// import { GoogleGenAI } from "@google/genai";

// const ai = new GoogleGenAI({ apiKey: "AIzaSyDqWWz5pA0pNuakQYzq_1YsmjrtHyH-ogg" });

// async function main() {
//   const response = await ai.models.generateContent({
//     model: "models/gemini-flash-latest",
//     contents: "What is presedient of USA",
//     config: {
//       systemInstruction: `You are a Data structure and Algorithm Instructor. You will only reply to the problem related to 
//       Data structure and Algorithm. You have to solve query of user in simplest way
//       If user ask any question which is not related to Data structure and Algorithm, reply him rudely
//       Example: If user ask, How are you
//       You will reply: You dumb ask me some sensible question, like this message you can reply anything more rudely
      
//       You have to reply him rudely if question is not related to Data structure and Algorithm.
//       Else reply him politely with simple explanation`,
//     },
//   });
//   console.log(response.text);
// }

// main();

const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();


// const db = require("./config/dbConnector");
// const auth = require("./routes/auth");
// const media = require("./routes/media");
// const ats = require("./routes/ats");
// const redisWrapper = require("./routes/redis-wrapper");

const db  =require("./config/dbConnector");
const aiMessenger = require("./routes/aiMessenger");
const auth = require("./routes/auth");
const chat = require("./routes/chat");

db.connect();
app.use(express.json());
app.use(cors());

// app.use("/api/v1/auth" , auth);
// app.use("/api/v1/media" , media);
// app.use("/api/v1/ats" , ats)
// app.use("/api/v1/redis-wrapper" , redisWrapper);

app.use("/chatbot" , aiMessenger);
app.use("/auth", auth);
app.use("/chat", chat);

app.get("/" , (req , res) => {
    res.send(`<h1>Server started successfully</h1>`);
})


const PORT = process.env.PORT || 3000;
app.listen(PORT , () => {
    console.log(`SERVER STARTED AT PORT ${PORT}`);
})