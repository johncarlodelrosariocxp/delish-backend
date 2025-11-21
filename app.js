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

const app = express();
const PORT = config.port;

// Connect to database
connectDB();

// CORS Configuration
app.use(
  cors({
    origin: [
      "http://localhost:5173", // Local development
      "https://delish-point-of-sale.vercel.app", // Old Vercel frontend
      "https://delish-final-pos.vercel.app", // New Vercel frontend
    ],
    credentials: true,
  })
);

// Middleware
app.use(express.json()); // Parse JSON bodies
app.use(cookieParser()); // Parse cookies

// Root Endpoint
app.get("/", (req, res) => {
  res.json({ message: "Hello from POS Server!" });
});

// API Routes
app.use("/api/user", userRoutes);
app.use("/api/order", orderRoutes);
app.use("/api/table", tableRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/inventory", inventoryRoutes);

// Global Error Handler
app.use(globalErrorHandler);

// Start Server
app.listen(PORT, () => {
  console.log(`☑️ POS Server is listening on port ${PORT}`);
});
