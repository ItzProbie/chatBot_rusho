const express = require("express");
const router = express.Router();

const { chat } = require("../controllers/aiMessenger");
const { auth } = require("../middlewares/auth");

router.post("/chat", auth, chat);

module.exports = router;