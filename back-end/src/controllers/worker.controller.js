const mongoose = require("mongoose");
const WorkerProfile = require("../Models/Worker.Profile");
const WorkerServices = require("../Models/Worker.Services");
const Review = require("../Models/Review");
const ServiceRequest = require("../Models/Service.Request");

// getWorkers — Returns a paginated, filtered, sorted list of workers
//
// This is the most complex endpoint so far. Here's the data flow:
//
// 1. Read query params from the URL (category, price, rating, sort, page)
// 2. Build a MongoDB filter object based on those params
// 3. Handle price filtering (tricky — price lives on WorkerServices, not WorkerProfile)
// 4. Query the database with populate (join related data)
// 5. Sort the results
// 6. Return paginated results
//
// Example URL: GET /api/workers?category=507f1f77&minPrice=50&maxPrice=200&minRating=4&sort=rating&page=1

const getWorkers = async (req, res) => {
  try {
    // === Step 1: Extract query params ===
    // req.query contains everything after the ? in the URL
    // e.g., ?category=abc&sort=rating → req.query = { category: "abc", sort: "rating" }
    const {
      category,
      minPrice,
      maxPrice,
      minRating,
      q,                // search query — matches service name
      sort = "rating",  // Default sort by rating if not specified
      page = 1,
      limit = 10,
    } = req.query;

    // Convert page and limit to numbers (query params come as strings)
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    // === Step 2: Build the filter object ===
    // This object will be passed to WorkerProfile.find(filter)
    // Only add conditions if the corresponding query param was provided
    const filter = {};

    // Escape regex-special characters so user input like "a+b" doesn't break the regex.
    const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // Filter by category — find workers who have active services in this category.
    // Accepts a single ID ("?category=abc") OR a comma-separated list
    // ("?category=abc,def,ghi") so the providers page can pass multiple
    // checkbox selections. We query WorkerServices because a worker can
    // have approved services in multiple categories.
    if (category) {
      const categoryIds = String(category).split(",").map(s => s.trim()).filter(Boolean);
      if (categoryIds.length > 0) {
        const workerIdsInCategory = await WorkerServices.distinct("workerID", {
          categoryId: { $in: categoryIds },
          active: true,
        });
        filter._id = { $in: workerIdsInCategory };
      }
    }

    // Filter by search query (q) — match against service NAMES.
    // Find workers who have at least one active service whose name matches.
    // We intersect with any existing _id filter (from category) so both apply.
    if (q && q.trim()) {
      const namePattern = new RegExp(escapeRegex(q.trim()), "i");
      const workerIdsMatchingQuery = await WorkerServices.distinct("workerID", {
        name: namePattern,
        active: true,
      });
      if (filter._id) {
        const existingIds = filter._id.$in.map(id => id.toString());
        filter._id = { $in: workerIdsMatchingQuery.filter(id => existingIds.includes(id.toString())) };
      } else {
        filter._id = { $in: workerIdsMatchingQuery };
      }
    }

    // Filter by minimum rating
    // $gte means "greater than or equal to" in MongoDB
    if (minRating) {
      filter.ratingAverage = { $gte: parseFloat(minRating) };
    }

    // Only show approved workers (not pending or rejected verification)
    filter.verificationStatus = "approved";

    // === Step 3: Handle price filtering ===
    // This is tricky because price lives on WorkerServices, NOT on WorkerProfile.
    // So we need a 2-step process:
    //   1. Find which workers have services in the price range
    //   2. Add those worker IDs to our main filter
    if (minPrice || maxPrice) {
      const priceFilter = {};
      if (minPrice) priceFilter.$gte = parseFloat(minPrice);
      if (maxPrice) priceFilter.$lte = parseFloat(maxPrice);

      // Find all WorkerServices where price is in range
      // .distinct("workerID") returns an array of unique worker IDs (no duplicates)
      const matchingWorkerIds = await WorkerServices.distinct("workerID", {
        price: priceFilter,
        active: true,
      });

      // If we already have an _id filter (from category), intersect the two sets
      // so we only get workers who match BOTH category AND price range.
      if (filter._id) {
        const categoryIds = filter._id.$in.map(id => id.toString());
        filter._id = { $in: matchingWorkerIds.filter(id => categoryIds.includes(id.toString())) };
      } else {
        filter._id = { $in: matchingWorkerIds };
      }
    }

    // === Step 4: Build sort object ===
    // MongoDB sort: 1 = ascending (A→Z, low→high), -1 = descending (Z→A, high→low)
    let sortObj = {};
    switch (sort) {
      case "price":
        sortObj = { "priceRange.min": 1 }; // Cheapest first
        break;
      case "rating":
        sortObj = { ratingAverage: -1 }; // Highest rated first
        break;
      case "mostOrdered":
        sortObj = { totalReviews: -1 }; // Most reviews = most popular
        break;
      case "alphabetical":
        // Can't sort by populated field directly in MongoDB
        // We'll sort in-memory after getting results (see below)
        sortObj = { createdAt: -1 }; // Temporary sort
        break;
      default:
        sortObj = { ratingAverage: -1 };
    }

    // === Step 5: Count total results (for pagination info) ===
    const total = await WorkerProfile.countDocuments(filter);

    // === Step 6: Query with populate ===
    // .populate() tells Mongoose: "replace this ID reference with the actual document"
    //
    // populate('userId', 'firstName lastName profileImage') means:
    //   "go to the User collection, find the user with this ID,
    //    and only bring back firstName, lastName, and profileImage (not password, etc.)"
    let workers = await WorkerProfile.find(filter)
      .populate("userId", "firstName lastName profileImage")
      .populate("Category", "name image")
      .populate("serviceCategories", "name image")
      .populate({
        path: "services",
        // Build the populate match from whatever filters are active.
        // Always requires active: true. Narrows further by category (single or
        // comma-separated list) and/or service-name search when those are present.
        match: {
          active: true,
          approvalStatus: "approved",
          ...(category && (() => {
            const ids = String(category).split(",").map(s => s.trim()).filter(Boolean);
            return ids.length > 1 ? { categoryId: { $in: ids } } : { categoryId: ids[0] };
          })()),
          ...(q && q.trim() && { name: new RegExp(escapeRegex(q.trim()), "i") }),
        },
        select: "name description images price typeofService priceRange categoryId",
      })
      .sort(sortObj)
      .skip((pageNum - 1) * limitNum)  // Skip results for previous pages
      .limit(limitNum);                 // Only return 'limit' results

    // === Step 7: Handle alphabetical sort in-memory ===
    // We couldn't sort by userId.firstName in MongoDB because it's a populated (joined) field.
    // For our page size (10 items), sorting in-memory is fast and simple.
    if (sort === "alphabetical") {
      workers = workers.sort((a, b) => {
        const nameA = a.userId?.firstName || "";
        const nameB = b.userId?.firstName || "";
        return nameA.localeCompare(nameB, "ar"); // "ar" = Arabic locale for correct Arabic sorting
      });
    }

    // === Step 8: Return results with pagination info ===
    res.json({
      workers,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum), // e.g., 42 results / 10 per page = 5 pages
      },
    });
  } catch (error) {
    console.log("Worker listing error:", error.message);
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// ============================================================
// GET /api/workers/:id
// ============================================================
// Fetches a SINGLE worker's full profile by their WorkerProfile _id.
//
// This is the "public profile page" — anyone can view it (no auth needed).
// It's different from the dashboard endpoint (which is for the worker themselves).
//
// We populate 3 related collections:
//   - userId → get the worker's name, avatar, bio, location, join date
//   - Category → get the category name and image
//   - services → get all ACTIVE services this worker offers
//
// The nested populate on services.categoryId is a "deep populate":
//   First populate the services array, then WITHIN each service,
//   also populate the categoryId field. This gives us:
//     service.categoryId.name instead of just service.categoryId = "507f1f77..."
// ============================================================
const getWorkerById = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: "Worker not found" });
    }

    const workerProfile = await WorkerProfile.findById(req.params.id)
      .populate("userId", "firstName lastName profileImage bio createdAt")
      .populate("Category", "name image")
      .populate("serviceCategories", "name image")
      .populate({
        path: "services",
        match: { active: true, approvalStatus: "approved" },
        select: "name description images price typeofService priceRange categoryId",
        populate: { path: "categoryId", select: "name" },
      });

    if (!workerProfile) {
      return res.status(404).json({ message: "Worker not found" });
    }

    const orderStats = await ServiceRequest.aggregate([
      {
        $match: {
          workerId: new mongoose.Types.ObjectId(workerProfile.userId?._id || workerProfile.userId),
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const counts = orderStats.reduce((acc, row) => {
      acc[row._id] = row.count;
      return acc;
    }, {});

    const servicePrices = (workerProfile.services || []).flatMap((service) => {
      if (service.typeofService === "range" && service.priceRange?.min) return [service.priceRange.min];
      if (typeof service.price === "number") return [service.price];
      return [];
    });

    const completedOrders = counts.completed || 0;
    const historicalOrders = completedOrders + (counts.cancelled || 0) + (counts.rejected || 0);
    const startingPrice =
      workerProfile.priceRange?.min ||
      (servicePrices.length > 0 ? Math.min(...servicePrices) : 0);

    const worker = workerProfile.toObject();
    worker.publicStats = {
      completedOrders,
      historicalOrders,
      successRate: historicalOrders > 0 ? Math.round((completedOrders / historicalOrders) * 100) : 0,
      startingPrice,
    };

    res.json({ worker });
  } catch (error) {
    console.error("getWorkerById error:", error);
    res.status(500).json({ message: "Server error fetching worker profile" });
  }
};

// ============================================================
// GET /api/workers/:id/reviews?page=1&limit=10
// ============================================================
// Fetches paginated reviews for a specific worker.
//
// IMPORTANT ID DISTINCTION:
//   - req.params.id = the WorkerProfile._id (used to find the profile)
//   - workerProfile.userId = the User._id (used to find reviews)
//
// Why the extra step? Because Review.workerId references the User model,
// NOT the WorkerProfile model. This is a common pattern:
//   - Reviews are tied to the PERSON (User._id) — they persist even if
//     the worker changes their profile or creates a new one.
//   - Services are tied to the PROFILE (WorkerProfile._id) — they belong
//     to a specific worker profile configuration.
//
// So we need to:
//   1. Find the WorkerProfile by its _id (from the URL)
//   2. Use workerProfile.userId to query the Review collection
// ============================================================
const getWorkerReviews = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    // Step 1: Find the worker profile to get the userId
    const workerProfile = await WorkerProfile.findById(req.params.id);
    if (!workerProfile) {
      return res.status(404).json({ message: "Worker not found" });
    }

    // Step 2: Count total reviews for pagination info
    const total = await Review.countDocuments({ workerId: workerProfile.userId });

    // Step 3: Fetch the actual reviews
    // We populate customerId to show who left the review (name + avatar)
    const reviews = await Review.find({ workerId: workerProfile.userId })
      .populate("customerId", "firstName lastName profileImage")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      reviews,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("getWorkerReviews error:", error);
    res.status(500).json({ message: "Server error fetching reviews" });
  }
};

