const mongoose = require('mongoose');
const serviceRequestSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    workerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WorkerServices",
      required: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    },
    description: String,
    location: {
      address: String,
      lat: Number,
      lng: Number,
    },
    proposedPrice: Number,
    paymentMode: {
      type: String,
      enum: ["cash_on_delivery", "card"],
      default: "cash_on_delivery",
    },
    couponCode: {
      type: String,
      default: null,
    },
    discountAmount: {
      type: Number,
      default: 0,
    },
    rejectionReason: {
      type: String,
      default: null,
    },
    // Completion proof uploaded by the worker when flipping the order to
    // `completed`. Required for that specific transition (enforced in
    // order.controller.updateOrderStatusByWorker). Stored as an embedded
    // subdocument so the customer's profile page can show it inline without
    // extra joins — typical access pattern is "load my orders, render cards".
    completionReport: {
      details: { type: String, default: "" },
      images: [{ type: String }], // Cloudinary URLs (same pipeline as chat attachments)
      submittedAt: { type: Date },
    },
    // Cancellation request raised by the customer on an already-accepted
    // order. Lives embedded because there's exactly one "current" request
    // per order and the access pattern is always "load order → render the
    // cancel banner if status==='pending'". When the worker approves, the
    // parent `status` flips to 'cancelled'. When denied, the request stays
    // with status='denied' so the customer sees what happened.
    //
    // For orders that were cancelled DIRECTLY (pending orders never
    // accepted), we skip this subdoc entirely and just set status='cancelled'
    // + cancelledBy='customer'. The subdoc only appears when a worker review
    // is involved.
    cancellationRequest: {
      requestedBy: { type: String, enum: ["customer", "worker"] },
      reason: { type: String, default: "" },
      status: {
        type: String,
        enum: ["pending", "approved", "denied"],
      },
      requestedAt: { type: Date },
      respondedAt: { type: Date },
      denialReason: { type: String, default: "" },
    },
    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
    },
    status: {
      type: String,
      enum: [
        "pending",
        "accepted",
        "rejected",
        "in_progress",
        "completed",
        "cancelled",
      ],
      default: "pending",
    },
    scheduledDate: Date,
    completedAt: Date,
    cancelledBy: {
      type: String,
      enum: ["customer", "worker", "admin"],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ServiceRequest", serviceRequestSchema);