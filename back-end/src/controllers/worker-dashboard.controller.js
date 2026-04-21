const mongoose = require("mongoose");
const WorkerProfile = require("../Models/Worker.Profile");
const WorkerServices = require("../Models/Worker.Services");
const ServiceRequest = require("../Models/Service.Request");
const User = require("../Models/User.Model");
const Notification = require("../Models/Notification");
const WalletTransaction = require("../Models/Wallet.Transaction");

// ============================================================
// GET /api/worker/dashboard
// ============================================================
// Returns the worker's profile + order counts + total earnings.
//
// KEY CONCEPT — "Auto-create" pattern (same as customer profile):
// The first time a worker visits their dashboard, if they don't have a
// WorkerProfile yet, we create one automatically. This avoids having to
// create the profile during signup — we only create it when it's needed.
//
// KEY CONCEPT — Promise.all for parallel queries:
// We need to count orders by status (pending, accepted, in_progress, completed).
// Instead of running 4 queries one-after-another (slow), we run them ALL
// at once using Promise.all. This is like:
//   - Sequential: "Count pending... done. Now count accepted... done. Now..."
//   - Parallel:   "Count pending AND accepted AND in_progress AND completed AT ONCE"
// Promise.all waits for ALL promises to finish, then gives us all results.
//
// KEY CONCEPT — MongoDB aggregate vs find:
// - find() returns full documents: [{_id, customerId, proposedPrice, ...}, ...]
// - aggregate() is a DATA PIPELINE that processes documents in stages:
//     $match → filter documents (like find's filter)
//     $group → combine documents and calculate values (like SQL GROUP BY)
//
// We use aggregate here because we need to SUM all proposedPrice values.
// With find(), we'd get all documents and sum in JavaScript (slow for many docs).
// With aggregate(), MongoDB does the summing on the database server (fast).
//
// WHY new mongoose.Types.ObjectId(userId)?
// In aggregate pipelines, Mongoose does NOT auto-cast strings to ObjectIds
// like it does in find(). If userId is a string "665a1f2b...", the $match
// stage won't find anything because MongoDB is comparing a string to an ObjectId.
// We must explicitly convert it.
// ============================================================
const getDashboard = async (req, res) => {
  try {
    const userId = req.user._id;

    // Step 1: Find or auto-create the worker profile
    let profile = await WorkerProfile.findOne({ userId })
      .populate("userId", "firstName lastName profileImage bio location createdAt")
      .populate("Category", "name image")
      .populate({
        path: "services",
        // No `match: { active: true }` — show ALL services to the worker,
        // including inactive and pending ones, so they can see approval status
        select: "description price typeofService priceRange categoryId active approvalStatus rejectionReason",
        populate: { path: "categoryId", select: "name" },
      });

    if (!profile) {
      profile = await WorkerProfile.create({ userId });
      // Re-populate after creation so the response has the same shape
      profile = await WorkerProfile.findById(profile._id)
        .populate("userId", "firstName lastName profileImage bio location createdAt")
        .populate("Category", "name image");
    }

    // Step 2: Count orders by status — all queries run in parallel
    // Promise.all takes an ARRAY of promises and returns an ARRAY of results
    // in the same order. So results[0] = pending count, results[1] = accepted count, etc.
    const [pendingCount, acceptedCount, inProgressCount, completedCount] =
      await Promise.all([
        ServiceRequest.countDocuments({ workerId: userId, status: "pending" }),
        ServiceRequest.countDocuments({ workerId: userId, status: "accepted" }),
        ServiceRequest.countDocuments({ workerId: userId, status: "in_progress" }),
        ServiceRequest.countDocuments({ workerId: userId, status: "completed" }),
      ]);

    // Step 3: Calculate total earnings using aggregate pipeline
    // The pipeline has 2 stages:
    //
    //   Stage 1 — $match: Filter to only this worker's completed orders
    //     (like a WHERE clause in SQL)
    //
    //   Stage 2 — $group: Combine all matching documents into one result
    //     _id: null means "group ALL documents together" (no sub-groups)
    //     $sum: "$proposedPrice" means "add up the proposedPrice field from each document"
    //
    // Result shape: [{ _id: null, total: 1500 }] or [] if no completed orders
    const earningsResult = await ServiceRequest.aggregate([
      {
        $match: {
          workerId: new mongoose.Types.ObjectId(userId),
          status: "completed",
        },
      },
      {
        $group: {
          _id: null,              // Group everything together (no sub-groups)
          total: { $sum: "$proposedPrice" },  // Sum all proposedPrice values
        },
      },
    ]);

    // If there are no completed orders, earningsResult is an empty array []
    // We use optional chaining (?.) and nullish coalescing (?? 0) to safely default to 0
    const totalEarnings = earningsResult[0]?.total ?? 0;

    res.json({
      profile,
      stats: {
        orders: {
          pending: pendingCount,
          accepted: acceptedCount,
          inProgress: inProgressCount,
          completed: completedCount,
          total: pendingCount + acceptedCount + inProgressCount + completedCount,
        },
        totalEarnings,
      },
    });
  } catch (error) {
    console.error("getDashboard error:", error);
    res.status(500).json({ message: "Server error fetching dashboard" });
  }
};

