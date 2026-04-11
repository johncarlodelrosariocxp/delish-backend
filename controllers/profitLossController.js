// controllers/profitLossController.js
const ProfitLoss = require("../models/ProfitLoss");
const Order = require("../models/orderModel");
const Expense = require("../models/Expense");

// Generate and save profit/loss report
exports.generateProfitLoss = async (req, res) => {
  try {
    const { startDate, endDate, reportType = "custom" } = req.body;
    
    console.log("=========================================");
    console.log("📊 GENERATING PROFIT & LOSS REPORT");
    console.log("=========================================");
    
    let start = startDate ? new Date(startDate) : new Date();
    let end = endDate ? new Date(endDate) : new Date();
    
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    
    // Get orders within date range
    const orders = await Order.find({
      orderStatus: "completed",
      createdAt: { $gte: start, $lte: end },
    });
    
    console.log(`📋 Orders found: ${orders.length}`);
    
    // Calculate total income
    let totalIncome = 0;
    for (const order of orders) {
      totalIncome += order.totalAmount || 0;
    }
    
    console.log(`💰 Total Income: ₱${totalIncome.toFixed(2)}`);
    
    // ============================================================
    // IMPORTANTE: LAHAT NG EXPENSES SA DATE RANGE - BINABAWAS LAHAT
    // ============================================================
    const expenses = await Expense.find({
      isActive: true,
      datePurchased: { $gte: start, $lte: end },
    });
    
    let totalExpenses = 0;
    for (const expense of expenses) {
      totalExpenses += expense.totalCost || 0;
    }
    
    console.log(`💸 Total Expenses (LAHAT NG BINILI): ₱${totalExpenses.toFixed(2)}`);
    console.log(`📦 Number of expenses: ${expenses.length}`);
    
    // Calculate profit - FORMULA: INCOME - LAHAT NG EXPENSES
    const totalProfit = totalIncome - totalExpenses;
    const profitMargin = totalIncome > 0 ? (totalProfit / totalIncome) * 100 : 0;
    
    console.log(`📈 Total Profit: ₱${totalProfit.toFixed(2)}`);
    console.log(`📊 Profit Margin: ${profitMargin.toFixed(2)}%`);
    console.log("=========================================");
    
    // Expenses breakdown
    const expensesBreakdown = expenses.map(exp => ({
      itemName: exp.itemName,
      category: exp.category,
      quantity: exp.quantity,
      unit: exp.unit,
      unitPrice: exp.unitPrice,
      totalCost: exp.totalCost,
      datePurchased: exp.datePurchased,
    }));
    
    // Create and save profit/loss report
    const profitLossReport = new ProfitLoss({
      startDate: start,
      endDate: end,
      totalIncome,
      totalExpenses: totalExpenses,
      totalProfit,
      profitMargin,
      totalOrders: orders.length,
      averageOrderValue: orders.length > 0 ? totalIncome / orders.length : 0,
      totalExpenseItems: expenses.length,
      expensesBreakdown,
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
    console.error("❌ Error generating profit/loss:", error);
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
    
    let totalIncome = 0;
    for (const order of orders) {
      totalIncome += order.totalAmount || 0;
    }
    
    let totalExpenses = 0;
    for (const expense of expenses) {
      totalExpenses += expense.totalCost || 0;
    }
    
    const totalProfit = totalIncome - totalExpenses;
    const profitMargin = totalIncome > 0 ? (totalProfit / totalIncome) * 100 : 0;
    
    res.json({
      success: true,
      data: {
        totalIncome,
        totalExpenses,
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
    
    let totalIncome = 0;
    for (const order of orders) {
      totalIncome += order.totalAmount || 0;
    }
    
    const expenses = await Expense.find({
      isActive: true,
      datePurchased: { $gte: startOfDay, $lte: endOfDay },
    });
    
    let totalExpenses = 0;
    for (const expense of expenses) {
      totalExpenses += expense.totalCost || 0;
    }
    
    const report = new ProfitLoss({
      startDate: startOfDay,
      endDate: endOfDay,
      totalIncome,
      totalExpenses,
      totalProfit: totalIncome - totalExpenses,
      profitMargin: totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0,
      totalOrders: orders.length,
      averageOrderValue: orders.length > 0 ? totalIncome / orders.length : 0,
      totalExpenseItems: expenses.length,
      orders: orders.map(o => o._id),
      expenses: expenses.map(e => e._id),
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