// routes/profitLossRoutes.js
const express = require("express");
const router = express.Router();
const profitLossController = require("../controllers/profitLossController");
const { isVerifiedUser } = require("../middlewares/tokenVerification");

// All routes require authentication
router.use(isVerifiedUser);

// Profit/Loss routes
router.post("/generate", profitLossController.generateProfitLoss);
router.post("/generate-daily", profitLossController.generateDailyReport);
router.get("/", profitLossController.getAllReports);
router.get("/latest", profitLossController.getLatestReport);
router.get("/summary", profitLossController.getAllTimeSummary);
router.get("/:id", profitLossController.getReportById);
router.delete("/:id", profitLossController.deleteReport);

module.exports = router;