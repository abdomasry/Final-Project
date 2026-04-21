const mongoose = require("mongoose");

// ============================================================
// SupportTicket (legacy model name "Ticket")
// ============================================================
// One row per support ticket raised by a customer or worker. Threaded
// replies live embedded on the document — bounded per ticket and always
// loaded together with the ticket itself, same pattern used by
// ServiceRequest.completionReport + ServiceRequest.cancellationRequest.
//
// The original schema was `{ type: [reports|feedback], customerId → CustomerProfile }`
// and was orphaned (no controllers/routes/UI). This rewrite keeps the model
// name "Ticket" (no migration), but the field set is new:
//   - userId refs User so both customers AND workers can file tickets
//   - type has 5 categories including payment_issue
//   - targetUserId/targetServiceId/targetOrderId provide optional context
//   - attachments consolidates the old files[] + images[] with metadata
//   - replies is the admin ↔ user thread
//   - lastActivityAt indexed so admin list can sort by freshest-first
// ============================================================

const replySchema = new mongoose.Schema(
  {
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Stored on the reply itself (not derived on read) so we don't need
    // to re-populate the author just to know which bubble colour to render.
    authorRole: {
      type: String,
      enum: ["customer", "worker", "admin"],
      required: true,
    },
    message: { type: String, required: true },
    attachments: [
      {
        url: String,
        kind: { type: String, enum: ["image", "file"] },
        fileName: String,
        fileSize: Number,
      },
    ],
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

const ticketSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        "service_issue",
        "user_report",
        "technical",
        "payment_issue",
        "other",
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
      maxlength: 150,
    },
    message: {
      type: String,
      required: true,
      maxlength: 2000,
    },
    status: {
      type: String,
      enum: ["open", "in_progress", "resolved", "closed"],
      default: "open",
    },
    // Optional context references. All three are nullable — "technical" and
    // "other" tickets leave them empty.
    targetUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    targetServiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WorkerServices",
    },
    targetOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServiceRequest",
    },
    attachments: [
      {
        url: String,
        kind: { type: String, enum: ["image", "file"] },
        fileName: String,
        fileSize: Number,
      },
    ],
    replies: [replySchema],
    // Used by the admin list to sort "freshest first" (new tickets + tickets
    // with new replies bubble to the top). Indexed because it's the default
    // sort key for admin list queries.
    lastActivityAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Ticket", ticketSchema);
