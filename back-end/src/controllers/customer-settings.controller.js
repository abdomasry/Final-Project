const PaymentMethod = require("../Models/PaymentMethod");
const User = require("../Models/User.Model");

// ============================================================
// GET /api/customer/payment-methods
// ============================================================
// Fetches all saved payment methods for the logged-in user.
//
// SORTING: { isDefault: -1, createdAt: -1 }
//   - isDefault: -1 → true (1) comes before false (0) in descending order,
//     so the default card always appears first in the list.
//   - createdAt: -1 → among non-default cards, newest first.
//
// WHY this order matters for the frontend:
//   The first card in the array is always the "primary" card.
//   The frontend can just display cards in the order received
//   without needing to sort them again.
// ============================================================
const getPaymentMethods = async (req, res) => {
  try {
    const paymentMethods = await PaymentMethod.find({
      userId: req.user._id,
    }).sort({ isDefault: -1, createdAt: -1 });

    res.json({ paymentMethods });
  } catch (error) {
    console.error("getPaymentMethods error:", error);
    res.status(500).json({ message: "Server error fetching payment methods" });
  }
};

// ============================================================
// POST /api/customer/payment-methods
// ============================================================
// Adds a new saved payment method.
//
// KEY CONCEPT — "First card = default" logic:
//   When a user adds their FIRST card, we automatically mark it
//   as the default. This is good UX because:
//     - The user doesn't have to take an extra step
//     - Every user with cards always has exactly one default
//     - If they add more cards later, the first stays default
//       until they explicitly change it
//
// We check this with countDocuments — if the count is 0, this
// is their first card, so we force isDefault to true.
// ============================================================
const addPaymentMethod = async (req, res) => {
  try {
    const { cardholderName, lastFourDigits, cardBrand, expiryMonth, expiryYear } = req.body;

    // --- Validation ---
    // We check required fields manually here for clear error messages.
    // The Mongoose schema also validates, but those errors are less readable.
    if (!cardholderName || !lastFourDigits || !cardBrand || !expiryMonth || !expiryYear) {
      return res.status(400).json({
        message: "All fields are required: cardholderName, lastFourDigits, cardBrand, expiryMonth, expiryYear",
      });
    }

    // Count existing cards to decide if this should be default.
    // countDocuments is fast — it doesn't load any documents into memory,
    // it just asks MongoDB "how many match this filter?".
    const existingCount = await PaymentMethod.countDocuments({
      userId: req.user._id,
    });

    // If this is the first card (existingCount === 0), make it default.
    const isDefault = existingCount === 0;

    // Create the payment method document in MongoDB.
    // Mongoose will run all schema validations (regex for lastFourDigits,
    // enum for cardBrand, min/max for expiryMonth, etc.).
    const paymentMethod = await PaymentMethod.create({
      userId: req.user._id,
      cardholderName,
      lastFourDigits,
      cardBrand,
      expiryMonth,
      expiryYear,
      isDefault,
    });

    res.status(201).json({ paymentMethod });
  } catch (error) {
    console.error("addPaymentMethod error:", error);
    res.status(500).json({ message: "Server error adding payment method" });
  }
};

// ============================================================
// DELETE /api/customer/payment-methods/:id
// ============================================================
// Deletes a saved payment method by its ID.
//
// SECURITY CONCEPT — Ownership check:
//   We filter by BOTH _id AND userId:
//     { _id: req.params.id, userId: req.user._id }
//
//   This ensures a user can only delete THEIR OWN cards.
//   Without the userId check, any authenticated user could
//   delete anyone's card by guessing the card's _id.
//   This is called an "Insecure Direct Object Reference" (IDOR)
//   vulnerability — one of the OWASP Top 10 security risks.
//
// EDGE CASE — Default card reassignment:
//   If the user deletes their default card, we need to pick
//   a new default. We find the first remaining card and make
//   it the default. This ensures there's always exactly one
//   default card (as long as the user has any cards at all).
// ============================================================
const deletePaymentMethod = async (req, res) => {
  try {
    // findOneAndDelete finds ONE document matching the filter and removes it.
    // It returns the deleted document (so we can check if it was the default).
    const deletedCard = await PaymentMethod.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id, // Ownership check — prevents IDOR attacks
    });

    // If no card was found, either:
    //   - The ID doesn't exist
    //   - The card belongs to someone else (userId didn't match)
    // Either way, we return 404.
    if (!deletedCard) {
      return res.status(404).json({ message: "Payment method not found" });
    }

    // If the deleted card WAS the default, promote another card.
    if (deletedCard.isDefault) {
      // findOne returns the first matching document.
      // Since we don't specify a sort, it returns the oldest card
      // (MongoDB's natural order). This is a reasonable choice.
      const nextCard = await PaymentMethod.findOne({ userId: req.user._id });

      // If there are remaining cards, make the first one default.
      // If nextCard is null (no cards left), we do nothing — the user
      // simply has no payment methods anymore.
      if (nextCard) {
        nextCard.isDefault = true;
        await nextCard.save();
      }
    }

    res.json({ message: "Payment method deleted" });
  } catch (error) {
    console.error("deletePaymentMethod error:", error);
    res.status(500).json({ message: "Server error deleting payment method" });
  }
};

