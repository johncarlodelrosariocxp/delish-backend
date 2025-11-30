const createHttpError = require("http-errors");
const User = require("../models/userModel");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const config = require("../config/config");

// Cache for frequent user lookups (5 minute TTL)
const userCache = new Map();

const register = async (req, res, next) => {
  try {
    const { name, phone, email, password, role } = req.body;

    // Fast validation
    if (!name || !phone || !email || !password || !role) {
      return next(createHttpError(400, "All fields are required!"));
    }

    // ✅ NORMALIZE ROLE TO LOWERCASE and validate
    const normalizedRole = role.toLowerCase().trim();

    // Validate role against enum values
    const validRoles = ["admin", "cashier"];
    if (!validRoles.includes(normalizedRole)) {
      return next(
        createHttpError(400, "Invalid role! Must be 'admin' or 'cashier'")
      );
    }

    // Use lean() for faster query - only check if user exists
    const existingUser = await User.findOne({ email }).select("_id").lean();
    if (existingUser) {
      return next(createHttpError(400, "User already exists!"));
    }

    // ✅ FIXED: Hash password ONCE in controller
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log("🔑 Password hashed in controller");

    const newUser = await User.create({
      name,
      phone,
      email,
      password: hashedPassword, // Already hashed - model won't hash again
      role: normalizedRole,
    });

    // Remove password from response
    const userResponse = newUser.toObject();
    delete userResponse.password;

    res.status(201).json({
      success: true,
      message: "New user created!",
      data: userResponse,
    });
  } catch (error) {
    // Handle mongoose validation errors
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return next(createHttpError(400, errors.join(", ")));
    }
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    console.log("🔐 LOGIN ATTEMPT:", {
      email: email,
      password: password ? "***" : "MISSING",
    });

    if (!email || !password) {
      return next(createHttpError(400, "All fields are required!"));
    }

    // Find user with case-insensitive email
    const user = await User.findOne({
      email: email.toLowerCase().trim(),
    })
      .select("_id name email phone role password")
      .lean();

    console.log("👤 USER FOUND:", user ? "YES" : "NO");

    if (!user) {
      console.log("❌ USER NOT FOUND FOR:", email);
      return next(createHttpError(401, "Invalid Credentials"));
    }

    console.log("🔍 USER DATA FROM DB:", {
      email: user.email,
      hasPassword: !!user.password,
      passwordLength: user.password?.length,
      passwordHashPreview: user.password?.substring(0, 20) + "...",
    });

    // Compare password
    console.log("🔑 COMPARING PASSWORDS...");
    console.log("   Input password:", password);
    console.log("   Stored hash starts with:", user.password?.substring(0, 10));

    const isMatch = await bcrypt.compare(password, user.password);
    console.log("🔑 PASSWORD MATCH RESULT:", isMatch);

    if (!isMatch) {
      console.log("❌ PASSWORD MISMATCH");
      return next(createHttpError(401, "Invalid Credentials"));
    }

    console.log("✅ PASSWORD MATCH - GENERATING TOKEN");

    // Generate token
    const token = jwt.sign({ _id: user._id }, config.accessTokenSecret, {
      expiresIn: "1d",
    });

    const userData = {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
    };

    console.log("✅ LOGIN SUCCESS - Sending response with token");

    // Set cookie for browser-based access
    res.cookie("accessToken", token, {
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    // Return token in response
    res.status(200).json({
      success: true,
      message: "User login successfully!",
      data: {
        ...userData,
        token: token,
      },
      token: token,
    });
  } catch (error) {
    console.error("💥 LOGIN ERROR:", error);
    next(error);
  }
};

const getUserData = async (req, res, next) => {
  try {
    // Fast query with only needed fields
    const user = await User.findById(req.user._id)
      .select("name email phone role")
      .lean();

    if (!user) {
      return next(createHttpError(404, "User not found"));
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    // Clear any cached user data
    if (req.user && req.user.email) {
      userCache.delete(`user:${req.user.email}`);
    }

    res.clearCookie("accessToken");
    res.status(200).json({
      success: true,
      message: "User logout successfully!",
    });
  } catch (error) {
    next(error);
  }
};

// ✅ DEBUG ENDPOINT - Check user in database
const debugUser = async (req, res, next) => {
  try {
    const { email } = req.body;

    console.log("🔍 DEBUG USER REQUEST:", email);

    const user = await User.findOne({ email: email.toLowerCase().trim() })
      .select("_id name email phone role password")
      .lean();

    if (!user) {
      return res.json({
        success: false,
        message: "User not found",
        email: email,
      });
    }

    // Test password hashing
    const testPasswords = [
      "Larianne",
      "password123",
      "Password123",
      "password",
      "123456",
    ];
    const passwordTests = [];

    for (let testPwd of testPasswords) {
      const isMatch = await bcrypt.compare(testPwd, user.password);
      passwordTests.push({
        password: testPwd,
        matches: isMatch,
      });
    }

    res.json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        passwordHash: user.password,
        passwordLength: user.password?.length,
      },
      passwordTests: passwordTests,
    });
  } catch (error) {
    console.error("❌ DEBUG ERROR:", error);
    next(error);
  }
};

