const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config({ quiet: true });

const db  =require("./config/dbConnector");
const aiMessenger = require("./routes/aiMessenger");
const auth = require("./routes/auth");
const chat = require("./routes/chat");

db.connect();
app.use(express.json());
app.use(cors());

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