const express = require("express");
const router = express.Router();
const { getMoodAnalysis, getMoodAnalysisByDateRange, getMoodAnalysisBySessionIds } = require("../controllers/moodAnalysis");
const { auth } = require("../middlewares/auth");

router.get("/date-range", auth, getMoodAnalysisByDateRange);
router.patch("/by-sessions", auth, getMoodAnalysisBySessionIds);

module.exports = router;
