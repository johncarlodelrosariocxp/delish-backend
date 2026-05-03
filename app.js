// app.js
const express = require("express");
const connectDB = require("./config/database");
const config = require("./config/config");
const globalErrorHandler = require("./middlewares/globalErrorHandler");
const cookieParser = require("cookie-parser");
const cors = require("cors");

// Route imports
const userRoutes = require("./routes/userRoute");
const orderRoutes = require("./routes/orderRoute");
const paymentRoutes = require("./routes/paymentRoute");
const salesRoutes = require("./routes/salesRoute");
const menuRoutes = require("./routes/menuRoutes");
const expenseRoutes = require("./routes/expenseRoutes");
const profitLossRoutes = require("./routes/profitLossRoutes");
const inventoryRoutes = require("./routes/inventoryRoutes"); // ✅ ADD THIS LINE

const app = express();
const PORT = process.env.PORT || 8000;

// Connect to database
connectDB();

// CORS configuration
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "https://delish-frontend-eight.vercel.app",
  "https://delish-final-pos.vercel.app",
  "https://final-delish-pos.vercel.app",
  "https://delish-pos-final.vercel.app",
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log(`🔒 CORS blocked origin: ${origin}`);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "Cookie",
    "X-Requested-With",
    "x-access-token",
    "Accept",
    "x-frontend-source",
    "x-frontend-url",
    "X-Frontend-Source",
    "X-Frontend-URL",
    "Access-Control-Allow-Origin",
    "Access-Control-Allow-Headers",
    "Access-Control-Allow-Methods",
  ],
  exposedHeaders: ["set-cookie", "Authorization"],
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`\n🌐 ${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log("   Origin:", req.headers.origin);
  next();
});

// CORS headers middleware
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
  }
  res.header("Access-Control-Allow-Credentials", "true");
  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, PATCH, OPTIONS",
  );
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Cookie, X-Requested-With, x-access-token, Accept, x-frontend-source, x-frontend-url, X-Frontend-Source, X-Frontend-URL",
  );
  next();
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    service: "Delish POS Backend",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    database: "Connected",
    cors: "Configured",
    allowedOrigins: allowedOrigins,
  });
});

// ==================== DEBUG ENDPOINTS ====================

// Debug orders endpoint
app.get("/api/debug/orders", async (req, res) => {
  try {
    const Order = require("./models/orderModel");
    const orders = await Order.find({})
      .populate("user", "name email role")
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      count: orders.length,
      orders: orders,
    });
  } catch (error) {
    console.error("❌ Debug orders error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Debug expenses endpoint
app.get("/api/debug/expenses", async (req, res) => {
  try {
    const Expense = require("./models/Expense");
    const expenses = await Expense.find({}).sort({ datePurchased: -1 }).lean();
    const totalPurchased = expenses.reduce(
      (sum, exp) => sum + (exp.totalCost || 0),
      0,
    );
    const totalUsed = expenses.reduce(
      (sum, exp) => sum + (exp.usedQuantity || 0) * (exp.unitPrice || 0),
      0,
    );
    const totalRemaining = expenses.reduce(
      (sum, exp) => sum + (exp.remainingQuantity || 0) * (exp.unitPrice || 0),
      0,
    );

    res.json({
      success: true,
      count: expenses.length,
      summary: {
        totalPurchased: totalPurchased,
        totalUsed: totalUsed,
        totalRemaining: totalRemaining,
      },
      expenses: expenses,
    });
  } catch (error) {
    console.error("❌ Debug expenses error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Debug profit/loss endpoint
app.get("/api/debug/profit-loss", async (req, res) => {
  try {
    const Order = require("./models/orderModel");
    const Expense = require("./models/Expense");

    const orders = await Order.find({ orderStatus: "completed" });
    const totalIncome = orders.reduce(
      (sum, order) => sum + (order.totalAmount || 0),
      0,
    );

    const expenses = await Expense.find({ isActive: true });
    const totalExpensesUsed = expenses.reduce(
      (sum, exp) => sum + (exp.usedQuantity || 0) * (exp.unitPrice || 0),
      0,
    );
    const totalPurchased = expenses.reduce(
      (sum, exp) => sum + (exp.totalCost || 0),
      0,
    );

    const totalProfit = totalIncome - totalExpensesUsed;
    const profitMargin =
      totalIncome > 0 ? (totalProfit / totalIncome) * 100 : 0;

    res.json({
      success: true,
      data: {
        totalIncome: totalIncome,
        totalExpensesUsed: totalExpensesUsed,
        totalPurchased: totalPurchased,
        remainingInventoryValue: totalPurchased - totalExpensesUsed,
        totalProfit: totalProfit,
        profitMargin: profitMargin.toFixed(2) + "%",
        totalOrders: orders.length,
      },
    });
  } catch (error) {
    console.error("❌ Debug profit/loss error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Debug inventory endpoint
app.get("/api/debug/inventory", async (req, res) => {
  try {
    const Inventory = require("./models/Inventory");
    const items = await Inventory.find({ isActive: true })
      .sort({ itemName: 1 })
      .lean();

    const totalValue = items.reduce(
      (sum, item) => sum + item.remainingQuantity * item.unitPrice,
      0,
    );

    res.json({
      success: true,
      count: items.length,
      totalValue: totalValue,
      items: items,
    });
  } catch (error) {
    console.error("❌ Debug inventory error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Debug database collections
app.get("/api/debug/database", async (req, res) => {
  try {
    const mongoose = require("mongoose");
    const collections = await mongoose.connection.db
      .listCollections()
      .toArray();
    const collectionCounts = {};

    for (const collection of collections) {
      const Model =
        mongoose.models[collection.name] ||
        mongoose.model(
          collection.name,
          new mongoose.Schema({}, { strict: false }),
        );
      const count = await Model.countDocuments();
      collectionCounts[collection.name] = count;
    }

    res.json({
      success: true,
      database:
        mongoose.connection.readyState === 1 ? "Connected" : "Disconnected",
      connectionState: mongoose.connection.readyState,
      collections: collections.map((c) => c.name),
      counts: collectionCounts,
    });
  } catch (error) {
    console.error("❌ Debug database error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== USER MANAGEMENT ENDPOINTS ====================

app.post("/api/force-create-user", async (req, res) => {
  try {
    const User = require("./models/userModel");
    const bcrypt = require("bcrypt");

    const { name, email, phone, password, role } = req.body;

    console.log("🚨 FORCE CREATING USER:", email);

    await User.deleteOne({ email });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      name: name || "Admin User",
      email: email,
      phone: phone || "1234567890",
      password: hashedPassword,
      role: role || "admin",
    });

    await newUser.save();
    console.log("✅ USER CREATED:", email);

    res.json({
      success: true,
      message: `User created successfully: ${email}`,
      user: {
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
    });
  } catch (error) {
    console.error("❌ Error creating user:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create user",
      error: error.message,
    });
  }
});

app.delete("/api/nuke-users", async (req, res) => {
  try {
    const User = require("./models/userModel");
    const result = await User.deleteMany({});

    res.json({
      success: true,
      message: `Deleted ${result.deletedCount} users`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("❌ Error deleting users:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete users",
      error: error.message,
    });
  }
});

app.get("/api/debug-users", async (req, res) => {
  try {
    const User = require("./models/userModel");
    const users = await User.find({})
      .select("name email role createdAt")
      .lean();

    res.json({
      success: true,
      users: users,
      count: users.length,
    });
  } catch (error) {
    console.error("❌ Error fetching users:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get users",
      error: error.message,
    });
  }
});

// ==================== ROOT ENDPOINT ====================

app.get("/", (req, res) => {
  res.json({
    message: "✅ Delish POS Server is running!",
    server: {
      port: PORT,
      environment: process.env.NODE_ENV || "development",
    },
    endpoints: {
      health: "GET /health",
      auth: {
        login: "POST /api/user/login",
        register: "POST /api/user/register",
        logout: "POST /api/user/logout",
        profile: "GET /api/user/me",
      },
      inventory: {
        list: "GET /api/inventory",
        add: "POST /api/inventory",
        update: "PUT /api/inventory/:id",
        delete: "DELETE /api/inventory/:id",
        stock: "PUT /api/inventory/:id/stock",
        linkToMenu: "POST /api/inventory/:id/link-to-menu",
        lowStock: "GET /api/inventory/low-stock",
        usageReport: "GET /api/inventory/usage-report",
        inventoryValue: "GET /api/inventory/inventory-value",
      },
      expenses: {
        list: "GET /api/expenses",
        add: "POST /api/expenses",
        update: "PUT /api/expenses/:id",
        delete: "DELETE /api/expenses/:id",
        profitLoss: "GET /api/expenses/profit-loss",
        inventoryValue: "GET /api/expenses/inventory-value",
      },
      profitLoss: {
        generate: "POST /api/profit-loss/generate",
        generateDaily: "POST /api/profit-loss/generate-daily",
        latest: "GET /api/profit-loss/latest",
        summary: "GET /api/profit-loss/summary",
        all: "GET /api/profit-loss",
        byId: "GET /api/profit-loss/:id",
        delete: "DELETE /api/profit-loss/:id",
      },
      orders: {
        list: "GET /api/order",
        create: "POST /api/order",
        update: "PUT /api/order/:id",
        stats: "GET /api/order/stats",
      },
      menu: {
        list: "GET /api/menu",
        byTag: "GET /api/menu/tag/:tag",
        byId: "GET /api/menu/:id",
      },
      sales: {
        list: "GET /api/sales",
        today: "GET /api/sales/today",
        stats: "GET /api/sales/stats",
      },
      debug: {
        orders: "GET /api/debug/orders",
        expenses: "GET /api/debug/expenses",
        inventory: "GET /api/debug/inventory",
        profitLoss: "GET /api/debug/profit-loss",
        database: "GET /api/debug/database",
        users: "GET /api/debug-users",
      },
      admin: {
        createUser: "POST /api/force-create-user",
        deleteUsers: "DELETE /api/nuke-users",
      },
    },
    timestamp: new Date().toISOString(),
  });
});

// ==================== API ROUTES ====================
app.use("/api/user", userRoutes);
app.use("/api/order", orderRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/profit-loss", profitLossRoutes);
app.use("/api/inventory", inventoryRoutes); // ✅ ADD THIS LINE

// Global Error Handler
app.use(globalErrorHandler);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.path,
    method: req.method,
    availableEndpoints: [
      "POST /api/user/login",
      "POST /api/user/register",
      "GET /api/user/me",
      "GET /api/inventory",
      "POST /api/inventory",
      "GET /api/expenses",
      "POST /api/expenses",
      "GET /api/expenses/profit-loss",
      "GET /api/expenses/inventory-value",
      "POST /api/profit-loss/generate",
      "GET /api/profit-loss/latest",
      "GET /api/profit-loss/summary",
      "GET /api/order",
      "POST /api/order",
      "GET /api/menu",
      "GET /api/sales",
    ],
  });
});

// ==================== START SERVER ====================
const server = app.listen(PORT, () => {
  console.log(`\n🎉 🚀 DELISH POS BACKEND SERVER STARTED!`);
  console.log(`=========================================`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`=========================================\n`);
  console.log(`📦 INVENTORY SYSTEM READY:`);
  console.log(`   GET  /api/inventory - View all inventory items`);
  console.log(`   POST /api/inventory - Add new inventory item`);
  console.log(`   PUT  /api/inventory/:id/stock - Update stock`);
  console.log(`   GET  /api/inventory/low-stock - View low stock items`);
  console.log(`   GET  /api/inventory/usage-report - View usage report`);
  console.log(`=========================================\n`);
  console.log(`💰 EXPENSE & PROFIT TRACKING SYSTEM READY`);
  console.log(`   GET  /api/expenses - View all expenses`);
  console.log(`   POST /api/expenses - Add new expense`);
  console.log(`   GET  /api/expenses/profit-loss - View profit report`);
  console.log(
    `   GET  /api/expenses/inventory-value - View remaining stock value`,
  );
  console.log(`=========================================\n`);
  console.log(`📊 PROFIT/LOSS REPORT ENDPOINTS:`);
  console.log(`   POST /api/profit-loss/generate - Generate custom report`);
  console.log(
    `   POST /api/profit-loss/generate-daily - Generate daily report`,
  );
  console.log(`   GET  /api/profit-loss/latest - Get latest report`);
  console.log(`   GET  /api/profit-loss/summary - Get all-time summary`);
  console.log(`   GET  /api/profit-loss - Get all reports`);
  console.log(`=========================================\n`);
  console.log(`📋 MENU & ORDERS:`);
  console.log(`   GET  /api/menu - View menu items`);
  console.log(`   GET  /api/order - View orders`);
  console.log(`   POST /api/order - Create new order`);
  console.log(`=========================================\n`);
  console.log(`🔧 DEBUG ENDPOINTS:`);
  console.log(`   GET  /api/debug/expenses - Debug expenses`);
  console.log(`   GET  /api/debug/inventory - Debug inventory`);
  console.log(`   GET  /api/debug/profit-loss - Quick profit check`);
  console.log(`   GET  /api/debug/orders - Debug orders`);
  console.log(`=========================================\n`);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🛑 Shutting down server gracefully...");
  server.close(() => {
    console.log("✅ Server closed");
    process.exit(0);
  });
});

process.on("SIGTERM", async () => {
  console.log("\n🛑 SIGTERM received, shutting down gracefully...");
  server.close(() => {
    console.log("✅ Server closed");
    process.exit(0);
  });
});
