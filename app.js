const express = require("express");
const connectDB = require("./config/database");
const config = require("./config/config");
const globalErrorHandler = require("./middlewares/globalErrorHandler");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const os = require("os");

// Route imports
const inventoryRoutes = require("./routes/inventory");
const userRoutes = require("./routes/userRoute");
const orderRoutes = require("./routes/orderRoute");
const tableRoutes = require("./routes/tableRoute");
const paymentRoutes = require("./routes/paymentRoute");
const salesRoutes = require("./routes/salesRoute");

const app = express();
const PORT = config.port || 8000;

// Connect to database
connectDB();

// Get local IP for mobile access
const getLocalIP = () => {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const interface of interfaces[name]) {
      if (interface.family === "IPv4" && !interface.internal) {
        return interface.address;
      }
    }
  }
  return "localhost";
};

const localIP = getLocalIP();

// Enhanced CORS configuration
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:5173",
      "https://delish-point-of-sale.vercel.app",
      "https://delish-final-pos.vercel.app",
      "https://delish-pos.vercel.app",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Cookie",
      "X-Requested-With",
      "x-access-token",
      "Accept",
    ],
    exposedHeaders: ["set-cookie"],
  })
);

// Pre-flight requests
app.options("*", cors());

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`\n🌐 ${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log("   Origin:", req.headers.origin);
  console.log("   User-Agent:", req.headers["user-agent"]);
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
    version: "1.0.0",
  });
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
      localIP: localIP,
      baseURL: `http://${req.headers.host}`,
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
app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n🎉 🚀 DELISH POS BACKEND SERVER STARTED!`);
  console.log(`=========================================`);
  console.log(`📍 Local: http://localhost:${PORT}`);
  console.log(`📱 Network: http://${localIP}:${PORT}`);
  console.log(`🌐 Production: https://delish-backend-1.onrender.com`);
  console.log(`\n🔧 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`🕒 Started: ${new Date().toISOString()}`);
  console.log(`=========================================\n`);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🛑 Shutting down server gracefully...");
  process.exit(0);
});
