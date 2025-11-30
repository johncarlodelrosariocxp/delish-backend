const createHttpError = require("http-errors");
const Order = require("../models/orderModel");
const { default: mongoose } = require("mongoose");

const addOrder = async (req, res, next) => {
  try {
    // Add user reference to the order
    const orderData = {
      ...req.body,
      user: req.user._id, // Add user reference
    };

    const order = new Order(orderData);
    await order.save();

    // Populate the saved order
    const populatedOrder = await Order.findById(order._id).populate("table");

    res.status(201).json({
      success: true,
      message: "Order created!",
      data: populatedOrder,
    });
  } catch (error) {
    next(error);
  }
};

const getOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error = createHttpError(404, "Invalid id!");
      return next(error);
    }

    // Only find order if it belongs to the logged-in user
    const order = await Order.findOne({
      _id: id,
      user: req.user._id,
    }).populate("table");

    if (!order) {
      const error = createHttpError(404, "Order not found!");
      return next(error);
    }

    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

const getOrders = async (req, res, next) => {
  try {
    // Only get orders for the logged-in user
    const orders = await Order.find({ user: req.user._id }).populate("table");
    res.status(200).json({
      success: true,
      data: orders,
    });
  } catch (error) {
    next(error);
  }
};

const updateOrder = async (req, res, next) => {
  try {
    const { orderStatus } = req.body;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error = createHttpError(404, "Invalid id!");
      return next(error);
    }

    // Only update order if it belongs to the logged-in user
    const order = await Order.findOneAndUpdate(
      { _id: id, user: req.user._id },
      { orderStatus },
      { new: true }
    ).populate("table");

    if (!order) {
      const error = createHttpError(404, "Order not found!");
      return next(error);
    }

    res.status(200).json({
      success: true,
      message: "Order updated",
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

// Get order statistics for logged-in user
const getOrderStats = async (req, res, next) => {
  try {
    const totalOrders = await Order.countDocuments({ user: req.user._id });

    const revenueStats = await Order.aggregate([
      { $match: { user: req.user._id } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$bills.totalWithTax" },
          totalTax: { $sum: "$bills.tax" },
          totalWithoutTax: { $sum: "$bills.total" },
        },
      },
    ]);

    const stats =
      revenueStats.length > 0
        ? revenueStats[0]
        : {
            totalRevenue: 0,
            totalTax: 0,
            totalWithoutTax: 0,
          };

    // Get today's orders
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayOrders = await Order.countDocuments({
      user: req.user._id,
      createdAt: { $gte: today },
    });

    // Get orders by status
    const statusStats = await Order.aggregate([
      { $match: { user: req.user._id } },
      {
        $group: {
          _id: "$orderStatus",
          count: { $sum: 1 },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalOrders,
        todayOrders,
        ...stats,
        statusDistribution: statusStats,
      },
    });
  } catch (error) {
    next(error);
  }
};

// 🔐 ADMIN ONLY - Get all orders from all users
const getAllOrdersAdmin = async (req, res, next) => {
  try {
    // Check if user is admin
    if (req.user.role !== "admin") {
      return next(createHttpError(403, "Access denied. Admin only."));
    }

    const orders = await Order.find()
      .populate("table")
      .populate("user", "name email phone")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: orders,
    });
  } catch (error) {
    next(error);
  }
};

// 🔐 ADMIN ONLY - Get all sales statistics
const getAllSalesStatsAdmin = async (req, res, next) => {
  try {
    // Check if user is admin
    if (req.user.role !== "admin") {
      return next(createHttpError(403, "Access denied. Admin only."));
    }

    const Order = require("../models/orderModel");
    const Payment = require("../models/paymentModel");
    const User = require("../models/userModel");

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get this week and last week for comparison
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    const startOfLastWeek = new Date(startOfWeek);
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);
    const endOfLastWeek = new Date(startOfLastWeek);
    endOfLastWeek.setDate(startOfLastWeek.getDate() + 7);

    const [
      totalOrders,
      todayOrders,
      weekOrders,
      lastWeekOrders,
      totalRevenue,
      todayRevenue,
      weekRevenue,
      lastWeekRevenue,
      totalUsers,
      totalPayments,
    ] = await Promise.all([
      Order.countDocuments(),
      Order.countDocuments({
        createdAt: { $gte: today, $lt: tomorrow },
      }),
      Order.countDocuments({
        createdAt: { $gte: startOfWeek, $lt: endOfWeek },
      }),
      Order.countDocuments({
        createdAt: { $gte: startOfLastWeek, $lt: endOfLastWeek },
      }),
      Order.aggregate([
        { $group: { _id: null, total: { $sum: "$bills.totalWithTax" } } },
      ]),
      Order.aggregate([
        {
          $match: {
            createdAt: { $gte: today, $lt: tomorrow },
          },
        },
        { $group: { _id: null, total: { $sum: "$bills.totalWithTax" } } },
      ]),
      Order.aggregate([
        {
          $match: {
            createdAt: { $gte: startOfWeek, $lt: endOfWeek },
          },
        },
        { $group: { _id: null, total: { $sum: "$bills.totalWithTax" } } },
      ]),
      Order.aggregate([
        {
          $match: {
            createdAt: { $gte: startOfLastWeek, $lt: endOfLastWeek },
          },
        },
        { $group: { _id: null, total: { $sum: "$bills.totalWithTax" } } },
      ]),
      User.countDocuments(),
      Payment.countDocuments(),
    ]);

    // Calculate percentages
    const ordersWeekPercentage =
      lastWeekOrders > 0
        ? Math.round(((weekOrders - lastWeekOrders) / lastWeekOrders) * 100)
        : weekOrders > 0
        ? 100
        : 0;

    const revenueWeekPercentage =
      lastWeekRevenue.length > 0 && lastWeekRevenue[0].total > 0
        ? Math.round(
            ((weekRevenue[0]?.total || 0 - lastWeekRevenue[0].total) /
              lastWeekRevenue[0].total) *
              100
          )
        : weekRevenue.length > 0
        ? 100
        : 0;

    res.status(200).json({
      success: true,
      data: {
        totalOrders,
        todayOrders,
        weekOrders,
        ordersWeekPercentage,
        totalRevenue: totalRevenue.length > 0 ? totalRevenue[0].total : 0,
        todayRevenue: todayRevenue.length > 0 ? todayRevenue[0].total : 0,
        weekRevenue: weekRevenue.length > 0 ? weekRevenue[0].total : 0,
        revenueWeekPercentage,
        totalUsers,
        totalPayments,
        averageOrderValue:
          totalOrders > 0 ? (totalRevenue[0]?.total || 0) / totalOrders : 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  addOrder,
  getOrderById,
  getOrders,
  updateOrder,
  getOrderStats,
  getAllOrdersAdmin,
  getAllSalesStatsAdmin,
};
