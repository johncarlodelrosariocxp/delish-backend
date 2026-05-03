// controllers/expenseController.js
const Expense = require("../models/Expense");
const Order = require("../models/orderModel");

// Get all expenses
exports.getExpenses = async (req, res) => {
  try {
    const { startDate, endDate, category } = req.query;
    let query = { isActive: true };

    if (startDate || endDate) {
      query.datePurchased = {};
      if (startDate) query.datePurchased.$gte = new Date(startDate);
      if (endDate) query.datePurchased.$lte = new Date(endDate);
    }

    if (category) {
      query.category = category;
    }

    const expenses = await Expense.find(query).sort({ datePurchased: -1 });

    const totalPurchased = expenses.reduce(
      (sum, exp) => sum + (exp.totalCost || 0),
      0,
    );
    const totalUsed = expenses.reduce(
      (sum, exp) => sum + (exp.usedQuantity || 0) * (exp.unitPrice || 0),
      0,
    );
    const totalRemaining = expenses.reduce(
      (sum, exp) => sum + (exp.remainingQuantity || 0) * (exp.unitPrice || 0),
      0,
    );

    res.json({
      success: true,
      data: expenses,
      count: expenses.length,
      summary: {
        totalPurchased: totalPurchased,
        totalUsed: totalUsed,
        totalRemaining: totalRemaining,
      },
    });
  } catch (error) {
    console.error("Error fetching expenses:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching expenses",
      error: error.message,
    });
  }
};

// Add new expense
exports.addExpense = async (req, res) => {
  try {
    const {
      itemName,
      description,
      category,
      quantity,
      unit,
      unitPrice,
      supplier,
      datePurchased,
      receiptNumber,
      notes,
    } = req.body;

    console.log("📦 Adding expense:", req.body);

    if (!itemName || !quantity || !unitPrice) {
      return res.status(400).json({
        success: false,
        message: "Item name, quantity, and unit price are required",
      });
    }

    const totalCost = Number(quantity) * Number(unitPrice);

    const expense = new Expense({
      itemName,
      description: description || "",
      category: category || "Ingredients",
      quantity: Number(quantity),
      usedQuantity: 0,
      remainingQuantity: Number(quantity),
      unit: unit || "pcs",
      unitPrice: Number(unitPrice),
      totalCost: totalCost,
      supplier: supplier || "",
      datePurchased: datePurchased || new Date(),
      receiptNumber: receiptNumber || "",
      notes: notes || "",
    });

    await expense.save();

    console.log("✅ Expense saved:", expense);

    res.status(201).json({
      success: true,
      message: "Expense added successfully",
      data: expense,
    });
  } catch (error) {
    console.error("Error adding expense:", error);
    res.status(400).json({
      success: false,
      message: "Error adding expense",
      error: error.message,
    });
  }
};

// Update expense
exports.updateExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const expense = await Expense.findById(id);
    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }

    Object.keys(updateData).forEach((key) => {
      if (
        key !== "_id" &&
        key !== "__v" &&
        key !== "createdAt" &&
        key !== "updatedAt"
      ) {
        expense[key] = updateData[key];
      }
    });

    if (updateData.quantity || updateData.unitPrice) {
      expense.totalCost = expense.quantity * expense.unitPrice;
      expense.remainingQuantity = expense.quantity - expense.usedQuantity;
    }

    await expense.save();

    res.json({
      success: true,
      message: "Expense updated successfully",
      data: expense,
    });
  } catch (error) {
    console.error("Error updating expense:", error);
    res.status(400).json({
      success: false,
      message: "Error updating expense",
      error: error.message,
    });
  }
};

// Delete expense
exports.deleteExpense = async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }

    expense.isActive = false;
    await expense.save();

    res.json({
      success: true,
      message: "Expense deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting expense:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting expense",
      error: error.message,
    });
  }
};

