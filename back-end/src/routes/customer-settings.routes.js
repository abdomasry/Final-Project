const express = require("express");
const router = express.Router();

// Import all 6 controller functions
const {
  getPaymentMethods,
  addPaymentMethod,
  deletePaymentMethod,
  setDefaultPaymentMethod,
  getNotificationPreferences,
  updateNotificationPreferences,
} = require("../controllers/customer-settings.controller");

// Import the auth middleware — every route here requires login
const authMiddleware = require("../middleware/auth.middleware");

// ============================================================
// Payment Methods Routes
// ============================================================
// These follow RESTful conventions:
//   GET    /payment-methods        → list all cards
//   POST   /payment-methods        → add a new card
//   DELETE /payment-methods/:id    → remove a specific card
//   PUT    /payment-methods/:id/default → set a card as default
//
// Notice /:id routes — Express captures whatever is in that URL
// position and puts it in req.params.id. For example:
//   DELETE /payment-methods/abc123  → req.params.id = "abc123"
//
// All routes use authMiddleware, which:
//   1. Checks for a valid JWT token in the request headers
//   2. Loads the full User document into req.user
//   3. Calls next() to pass control to the controller function
//   If no valid token: responds with 401 and stops the chain.
// ============================================================
router.get("/payment-methods", authMiddleware, getPaymentMethods);
router.post("/payment-methods", authMiddleware, addPaymentMethod);
router.delete("/payment-methods/:id", authMiddleware, deletePaymentMethod);
router.put("/payment-methods/:id/default", authMiddleware, setDefaultPaymentMethod);

// ============================================================
// Notification Preferences Routes
// ============================================================
// GET  → fetch current preferences
// PUT  → update preferences (replace all 3 toggles at once)
//
// We use PUT (not PATCH) because we replace the entire
// notificationPreferences object, not just one field within it.
// ============================================================
router.get("/notifications/preferences", authMiddleware, getNotificationPreferences);
router.put("/notifications/preferences", authMiddleware, updateNotificationPreferences);

module.exports = router;