// ============================================================
// GET /api/worker/services
// ============================================================
// Returns all services belonging to the logged-in worker.
//
// Flow: Find the worker's profile → Find all services where workerID = profile._id
//
// WHY workerID references WorkerProfile._id (not User._id)?
// Because services BELONG to a profile, not directly to a user.
// A worker profile is the "business entity" — it has a category, skills,
// portfolio, verification, etc. Services are part of that business entity.
// If we ever allowed a user to have multiple profiles (e.g., one for
// plumbing, one for electrical), each profile would have its own services.
// ============================================================
const getMyServices = async (req, res) => {
  try {
    const userId = req.user._id;

    // Step 1: Find the worker's profile
    const profile = await WorkerProfile.findOne({ userId });
    if (!profile) {
      return res.status(404).json({ message: "Worker profile not found" });
    }

    // Step 2: Find all services for this profile
    // We populate categoryId to show the category name alongside each service
    const services = await WorkerServices.find({ workerID: profile._id })
      .populate("categoryId", "name")
      .sort({ createdAt: -1 });

    res.json({ services });
  } catch (error) {
    console.error("getMyServices error:", error);
    res.status(500).json({ message: "Server error fetching services" });
  }
};

// ============================================================
// POST /api/worker/services
// ============================================================
// Creates a new service and links it to the worker's profile.
//
// KEY CONCEPT — $push (array management):
// WorkerProfile has a `services` field that is an ARRAY of ObjectIds:
//   services: [{ type: ObjectId, ref: "WorkerServices" }]
//
// When we create a new service, we need to do TWO things:
//   1. Create the WorkerServices document in the WorkerServices collection
//   2. Add the new service's _id to the profile's services array
//
// $push is MongoDB's array append operator. It adds an element to an array
// WITHOUT needing to fetch the document, modify it in JavaScript, and save it back.
//
//   findByIdAndUpdate(profileId, { $push: { services: newServiceId } })
//
// This is ATOMIC — it happens in one database operation. No race conditions.
// Compare to the non-atomic way:
//   const profile = await WorkerProfile.findById(profileId);
//   profile.services.push(newServiceId);
//   await profile.save();
// The non-atomic way has a race condition: if two requests happen at the same
// time, one push could be lost. $push avoids this.
// ============================================================
const addService = async (req, res) => {
  try {
    const userId = req.user._id;

    // Step 1: Find the worker's profile
    const profile = await WorkerProfile.findOne({ userId });
    if (!profile) {
      return res.status(404).json({ message: "Worker profile not found" });
    }

    // Step 2: Validate required fields
    const { name, categoryId, description, price, typeofService, priceRange, images } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Service name is required" });
    }

    // Step 3: Create the service document
    // workerID is set to profile._id (NOT userId!) — see explanation in getMyServices
    // Services start as pending approval. Admin must approve before they go live.
    //   active: false → won't show on public services page
    //   approvalStatus: "pending" → admin needs to review
    const service = await WorkerServices.create({
      workerID: profile._id,
      categoryId,
      name: name.trim(),
      description,
      images: Array.isArray(images) ? images.filter(Boolean) : [],
      price,
      typeofService,
      priceRange,
      active: false,
      approvalStatus: "pending",
    });

    // Step 4: Add the new service's _id to the profile's services array
    await WorkerProfile.findByIdAndUpdate(profile._id, {
      $push: { services: service._id },
    });

    // Step 5: Notify all admins that a new service needs their review.
    // We fire-and-forget this so the response isn't delayed by notification creation.
    // If notification creation fails, the service is still created successfully.
    (async () => {
      try {
        const admins = await User.find({ role: "admin" }).select("_id");
        if (admins.length > 0) {
          const workerName = `${req.user.firstName || ""} ${req.user.lastName || ""}`.trim() || "عامل";
          const notifications = admins.map(admin => ({
            userId: admin._id,
            title: "خدمة جديدة بانتظار الموافقة",
            message: `قام ${workerName} بإضافة خدمة جديدة "${service.name}" وهي بانتظار موافقتك.`,
            type: "info",
            link: "/admin/services",
          }));
          await Notification.insertMany(notifications);
        }
      } catch (notifErr) {
        console.error("Failed to notify admins about new service:", notifErr);
      }
    })();

    res.status(201).json({ service });
  } catch (error) {
    console.error("addService error:", error);
    res.status(500).json({ message: "Server error creating service" });
  }
};

