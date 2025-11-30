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
const salesRoutes = require("./routes/salesRoute"); // ADD SALES ROUTES

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

// CORS
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Cookie",
      "X-Requested-With",
      "x-access-token",
    ],
    exposedHeaders: ["set-cookie"],
  })
);

app.options("*", cors());
app.use(express.json());
app.use(cookieParser());

// Request logging
app.use((req, res, next) => {
  console.log(`\n🌐 ${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log("   Origin:", req.headers.origin);
  next();
});

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    service: "Delish POS Backend",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

// ✅ FIXED: USER RESET ENDPOINT - THIS WILL ACTUALLY WORK
app.post("/api/force-create-user", async (req, res) => {
  try {
    const User = require("./models/userModel");
    const bcrypt = require("bcrypt");

    const { name, email, phone, password, role } = req.body;

    console.log("🚨 FORCE CREATING USER:", email);

    // DELETE existing user first
    const deleteResult = await User.deleteOne({ email });
    console.log("🗑️ Delete result:", deleteResult);

    // Create new user with the EXACT password
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      name: name || "Test User",
      email: email,
      phone: phone || "1234567890",
      password: hashedPassword,
      role: role || "admin",
    });

    await newUser.save();
    console.log("✅ USER CREATED:", email);

    // Verify the user was created
    const verifyUser = await User.findOne({ email });
    console.log(
      "🔍 VERIFICATION:",
      verifyUser ? "USER EXISTS" : "USER MISSING"
    );

    res.json({
      success: true,
      message: `USER CREATED: ${email} / ${password}`,
      user: {
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
      verified: !!verifyUser,
    });
  } catch (error) {
    console.error("❌ Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create user",
      error: error.message,
    });
  }
});

// ✅ EMERGENCY: DELETE ALL USERS ENDPOINT
app.delete("/api/nuke-users", async (req, res) => {
  try {
    const User = require("./models/userModel");
    const result = await User.deleteMany({});
    console.log("💣 NUKE USERS RESULT:", result);

    res.json({
      success: true,
      message: `Deleted ${result.deletedCount} users`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("❌ Nuke error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete users",
      error: error.message,
    });
  }
});

// ✅ LIST ALL USERS ENDPOINT
app.get("/api/debug-users", async (req, res) => {
  try {
    const User = require("./models/userModel");
    const users = await User.find({}).select("name email role").lean();
    console.log("👥 ALL USERS:", users);

    res.json({
      success: true,
      users: users,
      count: users.length,
    });
  } catch (error) {
    console.error("❌ Debug error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get users",
      error: error.message,
    });
  }
});

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "✅ Delish POS Server is running!",
    server: {
      port: PORT,
      environment: process.env.NODE_ENV || "development",
      localIP: localIP,
    },
    endpoints: {
      health: "GET /health",
      forceCreateUser: "POST /api/force-create-user",
      nukeUsers: "DELETE /api/nuke-users",
      debugUsers: "GET /api/debug-users",
      register: "POST /api/user/register",
      login: "POST /api/user/login",
      sales: "GET /api/sales", // ADD SALES ENDPOINT INFO
      salesToday: "GET /api/sales/today",
      salesStats: "GET /api/sales/stats",
    },
    quickStart: [
      "1. DELETE /api/nuke-users (clear all users)",
      "2. POST /api/force-create-user (create user)",
      "3. POST /api/user/login (login with created user)",
      "4. GET /api/sales (access sales data)",
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
app.use("/api/sales", salesRoutes); // ADD SALES ROUTES

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
      "POST /api/force-create-user",
      "DELETE /api/nuke-users",
      "GET /api/debug-users",
      "POST /api/user/register",
      "POST /api/user/login",
      "GET /api/sales", // UPDATE AVAILABLE ENDPOINTS
      "GET /api/sales/today",
      "GET /api/sales/stats",
      "GET /api/sales/range",
      "GET /api/sales/reports",
    ],
  });
});

// Start Server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n🎉 🚀 DELISH POS BACKEND SERVER STARTED!`);
  console.log(`=========================================`);
  console.log(`📍 Local: http://localhost:${PORT}`);
  console.log(`📱 Mobile: http://${localIP}:${PORT}`);
  console.log(`\n🚨 EMERGENCY ENDPOINTS:`);
  console.log(`   DELETE http://localhost:${PORT}/api/nuke-users`);
  console.log(`   POST http://localhost:${PORT}/api/force-create-user`);
  console.log(`   GET http://localhost:${PORT}/api/debug-users`);
  console.log(`\n💰 SALES ENDPOINTS:`);
  console.log(`   GET http://localhost:${PORT}/api/sales`);
  console.log(`   GET http://localhost:${PORT}/api/sales/today`);
  console.log(`   GET http://localhost:${PORT}/api/sales/stats`);
  console.log(`   GET http://localhost:${PORT}/api/sales/range`);
  console.log(`\n🕒 Started: ${new Date().toISOString()}`);
  console.log(`=========================================\n`);
});

process.on("SIGINT", async () => {
  console.log("\n🛑 Shutting down server...");
  process.exit(0);
});
