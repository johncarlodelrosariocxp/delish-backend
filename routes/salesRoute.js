const express = require("express");
const { isVerifiedUser } = require("../middlewares/tokenVerification");
const Order = require("../models/orderModel");
const router = express.Router();

// GET /api/sales - Get all sales data
router.get("/", isVerifiedUser, async (req, res) => {
  try {
    const orders = await Order.find({ orderStatus: "completed" }).populate(
      "user",
      "name email"
    );

    res.json({
      success: true,
      data: orders,
      total: orders.length,
      message: "Sales data retrieved successfully",
    });
  } catch (error) {
    console.error("Sales fetch error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching sales data",
    });
  }
});

// GET /api/sales/today - Get today's sales
router.get("/today", isVerifiedUser, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayOrders = await Order.find({
      orderStatus: "completed",
      createdAt: {
        $gte: today,
        $lt: tomorrow,
      },
    }).populate("user", "name email");

    const totalSales = todayOrders.reduce(
      (sum, order) => sum + order.totalAmount,
      0
    );

    res.json({
      success: true,
      data: todayOrders,
      totalOrders: todayOrders.length,
      totalSales: totalSales,
      message: "Today's sales retrieved successfully",
    });
  } catch (error) {
    console.error("Today sales error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching today's sales",
    });
  }
});

// GET /api/sales/range - Get sales by date range
router.get("/range", isVerifiedUser, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Start date and end date are required",
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const rangeOrders = await Order.find({
      orderStatus: "completed",
      createdAt: {
        $gte: start,
        $lte: end,
      },
    }).populate("user", "name email");

    const totalSales = rangeOrders.reduce(
      (sum, order) => sum + order.totalAmount,
      0
    );
    const totalOrders = rangeOrders.length;

    res.json({
      success: true,
      data: rangeOrders,
      totalOrders: totalOrders,
      totalSales: totalSales,
      dateRange: {
        start: startDate,
        end: endDate,
      },
      message: "Sales data by date range retrieved successfully",
    });
  } catch (error) {
    console.error("Sales range error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching sales by date range",
    });
  }
});

// GET /api/sales/stats - Get sales statistics
router.get("/stats", isVerifiedUser, async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments({
      orderStatus: "completed",
    });

    const totalRevenueResult = await Order.aggregate([
      { $match: { orderStatus: "completed" } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]);

    const totalRevenue =
      totalRevenueResult.length > 0 ? totalRevenueResult[0].total : 0;

    // Get today's sales
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayOrders = await Order.countDocuments({
      orderStatus: "completed",
      createdAt: { $gte: today, $lt: tomorrow },
    });

    const todayRevenueResult = await Order.aggregate([
      {
        $match: {
          orderStatus: "completed",
          createdAt: { $gte: today, $lt: tomorrow },
        },
      },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]);

    const todayRevenue =
      todayRevenueResult.length > 0 ? todayRevenueResult[0].total : 0;

    res.json({
      success: true,
      data: {
        totalOrders,
        totalRevenue,
        todayOrders,
        todayRevenue,
        averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
      },
      message: "Sales stats retrieved successfully",
    });
  } catch (error) {
    console.error("Sales stats error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching sales statistics",
    });
  }
});

// GET /api/sales/reports - Get sales reports
router.get("/reports", isVerifiedUser, async (req, res) => {
  try {
    // Get monthly sales data
    const monthlySales = await Order.aggregate([
      { $match: { orderStatus: "completed" } },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          totalSales: { $sum: "$totalAmount" },
          orderCount: { $sum: 1 },
        },
      },
    ]);

    // Get top selling items
    const topItems = await Order.aggregate([
      { $match: { orderStatus: "completed" } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.name",
          totalQuantity: { $sum: "$items.quantity" },
          totalRevenue: {
            $sum: { $multiply: ["$items.quantity", "$items.price"] },
          },
        },
      },
      { $limit: 10 },
    ]);

    res.json({
      success: true,
      data: {
        monthlySales,
        topSellingItems: topItems,
        generatedAt: new Date().toISOString(),
      },
      message: "Sales reports generated successfully",
    });
  } catch (error) {
    console.error("Sales reports error:", error);
    res.status(500).json({
      success: false,
      message: "Error generating sales reports",
    });
  }
});

module.exports = router;
