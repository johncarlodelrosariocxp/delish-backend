const createHttpError = require("http-errors");
const Order = require("../models/orderModel");
const { default: mongoose } = require("mongoose");

// ... [keep all other functions exactly as they are] ...

// 🔐 ADMIN ONLY - Get all orders from all users
const getAllOrdersAdmin = async (req, res, next) => {
  try {
    // Check if user is admin
    if (req.user.role !== "admin") {
      return next(createHttpError(403, "Access denied. Admin only."));
    }

    const orders = await Order.find()
      .populate("table")
      .populate("user", "name email phone");

    res.status(200).json({
      success: true,
      data: orders,
    });
  } catch (error) {
    next(error);
  }
};

// ... [keep all other functions exactly as they are] ...

module.exports = {
  addOrder,
  getOrderById,
  getOrders,
  updateOrder,
  getOrderStats,
  getAllOrdersAdmin,
  getAllSalesStatsAdmin,
};