// ============================================================
// PUT /api/worker/services/:serviceId
// ============================================================
// Updates an existing service. Only the OWNER can update their own services.
//
// KEY CONCEPT — Ownership check:
// We don't just find the service by its _id. We find it by BOTH:
//   { _id: serviceId, workerID: profile._id }
//
// This ensures:
//   1. The service exists
//   2. It belongs to THIS worker (not someone else's service)
//
// Without the ownership check, any logged-in worker could edit anyone's services
// by guessing the service ID. The compound query prevents this.
//
// KEY CONCEPT — Partial update with spread:
// We only update fields that were actually sent in the request body.
// If the worker only sends { price: 100 }, we don't touch description or anything else.
// The ...(field && { field }) pattern handles this (same as customer updateProfile).
// ============================================================
const updateService = async (req, res) => {
  try {
    const userId = req.user._id;
    const { serviceId } = req.params;

    // Step 1: Find the worker's profile
    const profile = await WorkerProfile.findOne({ userId });
    if (!profile) {
      return res.status(404).json({ message: "Worker profile not found" });
    }

    // Step 2: Build the update object with only sent fields
    const { name, description, images, price, typeofService, priceRange, categoryId, active } = req.body;
    const updates = {
      ...(name && { name: name.trim() }),
      ...(description !== undefined && { description }),
      ...(Array.isArray(images) && { images: images.filter(Boolean) }),
      ...(price && { price }),
      ...(typeofService && { typeofService }),
      ...(priceRange && { priceRange }),
      ...(categoryId && { categoryId }),
      // For 'active', we check explicitly for undefined because false is a valid value
      // Using (active && { active }) would fail: if active=false, the && short-circuits
      // and we'd never be able to deactivate a service!
      ...(active !== undefined && { active }),
    };

    // Step 3: If the service was previously REJECTED and the worker is editing it,
    // automatically resubmit it for admin review by resetting approvalStatus to "pending".
    // We also set active=false because unapproved services shouldn't be visible to customers.
    //
    // WHY only for rejected (not approved)?
    // If an approved service is edited (e.g., worker changes the price), we don't want to
    // force it back through review — that would be annoying for minor tweaks.
    // But rejected services MUST go through review again because the admin already said "no".
    const existingService = await WorkerServices.findOne({ _id: serviceId, workerID: profile._id });
    if (existingService && existingService.approvalStatus === 'rejected') {
      updates.approvalStatus = 'pending';
      updates.active = false;
    }

    // Step 4: Find and update — with ownership check built into the query
    const service = await WorkerServices.findOneAndUpdate(
      { _id: serviceId, workerID: profile._id }, // filter: must match BOTH conditions
      updates,
      { new: true, runValidators: true },
    ).populate("categoryId", "name");

    if (!service) {
      return res.status(404).json({ message: "Service not found or not yours" });
    }

    // Step 5: If the service was resubmitted for review (rejected → pending),
    // notify all admins that a service is back in their queue.
    if (existingService && existingService.approvalStatus === 'rejected') {
      (async () => {
        try {
          const admins = await User.find({ role: "admin" }).select("_id");
          if (admins.length > 0) {
            const workerName = `${req.user.firstName || ""} ${req.user.lastName || ""}`.trim() || "عامل";
            const notifications = admins.map(admin => ({
              userId: admin._id,
              title: "خدمة معدلة بانتظار الموافقة",
              message: `قام ${workerName} بتعديل خدمة "${service.name}" بعد رفضها وهي بانتظار مراجعتك.`,
              type: "info",
              link: "/admin/services",
            }));
            await Notification.insertMany(notifications);
          }
        } catch (notifErr) {
          console.error("Failed to notify admins about resubmitted service:", notifErr);
        }
      })();
    }

    res.json({ service });
  } catch (error) {
    console.error("updateService error:", error);
    res.status(500).json({ message: "Server error updating service" });
  }
};