// ============================================================
// PUT /api/customer/payment-methods/:id/default
// ============================================================
// Sets a specific payment method as the default.
//
// TWO-STEP PROCESS:
//   1. Unset ALL cards: updateMany sets isDefault: false on every
//      card owned by this user. This is a "reset all" approach.
//   2. Set the ONE card: findOneAndUpdate sets isDefault: true on
//      the specific card requested.
//
// WHY two steps instead of one?
//   If we only set the new card to true, the OLD default card
//   would still have isDefault: true — we'd have TWO defaults!
//   By resetting all first, we guarantee exactly one default.
//
// updateMany vs updateOne:
//   updateMany updates ALL matching documents (all user's cards).
//   updateOne only updates the first match. We need updateMany
//   because in theory there could be multiple defaults (data bug).
// ============================================================
const setDefaultPaymentMethod = async (req, res) => {
  try {
    // Step 1: Remove default from ALL user's cards
    await PaymentMethod.updateMany(
      { userId: req.user._id },
      { isDefault: false }
    );

    // Step 2: Set the requested card as default
    // { new: true } returns the UPDATED document, not the old one.
    const paymentMethod = await PaymentMethod.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id }, // Ownership check
      { isDefault: true },
      { new: true }
    );

    if (!paymentMethod) {
      return res.status(404).json({ message: "Payment method not found" });
    }

    res.json({ paymentMethod });
  } catch (error) {
    console.error("setDefaultPaymentMethod error:", error);
    res.status(500).json({ message: "Server error setting default payment method" });
  }
};

// ============================================================
// GET /api/customer/notifications/preferences
// ============================================================
// Returns the user's notification preferences.
//
// This is very simple because authMiddleware already loads the
// full User document into req.user. The notificationPreferences
// field is already there — we just return it.
//
// No database query needed! The middleware already did the work.
// ============================================================
const getNotificationPreferences = async (req, res) => {
  try {
    res.json({ preferences: req.user.notificationPreferences });
  } catch (error) {
    console.error("getNotificationPreferences error:", error);
    res.status(500).json({ message: "Server error fetching notification preferences" });
  }
};

// ============================================================
// PUT /api/customer/notifications/preferences
// ============================================================
// Updates the user's notification preferences.
//
// The frontend sends: { orders: true, messages: false, promotions: true }
// We update the entire notificationPreferences object at once.
//
// WHY we replace the whole object instead of merging:
//   If the frontend sends { orders: false }, should messages and
//   promotions stay the same or become undefined? To avoid ambiguity,
//   we require ALL three fields every time. The frontend should
//   always send the complete preferences object.
//
// findByIdAndUpdate with { new: true } returns the UPDATED user,
// so we can immediately return the new preferences in the response.
// ============================================================
const updateNotificationPreferences = async (req, res) => {
  try {
    const { orders, messages, promotions } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      {
        notificationPreferences: {
          orders,
          messages,
          promotions,
        },
      },
      { new: true } // Return the updated document
    );

    res.json({ preferences: updatedUser.notificationPreferences });
  } catch (error) {
    console.error("updateNotificationPreferences error:", error);
    res.status(500).json({ message: "Server error updating notification preferences" });
  }
};

module.exports = {
  getPaymentMethods,
  addPaymentMethod,
  deletePaymentMethod,
  setDefaultPaymentMethod,
  getNotificationPreferences,
  updateNotificationPreferences,
};
