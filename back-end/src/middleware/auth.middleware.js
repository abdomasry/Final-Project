const jwt = require("jsonwebtoken");
const User = require("../Models/User.Model");

// This middleware protects routes that require a logged-in user.
// It runs BEFORE the controller function.
//
// How it works:
// 1. Client sends a request with header: Authorization: Bearer <token>
// 2. We extract the token from that header
// 3. We verify the token is valid and not expired using jwt.verify()
// 4. We find the user in the database using the userId from the token
// 5. We attach the user to req.user so the controller can use it
// 6. If anything fails, we return 401 (Unauthorized)

const authMiddleware = async (req, res, next) => {
  try {
    // Step 1: Get the Authorization header and extract the token
    // The header looks like: "Bearer eyJhbGciOiJIUzI1NiIs..."
    // We split by space and take the second part (the actual token)
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    // Step 2: Verify the token
    // jwt.verify() does two things:
    //   - Checks the token was signed with our secret key (not tampered with)
    //   - Checks the token hasn't expired (we set 7 days in generateToken)
    // If either check fails, it throws an error (caught by our catch block)
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Step 3: Find the user in the database
    // decoded.userId comes from what we put in the token during signup/signin:
    //   jwt.sign({ userId }, secret, { expiresIn: "7d" })
    // We use .select("-password") to exclude the password field from the result
    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    // Step 3.5: Check if user is banned/suspended
    // Even if the token is valid, the admin may have banned them AFTER they logged in.
    // This ensures banned users get kicked out on their very next API call.
    if (user.status === "banned") {
      return res.status(403).json({ message: "تم حظر حسابك", banned: true });
    }
    if (user.status === "suspended") {
      return res.status(403).json({ message: "تم تعليق حسابك مؤقتاً", suspended: true });
    }

    // Step 4: Attach user to the request object
    // Now any controller that runs after this middleware can access req.user
    req.user = user;

    // Step 5: Call next() to pass control to the next middleware or controller
    // Without next(), the request would hang here forever
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

module.exports = authMiddleware;