// ============================================================
// Customer Routes
// ============================================================
// This file defines the URL paths for customer profile operations
// and connects each path to its controller function.
//
// HOW THE MIDDLEWARE CHAIN WORKS:
//
// When a request hits GET /api/customer/profile, Express processes it
// through a chain like this:
//
//   Request → authMiddleware → getProfile → Response
//
// Step 1: The request arrives at the server.
// Step 2: authMiddleware runs FIRST. It:
//         - Extracts the JWT token from the Authorization header
//         - Verifies the token is valid and not expired
//         - Finds the user in the database
//         - Attaches the user to req.user
//         - Calls next() to pass control to the next function
//         - If anything fails, it returns 401 and the chain STOPS here.
// Step 3: The controller (getProfile/updateProfile/getOrders) runs.
//         It can safely use req.user because authMiddleware already
//         verified the user exists.
// Step 4: The controller sends a response back to the client.
//
// This is the "middleware pattern" — functions that run in sequence,
// each one deciding whether to continue (next()) or stop (res.json/status).
// It keeps auth logic separate from business logic (separation of concerns).
// ============================================================

const express = require("express");
const router = express.Router();
const {
  getProfile,
  updateProfile,
  getOrders,
  addAddress,
  updateAddress,
  deleteAddress,
  toggleFavoriteWorker,
} = require("../controllers/customer.controller");
const authMiddleware = require("../middleware/auth.middleware");

// All routes require authentication (authMiddleware runs first)
router.get("/profile", authMiddleware, getProfile);
router.put("/profile", authMiddleware, updateProfile);
router.get("/orders", authMiddleware, getOrders);

// Address management — operates on CustomerProfile.addresses
router.post("/addresses", authMiddleware, addAddress);
router.put("/addresses/:id", authMiddleware, updateAddress);
router.delete("/addresses/:id", authMiddleware, deleteAddress);

// Favorite workers — single toggle endpoint
router.post("/favorites/workers/:workerId", authMiddleware, toggleFavoriteWorker);

module.exports = router;
