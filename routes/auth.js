const express = require("express");
const router = express.Router();

// const { signup , sendOtp , login } = require("../controllers/Auth");

// router.post("/signup" , signup);
// router.post("/login" , login);
// router.post("/sendOtp" , sendOtp);
// router.get("/sendOtp" , ((req , res) => {
//     res.send("Req received");
// }))

const { signup , login } = require("../controllers/auth")

router.post("/signup", signup);
router.post("/login", login)

module.exports = router;