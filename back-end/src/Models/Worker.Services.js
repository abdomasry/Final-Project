const mongoose = require("mongoose");

const workerServicesSchema = new mongoose.Schema(
  {
    workerID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WorkerProfile",
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    },
    description: String,
    price: Number,
    typeofService: {
      type: String,
      enum: ["hourly", "fixed"],
      default: "fixed",
    },
    time: Date,
    priceRange: {
      min: { type: Number },
      max: { type: Number },
      custom: { type: String },
    },
    active: Boolean,
    teamNumber: Number,
  },
  { timestamps: true },
);

module.exports = mongoose.model("WorkerServices", workerServicesSchema);
