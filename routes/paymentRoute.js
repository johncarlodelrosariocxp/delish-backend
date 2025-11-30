const express = require("express");
const router = express.Router();
const { isVerifiedUser } = require("../middlewares/tokenVerification");
const {
  createOrder,
  verifyPayment,
  webHookVerification,
  getPayments, // ADDED: Import new functions
  createPaymentRecord, // ADDED
  getPaymentStats, // ADDED
} = require("../controllers/paymentController");

// Razorpay payment flow
router.route("/create-order").post(isVerifiedUser, createOrder); // Create Razorpay order
router.route("/verify-payment").post(isVerifiedUser, verifyPayment); // Verify payment

// User payment records and statistics
router
  .route("/") // ADDED
  .get(isVerifiedUser, getPayments); // GET /api/payment - Get user's payments

router
  .route("/record") // ADDED
  .post(isVerifiedUser, createPaymentRecord); // POST /api/payment/record - Create payment record

router
  .route("/stats") // ADDED
  .get(isVerifiedUser, getPaymentStats); // GET /api/payment/stats - User payment statistics

// Webhook (no authentication needed - called by Razorpay)
router.route("/webhook-verification").post(webHookVerification);

module.exports = router;
