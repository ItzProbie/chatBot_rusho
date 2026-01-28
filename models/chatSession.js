const mongoose = require("mongoose");

const chatSessionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    userName: {
        type: String,
        required: true
    },
    sessionTitle: {
        type: String,
        default: ""
    },
    messages: [{
        role: { type: String, enum: ["user", "ai"], required: true },
        content: { type: String, required: true }
    }],
    summary: {
        type: String,
        default: ""
    },
    therapistIndex: {
        type: Number,
        required: true,
        default: 0
    }
}, { timestamps: true });

module.exports = mongoose.model("ChatSession", chatSessionSchema);
