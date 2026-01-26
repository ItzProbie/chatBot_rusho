const express = require("express");
const router = express.Router();

// const { upload, download } = require("../controllers/Media");
// const { auth } = require("../middlewares/Auth");
// const { s3UploadLimitMid } = require("../controllers/Redis-Wrapper");

// router.get("/upload" , s3UploadLimitMid , auth , upload);
// router.get("/download" , auth , download);

const { chat } = require("../controllers/aiMessenger");
const { auth } = require("../middlewares/auth");

router.get("/chat", auth, chat);

module.exports = router;