const createHttpError = require("http-errors");
const Order = require("../models/orderModel");
const { default: mongoose } = require("mongoose");

const addOrder = async (req, res, next) => {
  try {
    // Determine which user to assign the order to
    let assignedUserId = req.user._id; // Default to logged-in user

    // If the frontend sends a user field and the requester is admin, use it
    if (req.body.user && req.user.role === "admin") {
      assignedUserId = req.body.user;
    }

    const orderData = {
      ...req.body,
      user: assignedUserId, // Use the determined user ID
    };

    const order = new Order(orderData);
    await order.save();

    // Populate the saved order with user details
    const populatedOrder = await Order.findById(order._id)
      .populate("table")
      .populate("user", "name email role");

    res.status(201).json({
      success: true,
      message: "Order created!",
      data: populatedOrder,
    });
  } catch (error) {
    next(error);
  }
};

const getOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error = createHttpError(404, "Invalid id!");
      return next(error);
    }

    let order;

    // Admin can see any order
    if (req.user.role === "admin") {
      order = await Order.findOne({ _id: id })
        .populate("table")
        .populate("user", "name email role");
    } else {
      // Cashiers and regular users can only see their own orders
      order = await Order.findOne({
        _id: id,
        user: req.user._id, // Cashier can only see orders they created
      }).populate("table");
    }

    if (!order) {
      const error = createHttpError(404, "Order not found!");
      return next(error);
    }

    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

const getOrders = async (req, res, next) => {
  try {
    let query = {};
    let populateOptions = ["table"];

    // Admin can see all orders and see user details
    if (req.user.role === "admin") {
      query = {};
      populateOptions = ["table", { path: "user", select: "name email role" }];
    } else {
      // Cashiers and regular users can only see their own orders
      // This allows cashiers to see ALL their historical records
      query = { user: req.user._id };
    }

    // ✅ FIXED: NO LIMIT - Returns ALL orders
    const orders = await Order.find(query)
      .populate(populateOptions)
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: orders,
      total: orders.length,
      message: `Successfully retrieved ${orders.length} orders`,
    });
  } catch (error) {
    next(error);
  }
};

