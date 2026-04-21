const express = require("express");
const router = express.Router();
const {
  signup,
  signin,
  forgotPassword,
  verifyEmail,
  resendVerificationCode,
  getMe,
  getNotifications,
  markNotificationsRead,
} = require("../controllers/auth.controller");
const authMiddleware = require("../middleware/auth.middleware");

// Public routes (no token needed)
router.post("/signup", signup);
router.post("/signin", signin);
router.post("/forgot-password", forgotPassword);
router.post("/verify-email", verifyEmail);
router.post("/resend-verification-code", resendVerificationCode);

// Protected routes (token required)
// authMiddleware runs first, verifies the token, then getMe runs
router.get("/me", authMiddleware, getMe);
router.get("/notifications", authMiddleware, getNotifications);
router.put("/notifications/read-all", authMiddleware, markNotificationsRead);

module.exports = router;
