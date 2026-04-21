// ============================================================
// Review Controller
// ============================================================
// Handles customer-submitted reviews on completed orders.
//
// Business rules enforced here (not in the model) because they span
// multiple collections:
//   1. Only the customer on the order can review it.
//   2. Only orders with status === "completed" can be reviewed — you can't
//      rate a worker for a service they haven't delivered yet.
//   3. One review per order. Re-submissions are 409 with an Arabic message
//      so the UI can disable the button.
//   4. Creating a review updates the WorkerProfile's ratingAverage and
//      totalReviews atomically, so the worker card on /services reflects
//      the new average without a manual recompute pass.
//
// The public GET /api/workers/:id/reviews endpoint (worker.controller) is
// already wired — we only add the POST side here.
// ============================================================

const Review = require("../Models/Review");
const ServiceRequest = require("../Models/Service.Request");
const WorkerProfile = require("../Models/Worker.Profile");
const Notification = require("../Models/Notification");

// Helper: emit notification:new over Socket.IO to a specific user. Same
// pattern as order.controller — kept local to avoid a shared util file
// (the whole socket-emit logic is ~6 lines).
const emitNotification = (req, userId, notification) => {
  try {
    const io = req.app.get("io");
    if (!io) return;
    io.to(`user:${String(userId)}`).emit("notification:new", notification);
  } catch (err) {
    console.error("emitNotification error:", err);
  }
};

// ============================================================
// POST /api/reviews
// ============================================================
// Body: { serviceRequestId, rating, comment? }
// Creates a review + updates the worker's rating stats + notifies the worker.
// ============================================================
const createReview = async (req, res) => {
  try {
    const { serviceRequestId, rating, comment } = req.body || {};

    if (!serviceRequestId) {
      return res.status(400).json({ message: "يرجى تحديد الطلب" });
    }
    const ratingNum = Number(rating);
    if (!ratingNum || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ message: "التقييم يجب أن يكون بين 1 و 5" });
    }

    const order = await ServiceRequest.findById(serviceRequestId);
    if (!order) return res.status(404).json({ message: "الطلب غير موجود" });

    // Ownership — only the customer on the order can review it.
    if (String(order.customerId) !== String(req.user._id)) {
      return res.status(403).json({ message: "غير مصرح" });
    }
    // Status gate — the worker has to have actually delivered the service.
    if (order.status !== "completed") {
      return res.status(400).json({ message: "يمكن تقييم الطلبات المكتملة فقط" });
    }
    if (!order.workerId) {
      return res.status(400).json({ message: "لا يوجد حرفي مرتبط بهذا الطلب" });
    }

    // Dedupe — one review per order. 409 is the right semantic signal
    // ("conflict with an existing resource").
    const existing = await Review.findOne({ serviceRequestId });
    if (existing) {
      return res.status(409).json({ message: "لقد قمت بتقييم هذا الطلب مسبقاً" });
    }

    const review = await Review.create({
      serviceRequestId,
      customerId: req.user._id,
      workerId: order.workerId,
      rating: ratingNum,
      comment: String(comment || "").trim().slice(0, 1000),
    });

    // Update the WorkerProfile aggregates. We use findOneAndUpdate so the
    // read+write is a single round trip, and we compute the new average
    // with the old values loaded for math:
    //   newAvg = (oldAvg * oldCount + newRating) / (oldCount + 1)
    //
    // Reading the profile first (rather than a pure $inc) is necessary for
    // ratingAverage — there's no built-in "running average" operator.
    const profile = await WorkerProfile.findOne({ userId: order.workerId });
    if (profile) {
      const oldCount = profile.totalReviews || 0;
      const oldAvg = profile.ratingAverage || 0;
      const newCount = oldCount + 1;
      // Round to 1 decimal place for a clean UI ("4.3" not "4.333333...").
      const newAvg = Math.round(((oldAvg * oldCount + ratingNum) / newCount) * 10) / 10;
      profile.totalReviews = newCount;
      profile.ratingAverage = newAvg;
      await profile.save();
    }

    // Notify the worker so the bell pings and the review page updates live.
    const notif = await Notification.create({
      userId: order.workerId,
      title: "تقييم جديد",
      message: `قام العميل بتقييم خدمتك بـ ${ratingNum} من 5`,
      type: "success",
      link: "/dashboard",
    });
    emitNotification(req, order.workerId, notif);

    res.status(201).json({ review });
  } catch (err) {
    console.error("createReview error:", err);
    res.status(500).json({ message: "خطأ في إنشاء التقييم" });
  }
};

module.exports = {
  createReview,
};
