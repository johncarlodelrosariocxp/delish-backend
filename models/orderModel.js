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
    required: true,
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
      required: true,
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
    // Remove the tableId field since you're using a string table field
    // tableId: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: "Table",
    //   default: null,
    // },
    // Table field - made optional (not required)
    table: {
      type: String,
      default: "",
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
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
    // Generate order number if not provided
    if (!this.orderNumber) {
      const timestamp = Date.now();
      const randomSuffix = Math.floor(Math.random() * 1000);
      this.orderNumber = `ORD-${timestamp}-${randomSuffix}`;
    }

    // Generate orderId if not provided
    if (!this.orderId) {
      const timestamp = Date.now();
      const randomSuffix = Math.floor(Math.random() * 10000);
      this.orderId = `order-${timestamp}-${randomSuffix}`;
    }

    // Calculate totals from items if not provided
    if (this.items && this.items.length > 0 && !this.totalAmount) {
      const subtotal = this.items.reduce((sum, item) => {
        if (item.isRedeemed) return sum;
        return sum + (item.price || 0);
      }, 0);

      this.totalAmount = subtotal;

      // Update bills if not set
      if (!this.bills.totalWithTax) {
        this.bills.totalWithTax = this.totalAmount;
      }
    }

    // Set cashier name from user if available
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

  // Calculate derived fields
  if (this.isModified("totalAmount") || this.isModified("bills")) {
    // Ensure bills object exists
    if (!this.bills) {
      this.bills = {};
    }

    // Calculate amount paid
    this.amountPaid = (this.cashAmount || 0) + (this.onlineAmount || 0);

    // Calculate remaining balance
    if (this.isPartialPayment) {
      this.remainingBalance = Math.max(0, this.totalAmount - this.amountPaid);
    } else {
      this.remainingBalance = 0;
    }

    // Calculate change
    if (this.amountPaid > this.totalAmount) {
      this.change = this.amountPaid - this.totalAmount;
    } else {
      this.change = 0;
    }

    // Update payment status based on payment
    if (this.amountPaid >= this.totalAmount) {
      this.paymentStatus = "completed";
      this.isPartialPayment = false;
      this.remainingBalance = 0;
    } else if (this.amountPaid > 0 && this.amountPaid < this.totalAmount) {
      this.paymentStatus = "partial";
      this.isPartialPayment = true;
    } else {
      this.paymentStatus = "pending";
    }

    // Sync payment details with bills
    if (this.paymentDetails) {
      this.paymentDetails.cashAmount = this.cashAmount || 0;
      this.paymentDetails.onlineAmount = this.onlineAmount || 0;
      this.paymentDetails.isPartialPayment = this.isPartialPayment;
      this.paymentDetails.remainingBalance = this.remainingBalance;
    }
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

// Virtual for customer name (for backward compatibility)
orderSchema.virtual("customerName").get(function () {
  return this.customerDetails?.name || "Walk-in Customer";
});

// Virtual for customer phone (for backward compatibility)
orderSchema.virtual("customerPhone").get(function () {
  return this.customerDetails?.phone || "";
});

// Static method to find active orders
orderSchema.statics.findActiveOrders = function () {
  return this.find({
    orderStatus: {
      $in: ["pending", "processing", "in-progress", "confirmed", "preparing"],
    },
  }).sort({ createdAt: 1 });
};

// Static method to find completed orders
orderSchema.statics.findCompletedOrders = function (startDate, endDate) {
  const query = {
    orderStatus: "completed",
  };

  if (startDate && endDate) {
    query.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  return this.find(query).sort({ createdAt: -1 });
};

// Instance method to add item to order
orderSchema.methods.addItem = function (itemData) {
  this.items.push(itemData);

  // Recalculate totals
  const subtotal = this.items.reduce((sum, item) => {
    if (item.isRedeemed) return sum;
    return sum + (item.price || 0);
  }, 0);

  this.totalAmount = subtotal;
  this.bills.totalWithTax = this.totalAmount;

  return this.save();
};

// Instance method to update payment
orderSchema.methods.updatePayment = function (paymentData) {
  if (paymentData.cashAmount !== undefined) {
    this.cashAmount = paymentData.cashAmount;
  }

  if (paymentData.onlineAmount !== undefined) {
    this.onlineAmount = paymentData.onlineAmount;
  }

  if (paymentData.paymentMethod) {
    this.paymentMethod = paymentData.paymentMethod;
  }

  if (paymentData.onlineMethod) {
    this.bills.onlineMethod = paymentData.onlineMethod;
    if (this.paymentDetails) {
      this.paymentDetails.onlineMethod = paymentData.onlineMethod;
    }
  }

  return this.save();
};

// Indexes for better performance
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ orderStatus: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ user: 1 });
orderSchema.index({ "customerDetails.name": 1 });
orderSchema.index({ table: 1 }); // Index for the new table field

module.exports = mongoose.model("Order", orderSchema);
