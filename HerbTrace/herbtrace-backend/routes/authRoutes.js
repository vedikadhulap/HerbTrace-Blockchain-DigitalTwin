const express = require("express");
const router  = express.Router();
const protect = require("../middleware/authMiddleware");
const {
  signup, login, approveUser, getPendingUsers,
  getUsers, revokeUser, getMe, getMyBatches,
} = require("../controllers/authController");

// Public
router.post("/signup", signup);
router.post("/login",  login);

// Admin only
router.get("/pending",              protect("admin"), getPendingUsers);
router.get("/users",                protect("admin"), getUsers);        // ?status=approved|rejected
router.patch("/approve/:userId",    protect("admin"), approveUser);
router.patch("/revoke/:userId",     protect("admin"), revokeUser);

// Any authenticated user
router.get("/me",         protect(), getMe);
router.get("/my-batches", protect(), getMyBatches);

module.exports = router;