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
    "x-frontend-source", // Added lowercase
    "x-frontend-url", // Added lowercase
    "X-Frontend-Source", // Added uppercase
    "X-Frontend-URL", // Added uppercase
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
  console.log("   Headers:", req.headers);
  console.log("   User-Agent:", req.headers["user-agent"]);
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

// Enhanced user management endpoints
app.post("/api/force-create-user", async (req, res) => {
  try {
    const User = require("./models/userModel");
    const bcrypt = require("bcrypt");

    const { name, email, phone, password, role } = req.body;

    console.log("🚨 FORCE CREATING USER:", email);
    console.log("📧 Request headers:", req.headers);

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
      "2. POST /api/user/login (login with credentials)",
      "3. Access protected endpoints with returned token",
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
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.path,
    method: req.method,
    availableEndpoints: [
      "GET /health",
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
  console.log(`🔧 CORS Headers: ${corsOptions.allowedHeaders.join(", ")}`);
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
