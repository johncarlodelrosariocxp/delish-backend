const express = require("express");
const {
  addOrder,
  getOrders,
  getOrderById,
  updateOrder,
  getOrderStats,
  getAllOrdersAdmin, // ✅ ADDED
  getAllSalesStatsAdmin, // ✅ ADDED
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

// 🔐 ADMIN ROUTES
router.route("/admin/all-orders").get(isVerifiedUser, getAllOrdersAdmin);

router.route("/admin/all-stats").get(isVerifiedUser, getAllSalesStatsAdmin);

module.exports = router;
