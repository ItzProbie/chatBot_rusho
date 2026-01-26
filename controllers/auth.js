const User = require("../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config({ quiet: true })

exports.signup = async(req , res) => {

    try{

        const {
            userName, password
        } = req.body;

        if(!userName || !password){
            return res.status(400).json({
                success : false,
                message : "Missing or incomplete fields"
            });
        }

        if(password.length < 5){
            return res.status(400).json({
                success : false,
                message : "Password length must be atleast 8 characters long"
            });
        }

        const existingUser = await User.findOne({userName});
        if(existingUser){
            return res.status(400).json({
                success : false,
                message : "Username already registered , please login or use a different userName"
            });
        }

        const hashedPassword = await bcrypt.hash(password , 10);

        const user = await User.create({
            userName ,
            password: hashedPassword 
        });

        return res.status(200).json({
            success : true
        });


    }catch(err){
        console.log(err);
        return res.status(500).json({
            success : false,
            error : err.message,
            mssg : "Cant signup, plz try again later"
        });

    }

}

exports.login = async(req, res) => {

    try{

        const {userName , password} = req.body;

        if(!userName || !password){
            return res.status(400).json({
                success : false,
                message : "Missing login credentials"
            });
        }

        const user = await User.findOne({userName});

        if(!user){
            return res.status(404).json({
                success : false,
                message : "User not found, please singup first"
            });
        }

        if(await bcrypt.compare(password , user.password)){

            const payload = {
                userName: user.userName,
                id: user._id
            };

            const token = jwt.sign(payload , process.env.JWT_SECRET , {
                expiresIn: process.env.JWT_TOKEN_EXPIRY
            });

            user.password = null;

            return res.status(200).json({
                success : true,
                token,
                user
            });

        }

        else{

            return res.status(403).json({
                success : false,
                message : "Password is incorrect"
            });

        }

    }catch(err){
        console.log(err);
        return res.status(500).json({
            success : false,
            error : err.message,
            mssg : "Cant login, plz try again later"
        });
    }

}