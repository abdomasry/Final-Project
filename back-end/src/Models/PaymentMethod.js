const mongoose = require("mongoose");

// ============================================================
// PaymentMethod Model
// ============================================================
// Stores saved payment methods for customers.
//
// CRITICAL SECURITY CONCEPT — Never store full card numbers!
// Payment Card Industry (PCI) compliance rules forbid storing
// full credit card numbers in your database. If your database
// gets hacked, attackers would have everyone's card numbers.
//
// Instead, we only store the LAST 4 DIGITS (e.g., "4242").
// This is enough for the user to identify which card is which
// ("Oh, that's my Visa ending in 4242") but useless to a hacker.
//
// In a real production app, a payment processor like Stripe or
// Paymob handles the actual card data. You'd store a "token"
// from Stripe, not the card number at all. But for learning
// purposes, we store the last 4 digits to simulate the concept.
// ============================================================

const paymentMethodSchema = new mongoose.Schema(
  {
    // Which user owns this payment method.
    // ref: "User" lets us use .populate() later to get user details.
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // The name printed on the card (e.g., "ABDULLAH MOHAMED").
    cardholderName: {
      type: String,
      required: [true, "Cardholder name is required"],
      trim: true, // Remove leading/trailing spaces
    },

    // Only the last 4 digits of the card number.
    // We use `match` with a regex to enforce EXACTLY 4 digits:
    //
    //   /^\d{4}$/
    //    ^       → start of string
    //    \d{4}   → exactly 4 digits (0-9)
    //    $       → end of string
    //
    // So "4242" passes, but "42", "42424", or "abcd" all fail.
    // This prevents anyone from accidentally storing a full card number.
    lastFourDigits: {
      type: String,
      required: [true, "Last four digits are required"],
      match: [/^\d{4}$/, "Must be exactly 4 digits"],
    },

    // The card network/brand. We limit it to 3 options with `enum`.
    // "visa" and "mastercard" are international; "meza" is Egypt's
    // national payment network (ميزة).
    cardBrand: {
      type: String,
      enum: ["visa", "mastercard", "meza"],
      default: "visa",
    },

    // Expiry month (1-12). min/max enforce the valid range.
    expiryMonth: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },

    // Expiry year (e.g., 2027). No max because years keep increasing.
    expiryYear: {
      type: Number,
      required: true,
    },

    // Whether this is the user's default/primary payment method.
    // Only ONE card should be default at a time — we handle that
    // logic in the controller (not in the schema).
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  // timestamps: true automatically adds createdAt and updatedAt fields.
  { timestamps: true }
);

module.exports = mongoose.model("PaymentMethod", paymentMethodSchema);
