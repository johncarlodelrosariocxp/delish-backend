const Razorpay = require("razorpay");
const config = require("../config/config");
const crypto = require("crypto");
const Payment = require("../models/paymentModel");
const createHttpError = require("http-errors");

// ... [keep all other functions exactly as they are] ...

// Get all payments for logged-in user
const getPayments = async (req, res, next) => {
  try {
    const payments = await Payment.find({ user: req.user._id });

    res.status(200).json({
      success: true,
      data: payments,
    });
  } catch (error) {
    next(error);
  }
};

// ... [keep all other functions exactly as they are] ...

module.exports = {
  createOrder,
  verifyPayment,
  webHookVerification,
  getPayments,
  createPaymentRecord,
  getPaymentStats,
};
