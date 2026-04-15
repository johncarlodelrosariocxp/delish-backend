// controllers/orderController.js
const createHttpError = require("http-errors");
const Order = require("../models/orderModel");
const Expense = require("../models/Expense");
const mongoose = require("mongoose");

const addOrder = async (req, res, next) => {
  try {
    let assignedUserId = req.user._id;

    if (req.body.user && req.user.role === "admin") {
      assignedUserId = req.body.user;
    }

    const processedItems = [];
    let totalOrderCost = 0;
    let totalRevenue = 0;
    const usedExpensesList = [];

    for (const item of req.body.items) {
      // Hanapin ang expense item na may natitirang stock
      const expenseItem = await Expense.findOne({ 
        itemName: { $regex: new RegExp(`^${item.name}$`, "i") },
        isActive: true,
        remainingQuantity: { $gt: 0 }
      });

      let costPerUnit = 0;
      let expenseId = null;
      let actualCost = 0;

      if (expenseItem) {
        // Gamitin ang stock mula sa expense
        const usedStock = await expenseItem.useStock(item.quantity);
        costPerUnit = usedStock.costPerUnit;
        expenseId = expenseItem._id;
        actualCost = usedStock.totalCost;
        
        usedExpensesList.push(usedStock);
      }

      const itemTotalCost = actualCost;
      const itemPrice = item.price || item.pricePerQuantity || 0;
      const itemRevenue = itemPrice * item.quantity;
      
      totalOrderCost += itemTotalCost;
      totalRevenue += itemRevenue;

      processedItems.push({
        name: item.name,
        quantity: item.quantity,
        pricePerQuantity: item.pricePerQuantity || itemPrice,
        price: itemPrice,
        originalPrice: item.originalPrice || itemPrice,
        isRedeemed: item.isRedeemed || false,
        isPwdSeniorDiscounted: item.isPwdSeniorDiscounted || false,
        category: item.category || "other",
        expenseId: expenseId,
        costPerUnit: costPerUnit,
        totalCost: itemTotalCost,
      });
    }

    const totalAmount = totalRevenue;
    const profit = totalAmount - totalOrderCost;

    const orderData = {
      ...req.body,
      items: processedItems,
      user: assignedUserId,
      totalAmount: totalAmount,
      totalCost: totalOrderCost,
      profit: profit,
    };

    const order = new Order(orderData);
    await order.save();

    const populatedOrder = await Order.findById(order._id)
      .populate("table")
      .populate("user", "name email role");

    res.status(201).json({
      success: true,
      message: "Order created! Stock deducted from expenses!",
      data: populatedOrder,
      summary: {
        revenue: totalAmount,
        cost: totalOrderCost,
        profit: profit,
        usedExpenses: usedExpensesList
      }
    });
  } catch (error) {
    console.error("Error creating order:", error);
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

    if (req.user.role === "admin") {
      order = await Order.findOne({ _id: id })
        .populate("table")
        .populate("user", "name email role");
    } else {
      order = await Order.findOne({
        _id: id,
        user: req.user._id,
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

    if (req.user.role === "admin") {
      query = {};
      populateOptions = ["table", { path: "user", select: "name email role" }];
    } else {
      query = { user: req.user._id };
    }

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

    if (req.user.role === "admin") {
      order = await Order.findByIdAndUpdate(id, { orderStatus }, { new: true })
        .populate("table")
        .populate("user", "name email role");
    } else {
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

// DELETE ORDER - Permanently remove order from database
const deleteOrder = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error = createHttpError(404, "Invalid order ID format!");
      return next(error);
    }

    // Check if user is admin (only admins can delete orders)
    if (req.user.role !== "admin") {
      const error = createHttpError(403, "Access denied. Only admins can delete orders!");
      return next(error);
    }

    // Find the order first to check if it exists
    const order = await Order.findById(id);
    
    if (!order) {
      const error = createHttpError(404, "Order not found!");
      return next(error);
    }

    // Check if order is already cancelled
    if (order.orderStatus?.toLowerCase() === "cancelled") {
      const error = createHttpError(400, "Cannot delete a cancelled order. Order is already cancelled.");
      return next(error);
    }

    // Store order details for response
    const orderDetails = {
      _id: order._id,
      orderNumber: order.orderNumber,
      totalAmount: order.totalAmount,
      customerName: order.customerDetails?.name || "Walk-in Customer",
      orderStatus: order.orderStatus
    };

    // Delete the order
    await Order.findByIdAndDelete(id);

    console.log(`✅ Order ${id} permanently deleted by admin ${req.user._id}`);

    res.status(200).json({
      success: true,
      message: "Order permanently deleted from the system!",
      data: {
        deletedOrder: orderDetails,
        deletedAt: new Date().toISOString(),
        deletedBy: req.user._id
      }
    });
  } catch (error) {
    console.error("Error deleting order:", error);
    next(error);
  }
};

const getOrderStats = async (req, res, next) => {
  try {
    let matchQuery = {};

    if (req.user.role === "admin") {
      matchQuery = {};
    } else {
      matchQuery = { user: req.user._id };
    }

    const totalOrders = await Order.countDocuments(matchQuery);

    const revenueStats = await Order.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$totalAmount" },
          totalCost: { $sum: "$totalCost" },
          totalProfit: { $sum: "$profit" },
          averageOrderValue: { $avg: "$totalAmount" },
        },
      },
    ]);

    const stats = revenueStats.length > 0 ? revenueStats[0] : {
      totalRevenue: 0,
      totalCost: 0,
      totalProfit: 0,
      averageOrderValue: 0,
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayOrders = await Order.countDocuments({
      ...matchQuery,
      createdAt: { $gte: today },
    });

    const statusStats = await Order.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: "$orderStatus",
          count: { $sum: 1 },
        },
      },
    ]);

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
          totalSales: { $sum: "$totalAmount" },
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
      },
    });
  } catch (error) {
    next(error);
  }
};

