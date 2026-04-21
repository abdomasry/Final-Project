const Conversation = require("../Models/Conversation");
const LiveChat = require("../Models/LiveChat");
const User = require("../Models/User.Model");

// ============================================================
// Chat REST endpoints
// ============================================================
// Powers the initial page loads for the chat UI.
// Once a client has loaded a conversation, live updates flow through
// Socket.IO (see socket/chat.socket.js) — these REST endpoints are
// only for history and the find-or-create handshake.
// ============================================================

// GET /api/chat/conversations
// List the current user's conversations, newest-first. Each row has
// the other participant's public info + lastMessage + unreadCount.
// Used by the /messages inbox page and the ChatWidget collapsed view.
const listConversations = async (req, res) => {
  try {
    const userId = req.user._id;

    const conversations = await Conversation.find({ participants: userId })
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .populate("participants", "firstName lastName profileImage role")
      .lean();

    // Shape each row to what the UI needs: a single "otherUser" + my unread count.
    const rows = conversations.map(conv => {
      const other = conv.participants.find(p => String(p._id) !== String(userId));
      const unreadCount = (conv.unreadCounts && conv.unreadCounts[String(userId)]) || 0;
      return {
        _id: conv._id,
        otherUser: other || null,
        lastMessage: conv.lastMessage || "",
        lastMessageAt: conv.lastMessageAt || conv.updatedAt,
        unreadCount,
      };
    });

    res.json({ conversations: rows });
  } catch (err) {
    console.error("listConversations error:", err);
    res.status(500).json({ message: "Server error loading conversations" });
  }
};

// POST /api/chat/conversations  { userId }
// Find an existing 1:1 conversation with the target user, or create one.
// Idempotent — repeated calls return the same conversation.
const findOrCreateConversation = async (req, res) => {
  try {
    const me = req.user._id;
    const { userId: otherId } = req.body;

    if (!otherId) return res.status(400).json({ message: "userId is required" });
    if (String(otherId) === String(me)) {
      return res.status(400).json({ message: "Cannot chat with yourself" });
    }

    // Validate the target user actually exists — otherwise we could create
    // ghost conversations to random ObjectIds.
    const other = await User.findById(otherId).select("firstName lastName profileImage role");
    if (!other) return res.status(404).json({ message: "User not found" });

    // Find an existing 1:1 that has EXACTLY these two participants.
    // Using $all + $size guards against accidentally matching a future
    // group chat that happens to include both.
    let conversation = await Conversation.findOne({
      participants: { $all: [me, otherId], $size: 2 },
    });

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [me, otherId],
        lastMessage: "",
        lastMessageAt: new Date(),
        unreadCounts: {},
      });
    }

    // Return the same shape as listConversations rows for consistency.
    res.json({
      conversation: {
        _id: conversation._id,
        otherUser: other,
        lastMessage: conversation.lastMessage || "",
        lastMessageAt: conversation.lastMessageAt || conversation.updatedAt,
        unreadCount: (conversation.unreadCounts && conversation.unreadCounts.get?.(String(me))) || 0,
      },
    });
  } catch (err) {
    console.error("findOrCreateConversation error:", err);
    res.status(500).json({ message: "Server error creating conversation" });
  }
};

// GET /api/chat/conversations/:id/messages?before=<msgId>&limit=30
// Cursor-based pagination. Returns the newest `limit` messages before
// the given cursor (or the latest if no cursor). Chat is inherently
// "newest at bottom, scroll up for history" so cursor-before feels right.
const getMessages = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id: conversationId } = req.params;
    const { before, limit = 30 } = req.query;

    const conversation = await Conversation.findById(conversationId).select("participants");
    if (!conversation) return res.status(404).json({ message: "Conversation not found" });
    if (!conversation.participants.map(String).includes(String(userId))) {
      return res.status(403).json({ message: "Not a participant" });
    }

    const filter = { conversationId };
    if (before) filter._id = { $lt: before };

    // Sort desc to fetch latest-first; the frontend reverses for display.
    const messages = await LiveChat.find(filter)
      .sort({ _id: -1 })
      .limit(Math.min(parseInt(limit) || 30, 100))
      .lean();

    // Re-reverse so oldest-first in the response (easier to render with
    // `messages.map(...)` at the bottom of the thread).
    res.json({
      messages: messages.reverse(),
      hasMore: messages.length === (parseInt(limit) || 30),
    });
  } catch (err) {
    console.error("getMessages error:", err);
    res.status(500).json({ message: "Server error loading messages" });
  }
};

// GET /api/chat/unread-total
// Single integer — sum of all unread counts across conversations.
// Used by the Navbar to seed the chat icon badge on first page load
// (before the socket is connected and can push live updates).
const getUnreadTotal = async (req, res) => {
  try {
    const userId = String(req.user._id);
    const conversations = await Conversation.find({ participants: req.user._id }).lean();
    const total = conversations.reduce((sum, conv) => {
      const n = (conv.unreadCounts && conv.unreadCounts[userId]) || 0;
      return sum + n;
    }, 0);
    res.json({ total });
  } catch (err) {
    console.error("getUnreadTotal error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  listConversations,
  findOrCreateConversation,
  getMessages,
  getUnreadTotal,
};
