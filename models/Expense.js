const mongoose = require("mongoose");

const expenseSchema = new mongoose.Schema(
  {
    itemName: {
      type: String,
      required: [true, "Item name is required"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    category: {
      type: String,
      enum: ["Ingredients", "Supplies", "Equipment", "Utilities", "Other"],
      default: "Ingredients",
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    usedQuantity: {
      type: Number,
      default: 0,
    },
    remainingQuantity: {
      type: Number,
      default: 0,
    },
    unit: {
      type: String,
      default: "pcs",
      enum: ["pcs", "kg", "g", "L", "ml", "box", "pack", "sack", "bottle"],
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    totalCost: {
      type: Number,
      required: true,
      min: 0,
    },
    supplier: {
      type: String,
      trim: true,
      default: "",
    },
    datePurchased: {
      type: Date,
      default: Date.now,
    },
    receiptNumber: {
      type: String,
      trim: true,
      default: "",
    },
    notes: {
      type: String,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

// Auto-calculate totalCost and remainingQuantity before saving
expenseSchema.pre("save", function (next) {
  if (this.quantity && this.unitPrice) {
    this.totalCost = this.quantity * this.unitPrice;
  }
  this.remainingQuantity = this.quantity - this.usedQuantity;
  next();
});

// Method to use expense in order
expenseSchema.methods.useStock = async function (quantity) {
  if (this.remainingQuantity < quantity) {
    throw new Error(
      `Insufficient stock for ${this.itemName}. Available: ${this.remainingQuantity}`,
    );
  }
  this.usedQuantity += quantity;
  this.remainingQuantity = this.quantity - this.usedQuantity;
  await this.save();
  return {
    itemName: this.itemName,
    quantityUsed: quantity,
    costPerUnit: this.unitPrice,
    totalCost: quantity * this.unitPrice,
  };
};

module.exports = mongoose.model("Expense", expenseSchema);
