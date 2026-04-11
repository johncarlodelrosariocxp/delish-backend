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
    
    const totalPurchased = expenses.reduce((sum, exp) => sum + (exp.totalCost || 0), 0);
    const totalUsed = expenses.reduce((sum, exp) => sum + ((exp.usedQuantity || 0) * (exp.unitPrice || 0)), 0);
    const totalRemaining = expenses.reduce((sum, exp) => sum + ((exp.remainingQuantity || 0) * (exp.unitPrice || 0)), 0);

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

    Object.keys(updateData).forEach(key => {
      if (key !== '_id' && key !== '__v' && key !== 'createdAt' && key !== 'updatedAt') {
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

// Get inventory value (remaining stock)
exports.getInventoryValue = async (req, res) => {
  try {
    const expenses = await Expense.find({ isActive: true, remainingQuantity: { $gt: 0 } });
    
    const inventoryValue = expenses.reduce((sum, exp) => sum + (exp.remainingQuantity * exp.unitPrice), 0);
    const items = expenses.map(exp => ({
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

// Get profit/loss report (Income vs Expenses USED only)
exports.getProfitLossReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    console.log("📊 Generating profit/loss report for:", { startDate, endDate });
    
    // Get TOTAL SALES from orders (Income)
    const ordersQuery = { orderStatus: "completed" };
    if (startDate || endDate) {
      ordersQuery.createdAt = {};
      if (startDate) ordersQuery.createdAt.$gte = new Date(startDate);
      if (endDate) ordersQuery.createdAt.$lte = new Date(endDate);
    }

    const orders = await Order.find(ordersQuery);
    const totalIncome = orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
    const totalOrders = orders.length;
    const averageOrderValue = totalOrders > 0 ? totalIncome / totalOrders : 0;

    console.log("💰 Total Income:", totalIncome, "from", totalOrders, "orders");

    // Get EXPENSES SUMMARY (Purchased vs Used vs Remaining)
    const expensesSummary = await Expense.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          totalPurchased: { $sum: "$totalCost" },
          totalUsedCost: { $sum: { $multiply: ["$usedQuantity", "$unitPrice"] } },
          totalRemainingValue: { $sum: { $multiply: ["$remainingQuantity", "$unitPrice"] } },
          totalUsedQuantity: { $sum: "$usedQuantity" },
        }
      }
    ]);

    const totalPurchased = expensesSummary.length > 0 ? expensesSummary[0].totalPurchased : 0;
    const totalExpensesUsed = expensesSummary.length > 0 ? expensesSummary[0].totalUsedCost : 0;
    const remainingInventoryValue = expensesSummary.length > 0 ? expensesSummary[0].totalRemainingValue : 0;
    const totalUsedQuantity = expensesSummary.length > 0 ? expensesSummary[0].totalUsedQuantity : 0;

    console.log("💸 Total Expenses Used:", totalExpensesUsed);
    console.log("📦 Total Purchased:", totalPurchased);
    console.log("📦 Remaining Inventory Value:", remainingInventoryValue);

    // Calculate PROFIT (Income minus Expenses USED only)
    const totalProfit = totalIncome - totalExpensesUsed;
    const profitMargin = totalIncome > 0 ? (totalProfit / totalIncome) * 100 : 0;

    // Get breakdown ng mga ginamit na expenses
    const expensesUsedBreakdown = await Expense.aggregate([
      { $match: { isActive: true, usedQuantity: { $gt: 0 } } },
      {
        $project: {
          itemName: 1,
          category: 1,
          purchasedQuantity: "$quantity",
          usedQuantity: 1,
          remainingQuantity: 1,
          usedCost: { $multiply: ["$usedQuantity", "$unitPrice"] },
          unitPrice: 1,
          unit: 1,
        }
      },
      { $sort: { usedCost: -1 } }
    ]);

    // Get orders breakdown
    const ordersBreakdown = await Order.aggregate([
      { $match: { orderStatus: "completed" } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.name",
          totalQuantity: { $sum: "$items.quantity" },
          totalRevenue: { $sum: { $multiply: ["$items.quantity", "$items.price"] } },
          totalCost: { $sum: "$items.totalCost" },
        }
      },
      {
        $addFields: {
          profit: { $subtract: ["$totalRevenue", "$totalCost"] },
          margin: {
            $cond: [
              { $eq: ["$totalRevenue", 0] },
              0,
              { $multiply: [{ $divide: [{ $subtract: ["$totalRevenue", "$totalCost"] }, "$totalRevenue"] }, 100] }
            ]
          }
        }
      },
      { $sort: { totalRevenue: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        summary: {
          totalIncome: totalIncome,
          totalExpensesUsed: totalExpensesUsed,
          totalPurchased: totalPurchased,
          remainingInventoryValue: remainingInventoryValue,
          totalProfit: totalProfit,
          profitMargin: profitMargin.toFixed(2) + "%",
          totalOrders: totalOrders,
          averageOrderValue: averageOrderValue,
          totalExpenseItems: expensesUsedBreakdown.length,
          totalUsedQuantity: totalUsedQuantity,
        },
        expensesUsed: expensesUsedBreakdown,
        ordersBreakdown: ordersBreakdown,
        dateRange: {
          startDate: startDate || "all time",
          endDate: endDate || "present",
        },
      },
    });
  } catch (error) {
    console.error("Error getting profit/loss report:", error);
    res.status(500).json({
      success: false,
      message: "Error getting profit/loss report",
      error: error.message,
    });
  }
};