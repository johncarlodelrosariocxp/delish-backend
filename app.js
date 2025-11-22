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

const app = express();
const PORT = config.port;

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

// Enhanced CORS Configuration for Vercel and Mobile
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, postman, server-to-server)
      if (!origin) return callback(null, true);

      const allowedOrigins = [
        // Local development
        "http://localhost:5173",
        "http://127.0.0.1:5173",

        // Mobile access via local IP
        `http://${localIP}:5173`,

        // Vercel deployments (main domain)
        "https://delish-point-of-sale.vercel.app",
        "https://delish-final-pos.vercel.app",

        // Vercel preview deployments (wildcard patterns)
        "https://*.vercel.app",
        "https://*-git-*.vercel.app",
        "https://*-*-*.vercel.app",

        // Specific Vercel preview patterns
        /https:\/\/delish-final-pos-.*\.vercel\.app/,
        /https:\/\/delish-point-of-sale-.*\.vercel\.app/,
      ];

      // Check if the origin matches any allowed pattern
      const isAllowed = allowedOrigins.some((allowedOrigin) => {
        if (typeof allowedOrigin === "string") {
          return origin === allowedOrigin;
        } else if (allowedOrigin instanceof RegExp) {
          return allowedOrigin.test(origin);
        }
        return false;
      });

      if (isAllowed) {
        callback(null, true);
      } else {
        console.log("🚫 CORS Blocked Origin:", origin);
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
    ],
    exposedHeaders: ["set-cookie"],
  })
);

// Handle preflight requests
app.options("*", cors());

// Middleware
app.use(express.json()); // Parse JSON bodies
app.use(cookieParser()); // Parse cookies

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log("   Origin:", req.headers.origin);
  console.log("   User-Agent:", req.headers["user-agent"]);
  next();
});

// Health check endpoint (important for Vercel)
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    service: "Delish POS Backend",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    cors: {
      allowed: true,
      origin: req.headers.origin,
    },
  });
});

// Root Endpoint with connection info
app.get("/", (req, res) => {
  res.json({
    message: "✅ Delish POS Server is running!",
    server: {
      port: PORT,
      environment: process.env.NODE_ENV || "development",
      localIP: localIP,
    },
    endpoints: {
      health: "/health",
      api: "/api",
      user: "/api/user",
      inventory: "/api/inventory",
      orders: "/api/order",
      tables: "/api/table",
      payments: "/api/payment",
    },
    cors: {
      allowedOrigins: [
        "localhost:5173",
        "vercel.app domains",
        `local IP: ${localIP}`,
      ],
    },
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use("/api/user", userRoutes);
app.use("/api/order", orderRoutes);
app.use("/api/table", tableRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/inventory", inventoryRoutes);

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
      "GET /",
      "POST /api/user/login",
      "POST /api/user/register",
      "GET /api/inventory",
      "POST /api/order",
      "GET /api/table",
    ],
  });
});

// Start Server - LISTEN ON ALL INTERFACES
app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n🎉 ☑️  POS Server is running!`);
  console.log(`📍 Local: http://localhost:${PORT}`);
  console.log(`📱 Mobile: http://${localIP}:${PORT}`);
  console.log(`🌐 Network: http://0.0.0.0:${PORT}`);
  console.log(`\n📲 Access URLs:`);
  console.log(`   Frontend (Local): http://localhost:5173`);
  console.log(`   Frontend (Mobile): http://${localIP}:5173`);
  console.log(`   Backend API: http://localhost:${PORT}`);
  console.log(`   Health Check: http://localhost:${PORT}/health`);
  console.log(`\n🔧 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`🕒 Started at: ${new Date().toISOString()}\n`);
});