// ============================================================
// DELETE /api/worker/services/:serviceId
// ============================================================
// Deletes a service and removes it from the worker's profile.
//
// KEY CONCEPT — $pull (opposite of $push):
// When we added a service, we used $push to append to the array.
// Now we use $pull to REMOVE from the array.
//
//   $push: { services: serviceId }  → adds serviceId to the array
//   $pull: { services: serviceId }  → removes serviceId from the array
//
// We need to do TWO things (mirror of addService):
//   1. Delete the WorkerServices document from the WorkerServices collection
//   2. Remove its _id from the profile's services array using $pull
//
// If we only did step 1, the profile would have a "dangling reference" —
// an ObjectId in the services array that points to a deleted document.
// This would cause errors when trying to populate().
// ============================================================
const deleteService = async (req, res) => {
  try {
    const userId = req.user._id;
    const { serviceId } = req.params;

    // Step 1: Find the worker's profile
    const profile = await WorkerProfile.findOne({ userId });
    if (!profile) {
      return res.status(404).json({ message: "Worker profile not found" });
    }

    // Step 2: Delete the service — with ownership check
    const service = await WorkerServices.findOneAndDelete({
      _id: serviceId,
      workerID: profile._id, // Ownership check: must belong to this worker
    });

    if (!service) {
      return res.status(404).json({ message: "Service not found or not yours" });
    }

    // Step 3: Remove the service _id from the profile's services array
    await WorkerProfile.findByIdAndUpdate(profile._id, {
      $pull: { services: service._id },
    });

    res.json({ message: "Service deleted successfully" });
  } catch (error) {
    console.error("deleteService error:", error);
    res.status(500).json({ message: "Server error deleting service" });
  }
};

// ============================================================
// GET /api/worker/orders?status=in_progress&page=1&limit=10
// ============================================================
// Same pattern as the customer's getOrders, but filtered by workerId
// instead of customerId. We populate customerId here so the worker
// can see WHO placed the order (the customer's name and avatar).
//
// This uses the SAME ServiceRequest model as the customer side.
// The only difference is the filter field:
//   - Customer sees orders WHERE customerId = their userId
//   - Worker sees orders WHERE workerId = their userId
// ============================================================
const getMyOrders = async (req, res) => {
  try {
    const userId = req.user._id;

    const status = req.query.status || "in_progress";
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    // Same status grouping as customer orders
    let statusFilter;
    if (status === "in_progress") {
      statusFilter = ["pending", "accepted", "in_progress"];
    } else {
      statusFilter = ["completed", "cancelled", "rejected"];
    }

    const total = await ServiceRequest.countDocuments({
      workerId: userId,
      status: { $in: statusFilter },
    });

    const orders = await ServiceRequest.find({
      workerId: userId,
      status: { $in: statusFilter },
    })
      .populate("customerId", "firstName lastName profileImage") // Show customer info to worker
      .populate("categoryId", "name")
      .populate("serviceId", "name images price typeofService priceRange")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("getMyOrders error:", error);
    res.status(500).json({ message: "Server error fetching orders" });
  }
};

// ============================================================
// GET /api/worker/wallet
// ============================================================
// Returns the worker's current wallet balance, lifetime earnings, and the
// most recent N transactions. Powers the "المحفظة" tab in the worker
// dashboard.
//
// Auto-create parity: if the worker has no WorkerProfile yet (they haven't
// visited /dashboard), we still return a zeroed wallet snapshot so the UI
// can render without a special case.
// ============================================================
const getWallet = async (req, res) => {
  try {
    const userId = req.user._id;

    const profile = await WorkerProfile.findOne({ userId }).select(
      "walletBalance lifetimeEarnings lifetimeWithdrawn",
    );

    const transactions = await WalletTransaction.find({ workerId: userId })
      .populate("relatedOrderId", "serviceId scheduledDate")
      .sort({ createdAt: -1 })
      .limit(50); // Hard cap; the list has no pagination UI yet.

    res.json({
      wallet: {
        balance: profile?.walletBalance || 0,
        lifetimeEarnings: profile?.lifetimeEarnings || 0,
        lifetimeWithdrawn: profile?.lifetimeWithdrawn || 0,
      },
      transactions,
    });
  } catch (err) {
    console.error("getWallet error:", err);
    res.status(500).json({ message: "خطأ في تحميل المحفظة" });
  }
};

module.exports = {
  getDashboard,
  getMyServices,
  addService,
  updateService,
  deleteService,
  getMyOrders,
  getWallet,
};
