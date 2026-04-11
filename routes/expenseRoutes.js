// routes/expenseRoutes.js
const express = require("express");
const router = express.Router();
const expenseController = require("../controllers/expenseController");
const { isVerifiedUser } = require("../middlewares/tokenVerification");

// All routes require authentication
router.use(isVerifiedUser);

// Expense routes
router.get("/", expenseController.getExpenses);
router.get("/profit-loss", expenseController.getProfitLossReport);
router.get("/inventory-value", expenseController.getInventoryValue);
router.post("/", expenseController.addExpense);
router.put("/:id", expenseController.updateExpense);
router.delete("/:id", expenseController.deleteExpense);

module.exports = router;