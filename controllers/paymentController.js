const Order = require("../models/orderModel");

// ✅ CREATE PAYMENT ORDER
exports.createOrder = async (req, res) => {
  try {
    const {
      amount,
      currency = "PHP",
      customerName,
      customerEmail,
      customerPhone,
      paymentMethod,
      items = [],
    } = req.body;

    // Validate required fields
    if (!amount || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: "Amount and payment method are required",
      });
    }

    // Create order in database
    const order = await Order.create({
      user: req.user?._id,
      totalAmount: amount,
      paymentMethod: paymentMethod,
      customerDetails: {
        name: customerName || "Walk-in Customer",
        email: customerEmail || "",
        phone: customerPhone || "",
      },
      items: items,
      orderStatus: "Pending",
      paymentStatus: "Pending",
    });

    res.status(201).json({
      success: true,
      message: "Payment order created",
      data: {
        orderId: order._id,
        amount: order.totalAmount,
        paymentMethod: order.paymentMethod,
        status: order.paymentStatus,
      },
    });
  } catch (error) {
    console.error("❌ Error creating payment order:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create payment order",
      error: error.message,
    });
  }
};

// ✅ VERIFY PAYMENT
exports.verifyPayment = async (req, res) => {
  try {
    const { orderId, transactionId, paymentStatus } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required",
      });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Update order status
    order.paymentStatus = paymentStatus || "Completed";
    order.orderStatus = "Completed";
    order.transactionId = transactionId;
    order.paidAt = new Date();

    await order.save();

    res.json({
      success: true,
      message: `Payment ${order.paymentStatus.toLowerCase()}`,
      data: {
        orderId: order._id,
        amount: order.totalAmount,
        paymentStatus: order.paymentStatus,
        transactionId: order.transactionId,
      },
    });
  } catch (error) {
    console.error("❌ Error verifying payment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify payment",
      error: error.message,
    });
  }
};

// ✅ GET PAYMENTS
exports.getPayments = async (req, res) => {
  try {
    const userId = req.user._id;
    const { startDate, endDate, paymentMethod, status } = req.query;

    let query = { user: userId };

    // Date filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Payment method filter
    if (paymentMethod) {
      query.paymentMethod = paymentMethod;
    }

    // Status filter
    if (status) {
      query.paymentStatus = status;
    }

    const payments = await Order.find(query)
      .select(
        "totalAmount paymentMethod paymentStatus createdAt transactionId items"
      )
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      success: true,
      count: payments.length,
      data: payments,
    });
  } catch (error) {
    console.error("❌ Error fetching payments:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch payments",
      error: error.message,
    });
  }
};

// ✅ GET PAYMENT STATS
exports.getPaymentStats = async (req, res) => {
  try {
    const userId = req.user._id;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get today's payments
    const todayPayments = await Order.find({
      user: userId,
      createdAt: { $gte: today },
      paymentStatus: "Completed",
    });

    // Calculate totals
    const totalRevenue = await Order.aggregate([
      { $match: { user: userId, paymentStatus: "Completed" } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]);

    const todayRevenue = todayPayments.reduce(
      (sum, payment) => sum + (payment.totalAmount || 0),
      0
    );

    // Payment method breakdown
    const paymentMethodStats = await Order.aggregate([
      { $match: { user: userId, paymentStatus: "Completed" } },
      {
        $group: {
          _id: "$paymentMethod",
          count: { $sum: 1 },
          total: { $sum: "$totalAmount" },
        },
      },
      { $sort: { total: -1 } },
    ]);

    res.json({
      success: true,
      stats: {
        totalRevenue: totalRevenue[0]?.total || 0,
        todayRevenue,
        totalTransactions: todayPayments.length,
        paymentMethods: paymentMethodStats,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching payment stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch payment stats",
      error: error.message,
    });
  }
};
