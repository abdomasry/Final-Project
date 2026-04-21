const mongoose = require("mongoose");

// ============================================================
// WalletTransaction
// ============================================================
// One row per credit (or eventually debit) applied to a worker's wallet.
// Current usage:
//   - `source: "order_completion"` credits the worker's wallet with
//     the order's proposedPrice when the worker marks the order completed.
//
// Future usage (not implemented yet — withdrawal UI is a placeholder):
//   - `source: "withdrawal"` debit rows for when the worker requests a
//     payout to their card / bank.
//   - `source: "adjustment"` admin-driven corrections.
//
// Why a separate collection (vs. embedding transactions in WorkerProfile):
//   - Transactions are append-only and can grow without bound.
//   - We want efficient queries like "most recent N" and "by date range"
//     without loading the whole profile doc into memory.
//   - An embedded array would also fight Mongoose's document-size limits.
// ============================================================

const walletTransactionSchema = new mongoose.Schema(
  {
    // References User._id (same shape as ServiceRequest.workerId). Indexed
    // so the wallet view can page through a worker's history quickly.
    workerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["credit", "debit"],
      required: true,
    },
    // Stored as a positive integer (EGP). We NEVER store negative numbers —
    // `type` alone indicates direction. Keeps aggregations unambiguous.
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    source: {
      type: String,
      enum: ["order_completion", "withdrawal", "adjustment"],
      required: true,
    },
    relatedOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServiceRequest",
    },
    status: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "completed",
    },
    // Short human-readable description shown in the wallet UI. Example:
    // "دفعة مقابل: Full Clean".
    note: { type: String, default: "" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("WalletTransaction", walletTransactionSchema);
