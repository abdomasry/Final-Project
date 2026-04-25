const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth.middleware");
const workerOnly = require("../middleware/worker.middleware");
const {
  getDashboard,
  updateProfile,
  getMyServices,
  addService,
  updateService,
  deleteService,
  getMyOrders,
  getWallet,
} = require("../controllers/worker-dashboard.controller");

// ============================================================
// Worker Dashboard Routes — all protected
// ============================================================
// Every route here uses TWO middlewares chained together:
//
//   authMiddleware → workerOnly → controller
//
// 1. authMiddleware checks the JWT token and attaches req.user
//    (returns 401 if no token or invalid token)
//
// 2. workerOnly checks req.user.role === "worker"
//    (returns 403 if the user is a customer or admin)
//
// 3. The controller function runs only if both checks pass
//
// This is the middleware chain pattern — Express runs them LEFT to RIGHT.
// If any middleware calls res.status().json() instead of next(),
// the chain STOPS and the response is sent immediately.
// ============================================================

// Dashboard overview — profile + stats + earnings
router.get("/dashboard", authMiddleware, workerOnly, getDashboard);
router.put("/profile", authMiddleware, workerOnly, updateProfile);

// Service management (CRUD)
router.get("/services", authMiddleware, workerOnly, getMyServices);
router.post("/services", authMiddleware, workerOnly, addService);
router.put("/services/:serviceId", authMiddleware, workerOnly, updateService);
router.delete("/services/:serviceId", authMiddleware, workerOnly, deleteService);

// Orders — see requests from customers
router.get("/orders", authMiddleware, workerOnly, getMyOrders);

// Wallet — balance + lifetime earnings + transaction history
router.get("/wallet", authMiddleware, workerOnly, getWallet);

module.exports = router;
