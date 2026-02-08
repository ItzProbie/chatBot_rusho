const ai = require("../config/aiConnector");
const ChatSession = require("../models/chatSession");
require("dotenv").config({ quiet: true });

module.exports.getMoodAnalysisByDateRange = async(req, res) => {
    try {
        const userId = req.user.id;
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: "Start date and end date are required"
            });
        }

        const sessions = await ChatSession.find({
            userId,
            createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) }
        });

        for (let session of sessions) {
            const needsAnalysis = !session.moodAnalysis || 
                                  !session.moodAnalysis.anxiety || 
                                  session.messages.length !== session.lastMoodAnalysisMessageCount;
            
            if (needsAnalysis) {
                if (session.summary) {
                    const analysisPrompt = `Analyze this therapy session summary and rate the following on a scale of 0-10:
- Anxiety level
- Stress level
- Depression level
- Overall mental wellbeing (10 being best)

Session summary: ${session.summary}

Respond ONLY with a JSON object in this exact format:
{"anxiety": <number>, "stress": <number>, "depression": <number>, "overall": <number>}`;

                    const response = await ai.models.generateContent({
                        model: process.env.GEMINI_MODEL,
                        contents: [{ role: "user", parts: [{ text: analysisPrompt }] }]
                    });

                    const jsonMatch = response.text.match(/\{[^}]+\}/);
                    if (jsonMatch) {
                        const analysis = JSON.parse(jsonMatch[0]);
                        session.moodAnalysis = analysis;
                        session.lastMoodAnalysisMessageCount = session.messages.length;
                        await session.save();
                    }
                } else {
                    const last5Messages = session.messages.slice(-5).map(m => `${m.role}: ${m.content}`).join('\n');
                    
                    const analysisPrompt = `Analyze this therapy session and rate the following on a scale of 0-10:
- Anxiety level
- Stress level
- Depression level
- Overall mental wellbeing (10 being best)

Last messages:\n${last5Messages}

Respond ONLY with a JSON object in this exact format:
{"anxiety": <number>, "stress": <number>, "depression": <number>, "overall": <number>}`;

                    const response = await ai.models.generateContent({
                        model: process.env.GEMINI_MODEL,
                        contents: [{ role: "user", parts: [{ text: analysisPrompt }] }]
                    });

                    const jsonMatch = response.text.match(/\{[^}]+\}/);
                    if (jsonMatch) {
                        const analysis = JSON.parse(jsonMatch[0]);
                        session.moodAnalysis = analysis;
                        session.lastMoodAnalysisMessageCount = session.messages.length;
                        await session.save();
                    }
                }
            }
        }

        const validSessions = sessions.filter(s => s.moodAnalysis && s.moodAnalysis.anxiety);
        
        const avgMood = validSessions.length > 0 ? {
            anxiety: validSessions.reduce((sum, s) => sum + s.moodAnalysis.anxiety, 0) / validSessions.length,
            stress: validSessions.reduce((sum, s) => sum + s.moodAnalysis.stress, 0) / validSessions.length,
            depression: validSessions.reduce((sum, s) => sum + s.moodAnalysis.depression, 0) / validSessions.length,
            overall: validSessions.reduce((sum, s) => sum + s.moodAnalysis.overall, 0) / validSessions.length
        } : null;

        return res.status(200).json({
            success: true,
            averageMood: avgMood,
            totalSessions: sessions.length,
            sessionsData: validSessions.map(s => ({
                date: s.createdAt,
                anxiety: s.moodAnalysis.anxiety,
                stress: s.moodAnalysis.stress,
                depression: s.moodAnalysis.depression,
                overall: s.moodAnalysis.overall
            }))
        });

    } catch(err) {
        
        const status = err.status || err.response?.status || err.statusCode;
        
        if (status === 429) {
            console.log("API quota reached")
            return res.status(429).json({
                success: false,
                message: "API quota exceeded. Please try again later."
            });
        }
        
        console.log(err);

        return res.status(500).json({
            success: false,
            message: "Failed to analyze mood"
        });
    }
}

