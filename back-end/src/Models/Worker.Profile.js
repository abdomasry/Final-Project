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
  },
  { timestamps: true },
);

module.exports = mongoose.model("WorkerProfile", workerProfileSchema);
