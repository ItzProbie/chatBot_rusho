const ai = require("../config/aiConnector");
const ChatSession = require("../models/chatSession");
const therapists = require("../config/therapists");
require("dotenv").config({ quiet: true });

module.exports.chat = async(req, res) => {
    
    try {
        const { mssg, sessionId, therapistIndex } = req.body;
        const userId = req.user.id;
        const userName = req.user.userName;

        // Find or create session
        let session = sessionId 
            ? await ChatSession.findById(sessionId).select('userId userName summary sessionTitle messages therapistIndex')
            : null;
        if (!session) {
            session = new ChatSession({ 
                userId,
                userName, 
                messages: [],
                sessionTitle: mssg.substring(0, 25),
                therapistIndex: therapistIndex || 0
            });
        } else if (session.therapistIndex !== therapistIndex) {
            session.therapistIndex = therapistIndex;
        }

        // Build context: summary + last 10 messages + new message
        let contextMessages = [];
        if (session.summary) {
            contextMessages.push({ role: "user", parts: [{ text: `${session.summary}` }] });
        }
        const recentMessages = session.messages.slice(-10);
        recentMessages.forEach(msg => {
            const role = msg.role === 'ai' ? 'model' : 'user';
            contextMessages.push({ role, parts: [{ text: msg.content }] });
        });
        contextMessages.push({ role: "user", parts: [{ text: mssg }] });

        const selectedTherapist =
            Number.isInteger(therapistIndex) && therapists[therapistIndex]
                ? therapists[therapistIndex]
                : therapists[0]; // default: General Psychologist

        const activeTherapist = selectedTherapist.name;

        const response = await ai.models.generateContent({
            model: process.env.GEMINI_MODEL,
            contents: contextMessages,
            config: {
                systemInstruction: 
                `
                You are a compassionate mental health support chatbot. Active therapeutic perspective: ${activeTherapist}

                Use your full knowledge of ${activeTherapist}'s approach and methods to guide the conversation.

                Follow this natural flow (adapt based on the conversation):

                1. CALM FIRST
                - Ground and stabilize their emotions before anything else
                - Warm, present tone: "Let's take this one step at a time"

                2. UNDERSTAND
                - Ask gentle questions to learn what's happening
                - Listen and reflect back what you hear
                - Validate without rushing to solutions

                3. EXPLAIN SIMPLY
                - Help them understand their experience through the ${activeTherapist} lens
                - Use everyday language, keep it brief
                - Normalize: "This makes sense because..."

                4. OFFER PRACTICAL HELP
                - Suggest 1-2 simple techniques (grounding, breathing, etc.)
                - Explain why it helps
                - Make it optional: "Would you like to try..."

                Be conversational and interactive. Ask questions. Match their pace. One idea at a time—never overwhelm.

                CRITICAL SAFETY PROTOCOL:
                If the user expresses suicidal thoughts, self-harm intentions, or severe crisis:
                1. Prioritize their immediate safety
                2. Ask if they are safe right now
                3. Provide your response as normal
                4. At the VERY END of your response, add a clearly separated helpline section with relevant Indian mental health crisis helplines (research and provide accurate, current helpline numbers)

                Format:
                ---
                **🆘 IMMEDIATE HELP AVAILABLE**

                If you're in crisis, please reach out immediately:
                [List 3-5 major Indian crisis helplines with numbers and availability]

                You are not alone. These trained professionals are here to help you right now.
                ---

                You're here to help them feel calmer, understood, and equipped with a small next step.
                `,
            },
        });

        // Store messages
        session.messages.push({ role: "user", content: mssg });
        session.messages.push({ role: "ai", content: response.text });

        // If more than 10 messages, create summary
        if (session.messages.length > 10) {
            const oldMessages = session.messages.slice(0, -10);
            const summaryPrompt = session.summary 
                ? `Previous summary: ${session.summary}\n\nNew messages:\n${oldMessages.map(m => `${m.role}: ${m.content}`).join('\n')}\n\nCreate updated summary:`
                : `Summarize this conversation concisely:\n${oldMessages.map(m => `${m.role}: ${m.content}`).join('\n')}`;
            
            const summaryResponse = await ai.models.generateContent({
                model: process.env.GEMINI_MODEL,
                contents: [{ role: "user", parts: [{ text: summaryPrompt }] }]
            });
            
            session.summary = summaryResponse.text;
        }

        await session.save();

        const crisisDetected = response.text.includes('IMMEDIATE HELP AVAILABLE') || response.text.includes('🆘');

        return res.status(200).json({
            success: true,
            response: response.text,
            sessionId: session._id,
            crisisDetected
        });

    }catch(err){
        
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
            success : false,
            message : "Cant connect to the chatbot, plz try again later"
        }); 
    }
}
