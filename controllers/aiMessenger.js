const ai = require("../config/aiConnector");
const ChatSession = require("../models/chatSession");
require("dotenv").config();

module.exports.chat = async(req, res) => {
    
    try {
        const { mssg, sessionId } = req.body;
        const userId = req.user.id;
        const userName = req.user.userName;

        // Find or create session
        let session = sessionId 
            ? await ChatSession.findById(sessionId).select('userId userName summary sessionTitle messages')
            : null;
        if (!session) {
            session = new ChatSession({ 
                userId,
                userName, 
                messages: [],
                sessionTitle: mssg.substring(0, 25)
            });
        }

        // Build context: summary + last 10 messages + new message
        let contextMessages = [];
        if (session.summary) {
            contextMessages.push({ role: "user", parts: [{ text: `${session.summary}` }] });
        }
        const recentMessages = session.messages.slice(-10);
        recentMessages.forEach(msg => {
            contextMessages.push({ role: msg.role, parts: [{ text: msg.content }] });
        });
        contextMessages.push({ role: "user", parts: [{ text: mssg }] });

        const response = await ai.models.generateContent({
            model: process.env.GEMINI_MODEL,
            contents: contextMessages,
            config: {
                systemInstruction: `You are a Data structure and Algorithm Instructor. You will only reply to the problem related to 
            Data structure and Algorithm. You have to solve query of user in simplest way
            If user ask any question which is not related to Data structure and Algorithm, reply him rudely
            Example: If user ask, How are you
            You will reply: You dumb ask me some sensible question, like this message you can reply anything more rudely
            
            You have to reply him rudely if question is not related to Data structure and Algorithm.
            Else reply him politely with simple explanation`,
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
