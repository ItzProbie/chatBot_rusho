const express = require("express");
const router = express.Router();

const { getMySessions , getSession , deleteSession } = require("../controllers/chat");
const { auth } = require("../middlewares/auth");

router.get("/get-my-sessions", auth, getMySessions);
router.get("/get-session/:sessionId", auth, getSession);
router.delete("/delete-session/:sessionId", auth, deleteSession);

module.exports = router;