const express = require("express");
const router = express.Router();
const inventoryController = require("../controllers/inventoryController");

// GET /api/inventory - Get all inventory items
router.get("/", inventoryController.getInventory);

// POST /api/inventory - Create new inventory item
router.post("/", inventoryController.createInventory);

// PUT /api/inventory/:id - Update inventory item
router.put("/:id", inventoryController.updateInventory);

// PATCH /api/inventory/:id/transfer - Transfer stock between locations
router.patch("/:id/transfer", inventoryController.transferStock);

// DELETE /api/inventory/:id - Delete inventory item
router.delete("/:id", inventoryController.deleteInventory);

// GET /api/inventory/low-stock - Get low stock items
router.get("/low-stock", inventoryController.getLowStock);

module.exports = router;
