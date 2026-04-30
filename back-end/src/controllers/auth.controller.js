const User = require("../Models/User.Model");
const jwt = require("jsonwebtoken");
const { sendVerificationEmail, sendPasswordResetEmail } = require("../config/email");

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

// ============================================================
// POST /api/auth/forgot-password
// ============================================================
// Body: { email? } | { phone? }
// Generates a 1-hour reset JWT, stashes it on the user, and emails the link.
// SMS-based reset for phone-only users isn't wired yet — those accounts get a
// 200 OK with no email sent (we don't disclose which channel succeeded).
//
// Security note: we always respond 200 OK even if the user wasn't found, to
// avoid leaking which emails/phones are registered. The Arabic message is
// generic on purpose.
const forgotPassword = async (req, res) => {
  try {
    const { email, phone } = req.body;

    if (!(email || phone)) {
      return res.status(400).json({
        message: "يرجى إدخال البريد الإلكتروني أو رقم الهاتف",
      });
    }

    const user = await User.findOne({
      ...(email && { email }),
      ...(phone && { phone }),
    });

    // The "always 200" pattern — only do real work when the account exists,
    // but never tell the client whether it does.
    if (user) {
      const resetToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
        expiresIn: "1h",
      });
      user.resetPasswordToken = resetToken;
      user.resetPasswordTokenExpires = Date.now() + 3600000;
      await user.save();

      if (user.email) {
        // Send via email. await so a transport error surfaces in our logs.
        try {
          await sendPasswordResetEmail(user.email, resetToken);
        } catch (mailErr) {
          console.error("sendPasswordResetEmail failed:", mailErr);
          // Still 200 OK to the client — the user can retry. We don't want
          // to expose mail-transport hiccups to attackers either.
        }
      }
      // Phone-only users currently get no SMS. When we wire SMS, branch here.
    }

    res.json({
      message: "إذا كان الحساب موجوداً، فقد أرسلنا تعليمات إعادة التعيين.",
    });
  } catch (error) {
    console.log("ERROR NAME:", error.name);
    console.log("ERROR MESSAGE:", error.message);
    console.log("FULL ERROR:", error);
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// ============================================================
// POST /api/auth/reset-password
// ============================================================
// Body: { token, password, confirmPassword }
// Verifies the JWT and matches it against the user's stored
// resetPasswordToken (so a leaked-but-revoked token can't be reused). Hashes
// the new password and clears the reset state.
const resetPassword = async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body || {};

    if (!token) {
      return res.status(400).json({ message: "رابط الاستعادة غير صالح" });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({
        message: "كلمة المرور يجب أن تكون 6 أحرف على الأقل",
      });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ message: "كلمتا المرور غير متطابقتين" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(400).json({
        message: "رابط الاستعادة منتهي الصلاحية أو غير صالح",
      });
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(400).json({
        message: "رابط الاستعادة غير صالح",
      });
    }
    // Match the JWT against the stored copy so a token revoked by a newer
    // forgot-password request can't be re-used.
    if (
      !user.resetPasswordToken ||
      user.resetPasswordToken !== token ||
      !user.resetPasswordTokenExpires ||
      user.resetPasswordTokenExpires < Date.now()
    ) {
      return res.status(400).json({
        message: "رابط الاستعادة منتهي الصلاحية. يرجى طلب رابط جديد.",
      });
    }

    // Assign the plaintext — the User model's pre('save') hook hashes it.
    // Manually calling bcrypt.hash here would double-hash and break login.
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordTokenExpires = undefined;
    await user.save();

    res.json({ message: "تم تحديث كلمة المرور بنجاح" });
  } catch (error) {
    console.error("resetPassword error:", error);
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

module.exports = { signup, signin, forgotPassword, resetPassword, verifyEmail, resendVerificationCode, getMe, getNotifications, markNotificationsRead }
