const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  total: {
    type: Number,
    required: true,
    min: 0,
  },
});

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
    },
    customerDetails: {
      name: {
        type: String,
        default: "Walk-in Customer",
      },
      phone: {
        type: String,
        default: "N/A",
      },
      guests: {
        type: Number,
        default: 1,
      },
    },
    orderStatus: {
      type: String,
      default: "pending",
      enum: [
        "pending",
        "confirmed",
        "preparing",
        "ready",
        "served",
        "completed",
        "cancelled",
      ],
    },
    orderDate: {
      type: Date,
      default: Date.now,
    },
    bills: {
      total: {
        type: Number,
        default: 0,
      },
      tax: {
        type: Number,
        default: 0,
      },
      totalWithTax: {
        type: Number,
        default: 0,
      },
    },
    items: [orderItemSchema],
    table: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Table",
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    paymentMethod: {
      type: String,
      default: "cash",
      enum: ["cash", "card", "online", "wallet", "upi"],
    },
    paymentStatus: {
      type: String,
      default: "pending",
      enum: ["pending", "paid", "partial", "refunded", "failed"],
    },
    paymentData: {
      razorpay_order_id: String,
      razorpay_payment_id: String,
    },
    notes: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Generate order number before saving
orderSchema.pre("save", async function (next) {
  if (this.isNew) {
    const today = new Date();
    const dateStr = today.toISOString().slice(2, 10).replace(/-/g, "");
    const count = await this.constructor.countDocuments({
      createdAt: {
        $gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
        $lt: new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate() + 1
        ),
      },
    });
    this.orderNumber = `ORD-${dateStr}-${(count + 1)
      .toString()
      .padStart(4, "0")}`;
  }

  // Calculate totals if items exist
  if (this.items && this.items.length > 0) {
    const subtotal = this.items.reduce(
      (sum, item) => sum + (item.total || 0),
      0
    );
    this.bills.total = subtotal;
    this.bills.totalWithTax = subtotal + this.bills.tax;
  }

  next();
});

// Virtual for formatted date
orderSchema.virtual("formattedDate").get(function () {
  return this.createdAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
});

// Virtual for formatted time
orderSchema.virtual("formattedTime").get(function () {
  return this.createdAt.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
});

module.exports = mongoose.model("Order", orderSchema);