const updateOrder = async (req, res, next) => {
  try {
    const { orderStatus } = req.body;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error = createHttpError(404, "Invalid id!");
      return next(error);
    }

    let order;

    // Admin can update any order
    if (req.user.role === "admin") {
      order = await Order.findByIdAndUpdate(id, { orderStatus }, { new: true })
        .populate("table")
        .populate("user", "name email role");
    } else {
      // Cashiers and regular users can only update their own orders
      order = await Order.findOneAndUpdate(
        { _id: id, user: req.user._id },
        { orderStatus },
        { new: true }
      ).populate("table");
    }

    if (!order) {
      const error = createHttpError(404, "Order not found!");
      return next(error);
    }

    res.status(200).json({
      success: true,
      message: "Order updated",
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

// Get order statistics for logged-in user
const getOrderStats = async (req, res, next) => {
  try {
    let matchQuery = {};

    // Admin sees stats for all orders
    if (req.user.role === "admin") {
      matchQuery = {};
    } else {
      // Cashiers and regular users see stats only for their orders
      matchQuery = { user: req.user._id };
    }

    const totalOrders = await Order.countDocuments(matchQuery);

    const revenueStats = await Order.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$bills.totalWithTax" },
          totalTax: { $sum: "$bills.tax" },
          totalWithoutTax: { $sum: "$bills.total" },
          averageOrderValue: { $avg: "$bills.totalWithTax" },
        },
      },
    ]);

    const stats =
      revenueStats.length > 0
        ? revenueStats[0]
        : {
            totalRevenue: 0,
            totalTax: 0,
            totalWithoutTax: 0,
            averageOrderValue: 0,
          };

    // Get today's orders
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayOrders = await Order.countDocuments({
      ...matchQuery,
      createdAt: { $gte: today },
    });

    // Get orders by status
    const statusStats = await Order.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: "$orderStatus",
          count: { $sum: 1 },
        },
      },
    ]);

    // Get daily sales for the last 30 days (extended for cashier to see more history)
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);

    const dailySales = await Order.aggregate([
      {
        $match: {
          ...matchQuery,
          createdAt: { $gte: last30Days },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          totalSales: { $sum: "$bills.totalWithTax" },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Get monthly sales for the last 6 months (for historical view)
    const last6Months = new Date();
    last6Months.setMonth(last6Months.getMonth() - 6);

    const monthlySales = await Order.aggregate([
      {
        $match: {
          ...matchQuery,
          createdAt: { $gte: last6Months },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m", date: "$createdAt" },
          },
          totalSales: { $sum: "$bills.totalWithTax" },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalOrders,
        todayOrders,
        ...stats,
        statusDistribution: statusStats,
        dailySales: dailySales,
        monthlySales: monthlySales,
      },
    });
  } catch (error) {
    next(error);
  }
};

// 🔐 ADMIN ONLY - Get all orders from all users
const getAllOrdersAdmin = async (req, res, next) => {
  try {
    // Check if user is admin
    if (req.user.role !== "admin") {
      return next(createHttpError(403, "Access denied. Admin only."));
    }

    // ✅ FIXED: Get query parameters for optional pagination
    const {
      page,
      limit = 5000, // Very high limit to get all orders
      startDate,
      endDate,
      status,
      paymentMethod,
      customerName,
      orderId,
    } = req.query;

    // Build query
    let query = {};

    // Date filtering
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        query.createdAt.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    // Status filtering
    if (status) {
      query.orderStatus = status;
    }

    // Payment method filtering
    if (paymentMethod) {
      query.paymentMethod = paymentMethod;
    }

    // Customer name filtering (search in populated user)
    if (customerName) {
      // This will be handled after population
    }

    // Order ID filtering
    if (orderId) {
      query._id = new mongoose.Types.ObjectId(orderId);
    }

    // Get total count
    const total = await Order.countDocuments(query);

    // ✅ FIXED: Create base query without limit
    let findQuery = Order.find(query)
      .populate("table")
      .populate("user", "name email phone role")
      .sort({ createdAt: -1 });

    // Apply pagination only if explicitly requested
    if (page && limit) {
      const skip = (parseInt(page) - 1) * parseInt(limit);
      findQuery = findQuery.skip(skip).limit(parseInt(limit));
    } else {
      // No pagination - return ALL orders
      findQuery = findQuery.limit(parseInt(limit) || 5000);
    }

    const orders = await findQuery;

    // Calculate summary stats
    const stats = await Order.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$bills.totalWithTax" },
          totalOrders: { $sum: 1 },
          avgOrderValue: { $avg: "$bills.totalWithTax" },
          totalTax: { $sum: "$bills.tax" },
          totalDiscount: { $sum: "$bills.discount" },
        },
      },
    ]);

    // Filter by customer name after population if needed
    let filteredOrders = orders;
    if (customerName) {
      filteredOrders = orders.filter((order) => {
        const user = order.user;
        return (
          user &&
          user.name &&
          user.name.toLowerCase().includes(customerName.toLowerCase())
        );
      });
    }

    res.status(200).json({
      success: true,
      data: filteredOrders,
      summary:
        stats.length > 0
          ? stats[0]
          : {
              totalRevenue: 0,
              totalOrders: 0,
              avgOrderValue: 0,
              totalTax: 0,
              totalDiscount: 0,
            },
      total: filteredOrders.length,
      allOrdersCount: total,
      message:
        page && limit
          ? `Showing ${filteredOrders.length} of ${total} orders (page ${page})`
          : `Retrieved ${filteredOrders.length} orders`,
    });
  } catch (error) {
    next(error);
  }
};

