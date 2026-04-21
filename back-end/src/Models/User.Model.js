const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
      minlength: [3, "First name must be at least 3 characters long"],
    },
    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
      minlength: [3, "Last name must be at least 3 characters long"],
    },
    email: {
      type: String,
      lowercase: true,
      sparse: true,
      unique: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email",
      ],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters long"],
    },
    resetPasswordToken: {
      type: String,
      default: null,
    },
    resetPasswordTokenExpires: {
      type: Date,
      default: null,
    },
    phone: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      match: [
        /^(01[0125][0-9]{8}|\+20\d{10})$/,
        "Please enter a valid phone number",
      ],
    },
    role: {
      type: String,
      enum: ["customer", "worker", "admin"],
      default: "customer",
    },
    profileImage: String,
    bio: String,
    location: {
      city: String,
      area: String,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationCode: {
      type: String,
      default: null,
    },

    verificationCodeExpires: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ["active", "suspended", "banned"],
      default: "active",
    },
    // ============================================================
    // Notification Preferences
    // ============================================================
    // Controls what types of notifications the user wants to receive.
    // Each key is a notification category with a Boolean toggle.
    //
    // This is a "nested object" in the schema — Mongoose lets you
    // define sub-fields directly. Each has a default of `true`,
    // meaning new users get ALL notifications by default (opt-out model).
    //
    // An "opt-out" model is better UX than "opt-in" because:
    //   - Users get useful notifications from day one
    //   - They can turn off what they don't want later
    //   - Most users never change defaults, so they stay informed
    // ============================================================
    notificationPreferences: {
      orders: { type: Boolean, default: true },       // Order status updates
      messages: { type: Boolean, default: true },     // Chat messages from workers
      promotions: { type: Boolean, default: true },   // Deals, offers, marketing
    },

    blockedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true },
);

userSchema.pre("save", async function () {
  if (!this.isModified("password")) {
    return;
  }
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toPublicJSON = function () {
  return {
    id: this._id,
    firstName: this.firstName,
    lastName: this.lastName,
    ...(this.email && { email: this.email }),
    ...(this.phone && { phone: this.phone }),
    ...(this.profileImage && { profileImage: this.profileImage }),
    role: this.role,
    isVerified: this.isVerified,
    notificationPreferences: this.notificationPreferences,
  };
};

userSchema.methods.isResetTokenValid = function () {
  return (
    this.resetPasswordTokenExpires > Date.now() &&
    this.resetPasswordToken !== null
  );
};

module.exports = mongoose.model("User", userSchema);
