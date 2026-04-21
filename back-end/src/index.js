const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const connectDB = require("./config/db");
const cors = require("cors");
const authRoutes = require("./routes/auth.routes");
const categoryRoutes = require("./routes/category.routes");
const workerRoutes = require("./routes/worker.routes");
const customerRoutes = require("./routes/customer.routes");
const customerSettingsRoutes = require("./routes/customer-settings.routes");
const workerDashboardRoutes = require("./routes/worker-dashboard.routes");
const adminRoutes = require("./routes/admin.routes");
const searchRoutes = require("./routes/search.routes");
const couponRoutes = require("./routes/coupon.routes");
const chatRoutes = require("./routes/chat.routes");
const orderRoutes = require("./routes/order.routes");
const reviewRoutes = require("./routes/review.routes");
const supportRoutes = require("./routes/support.routes");
const attachChatSocket = require("./socket/chat.socket");
connectDB();

const app = express();
const NextPort = "http://localhost:3000";
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(
  cors({
    origin: NextPort || "http://localhost:3000",
  }),
);

app.get("/", (req, res) => {
    res.json({ message: "Server is running" });
});

app.use("/api/auth", authRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/workers", workerRoutes);
app.use("/api/customer", customerRoutes);
app.use("/api/customer", customerSettingsRoutes);
app.use("/api/worker", workerDashboardRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/chat", chatRoutes);
// Order endpoints live at /api/customer/orders and /api/worker/orders/:id/status.
// Mounted at /api so the router controls the full sub-paths itself.
app.use("/api", orderRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/support", supportRoutes);

// Create an explicit HTTP server so Socket.IO can attach to it.
// Using app.listen() directly would give Express its own server we can't share.
const server = http.createServer(app);

// Socket.IO needs its OWN cors block — Express's cors() middleware doesn't
// cover the WebSocket handshake. Missing this causes "xhr poll error" in the
// browser with no clear explanation.
const io = new Server(server, {
  cors: {
    origin: NextPort,
    credentials: true,
  },
});

// Expose `io` to REST controllers via app.set('io', io). Controllers read it
// with req.app.get('io') to emit 'notification:new' events when creating
// Notification docs (e.g. order.controller.js). Keeps socket-aware logic out
// of the routing table itself.
app.set("io", io);

// Attach all chat-related socket handlers (auth, presence, message events).
// Kept in a separate module to keep this entrypoint clean.
attachChatSocket(io);

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