const getAllOrdersAdmin = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return next(createHttpError(403, "Access denied. Admin only."));
    }

    const { page, limit = 100, startDate, endDate, status } = req.query;
    let query = {};

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

    if (status) {
      query.orderStatus = status;
    }

    const total = await Order.countDocuments(query);
    const skip = page ? (parseInt(page) - 1) * parseInt(limit) : 0;

    const orders = await Order.find(query)
      .populate("table")
      .populate("user", "name email phone role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const stats = await Order.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$totalAmount" },
          totalCost: { $sum: "$totalCost" },
          totalProfit: { $sum: "$profit" },
          totalOrders: { $sum: 1 },
          avgOrderValue: { $avg: "$totalAmount" },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: orders,
      summary: stats.length > 0 ? stats[0] : {
        totalRevenue: 0,
        totalCost: 0,
        totalProfit: 0,
        totalOrders: 0,
        avgOrderValue: 0,
      },
      total: orders.length,
      allOrdersCount: total,
    });
  } catch (error) {
    next(error);
  }
};

const getAllSalesStats = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return next(createHttpError(403, "Access denied. Admin only."));
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

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
    ] = await Promise.all([
      Order.countDocuments(),
      Order.countDocuments({ createdAt: { $gte: today, $lt: tomorrow } }),
      Order.countDocuments({ createdAt: { $gte: startOfWeek, $lt: endOfWeek } }),
      Order.countDocuments({ createdAt: { $gte: startOfLastWeek, $lt: endOfLastWeek } }),
      Order.aggregate([{ $group: { _id: null, total: { $sum: "$totalAmount" } } }]),
      Order.aggregate([
        { $match: { createdAt: { $gte: today, $lt: tomorrow } } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]),
      Order.aggregate([
        { $match: { createdAt: { $gte: startOfWeek, $lt: endOfWeek } } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]),
      Order.aggregate([
        { $match: { createdAt: { $gte: startOfLastWeek, $lt: endOfLastWeek } } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]),
      Order.aggregate([
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.name",
            totalQuantity: { $sum: "$items.quantity" },
            totalRevenue: { $sum: { $multiply: ["$items.quantity", "$items.price"] } },
          },
        },
        { $sort: { totalQuantity: -1 } },
        { $limit: 10 },
      ]),
    ]);

    const ordersWeekPercentage = lastWeekOrders > 0
      ? Math.round(((weekOrders - lastWeekOrders) / lastWeekOrders) * 100)
      : weekOrders > 0 ? 100 : 0;

    const revenueWeekPercentage = lastWeekRevenue.length > 0 && lastWeekRevenue[0].total > 0
      ? Math.round(((weekRevenue[0]?.total || 0 - lastWeekRevenue[0].total) / lastWeekRevenue[0].total) * 100)
      : weekRevenue.length > 0 ? 100 : 0;

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
        averageOrderValue: totalOrders > 0 ? (totalRevenue[0]?.total || 0) / totalOrders : 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getCashierOrders = async (req, res, next) => {
  try {
    if (req.user.role !== "cashier") {
      return next(createHttpError(403, "Access denied. Cashier only."));
    }

    const { startDate, endDate, page = 1, limit = 100 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let dateFilter = {};

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

    const query = { user: req.user._id, ...dateFilter };
    const totalOrders = await Order.countDocuments(query);

    const orders = await Order.find(query)
      .populate("table")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const cashierStats = await Order.aggregate([
      { $match: { user: req.user._id } },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: "$totalAmount" },
          totalCost: { $sum: "$totalCost" },
          totalProfit: { $sum: "$profit" },
          averageOrderValue: { $avg: "$totalAmount" },
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
        summary: cashierStats.length > 0 ? cashierStats[0] : {
          totalOrders: 0,
          totalRevenue: 0,
          totalCost: 0,
          totalProfit: 0,
          averageOrderValue: 0,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

const getTodaysOrdersSummary = async (req, res, next) => {
  try {
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

    const todayStats = await Order.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          orderCount: { $sum: 1 },
          totalRevenue: { $sum: "$totalAmount" },
          totalCost: { $sum: "$totalCost" },
          totalProfit: { $sum: "$profit" },
          averageOrderValue: { $avg: "$totalAmount" },
        },
      },
    ]);

    const todaysOrders = await Order.find(query)
      .populate("table")
      .sort({ createdAt: -1 })
      .limit(10);

    res.status(200).json({
      success: true,
      data: {
        summary: todayStats.length > 0 ? todayStats[0] : {
          orderCount: 0,
          totalRevenue: 0,
          totalCost: 0,
          totalProfit: 0,
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
  deleteOrder,
  getOrderStats,
  getAllOrdersAdmin,
  getAllSalesStats,
  getCashierOrders,
  getTodaysOrdersSummary,
};