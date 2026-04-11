// controllers/profitLossController.js
const ProfitLoss = require("../models/ProfitLoss");
const Order = require("../models/orderModel");
const Expense = require("../models/Expense");

// Generate and save profit/loss report
exports.generateProfitLoss = async (req, res) => {
  try {
    const { startDate, endDate, reportType = "custom" } = req.body;
    
    let start = startDate ? new Date(startDate) : new Date();
    let end = endDate ? new Date(endDate) : new Date();
    
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    
    // Get orders within date range
    const orders = await Order.find({
      orderStatus: "completed",
      createdAt: { $gte: start, $lte: end },
    });
    
    // Get expenses within date range
    const expenses = await Expense.find({
      isActive: true,
      datePurchased: { $gte: start, $lte: end },
    });
    
    // Calculate totals
    const totalIncome = orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
    const totalOrders = orders.length;
    const averageOrderValue = totalOrders > 0 ? totalIncome / totalOrders : 0;
    
    // Calculate expenses used (yung nagamit lang sa orders)
    const expensesSummary = await Expense.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          totalPurchased: { $sum: "$totalCost" },
          totalUsedCost: { $sum: { $multiply: ["$usedQuantity", "$unitPrice"] } },
          totalRemainingValue: { $sum: { $multiply: ["$remainingQuantity", "$unitPrice"] } },
        }
      }
    ]);
    
    const totalPurchased = expensesSummary.length > 0 ? expensesSummary[0].totalPurchased : 0;
    const totalExpensesUsed = expensesSummary.length > 0 ? expensesSummary[0].totalUsedCost : 0;
    const remainingInventoryValue = expensesSummary.length > 0 ? expensesSummary[0].totalRemainingValue : 0;
    
    const totalProfit = totalIncome - totalExpensesUsed;
    const profitMargin = totalIncome > 0 ? (totalProfit / totalIncome) * 100 : 0;
    
    // Get breakdown ng mga ginamit na expenses
    const expensesUsedBreakdown = await Expense.aggregate([
      { $match: { isActive: true, usedQuantity: { $gt: 0 } } },
      {
        $project: {
          itemName: 1,
          category: 1,
          usedQuantity: 1,
          usedCost: { $multiply: ["$usedQuantity", "$unitPrice"] },
          unitPrice: 1,
        }
      },
      { $sort: { usedCost: -1 } }
    ]);
    
    // Create and save profit/loss report
    const profitLossReport = new ProfitLoss({
      startDate: start,
      endDate: end,
      totalIncome,
      totalExpensesUsed,
      totalPurchased,
      remainingInventoryValue,
      totalProfit,
      profitMargin,
      totalOrders,
      averageOrderValue,
      totalExpenseItems: expensesUsedBreakdown.length,
      expensesUsedBreakdown,
      orders: orders.map(o => o._id),
      expenses: expenses.map(e => e._id),
      reportType,
      generatedAt: new Date(),
    });
    
    await profitLossReport.save();
    
    res.status(201).json({
      success: true,
      message: "Profit/Loss report generated successfully",
      data: profitLossReport,
    });
  } catch (error) {
    console.error("Error generating profit/loss:", error);
    res.status(500).json({
      success: false,
      message: "Error generating profit/loss report",
      error: error.message,
    });
  }
};

// Get all profit/loss reports
exports.getAllReports = async (req, res) => {
  try {
    const reports = await ProfitLoss.find()
      .sort({ createdAt: -1 })
      .populate("orders", "orderNumber totalAmount")
      .populate("expenses", "itemName totalCost");
    
    res.json({
      success: true,
      count: reports.length,
      data: reports,
    });
  } catch (error) {
    console.error("Error fetching reports:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching reports",
      error: error.message,
    });
  }
};

// Get latest profit/loss report
exports.getLatestReport = async (req, res) => {
  try {
    const latestReport = await ProfitLoss.findOne()
      .sort({ createdAt: -1 })
      .populate("orders", "orderNumber totalAmount createdAt")
      .populate("expenses", "itemName totalCost datePurchased");
    
    if (!latestReport) {
      return res.status(404).json({
        success: false,
        message: "No profit/loss report found. Generate one first.",
      });
    }
    
    res.json({
      success: true,
      data: latestReport,
    });
  } catch (error) {
    console.error("Error fetching latest report:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching latest report",
      error: error.message,
    });
  }
};

