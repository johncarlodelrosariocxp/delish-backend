const express = require("express");
const router = express.Router();
const inventoryController = require("../controllers/inventoryController");
const { protect, admin } = require("../middlewares/authMiddleware");

// Routes
router.get("/", protect, inventoryController.getInventory);
router.get("/low-stock", protect, inventoryController.getLowStock);
router.get(
  "/usage-report",
  protect,
  inventoryController.getInventoryUsageReport,
);
router.get("/inventory-value", protect, inventoryController.getInventoryValue);
router.get("/:id", protect, inventoryController.getInventoryById);
router.post("/", protect, admin, inventoryController.createInventory);
router.put("/:id", protect, admin, inventoryController.updateInventory);
router.delete("/:id", protect, admin, inventoryController.deleteInventory);
router.put("/:id/stock", protect, admin, inventoryController.updateStock);
router.post(
  "/:id/link-to-menu",
  protect,
  admin,
  inventoryController.linkToMenuItems,
);

module.exports = router;
