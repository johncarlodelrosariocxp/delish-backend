// routes/orderRoute.js
const express = require("express");
const {
  addOrder,
  getOrders,
  getOrderById,
  updateOrder,
  getOrderStats,
  getAllOrdersAdmin,
  getAllSalesStats,
  getCashierOrders,
  getTodaysOrdersSummary,
} = require("../controllers/orderController");
const { isVerifiedUser } = require("../middlewares/tokenVerification");
const router = express.Router();

// User routes
router.route("/").get(isVerifiedUser, getOrders).post(isVerifiedUser, addOrder);
router.route("/stats").get(isVerifiedUser, getOrderStats);
router.route("/:id").get(isVerifiedUser, getOrderById).put(isVerifiedUser, updateOrder);

// Cashier routes
router.route("/cashier/orders").get(isVerifiedUser, getCashierOrders);
router.route("/cashier/today").get(isVerifiedUser, getTodaysOrdersSummary);

// Admin routes
router.route("/admin/all-orders").get(isVerifiedUser, getAllOrdersAdmin);
router.route("/admin/all-stats").get(isVerifiedUser, getAllSalesStats);

module.exports = router;