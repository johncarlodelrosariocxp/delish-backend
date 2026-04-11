// routes/inventory.js
const express = require("express");
const router = express.Router();
const inventoryController = require("../controllers/inventoryController");
const { isVerifiedUser } = require("../middlewares/tokenVerification");

// All routes require authentication
router.use(isVerifiedUser);

// Inventory CRUD
router.get("/", inventoryController.getInventory);
router.get("/low-stock", inventoryController.getLowStock);
router.get("/financial-summary", inventoryController.getFinancialSummary);
router.get("/profit-report", inventoryController.getProfitReport);
router.get("/:id", inventoryController.getInventoryById);
router.post("/", inventoryController.createInventory);
router.put("/:id", inventoryController.updateInventory);
router.patch("/:id/stock", inventoryController.updateStock);
router.patch("/:id/transfer", inventoryController.transferStock);
router.delete("/:id", inventoryController.deleteInventory);

module.exports = router;