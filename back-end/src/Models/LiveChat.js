const mongoose = require('mongoose');

// LiveChat — one document per message sent inside a Conversation.
// `message` holds the text for text messages, OR the URL for image/file messages.
// For "file" and "image" type messages, we also store the original file name
// and size so the UI can render a download card with proper metadata
// instead of just a cryptic Cloudinary URL.
const liveChatSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    message: String,
    messageType: {
      type: String,
      enum: ["text", "image", "file"],
      default: "text",
    },
    // Original file name as chosen by the user ("contract.pdf"). Used so the
    // download link shows a friendly name instead of the Cloudinary public_id.
    fileName: String,
    // File size in bytes. Rendered as "2.3 MB" in the UI.
    fileSize: Number,
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("LiveChat", liveChatSchema);