// Get report by ID
exports.getReportById = async (req, res) => {
  try {
    const report = await ProfitLoss.findById(req.params.id)
      .populate("orders", "orderNumber totalAmount createdAt")
      .populate("expenses", "itemName totalCost datePurchased category");
    
    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }
    
    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error("Error fetching report:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching report",
      error: error.message,
    });
  }
};

// Delete report
exports.deleteReport = async (req, res) => {
  try {
    const report = await ProfitLoss.findByIdAndDelete(req.params.id);
    
    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }
    
    res.json({
      success: true,
      message: "Report deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting report:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting report",
      error: error.message,
    });
  }
};

// Get summary of all time
exports.getAllTimeSummary = async (req, res) => {
  try {
    const orders = await Order.find({ orderStatus: "completed" });
    const expenses = await Expense.find({ isActive: true });
    
    const totalIncome = orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
    const totalPurchased = expenses.reduce((sum, exp) => sum + (exp.totalCost || 0), 0);
    const totalExpensesUsed = expenses.reduce((sum, exp) => sum + ((exp.usedQuantity || 0) * (exp.unitPrice || 0)), 0);
    const totalProfit = totalIncome - totalExpensesUsed;
    const profitMargin = totalIncome > 0 ? (totalProfit / totalIncome) * 100 : 0;
    
    res.json({
      success: true,
      data: {
        totalIncome,
        totalExpensesUsed,
        totalPurchased,
        remainingInventoryValue: totalPurchased - totalExpensesUsed,
        totalProfit,
        profitMargin: profitMargin.toFixed(2) + "%",
        totalOrders: orders.length,
        totalExpenseItems: expenses.length,
        averageOrderValue: orders.length > 0 ? totalIncome / orders.length : 0,
      },
    });
  } catch (error) {
    console.error("Error getting summary:", error);
    res.status(500).json({
      success: false,
      message: "Error getting summary",
      error: error.message,
    });
  }
};

// Auto-generate daily report
exports.generateDailyReport = async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);
    
    const existingReport = await ProfitLoss.findOne({
      startDate: startOfDay,
      endDate: endOfDay,
    });
    
    if (existingReport) {
      return res.status(400).json({
        success: false,
        message: "Daily report already exists for today",
        data: existingReport,
      });
    }
    
    const orders = await Order.find({
      orderStatus: "completed",
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    });
    
    const totalIncome = orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
    const totalOrders = orders.length;
    
    const expensesSummary = await Expense.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          totalUsedCost: { $sum: { $multiply: ["$usedQuantity", "$unitPrice"] } },
          totalPurchased: { $sum: "$totalCost" },
        }
      }
    ]);
    
    const totalExpensesUsed = expensesSummary.length > 0 ? expensesSummary[0].totalUsedCost : 0;
    const totalPurchased = expensesSummary.length > 0 ? expensesSummary[0].totalPurchased : 0;
    
    const report = new ProfitLoss({
      startDate: startOfDay,
      endDate: endOfDay,
      totalIncome,
      totalExpensesUsed,
      totalPurchased,
      remainingInventoryValue: totalPurchased - totalExpensesUsed,
      totalProfit: totalIncome - totalExpensesUsed,
      profitMargin: totalIncome > 0 ? ((totalIncome - totalExpensesUsed) / totalIncome) * 100 : 0,
      totalOrders,
      averageOrderValue: totalOrders > 0 ? totalIncome / totalOrders : 0,
      totalExpenseItems: 0,
      orders: orders.map(o => o._id),
      expenses: [],
      reportType: "daily",
    });
    
    await report.save();
    
    res.status(201).json({
      success: true,
      message: "Daily report generated successfully",
      data: report,
    });
  } catch (error) {
    console.error("Error generating daily report:", error);
    res.status(500).json({
      success: false,
      message: "Error generating daily report",
      error: error.message,
    });
  }
};