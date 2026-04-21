const mongoose = require('mongoose');

// Conversation — represents a 1-to-1 DM channel between two users.
// `participants` is always length 2 in v1 (no group chats yet, but the array
// shape leaves the door open).
//
// `unreadCounts` is a Map keyed by userId → number of messages the user
// hasn't read yet. Cheaper than scanning LiveChat every time the Navbar
// needs a badge count.
const conversationSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    // Optional link to a ServiceRequest — currently unused (chat is free-form
    // between customer and worker) but kept for future "chat tied to an order"
    // flows.
    serviceRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServiceRequest",
    },
    // Snapshot of the latest message so the inbox can render rows without
    // a second query per conversation. Denormalized on purpose.
    lastMessage: String,
    lastMessageAt: Date,
    // Per-participant unread count. Keys are userIds as strings.
    // Incremented when a message is sent to someone who isn't in the room;
    // reset to 0 when that user's client fires chat:read for this conv.
    unreadCounts: {
      type: Map,
      of: Number,
      default: {},
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Conversation", conversationSchema);
