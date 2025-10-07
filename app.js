const express = require("express");
const connectDB = require("./config/database");
const config = require("./config/config");
const globalErrorHandler = require("./middlewares/globalErrorHandler");
const cookieParser = require("cookie-parser");
const cors = require("cors");

const app = express();
const PORT = config.port;

// Connect to database
connectDB();

// CORS Configuration
app.use(
  cors({
    origin: [
      "http://localhost:5173", // Local dev
      "https://delish-point-of-sale.vercel.app", // Vercel frontend
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
app.use("/api/user", require("./routes/userRoute"));
app.use("/api/order", require("./routes/orderRoute"));
app.use("/api/table", require("./routes/tableRoute"));
app.use("/api/payment", require("./routes/paymentRoute"));

// Global Error Handler
app.use(globalErrorHandler);

// Start Server
app.listen(PORT, () => {
  console.log(`☑️ POS Server is listening on port ${PORT}`);
});