// ============================================================
// GET /api/workers/service/:serviceId
// ============================================================
// Fetches a SINGLE approved+active WorkerService by its _id.
// Used by the /checkout page and by the chat service-seed prefill flow to
// show service summary info (name, price, worker) without loading the whole
// worker profile.
//
// Populates the worker chain: workerID (WorkerProfile) → userId (User) so the
// frontend can display the worker's name/avatar in the checkout summary.
// Category is populated so the coupon validator can check scope.
// ============================================================
const getServiceById = async (req, res) => {
  try {
    const service = await WorkerServices.findById(req.params.serviceId)
      .populate({
        path: "workerID",
        // Include ratingAverage + totalReviews + rank so the service detail
        // page can render trust signals (stars, count, rank badge) on the
        // worker card without a second round-trip.
        select: "userId verificationStatus ratingAverage totalReviews rank",
        populate: { path: "userId", select: "firstName lastName profileImage" },
      })
      .populate("categoryId", "name");

    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }
    // Only expose services that are publicly orderable.
    if (!service.active || service.approvalStatus !== "approved") {
      return res.status(404).json({ message: "Service not available" });
    }

    res.json({ service });
  } catch (error) {
    console.error("getServiceById error:", error);
    res.status(500).json({ message: "Server error fetching service" });
  }
};

module.exports = { getWorkers, getWorkerById, getWorkerReviews, getServiceById };
