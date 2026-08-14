const express = require("express");
const router = express.Router();
const { signup, approveUser, login, getPendingUsers } = require("../controllers/authController");
const protect = require("../middleware/authMiddleware");
router.post("/signup", signup);
router.patch("/approve/:userId", approveUser);
router.post("/login", login);
router.get("/pending", protect("admin"), getPendingUsers);
module.exports = router;