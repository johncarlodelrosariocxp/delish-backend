// models/ProfitLoss.js
const mongoose = require("mongoose");

const profitLossSchema = new mongoose.Schema(
  {
    reportDate: {
      type: Date,
      default: Date.now,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    totalIncome: {
      type: Number,
      default: 0,
    },
    totalExpensesUsed: {
      type: Number,
      default: 0,
    },
    totalPurchased: {
      type: Number,
      default: 0,
    },
    remainingInventoryValue: {
      type: Number,
      default: 0,
    },
    totalProfit: {
      type: Number,
      default: 0,
    },
    profitMargin: {
      type: Number,
      default: 0,
    },
    totalOrders: {
      type: Number,
      default: 0,
    },
    averageOrderValue: {
      type: Number,
      default: 0,
    },
    totalExpenseItems: {
      type: Number,
      default: 0,
    },
    expensesUsedBreakdown: [
      {
        itemName: String,
        category: String,
        usedQuantity: Number,
        usedCost: Number,
        unitPrice: Number,
      },
    ],
    orders: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Order",
      },
    ],
    expenses: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Expense",
      },
    ],
    reportType: {
      type: String,
      enum: ["daily", "weekly", "monthly", "yearly", "custom"],
      default: "custom",
    },
    generatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

profitLossSchema.index({ startDate: 1, endDate: 1 });
profitLossSchema.index({ reportDate: -1 });
profitLossSchema.index({ reportType: 1 });

module.exports = mongoose.model("ProfitLoss", profitLossSchema);