// Get inventory value (remaining stock) - Uses Inventory model now
exports.getInventoryValue = async (req, res) => {
  try {
    const Inventory = require("../models/Inventory");
    const expenses = await Inventory.find({
      isActive: true,
      remainingQuantity: { $gt: 0 },
    });

    const inventoryValue = expenses.reduce(
      (sum, exp) => sum + exp.remainingQuantity * exp.unitPrice,
      0,
    );
    const items = expenses.map((exp) => ({
      itemName: exp.itemName,
      remainingQuantity: exp.remainingQuantity,
      unit: exp.unit,
      unitPrice: exp.unitPrice,
      value: exp.remainingQuantity * exp.unitPrice,
    }));

    res.json({
      success: true,
      data: {
        totalInventoryValue: inventoryValue,
        items: items,
        count: items.length,
      },
    });
  } catch (error) {
    console.error("Error getting inventory value:", error);
    res.status(500).json({
      success: false,
      message: "Error getting inventory value",
      error: error.message,
    });
  }
};

// Get profit/loss report
exports.getProfitLossReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    console.log("=========================================");
    console.log("📊 PROFIT & LOSS REPORT");
    console.log("📅 Date Range:", { startDate, endDate });
    console.log("=========================================");

    const ordersDateFilter = {};
    const expensesDateFilter = {};

    if (startDate && endDate) {
      ordersDateFilter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
      expensesDateFilter.datePurchased = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const orders = await Order.find({
      orderStatus: "completed",
      ...ordersDateFilter,
    });

    console.log(`📋 Total completed orders: ${orders.length}`);

    let totalIncome = 0;
    for (const order of orders) {
      totalIncome += order.totalAmount || 0;
    }

    console.log(`💰 TOTAL INCOME: ₱${totalIncome.toFixed(2)}`);

    const Inventory = require("../models/Inventory");
    const expenses = await Inventory.find({
      isActive: true,
      ...expensesDateFilter,
    });

    let totalExpenses = 0;
    for (const expense of expenses) {
      totalExpenses += expense.totalCost || 0;
    }

    console.log(
      `💸 TOTAL EXPENSES (LAHAT NG BINILI): ₱${totalExpenses.toFixed(2)}`,
    );

    const totalProfit = totalIncome - totalExpenses;
    const profitMargin =
      totalIncome > 0 ? (totalProfit / totalIncome) * 100 : 0;

    console.log(`📈 TOTAL PROFIT: ₱${totalProfit.toFixed(2)}`);
    console.log(`📊 PROFIT MARGIN: ${profitMargin.toFixed(2)}%`);
    console.log("=========================================");

    const expensesBreakdown = expenses.map((exp) => ({
      itemName: exp.itemName,
      category: exp.category,
      quantity: exp.quantity,
      unit: exp.unit,
      unitPrice: exp.unitPrice,
      totalCost: exp.totalCost,
      datePurchased: exp.datePurchased,
    }));

    const ordersBreakdown = [];
    const orderItemsMap = new Map();

    for (const order of orders) {
      for (const item of order.items || []) {
        const key = item.name;
        if (orderItemsMap.has(key)) {
          const existing = orderItemsMap.get(key);
          existing.totalQuantity += item.quantity || 0;
          existing.totalRevenue += (item.price || 0) * (item.quantity || 0);
        } else {
          orderItemsMap.set(key, {
            _id: key,
            totalQuantity: item.quantity || 0,
            totalRevenue: (item.price || 0) * (item.quantity || 0),
          });
        }
      }
    }

    for (const [key, value] of orderItemsMap) {
      ordersBreakdown.push({
        ...value,
        profit: value.totalRevenue,
      });
    }

    ordersBreakdown.sort((a, b) => b.totalRevenue - a.totalRevenue);

    res.json({
      success: true,
      data: {
        summary: {
          totalIncome: totalIncome,
          totalExpenses: totalExpenses,
          totalProfit: totalProfit,
          profitMargin: profitMargin.toFixed(2) + "%",
          totalOrders: orders.length,
          totalExpenseItems: expenses.length,
          averageOrderValue:
            orders.length > 0 ? totalIncome / orders.length : 0,
        },
        expenses: expensesBreakdown,
        ordersBreakdown: ordersBreakdown,
        dateRange: {
          startDate: startDate || "all time",
          endDate: endDate || "present",
        },
      },
    });
  } catch (error) {
    console.error("❌ Error getting profit/loss report:", error);
    res.status(500).json({
      success: false,
      message: "Error getting profit/loss report",
      error: error.message,
    });
  }
};
