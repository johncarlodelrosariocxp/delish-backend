const express = require("express");
const {
  addOrder,
  getOrders,
  getOrderById,
  updateOrder,
  getOrderStats,
  // These functions might not exist in your controller
  // getAllOrdersAdmin,
  // getAllSalesStatsAdmin,
} = require("../controllers/orderController");
const { isVerifiedUser } = require("../middlewares/tokenVerification");
const router = express.Router();

// 👤 USER ROUTES
router.route("/").get(isVerifiedUser, getOrders).post(isVerifiedUser, addOrder);

router.route("/stats").get(isVerifiedUser, getOrderStats);

router
  .route("/:id")
  .get(isVerifiedUser, getOrderById)
  .put(isVerifiedUser, updateOrder);

// 🔐 ADMIN ROUTES - Comment out if functions don't exist
// router.route("/admin/all-orders").get(isVerifiedUser, getAllOrdersAdmin);
// router.route("/admin/all-stats").get(isVerifiedUser, getAllSalesStatsAdmin);

// Or create simple fallback routes:
router.route("/admin/all-orders").get(isVerifiedUser, async (req, res) => {
  try {
    const Order = require("../models/orderModel");
    const orders = await Order.find({}).sort({ createdAt: -1 }).limit(50);

    res.json({
      success: true,
      count: orders.length,
      orders: orders,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching orders",
      error: error.message,
    });
  }
});

router.route("/admin/all-stats").get(isVerifiedUser, async (req, res) => {
  try {
    const Order = require("../models/orderModel");
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totalOrders = await Order.countDocuments();
    const ordersToday = await Order.countDocuments({
      createdAt: { $gte: today },
    });

    res.json({
      success: true,
      stats: {
        totalOrders,
        ordersToday,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching stats",
      error: error.message,
    });
  }
});

module.exports = router;
