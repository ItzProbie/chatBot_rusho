const User = require("../models/user");
const chatSession = require("../models/chatSession");

exports.getMySessions = async(req , res) => {

    try{

        const userId = req.user.id;

        const sessions = await chatSession.find({ userId }).select('sessionTitle');

        return res.status(200).json({
            success: true,
            sessions
        });

    }catch(err){
        console.log(err);
        return res.status(500).json({
            success : false,
            error : err.message,
            mssg : "Cant fetch sessions, plz try again later"
        });

    }

}

exports.getSession = async(req , res) => {

    try{

        const userId = req.user.id;
        const { sessionId } = req.params;

        const session = await chatSession.findOne({ _id: sessionId, userId }).select('-summary');

        if(!session){
            return res.status(404).json({
                success: false,
                message: "Session not found"
            });
        }

        return res.status(200).json({
            success: true,
            session
        });

    }catch(err){
        console.log(err);
        return res.status(500).json({
            success : false,
            error : err.message,
            mssg : "Cant fetch session, plz try again later"
        });

    }

}

exports.deleteSession = async(req , res) => {

    try{

        const userId = req.user.id;
        const { sessionId } = req.params;

        const session = await chatSession.findOneAndDelete({ _id: sessionId, userId });

        if(!session){
            return res.status(404).json({
                success: false,
                message: "Session not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Session deleted successfully"
        });

    }catch(err){
        console.log(err);
        return res.status(500).json({
            success : false,
            error : err.message,
            mssg : "Cant delete session, plz try again later"
        });

    }

}