// 🔐 ADMIN ONLY - Get all sales statistics
const getAllSalesStats = async (req, res, next) => {
  try {
    // Check if user is admin
    if (req.user.role !== "admin") {
      return next(createHttpError(403, "Access denied. Admin only."));
    }

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get this week and last week for comparison
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    const startOfLastWeek = new Date(startOfWeek);
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);
    const endOfLastWeek = new Date(startOfLastWeek);
    endOfLastWeek.setDate(startOfLastWeek.getDate() + 7);

    const [
      totalOrders,
      todayOrders,
      weekOrders,
      lastWeekOrders,
      totalRevenue,
      todayRevenue,
      weekRevenue,
      lastWeekRevenue,
      topItems,
      paymentMethodStats,
    ] = await Promise.all([
      Order.countDocuments(),
      Order.countDocuments({
        createdAt: { $gte: today, $lt: tomorrow },
      }),
      Order.countDocuments({
        createdAt: { $gte: startOfWeek, $lt: endOfWeek },
      }),
      Order.countDocuments({
        createdAt: { $gte: startOfLastWeek, $lt: endOfLastWeek },
      }),
      Order.aggregate([
        { $group: { _id: null, total: { $sum: "$bills.totalWithTax" } } },
      ]),
      Order.aggregate([
        {
          $match: {
            createdAt: { $gte: today, $lt: tomorrow },
          },
        },
        { $group: { _id: null, total: { $sum: "$bills.totalWithTax" } } },
      ]),
      Order.aggregate([
        {
          $match: {
            createdAt: { $gte: startOfWeek, $lt: endOfWeek },
          },
        },
        { $group: { _id: null, total: { $sum: "$bills.totalWithTax" } } },
      ]),
      Order.aggregate([
        {
          $match: {
            createdAt: { $gte: startOfLastWeek, $lt: endOfLastWeek },
          },
        },
        { $group: { _id: null, total: { $sum: "$bills.totalWithTax" } } },
      ]),
      // Get top selling items
      Order.aggregate([
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.name",
            totalQuantity: { $sum: "$items.quantity" },
            totalRevenue: {
              $sum: {
                $multiply: ["$items.quantity", "$items.pricePerQuantity"],
              },
            },
          },
        },
        { $sort: { totalQuantity: -1 } },
        { $limit: 10 },
      ]),
      // Get payment method statistics
      Order.aggregate([
        {
          $group: {
            _id: "$paymentMethod",
            count: { $sum: 1 },
            totalAmount: { $sum: "$bills.totalWithTax" },
          },
        },
        { $sort: { count: -1 } },
      ]),
    ]);

    // Calculate percentages
    const ordersWeekPercentage =
      lastWeekOrders > 0
        ? Math.round(((weekOrders - lastWeekOrders) / lastWeekOrders) * 100)
        : weekOrders > 0
        ? 100
        : 0;

    const revenueWeekPercentage =
      lastWeekRevenue.length > 0 && lastWeekRevenue[0].total > 0
        ? Math.round(
            ((weekRevenue[0]?.total || 0 - lastWeekRevenue[0].total) /
              lastWeekRevenue[0].total) *
              100
          )
        : weekRevenue.length > 0
        ? 100
        : 0;

    res.status(200).json({
      success: true,
      data: {
        totalOrders,
        todayOrders,
        weekOrders,
        ordersWeekPercentage,
        totalRevenue: totalRevenue.length > 0 ? totalRevenue[0].total : 0,
        todayRevenue: todayRevenue.length > 0 ? todayRevenue[0].total : 0,
        weekRevenue: weekRevenue.length > 0 ? weekRevenue[0].total : 0,
        revenueWeekPercentage,
        topItems: topItems || [],
        paymentMethods: paymentMethodStats || [],
        averageOrderValue:
          totalOrders > 0 ? (totalRevenue[0]?.total || 0) / totalOrders : 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

// 🔐 CASHIER ONLY - Get all cashier's orders (their own historical records)
const getCashierOrders = async (req, res, next) => {
  try {
    // Check if user is cashier
    if (req.user.role !== "cashier") {
      return next(createHttpError(403, "Access denied. Cashier only."));
    }

    // Get query parameters for filtering
    // ✅ FIXED: Increased limit from 50 to 1000
    const { startDate, endDate, page = 1, limit = 1000 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let dateFilter = {};

    // Apply date filter if provided
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        dateFilter.createdAt.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.createdAt.$lte = end;
      }
    }

    const query = {
      user: req.user._id, // Cashier can only see their own orders
      ...dateFilter,
    };

    // Get total count for pagination
    const totalOrders = await Order.countDocuments(query);

    // Get orders with pagination
    const orders = await Order.find(query)
      .populate("table")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get summary statistics for the cashier
    const cashierStats = await Order.aggregate([
      { $match: { user: req.user._id } },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: "$bills.totalWithTax" },
          totalTax: { $sum: "$bills.tax" },
          averageOrderValue: { $avg: "$bills.totalWithTax" },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        orders,
        pagination: {
          total: totalOrders,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(totalOrders / parseInt(limit)),
        },
        summary:
          cashierStats.length > 0
            ? cashierStats[0]
            : {
                totalOrders: 0,
                totalRevenue: 0,
                totalTax: 0,
                averageOrderValue: 0,
              },
      },
    });
  } catch (error) {
    next(error);
  }
};

// 🔐 CASHIER ONLY - Get today's orders summary for dashboard
const getTodaysOrdersSummary = async (req, res, next) => {
  try {
    // Check if user is cashier
    if (req.user.role !== "cashier") {
      return next(createHttpError(403, "Access denied. Cashier only."));
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const query = {
      user: req.user._id,
      createdAt: { $gte: today, $lt: tomorrow },
    };

    // Get today's orders count and revenue
    const todayStats = await Order.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          orderCount: { $sum: 1 },
          totalRevenue: { $sum: "$bills.totalWithTax" },
          totalTax: { $sum: "$bills.tax" },
          averageOrderValue: { $avg: "$bills.totalWithTax" },
        },
      },
    ]);

    // Get today's orders list
    const todaysOrders = await Order.find(query)
      .populate("table")
      .sort({ createdAt: -1 })
      .limit(10); // Limit to 10 most recent for dashboard

    res.status(200).json({
      success: true,
      data: {
        summary:
          todayStats.length > 0
            ? todayStats[0]
            : {
                orderCount: 0,
                totalRevenue: 0,
                totalTax: 0,
                averageOrderValue: 0,
              },
        recentOrders: todaysOrders,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  addOrder,
  getOrderById,
  getOrders,
  updateOrder,
  getOrderStats,
  getAllOrdersAdmin,
  getAllSalesStats,
  getCashierOrders,
  getTodaysOrdersSummary,
};