// ✅ USER DASHBOARD STATS (For cashier users)
const getUserDashboardStats = async (req, res, next) => {
  try {
    const Order = require("../models/orderModel");
    const Payment = require("../models/paymentModel");

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get counts for the logged-in user
    const [totalOrders, todayOrders, totalPayments, todayRevenue] =
      await Promise.all([
        Order.countDocuments({ user: req.user._id }),
        Order.countDocuments({
          user: req.user._id,
          createdAt: { $gte: today, $lt: tomorrow },
        }),
        Payment.countDocuments({ user: req.user._id }),
        Payment.aggregate([
          {
            $match: {
              user: req.user._id,
              createdAt: { $gte: today, $lt: tomorrow },
              status: "captured",
            },
          },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]),
      ]);

    const todayRevenueAmount =
      todayRevenue.length > 0 ? todayRevenue[0].total : 0;

    res.status(200).json({
      success: true,
      data: {
        totalOrders,
        todayOrders,
        totalPayments,
        todayRevenue: todayRevenueAmount,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ✅ ADMIN DASHBOARD STATS (Shows all data - Admin only)
const getAdminDashboardStats = async (req, res, next) => {
  try {
    // Check if user is admin
    if (req.user.role !== "admin") {
      return next(createHttpError(403, "Access denied. Admin only."));
    }

    const Order = require("../models/orderModel");
    const Payment = require("../models/paymentModel");
    const User = require("../models/userModel");

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get this week's date range
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    // Get last week's date range
    const startOfLastWeek = new Date(startOfWeek);
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);
    const endOfLastWeek = new Date(startOfLastWeek);
    endOfLastWeek.setDate(startOfLastWeek.getDate() + 7);

    // Get ALL data (no user filter for admin)
    const [
      totalOrders,
      todayOrders,
      weekOrders,
      lastWeekOrders,
      totalPayments,
      todayRevenue,
      weekRevenue,
      lastWeekRevenue,
      totalUsers,
    ] = await Promise.all([
      // Orders count
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

      // Payments count
      Payment.countDocuments(),

      // Revenue calculations
      Payment.aggregate([
        {
          $match: {
            createdAt: { $gte: today, $lt: tomorrow },
            status: "captured",
          },
        },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Payment.aggregate([
        {
          $match: {
            createdAt: { $gte: startOfWeek, $lt: endOfWeek },
            status: "captured",
          },
        },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Payment.aggregate([
        {
          $match: {
            createdAt: { $gte: startOfLastWeek, $lt: endOfLastWeek },
            status: "captured",
          },
        },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),

      // Users count
      User.countDocuments(),
    ]);

    // Calculate percentages vs last week
    const ordersWeekPercentage =
      lastWeekOrders > 0
        ? Math.round(((weekOrders - lastWeekOrders) / lastWeekOrders) * 100)
        : 0;

    const revenueWeekPercentage =
      lastWeekRevenue.length > 0 && lastWeekRevenue[0].total > 0
        ? Math.round(
            ((weekRevenue[0]?.total || 0 - lastWeekRevenue[0].total) /
              lastWeekRevenue[0].total) *
              100
          )
        : 0;

    res.status(200).json({
      success: true,
      data: {
        // Orders
        totalOrders,
        todayOrders,
        weekOrders,
        ordersWeekPercentage,

        // Revenue
        todayRevenue: todayRevenue.length > 0 ? todayRevenue[0].total : 0,
        weekRevenue: weekRevenue.length > 0 ? weekRevenue[0].total : 0,
        revenueWeekPercentage,

        // Users & Payments
        totalUsers,
        totalPayments,

        // Additional admin stats
        averageOrderValue:
          totalOrders > 0 ? (weekRevenue[0]?.total || 0) / weekOrders : 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Clear cache every hour to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (let [key, value] of userCache.entries()) {
    if (value.timestamp && now - value.timestamp > 3600000) {
      userCache.delete(key);
    }
  }
}, 600000);

// ✅ EXPORTS WITH DEBUG FUNCTION
module.exports = {
  register,
  login,
  getUserData,
  logout,
  getUserDashboardStats,
  getAdminDashboardStats,
  debugUser,
};
