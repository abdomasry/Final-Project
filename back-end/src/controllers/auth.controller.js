const User = require("../Models/User.Model");
const jwt = require("jsonwebtoken");
const { sendVerificationEmail } = require("../config/email");

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

const signup = async (req, res) => {
  try {
    const { firstName, lastName, email, password, confirmPassword, phone, role } =
      req.body;

    if (!firstName || !lastName || !(email || phone) || !password) {
      return res.status(400).json({
        message: "Please provide all required fields",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        message: "Passwords do not match",
      });
    }

    if (email) {
      const emailExists = await User.findOne({ email });
      if (emailExists) {
        return res.status(400).json({
          message: "Email already in use",
        });
      }
    }

    if (phone) {
      const phoneExists = await User.findOne({ phone });
      if (phoneExists) {
        return res.status(400).json({
          message: "Phone number already in use",
        });
      }
    }

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const hasEmail = !!email;

    const userData = {
      firstName,
      lastName,
      ...(email && { email }),
      ...(phone && { phone }),
      password,
      // Allow choosing role at signup (customer or worker). Admin can only be set by another admin.
      ...(role && role !== 'admin' && { role }),
      verificationCode: hasEmail ? verificationCode : null,
      verificationCodeExpires: hasEmail ? Date.now() + 10 * 60 * 1000 : null,
      isVerified: !hasEmail, // Phone-only users are immediately verified
    };
    const user = await User.create(userData);

    if (email) {
      sendVerificationEmail(email, verificationCode).catch(err => {
        console.log("Email sending failed:", err.message);
      });
    }

    const token = generateToken(user._id);

    res.status(201).json({
      message: hasEmail
        ? "تم انشاء الحساب بنجاح. يرجى التحقق من بريدك الإلكتروني لتفعيل حسابك."
        : "تم إنشاء الحساب بنجاح",
      token,
      user: user.toPublicJSON(),
      requireVerification: hasEmail,
    });
  } catch (error) {
    console.log("ERROR NAME:", error.name);
    console.log("ERROR MESSAGE:", error.message);
    console.log("FULL ERROR:", error);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ message: messages[0] });
    }

    res.status(500).json({ message: "Server error, please try again" });
  }
};

const signin = async (req, res) => {
  try {
    const { email, phone, password } = req.body;

    if (!(email || phone) || !password) {
      return res.status(400).json({
        message: "Please provide email/phone and password",
      });
    }

    const user = await User.findOne({
      ...(email && { email }),
      ...(phone && { phone }),
    });
    if (!user) {
      return res.status(400).json({
        message: "Invalid email/phone",
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({
        message: "Invalid password",
      });
    }

    // Check if account is banned or suspended BEFORE issuing a token.
    // This is the enforcement — without this, banned users could still log in.
    if (user.status === "banned") {
      return res.status(403).json({
        message: "تم حظر حسابك. يرجى التواصل مع الدعم الفني.",
        banned: true,
      });
    }

    if (user.status === "suspended") {
      return res.status(403).json({
        message: "تم تعليق حسابك مؤقتاً. يرجى التواصل مع الدعم الفني.",
        suspended: true,
      });
    }

    const token = generateToken(user._id);
    res.json({
      message: "Login successful",
      token,
      user: user.toPublicJSON(),
    });
  } catch (error) {
    console.log("ERROR NAME:", error.name);
    console.log("ERROR MESSAGE:", error.message);
    console.log("FULL ERROR:", error);
    res.status(500).json({ message: "Server error, please try again" });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email, phone } = req.body;

    if (!(email || phone)) {
      return res.status(400).json({
        message: "Please provide email or phone",
      });
    }

    const user = await User.findOne({
      ...(email && { email }),
      ...(phone && { phone }),
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found with provided email or phone",
      });
    }

    const resetToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });
    user.resetPasswordToken = resetToken;
    user.resetPasswordTokenExpires = Date.now() + 3600000;
    await user.save();

    res.json({ message: "Forgot password endpoint - to be implemented" });
  } catch (error) {
    console.log("ERROR NAME:", error.name);
    console.log("ERROR MESSAGE:", error.message);
    console.log("FULL ERROR:", error);
    res.status(500).json({ message: "Server error, please try again" });
  }
};

const verifyEmail = async (req, res) => {
  try {
    const { code } = req.body
    const token = req.headers.authorization?.split(" ")[1]

    if (!token) {
      return res.status(401).json({ message: "No token provided" })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    const user = await User.findById(decoded.userId)

    if (!user) {
      return res.status(404).json({ message: "المسخدم غير موجود" })
    }

    if (user.verificationCode !== code) {
      return res.status(400).json({ message: "الكود غير صحيح" })
    }

    if (user.verificationCodeExpires < Date.now()) {
      return res.status(400).json({ message: "الكود غير صحيح او منتهي الصلاحية" })
    }

    user.isVerified = true
    user.verificationCode = null
    user.verificationCodeExpires = null
    await user.save()

    res.json({ message: "تم التحقق من البريد الإلكتروني بنجاح" })

  } catch (error) {
    res.status(500).json({ message: "حدث خطأ في الخادم، يرجى المحاولة لاحقًا" })
  }
}

const resendVerificationCode = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1]
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const user = await User.findById(decoded.userId)

    if (!user) {
      return res.status(404).json({ message: "المسخدم غير موجود" })
    }

    if (user.isVerified) {
      return res.status(400).json({ message: "المسخدم متحقق بالفعل" })
    }

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString()
    user.verificationCode = verificationCode
    user.verificationCodeExpires = Date.now() + 10 * 60 * 1000
    await user.save()

    if (user.email) {
      try {
        await sendVerificationEmail(user.email, verificationCode)
      } catch (emailError) {
        console.log("Email sending failed:", emailError.message)
      }
    }

    res.json({ message: "تم إرسال كود التحقق الجديد إلى بريدك الإلكتروني" })

  } catch (error) {
    res.status(500).json({ message: "حدث خطأ في الخادم، يرجى المحاولة لاحقًا" })
  }
}

// getMe - Returns the currently logged-in user's data.
// The authMiddleware already verified the token and attached the user to req.user,
// so this controller is very simple — just return the user data.
// The frontend calls this on page load to restore the session.
const getMe = async (req, res) => {
  try {
    res.json({ user: req.user.toPublicJSON() });
  } catch (error) {
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// ============================================================
// GET /api/auth/notifications
// ============================================================
// Returns the logged-in user's notifications (newest first).
const Notification = require("../Models/Notification");

const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(20);

    const unreadCount = await Notification.countDocuments({
      userId: req.user._id,
      isRead: false,
    });

    res.json({ notifications, unreadCount });
  } catch (error) {
    res.status(500).json({ message: "Server error fetching notifications" });
  }
};

// PUT /api/auth/notifications/read-all — mark all as read
const markNotificationsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user._id, isRead: false },
      { isRead: true }
    );
    res.json({ message: "All notifications marked as read" });
  } catch (error) {
    res.status(500).json({ message: "Server error updating notifications" });
  }
};

module.exports = { signup, signin, forgotPassword, verifyEmail, resendVerificationCode, getMe, getNotifications, markNotificationsRead }
