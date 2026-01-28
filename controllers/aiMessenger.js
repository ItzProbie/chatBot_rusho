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

                Safety: If they express suicidal thoughts, prioritize safety—ask if they're safe now and encourage immediate professional help.

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
