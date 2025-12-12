const express = require("express");
const connectDB = require("./config/database");
const config = require("./config/config");
const globalErrorHandler = require("./middlewares/globalErrorHandler");
const cookieParser = require("cookie-parser");
const cors = require("cors");

// Route imports
const inventoryRoutes = require("./routes/inventory");
const userRoutes = require("./routes/userRoute");
const orderRoutes = require("./routes/orderRoute");
const tableRoutes = require("./routes/tableRoute");
const paymentRoutes = require("./routes/paymentRoute");
const salesRoutes = require("./routes/salesRoute");

const app = express();
const PORT = process.env.PORT || 8000;

// Connect to database
connectDB();

// Enhanced CORS configuration for production
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "https://delish-frontend-eight.vercel.app",
  "https://delish-final-pos.vercel.app",
  "https://final-delish-pos.vercel.app",
  "https://delish-pos-final.vercel.app",
];

// Create custom CORS middleware
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
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

// Apply CORS middleware
app.use(cors(corsOptions));

// Handle preflight requests
app.options("*", cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`\n🌐 ${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log("   Origin:", req.headers.origin);
  next();
});

// Add CORS headers manually for all responses
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
  }
  res.header("Access-Control-Allow-Credentials", "true");
  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, PATCH, OPTIONS"
  );
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Cookie, X-Requested-With, x-access-token, Accept, x-frontend-source, x-frontend-url, X-Frontend-Source, X-Frontend-URL"
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
      .populate("table", "tableNumber capacity status")
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      count: orders.length,
      orders: orders,
      database: process.env.MONGODB_URI ? "Connected" : "Not connected",
    });
  } catch (error) {
    console.error("❌ Debug orders error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Debug payments endpoint
app.get("/api/debug/payments", async (req, res) => {
  try {
    const Payment = require("./models/paymentModel");
    const payments = await Payment.find({})
      .populate("user", "name email role")
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      count: payments.length,
      payments: payments,
    });
  } catch (error) {
    console.error("❌ Debug payments error:", error);
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
          new mongoose.Schema({}, { strict: false })
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

// FIXED: Create test data endpoint that matches your Order model
app.post("/api/test/create-orders", async (req, res) => {
  try {
    const Order = require("./models/orderModel");
    const User = require("./models/userModel");
    const Table = require("./models/tableModel");

    // Get or create test user
    let user = await User.findOne({ email: "admin@delish.com" });
    if (!user) {
      const bcrypt = require("bcrypt");
      const hashedPassword = await bcrypt.hash("admin123", 10);
      user = await User.create({
        name: "Admin User",
        email: "admin@delish.com",
        phone: "1234567890",
        password: hashedPassword,
        role: "admin",
      });
    }

    // Get or create test table
    let table = await Table.findOne({ tableNumber: "T1" });
    if (!table) {
      table = await Table.create({
        tableNumber: "T1",
        capacity: 4,
        status: "available",
      });
    }

    // Create test orders with the CORRECT structure matching your Order model
    const testOrdersData = [
      {
        user: user._id,
        table: table._id,
        customerDetails: {
          name: "John Doe",
          phone: "1234567890",
          guests: 2,
        },
        items: [
          { name: "Burger", quantity: 2, price: 150, total: 300 },
          { name: "Fries", quantity: 1, price: 80, total: 80 },
        ],
        bills: {
          total: 380,
          tax: 38,
          totalWithTax: 418,
        },
        orderStatus: "completed",
        paymentMethod: "cash",
        paymentStatus: "paid",
        notes: "Test order 1",
      },
      {
        user: user._id,
        table: table._id,
        customerDetails: {
          name: "Jane Smith",
          phone: "0987654321",
          guests: 4,
        },
        items: [
          { name: "Pizza", quantity: 1, price: 250, total: 250 },
          { name: "Coke", quantity: 2, price: 50, total: 100 },
        ],
        bills: {
          total: 350,
          tax: 35,
          totalWithTax: 385,
        },
        orderStatus: "preparing",
        paymentMethod: "card",
        paymentStatus: "pending",
        notes: "Test order 2",
      },
      {
        user: user._id,
        table: table._id,
        customerDetails: {
          name: "Bob Wilson",
          phone: "5551234567",
          guests: 1,
        },
        items: [{ name: "Pasta", quantity: 3, price: 180, total: 540 }],
        bills: {
          total: 540,
          tax: 54,
          totalWithTax: 594,
        },
        orderStatus: "served",
        paymentMethod: "online",
        paymentStatus: "paid",
        notes: "Test order 3",
      },
    ];

    const orders = await Order.create(testOrdersData);

    // Populate the created orders
    const populatedOrders = await Order.find({
      _id: { $in: orders.map((o) => o._id) },
    })
      .populate("user", "name email role")
      .populate("table", "tableNumber");

    res.json({
      success: true,
      message: "Test orders created successfully",
      count: populatedOrders.length,
      orders: populatedOrders,
    });
  } catch (error) {
    console.error("❌ Test data error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.errors,
    });
  }
});

// Quick order test endpoint with minimal data
app.post("/api/test/simple-order", async (req, res) => {
  try {
    const Order = require("./models/orderModel");
    const User = require("./models/userModel");

    // Get any user
    const user = await User.findOne();

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "No users found. Create a user first.",
      });
    }

    // Create simple test order with all required fields
    const order = await Order.create({
      user: user._id,
      customerDetails: {
        name: "Test Customer",
        phone: "1234567890",
        guests: 1,
      },
      items: [
        {
          name: "Test Item",
          quantity: 1,
          price: 100,
          total: 100,
        },
      ],
      bills: {
        total: 100,
        tax: 10,
        totalWithTax: 110,
      },
      orderStatus: "pending",
      paymentMethod: "cash",
      paymentStatus: "pending",
      notes: "Simple test order",
    });

    res.json({
      success: true,
      message: "Test order created",
      order: await Order.findById(order._id).populate("user", "name email"),
    });
  } catch (error) {
    console.error("❌ Simple order error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.errors,
    });
  }
});

// Clear all test data
app.delete("/api/test/clear-data", async (req, res) => {
  try {
    const Order = require("./models/orderModel");
    const Payment = require("./models/paymentModel");

    const [ordersDeleted, paymentsDeleted] = await Promise.all([
      Order.deleteMany({}),
      Payment.deleteMany({}),
    ]);

    res.json({
      success: true,
      message: "Test data cleared",
      deleted: {
        orders: ordersDeleted.deletedCount,
        payments: paymentsDeleted.deletedCount,
      },
    });
  } catch (error) {
    console.error("❌ Clear data error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Enhanced user management endpoints
app.post("/api/force-create-user", async (req, res) => {
  try {
    const User = require("./models/userModel");
    const bcrypt = require("bcrypt");

    const { name, email, phone, password, role } = req.body;

    console.log("🚨 FORCE CREATING USER:", email);

    // Delete existing user first
    await User.deleteOne({ email });

    // Create new user
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

    // Verify creation
    const verifyUser = await User.findOne({ email });

    res.json({
      success: true,
      message: `User created successfully: ${email}`,
      user: {
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
      verified: !!verifyUser,
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

// Root endpoint with complete API documentation
app.get("/", (req, res) => {
  res.json({
    message: "✅ Delish POS Server is running!",
    server: {
      port: PORT,
      environment: process.env.NODE_ENV || "development",
      baseURL: `https://${req.headers.host}`,
    },
    cors: {
      configured: true,
      allowedOrigins: allowedOrigins,
      allowedHeaders: corsOptions.allowedHeaders,
    },
    endpoints: {
      health: "GET /health",
      debug: {
        orders: "GET /api/debug/orders",
        payments: "GET /api/debug/payments",
        database: "GET /api/debug/database",
        users: "GET /api/debug-users",
      },
      test: {
        createOrders: "POST /api/test/create-orders",
        simpleOrder: "POST /api/test/simple-order",
        clearData: "DELETE /api/test/clear-data",
      },
      auth: {
        register: "POST /api/user/register",
        login: "POST /api/user/login",
        logout: "POST /api/user/logout",
        profile: "GET /api/user/me",
      },
      sales: {
        all: "GET /api/sales",
        today: "GET /api/sales/today",
        stats: "GET /api/sales/stats",
        range: "GET /api/sales/range",
        reports: "GET /api/sales/reports",
      },
      orders: {
        create: "POST /api/order",
        list: "GET /api/order",
        single: "GET /api/order/:id",
        update: "PUT /api/order/:id",
        delete: "DELETE /api/order/:id",
        stats: "GET /api/order/stats",
      },
      tables: {
        create: "POST /api/table",
        list: "GET /api/table",
        update: "PUT /api/table/:id",
      },
      payments: {
        create: "POST /api/payment/create-order",
        verify: "POST /api/payment/verify-payment",
        list: "GET /api/payment",
        stats: "GET /api/payment/stats",
      },
      inventory: {
        list: "GET /api/inventory",
        create: "POST /api/inventory",
        update: "PUT /api/inventory/:id",
        delete: "DELETE /api/inventory/:id",
        lowStock: "GET /api/inventory/low-stock",
      },
      admin: {
        emergency: {
          createUser: "POST /api/force-create-user",
          deleteUsers: "DELETE /api/nuke-users",
          listUsers: "GET /api/debug-users",
        },
      },
    },
    quickStart: [
      "1. POST /api/force-create-user (create admin user)",
      "2. POST /api/test/simple-order (create test order)",
      "3. POST /api/user/login (login with credentials)",
      "4. Access protected endpoints with returned token",
    ],
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use("/api/user", userRoutes);
app.use("/api/order", orderRoutes);
app.use("/api/table", tableRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/sales", salesRoutes);

// Global Error Handler
app.use(globalErrorHandler);

// 404 Handler
app.use((req, res) => {
  // Check if it's a common mistake
  const commonMistakes = {
    "/api/login": "/api/user/login",
    "/api/register": "/api/user/register",
    "/api/logout": "/api/user/logout",
    "/api/me": "/api/user/me",
  };

  const suggestedPath = commonMistakes[req.path];
  const suggestion = suggestedPath
    ? `Did you mean: ${req.method} ${suggestedPath}?`
    : "Check the available endpoints below";

  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.path,
    method: req.method,
    suggestion: suggestion,
    availableEndpoints: [
      "GET /health",
      "GET /api/debug/orders",
      "GET /api/debug/payments",
      "GET /api/debug/database",
      "POST /api/test/create-orders",
      "POST /api/test/simple-order",
      "POST /api/force-create-user",
      "POST /api/user/register",
      "POST /api/user/login",
      "GET /api/sales",
      "GET /api/sales/today",
      "GET /api/sales/stats",
      "POST /api/order",
      "GET /api/order",
      "GET /api/inventory",
    ],
  });
});

// Start Server
const server = app.listen(PORT, () => {
  console.log(`\n🎉 🚀 DELISH POS BACKEND SERVER STARTED!`);
  console.log(`=========================================`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`🕒 Started: ${new Date().toISOString()}`);
  console.log(`🌍 Allowed Origins: ${allowedOrigins.join(", ")}`);
  console.log(`=========================================\n`);
  console.log(`🔍 DEBUG ENDPOINTS AVAILABLE:`);
  console.log(`   GET  /api/debug/orders`);
  console.log(`   GET  /api/debug/payments`);
  console.log(`   GET  /api/debug/database`);
  console.log(`   POST /api/test/simple-order`);
  console.log(`   POST /api/force-create-user`);
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
