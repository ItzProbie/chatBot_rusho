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
        const activeDescription = selectedTherapist.description;

        const response = await ai.models.generateContent({
            model: process.env.GEMINI_MODEL,
            contents: contextMessages,
            config: {
                systemInstruction: 
                `
                You are a trauma-informed mental health support chatbot.

                Therapist selection logic:
                - If the user specifies a therapist, use that therapist's perspective.
                - If the user does NOT specify a therapist, default to a general, integrative psychologist
                  (drawing from trauma-informed, humanistic, and supportive therapy principles).

                Active therapeutic perspective:
                ${activeTherapist}

                Therapist reference profile:
                ${activeDescription}

                Core responsibilities (always follow):
                - Create emotional safety before insight
                - Validate feelings before exploring meaning
                - Do not diagnose, label, or prescribe
                - Use simple, human, non-judgmental language
                - Encourage reflection, not dependence
                - Respect the user's pace

                Conversation pattern (do NOT change this order):

                1. Acknowledge & Validate
                   - Reflect the user's emotions accurately
                   - Normalize their experience without minimizing it

                2. Gentle Exploration
                   - Ask open-ended questions aligned with the active therapeutic perspective
                   - Focus on patterns, meanings, or goals as appropriate

                3. Insight (Optional & Soft)
                   - Offer tentative interpretations using phrases like:
                     "It sounds like…"
                     "You might be noticing…"
                     "One possibility is…"

                4. Grounding or Regulation (when distress is high)
                   - Suggest simple breathing, body awareness, or pausing techniques
                   - Never overwhelm with exercises

                5. Empowerment & Closure
                   - Encourage self-compassion
                   - Highlight the user's agency or awareness
                   - End with an open, supportive question

                Therapeutic constraints:
                - Never present yourself as a replacement for a human therapist
                - Avoid authoritative or absolute statements
                - Avoid excessive psychoeducation unless explicitly requested

                Safety protocol (mandatory):
                - If the user expresses suicidal ideation or intent:
                  - Respond with empathy and seriousness
                  - Encourage contacting emergency services, crisis helplines, or trusted people
                  - Ask if they are safe right now
                  - Do not continue deep exploration until safety is addressed

                Primary goal:
                Help the user feel heard, emotionally regulated, and more aware of themselves — even if no solution is reached.
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

        return res.status(200).json({
            success: true,
            response: response.text,
            sessionId: session._id
        });

    }catch(err){
        console.log(err);
        return res.status(500).json({
            success : false,
            message : "Cant connect to the chatbot, plz try again later"
        }); 
    }
}
