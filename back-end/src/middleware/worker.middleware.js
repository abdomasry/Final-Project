// workerOnly middleware — runs AFTER authMiddleware
//
// The chain works like this:
//   authMiddleware (checks token, attaches req.user) → workerOnly (checks role) → controller
//
// This is the exact same pattern as adminOnly, but checks for "worker" role instead.
// We keep role-checking middlewares separate from authMiddleware so we can mix and match:
//   - authMiddleware only           → any logged-in user can access
//   - authMiddleware + workerOnly   → only workers can access
//   - authMiddleware + adminOnly    → only admins can access
//
// WHY 403 and not 401?
//   - 401 = "Unauthorized" → you're not logged in at all (no/bad token)
//   - 403 = "Forbidden"    → you ARE logged in, but your role doesn't have permission
// The user IS authenticated (authMiddleware already confirmed that),
// they just don't have the right role. That's a 403.

const workerOnly = (req, res, next) => {
  // req.user is guaranteed to exist here because authMiddleware ran first
  // and would have returned 401 if the token was invalid
  if (req.user.role !== "worker") {
    return res.status(403).json({ message: "Worker access required" });
  }

  // User is a worker — let the request continue to the controller
  next();
};

module.exports = workerOnly;
