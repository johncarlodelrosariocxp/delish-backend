const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    customerDetails: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      guests: { type: Number, required: true },
    },
    orderStatus: {
      type: String,
      required: true,
      enum: ["Pending", "Processing", "Completed", "Cancelled"], // ADD THIS
      default: "Pending", // ADD THIS
    },
    orderDate: {
      type: Date,
      default: Date.now,
    },
    bills: {
      total: { type: Number, required: true },
      tax: { type: Number, required: true },
      totalWithTax: { type: Number, required: true },
    },
    items: [],
    table: { type: mongoose.Schema.Types.ObjectId, ref: "Table" },
    paymentMethod: String,
    // ADD paymentStatus field
    paymentStatus: {
      type: String,
      enum: ["Pending", "Partial", "Completed", "Failed", "Refunded"], // ADD THIS
      default: "Pending", // ADD THIS
    },
    paymentData: {
      razorpay_order_id: String,
      razorpay_payment_id: String,
    },
    // ADDED: User reference
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // ADD: Optional fields for better tracking
    orderNumber: { type: String, unique: true },
    isPartialPayment: { type: Boolean, default: false },
    remainingBalance: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
