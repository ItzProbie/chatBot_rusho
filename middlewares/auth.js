const jwt = require("jsonwebtoken");
require("dotenv").config();
const User = require("../models/User");

exports.auth = async(req,res,next) => {
    try{

        const token = req.body?.token   ||
                      (req.header("Authorization") && req.header("Authorization").replace("Bearer ", ""));
        
        if(!token){
            return res.status(401).json({
                success : false,
                mesage : "Auth Failed"
            });
        }

        try{
            
            const decode = jwt.verify(token , process.env.JWT_SECRET);
            req.user = decode;
            
        }catch(err){
            return res.status(401).json({
                success :false,
                message : "token is invalid"
            });
        }
        next();

    }catch(err){
        console.log(err);
        return res.status(401).json({
            success :false,
            message : "Something went wrong while validating the token, plz try again later",
            error : err.mesage
        });
    }
};