// models/orderModel.js
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
  pricePerQuantity: {
    type: Number,
    required: false,
    default: 0,
    min: 0,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  originalPrice: {
    type: Number,
    default: 0,
  },
  isRedeemed: {
    type: Boolean,
    default: false,
  },
  isPwdSeniorDiscounted: {
    type: Boolean,
    default: false,
  },
  category: {
    type: String,
    enum: ["drink", "food", "other"],
    default: "other",
  },
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "MenuItem",
  },
  expenseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Expense",
    default: null,
  },
  costPerUnit: {
    type: Number,
    default: 0,
  },
  totalCost: {
    type: Number,
    default: 0,
  },
});

const billsSchema = new mongoose.Schema({
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
  discount: {
    type: Number,
    default: 0,
  },
  pwdSeniorDiscount: {
    type: Number,
    default: 0,
  },
  pwdSeniorDiscountedValue: {
    type: Number,
    default: 0,
  },
  employeeDiscount: {
    type: Number,
    default: 0,
  },
  shareholderDiscount: {
    type: Number,
    default: 0,
  },
  redemptionDiscount: {
    type: Number,
    default: 0,
  },
  netSales: {
    type: Number,
    default: 0,
  },
  cashAmount: {
    type: Number,
    default: 0,
  },
  onlineAmount: {
    type: Number,
    default: 0,
  },
  onlineMethod: {
    type: String,
    enum: ["BDO", "GCASH", null],
    default: null,
  },
  change: {
    type: Number,
    default: 0,
  },
  isPartialPayment: {
    type: Boolean,
    default: false,
  },
  remainingBalance: {
    type: Number,
    default: 0,
  },
  amountPaid: {
    type: Number,
    default: 0,
  },
});

const customerDetailsSchema = new mongoose.Schema({
  name: {
    type: String,
    default: "Walk-in Customer",
  },
  phone: {
    type: String,
    default: "",
  },
  guests: {
    type: Number,
    default: 1,
  },
  email: {
    type: String,
    default: "",
  },
  address: {
    type: String,
    default: "",
  },
});

const paymentDetailsSchema = new mongoose.Schema({
  cashAmount: {
    type: Number,
    default: 0,
  },
  onlineAmount: {
    type: Number,
    default: 0,
  },
  onlineMethod: {
    type: String,
    enum: ["BDO", "GCASH", null],
    default: null,
  },
  isMixedPayment: {
    type: Boolean,
    default: false,
  },
  isPartialPayment: {
    type: Boolean,
    default: false,
  },
  remainingBalance: {
    type: Number,
    default: 0,
  },
  paymentMethodDisplay: {
    type: String,
    default: "Cash",
  },
});

const pwdSeniorDetailsSchema = new mongoose.Schema({
  name: {
    type: String,
    default: "",
  },
  idNumber: {
    type: String,
    default: "",
  },
  type: {
    type: String,
    enum: ["PWD", "Senior"],
    default: "PWD",
  },
});

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
    },
    orderId: {
      type: String,
      unique: true,
    },
    customerDetails: customerDetailsSchema,
    customerType: {
      type: String,
      enum: ["walk-in", "take-out"],
      default: "walk-in",
    },
    customerStatus: {
      type: String,
      enum: ["Dine-in", "Take-out", "Delivery"],
      default: "Dine-in",
    },
    items: [orderItemSchema],
    bills: billsSchema,
    paymentMethod: {
      type: String,
      enum: ["Cash", "BDO", "GCASH", "Mixed"],
      default: "Cash",
    },
    paymentDetails: paymentDetailsSchema,
    paymentStatus: {
      type: String,
      enum: ["pending", "completed", "partial", "failed", "refunded"],
      default: "pending",
    },
    orderStatus: {
      type: String,
      enum: [
        "pending",
        "processing",
        "in-progress",
        "completed",
        "cancelled",
        "served",
        "confirmed",
        "preparing",
        "ready",
      ],
      default: "pending",
    },
    pwdSeniorDetails: pwdSeniorDetailsSchema,
    pwdSeniorDiscountApplied: {
      type: Boolean,
      default: false,
    },
    pwdSeniorSelectedItems: [orderItemSchema],
    cashier: {
      type: String,
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    table: {
      type: String,
      default: "",
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    totalCost: {
      type: Number,
      default: 0,
    },
    profit: {
      type: Number,
      default: 0,
    },
    cashAmount: {
      type: Number,
      default: 0,
    },
    onlineAmount: {
      type: Number,
      default: 0,
    },
    change: {
      type: Number,
      default: 0,
    },
    isPartialPayment: {
      type: Boolean,
      default: false,
    },
    remainingBalance: {
      type: Number,
      default: 0,
    },
    amountPaid: {
      type: Number,
      default: 0,
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
    if (!this.orderNumber) {
      const timestamp = Date.now();
      const randomSuffix = Math.floor(Math.random() * 1000);
      this.orderNumber = `ORD-${timestamp}-${randomSuffix}`;
    }
    if (!this.orderId) {
      const timestamp = Date.now();
      const randomSuffix = Math.floor(Math.random() * 10000);
      this.orderId = `order-${timestamp}-${randomSuffix}`;
    }
    if (this.user && !this.cashier) {
      try {
        const User = mongoose.model("User");
        const user = await User.findById(this.user);
        if (user) {
          this.cashier = user.name || "Unknown Cashier";
        }
      } catch (error) {
        console.error("Error fetching user for cashier name:", error);
      }
    }
  }

  if (this.items && this.items.length > 0) {
    this.totalCost = this.items.reduce((sum, item) => sum + (item.totalCost || 0), 0);
    this.profit = (this.totalAmount || 0) - this.totalCost;
  }

  next();
});

// Virtuals
orderSchema.virtual("formattedDate").get(function () {
  return this.createdAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
});

orderSchema.virtual("formattedTime").get(function () {
  return this.createdAt.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
});

orderSchema.virtual("customerName").get(function () {
  return this.customerDetails?.name || "Walk-in Customer";
});

orderSchema.virtual("customerPhone").get(function () {
  return this.customerDetails?.phone || "";
});

// Static method for financial summary
orderSchema.statics.getFinancialSummary = async function (startDate, endDate) {
  const match = { orderStatus: "completed" };
  
  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) match.createdAt.$gte = new Date(startDate);
    if (endDate) match.createdAt.$lte = new Date(endDate);
  }

  const summary = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: "$totalAmount" },
        totalCost: { $sum: "$totalCost" },
        totalProfit: { $sum: "$profit" },
        totalOrders: { $sum: 1 },
        avgOrderValue: { $avg: "$totalAmount" },
      }
    }
  ]);

  return summary[0] || {
    totalRevenue: 0,
    totalCost: 0,
    totalProfit: 0,
    totalOrders: 0,
    avgOrderValue: 0,
  };
};

// Indexes
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ orderStatus: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ user: 1 });
orderSchema.index({ "customerDetails.name": 1 });
orderSchema.index({ table: 1 });

module.exports = mongoose.model("Order", orderSchema);