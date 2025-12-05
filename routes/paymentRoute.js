const express = require("express");
const {
  createOrder,
  verifyPayment,
  getPayments,
  getPaymentStats,
} = require("../controllers/paymentController");
const { isVerifiedUser } = require("../middlewares/tokenVerification");
const router = express.Router();

// Payment routes
router.post("/create-order", isVerifiedUser, createOrder);
router.post("/verify-payment", isVerifiedUser, verifyPayment);
router.get("/", isVerifiedUser, getPayments);
router.get("/stats", isVerifiedUser, getPaymentStats);

module.exports = router;
