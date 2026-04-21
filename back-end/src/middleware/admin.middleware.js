// adminOnly middleware — runs AFTER authMiddleware
//
// The chain works like this:
//   authMiddleware (checks token, attaches req.user) → adminOnly (checks role) → controller
//
// Why not combine with authMiddleware?
// Because some routes need auth but not admin access (like /me).
// Keeping them separate lets us mix and match:
//   - authMiddleware only → any logged-in user can access
//   - authMiddleware + adminOnly → only admins can access

const adminOnly = (req, res, next) => {
  // req.user is guaranteed to exist here because authMiddleware ran first
  // and would have returned 401 if the token was invalid
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }

  // User is an admin — let the request continue to the controller
  next();
};

module.exports = adminOnly;
