const Razorpay = require("razorpay");
const config = require("../config/config");
const crypto = require("crypto");
const Payment = require("../models/paymentModel");
const createHttpError = require("http-errors");

const createOrder = async (req, res, next) => {
  const razorpay = new Razorpay({
    key_id: config.razorpayKeyId,
    key_secret: config.razorpaySecretKey,
  });

  try {
    const { amount } = req.body;
    const options = {
      amount: amount * 100, // Amount in paisa (1 INR = 100 paisa)
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);
    res.status(200).json({ success: true, order });
  } catch (error) {
    console.log(error);
    next(error);
  }
};

const verifyPayment = async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;

    const expectedSignature = crypto
      .createHmac("sha256", config.razorpaySecretKey)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (expectedSignature === razorpay_signature) {
      res.json({ success: true, message: "Payment verified successfully!" });
    } else {
      const error = createHttpError(400, "Payment verification failed!");
      return next(error);
    }
  } catch (error) {
    next(error);
  }
};

const webHookVerification = async (req, res, next) => {
  try {
    const secret = config.razorpyWebhookSecret;
    const signature = req.headers["x-razorpay-signature"];

    const body = JSON.stringify(req.body);

    // 🛑 Verify the signature
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("hex");

    if (expectedSignature === signature) {
      console.log("✅ Webhook verified:", req.body);

      // ✅ Process payment (e.g., update DB, send confirmation email)
      if (req.body.event === "payment.captured") {
        const payment = req.body.payload.payment.entity;
        console.log(`💰 Payment Captured: ${payment.amount / 100} INR`);

        // Note: Webhook doesn't have user context, so we need to handle this differently
        // You might want to store payments without user reference or update later
        const newPayment = new Payment({
          paymentId: payment.id,
          orderId: payment.order_id,
          amount: payment.amount / 100,
          currency: payment.currency,
          status: payment.status,
          method: payment.method,
          email: payment.email,
          contact: payment.contact,
          createdAt: new Date(payment.created_at * 1000),
          // user: We can't set user here as webhook doesn't have user context
          // You might need to update this later when the order is created
        });

        await newPayment.save();
      }

      res.json({ success: true });
    } else {
      const error = createHttpError(400, "❌ Invalid Signature!");
      return next(error);
    }
  } catch (error) {
    next(error);
  }
};

// Get all payments for logged-in user
const getPayments = async (req, res, next) => {
  try {
    const payments = await Payment.find({ user: req.user._id }).sort({
      createdAt: -1,
    });

    res.status(200).json({
      success: true,
      data: payments,
    });
  } catch (error) {
    next(error);
  }
};

// Create payment record (for manual payments or to associate with user)
const createPaymentRecord = async (req, res, next) => {
  try {
    const {
      paymentId,
      orderId,
      amount,
      currency,
      status,
      method,
      email,
      contact,
    } = req.body;

    if (!paymentId || !amount) {
      return next(createHttpError(400, "Payment ID and amount are required!"));
    }

    const newPayment = await Payment.create({
      paymentId,
      orderId,
      amount,
      currency,
      status,
      method,
      email,
      contact,
      createdAt: new Date(),
      user: req.user._id, // Add user reference
    });

    res.status(201).json({
      success: true,
      message: "Payment recorded successfully!",
      data: newPayment,
    });
  } catch (error) {
    next(error);
  }
};

// Get payment statistics for logged-in user
const getPaymentStats = async (req, res, next) => {
  try {
    const totalPayments = await Payment.countDocuments({ user: req.user._id });

    const revenueStats = await Payment.aggregate([
      { $match: { user: req.user._id, status: "captured" } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$amount" },
          averagePayment: { $avg: "$amount" },
        },
      },
    ]);

    const stats =
      revenueStats.length > 0
        ? revenueStats[0]
        : {
            totalRevenue: 0,
            averagePayment: 0,
          };

    // Get today's payments
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayPayments = await Payment.countDocuments({
      user: req.user._id,
      createdAt: { $gte: today },
    });

    // Payment methods distribution
    const methodStats = await Payment.aggregate([
      { $match: { user: req.user._id } },
      {
        $group: {
          _id: "$method",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalPayments,
        todayPayments,
        ...stats,
        methodDistribution: methodStats,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createOrder,
  verifyPayment,
  webHookVerification,
  getPayments,
  createPaymentRecord,
  getPaymentStats,
};