module.exports.getMoodAnalysisBySessionIds = async(req, res) => {
    try {
        const userId = req.user.id;
        const { sessionIds } = req.body;

        if (!sessionIds || !Array.isArray(sessionIds) || sessionIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Array of sessionIds is required"
            });
        }

        const sessions = await ChatSession.find({
            _id: { $in: sessionIds },
            userId
        });

        if (sessions.length !== sessionIds.length) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized access to one or more sessions"
            });
        }

        console.log(`Found ${sessions.length} sessions for analysis`);

        const sessionsToAnalyze = sessions.filter(s => {
            const needsAnalysis = !s.moodAnalysis || 
                                  !s.moodAnalysis.anxiety || 
                                  s.messages.length !== s.lastMoodAnalysisMessageCount;
            return needsAnalysis;
        });

        if (sessionsToAnalyze.length === 0) {
            return res.status(200).json({
                success: true,
                message: "All sessions already have up-to-date mood analysis"
            });
        }

        const sessionsData = sessionsToAnalyze.map((s, idx) => {
            const content = s.summary || s.messages.slice(-5).map(m => `${m.role}: ${m.content}`).join('\n');
            return `Session ${idx + 1}:\n${content}`;
        }).join('\n\n---\n\n');

        const analysisPrompt = `Analyze these ${sessionsToAnalyze.length} therapy sessions and rate each on a scale of 0-10:
- Anxiety level
- Stress level
- Depression level
- Overall mental wellbeing (10 being best)

${sessionsData}

Respond ONLY with a JSON array in this exact format:
[{"anxiety": <number>, "stress": <number>, "depression": <number>, "overall": <number>}, ...]`;

        console.log('Sending batch prompt to Gemini API...');
        const response = await ai.models.generateContent({
            model: process.env.GEMINI_MODEL,
            contents: [{ role: "user", parts: [{ text: analysisPrompt }] }]
        });

        console.log('Gemini API Response:', response.text);

        const jsonMatch = response.text.match(/\[[^\]]+\]/);
        if (jsonMatch) {
            const analyses = JSON.parse(jsonMatch[0]);
            console.log('Parsed analyses:', analyses);
            
            for (let i = 0; i < sessionsToAnalyze.length && i < analyses.length; i++) {
                sessionsToAnalyze[i].moodAnalysis = analyses[i];
                sessionsToAnalyze[i].lastMoodAnalysisMessageCount = sessionsToAnalyze[i].messages.length;
                await sessionsToAnalyze[i].save();
            }

            return res.status(200).json({
                success: true,
                message: `Mood analysis completed for ${sessionsToAnalyze.length} session(s)`
            });
        }

        return res.status(200).json({
            success: true,
            message: "Analysis completed but failed to parse results"
        });

    } catch(err) {
        
        const status = err.status || err.response?.status || err.statusCode;
        
        if (status === 429) {
            console.log("API quota reached");
            return res.status(429).json({
                success: false,
                message: "API quota exceeded. Please try again later."
            });
        }
        
        console.log(err);
        
        return res.status(500).json({
            success: false,
            message: "Failed to analyze mood"
        });
    }
}

module.exports.getMoodAnalysis = async(req, res) => {
    try {
        const userId = req.user.id;

        const sessions = await ChatSession.find({ userId }).select('summary moodAnalysis messages lastMoodAnalysisMessageCount');

        const sessionsToAnalyze = [];
        
        for (let session of sessions) {
            const needsAnalysis = !session.moodAnalysis || 
                                  !session.moodAnalysis.anxiety || 
                                  session.messages.length !== session.lastMoodAnalysisMessageCount;
            
            if (needsAnalysis) {
                sessionsToAnalyze.push(session);
            }
        }

        if (sessionsToAnalyze.length > 0) {
            console.log(`Analyzing ${sessionsToAnalyze.length} sessions...`);
            
            for (let session of sessionsToAnalyze) {
                if (session.summary) {
                    const analysisPrompt = `Analyze this therapy session summary and rate the following on a scale of 0-10:
- Anxiety level
- Stress level
- Depression level
- Overall mental wellbeing (10 being best)

Session summary: ${session.summary}

Respond ONLY with a JSON object in this exact format:
{"anxiety": <number>, "stress": <number>, "depression": <number>, "overall": <number>}`;

                    console.log('Sending prompt to Gemini API...');
                    const response = await ai.models.generateContent({
                        model: process.env.GEMINI_MODEL,
                        contents: [{ role: "user", parts: [{ text: analysisPrompt }] }]
                    });

                    console.log('Gemini API Response:', response.text);

                    const jsonMatch = response.text.match(/\{[^}]+\}/);
                    if (jsonMatch) {
                        const analysis = JSON.parse(jsonMatch[0]);
                        console.log('Parsed analysis:', analysis);
                        session.moodAnalysis = analysis;
                        session.lastMoodAnalysisMessageCount = session.messages.length;
                        await session.save();
                    }
                }
            }
        }

        const allSessions = await ChatSession.find({ userId }).select('sessionTitle moodAnalysis createdAt');

        return res.status(200).json({
            success: true,
            sessions: allSessions
        });

    } catch(err) {
        
        const status = err.status || err.response?.status || err.statusCode;
        
        if (status === 429) {
            console.log("API quota reached");
            return res.status(429).json({
                success: false,
                message: "API quota exceeded. Please try again later."
            });
        }
        
        console.log(err);
        
        return res.status(500).json({
            success: false,
            message: "Failed to get mood analysis"
        });
    }
}
