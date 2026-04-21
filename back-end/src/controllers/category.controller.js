const Category = require("../Models/Category");
const WorkerServices = require("../Models/Worker.Services");

// ========== READ operations (public — no auth needed) ==========

// getAll — Returns all active categories
// Used by: home page to display category cards
// Why filter by isActive? So admins can "disable" a category without deleting it.
// This is called a "soft delete" — the data stays in the DB but is hidden from users.
//
// Optional `?withCounts=true` query param augments each category with a
// `serviceCount` field — the number of active+approved services in that
// category. Used by the services page filter sidebar to show "(142)" next
// to each checkbox. We do a single aggregation and join instead of N+1
// queries to keep this snappy.
const getAll = async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true }).lean();

    if (req.query.withCounts === "true") {
      // One aggregation query: group active services by categoryId, sum counts.
      const counts = await WorkerServices.aggregate([
        { $match: { active: true, approvalStatus: "approved" } },
        { $group: { _id: "$categoryId", count: { $sum: 1 } } },
      ]);

      // Build an id-keyed lookup so each category gets its count in O(1).
      const countMap = new Map(counts.map(c => [String(c._id), c.count]));
      categories.forEach(cat => {
        cat.serviceCount = countMap.get(String(cat._id)) || 0;
      });
    }

    res.json({ categories });
  } catch (error) {
    console.error("category getAll error:", error);
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// getById — Returns a single category by its MongoDB _id
// Used by: services page to show the selected category name
const getById = async (req, res) => {
  try {
    // req.params.id comes from the URL: /api/categories/:id
    // e.g., /api/categories/507f1f77bcf86cd799439011 → req.params.id = "507f1f77bcf86cd799439011"
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    res.json({ category });
  } catch (error) {
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// ========== WRITE operations (admin only — auth + admin middleware required) ==========

// create — Creates a new category
// The route will have: authMiddleware → adminOnly → create
// So by the time we get here, we KNOW the user is a logged-in admin.
const create = async (req, res) => {
  try {
    const { name, description, image } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Category name is required" });
    }

    const category = await Category.create({ name, description, image });

    // 201 = "Created" — the standard status code when a new resource is created
    res.status(201).json({ category });
  } catch (error) {
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// update — Updates an existing category
// findByIdAndUpdate options:
//   - { new: true } → return the UPDATED document, not the old one
//   - { runValidators: true } → check schema validation rules on the new data
const update = async (req, res) => {
  try {
    const category = await Category.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    res.json({ category });
  } catch (error) {
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// deleteCategory — Deletes a category permanently
// Note: we name it "deleteCategory" not "delete" because "delete" is a reserved word in JS
const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    res.json({ message: "Category deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error, please try again" });
  }
};

module.exports = { getAll, getById, create, update, deleteCategory };
