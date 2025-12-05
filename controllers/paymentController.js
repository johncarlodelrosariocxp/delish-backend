const Order = require("../models/orderModel");

// Create payment order
const createOrder = async (req, res) => {
  try {
    const { amount, paymentMethod, items = [] } = req.body;

    if (!amount) {
      return res.status(400).json({
        success: false,
        message: "Amount is required",
      });
    }

    const order = await Order.create({
      user: req.user?._id,
      totalAmount: amount,
      paymentMethod: paymentMethod || "Cash",
      items: items,
      orderStatus: "Pending",
      paymentStatus: "Pending",
    });

    res.status(201).json({
      success: true,
      message: "Payment order created",
      orderId: order._id,
      amount: order.totalAmount,
    });
  } catch (error) {
    console.error("Error creating payment order:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create payment order",
      error: error.message,
    });
  }
};

// Verify payment
const verifyPayment = async (req, res) => {
  try {
    const { orderId, transactionId } = req.body;

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    order.paymentStatus = "Completed";
    order.orderStatus = "Completed";
    order.transactionId = transactionId;
    await order.save();

    res.json({
      success: true,
      message: "Payment verified successfully",
      orderId: order._id,
    });
  } catch (error) {
    console.error("Error verifying payment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify payment",
      error: error.message,
    });
  }
};

// Get payments
const getPayments = async (req, res) => {
  try {
    const userId = req.user._id;

    const payments = await Order.find({ user: userId })
      .select("totalAmount paymentMethod paymentStatus createdAt")
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      success: true,
      count: payments.length,
      data: payments,
    });
  } catch (error) {
    console.error("Error fetching payments:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch payments",
      error: error.message,
    });
  }
};

// Get payment stats
const getPaymentStats = async (req, res) => {
  try {
    const userId = req.user._id;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Today's revenue
    const todayOrders = await Order.find({
      user: userId,
      createdAt: { $gte: today },
      paymentStatus: "Completed",
    });

    const todayRevenue = todayOrders.reduce(
      (sum, order) => sum + (order.totalAmount || 0),
      0
    );

    // Total revenue
    const allOrders = await Order.find({
      user: userId,
      paymentStatus: "Completed",
    });

    const totalRevenue = allOrders.reduce(
      (sum, order) => sum + (order.totalAmount || 0),
      0
    );

    res.json({
      success: true,
      stats: {
        todayRevenue,
        totalRevenue,
        todayOrdersCount: todayOrders.length,
        totalOrdersCount: allOrders.length,
      },
    });
  } catch (error) {
    console.error("Error fetching payment stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch payment stats",
      error: error.message,
    });
  }
};

// Export functions
module.exports = {
  createOrder,
  verifyPayment,
  getPayments,
  getPaymentStats,
};
