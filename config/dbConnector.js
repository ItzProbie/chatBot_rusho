const mongoose = require("mongoose");
require("dotenv").config();

exports.connect = () => {

    mongoose.connect(process.env.MONGODB_URL)
    .then(() => {
        console.log("DB connection successfull");
    })
    .catch((err) => {
        console.log(err);
        console.log("DB connection failed");
        process.exit(1);
    }) 

}