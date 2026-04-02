const mongoose = require("mongoose");

const ticketSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["reports", "feedback"],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["open", "in_progress", "resolved", "closed"],
      default: "open",
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CustomerProfile",
    },
    files: {
      type: [String],
    },
    images: {
      type: [String],
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Ticket", ticketSchema);
