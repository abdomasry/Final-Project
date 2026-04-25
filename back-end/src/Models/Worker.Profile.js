const mongoose = require("mongoose");

const workerProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    Category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    },
    serviceCategories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
    ],
    title: {
      type: String,
      trim: true,
    },
    priceRange: {
      min: Number,
      max: Number,
    },
    availability: [
      {
        day: String,
        from: String,
        to: String,
      },
    ],
    skills: [String],
    portfolio: [
      {
        title: String,
        description: String,
        images: [String],
        completedAt: Date,
      },
    ],
    packages: [
      {
        title: String,
        description: String,
        price: Number,
        features: [String],
      },
    ],
    license: {
      name: String,
      number: String,
      fileUrl: String,
      status: {
        type: String,
        enum: ["not_submitted", "pending", "approved", "rejected"],
        default: "not_submitted",
      },
      rejectionReason: {
        type: String,
        default: "",
      },
      submittedAt: Date,
      reviewedAt: Date,
    },
    documents: [
      {
        type: {
          type: String,
          enum: ["id_card", "certificate", "license", "other"],
        },
        name: String,
        fileUrl: String,
        status: {
          type: String,
          enum: ["pending", "approved", "rejected"],
          default: "pending",
        },
      },
    ],
    verificationStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    ratingAverage: {
      type: Number,
      default: 0,
    },
    totalReviews: {
      type: Number,
      default: 0,
    },
    location: String,
    typeOfWorker: {
      type: String,
      enum: ["individual", "company"],
    },
    services: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "WorkerServices",
    }],
    reports: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Reports",
    }],
    adminChat: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ticket",
    }],
    liveChat: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "LiveChat",
    }],
    // ─── Wallet ──────────────────────────────────────────────────
    // In-app wallet credited when the worker marks an order as completed.
    // `walletBalance` is what the worker can currently withdraw.
    // `lifetimeEarnings` is the cumulative all-time credit (never decreases)
    // — used for the "Total Earnings" stat card.
    // `lifetimeWithdrawn` will track how much has moved out once the
    // withdrawal flow is real. For now it stays at 0 because withdrawals are
    // a UI-only placeholder.
    walletBalance: { type: Number, default: 0 },
    lifetimeEarnings: { type: Number, default: 0 },
    lifetimeWithdrawn: { type: Number, default: 0 },
  },
  { timestamps: true },
);

module.exports = mongoose.model("WorkerProfile", workerProfileSchema);
