const Inventory = require("../models/Inventory");

// Get all inventory items
exports.getInventory = async (req, res) => {
  try {
    const inventory = await Inventory.find(); // Removed \({ name: 1 })
    res.json({
      success: true,
      data: inventory,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching inventory",
      error: error.message,
    });
  }
};

// Create new inventory item
exports.createInventory = async (req, res) => {
  try {
    const inventory = new Inventory(req.body);
    await inventory.save();

    res.status(201).json({
      success: true,
      message: "Inventory item created successfully",
      data: inventory,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Error creating inventory item",
      error: error.message,
    });
  }
};

// Update inventory item
exports.updateInventory = async (req, res) => {
  try {
    const inventory = await Inventory.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!inventory) {
      return res.status(404).json({
        success: false,
        message: "Inventory item not found",
      });
    }

    res.json({
      success: true,
      message: "Inventory item updated successfully",
      data: inventory,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Error updating inventory item",
      error: error.message,
    });
  }
};

// Transfer stock between room and shop
exports.transferStock = async (req, res) => {
  try {
    const { from, to, quantity } = req.body;
    const inventory = await Inventory.findById(req.params.id);

    if (!inventory) {
      return res.status(404).json({
        success: false,
        message: "Inventory item not found",
      });
    }

    if (from === "stockRoom" && to === "shop") {
      if (inventory.stockRoomQuantity < quantity) {
        return res.status(400).json({
          success: false,
          message: "Insufficient stock in storage room",
        });
      }
      inventory.stockRoomQuantity -= quantity;
      inventory.shopQuantity += quantity;
    } else if (from === "shop" && to === "stockRoom") {
      if (inventory.shopQuantity < quantity) {
        return res.status(400).json({
          success: false,
          message: "Insufficient stock in shop",
        });
      }
      inventory.shopQuantity -= quantity;
      inventory.stockRoomQuantity += quantity;
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid transfer direction",
      });
    }

    await inventory.save();

    res.json({
      success: true,
      message: "Stock transferred successfully",
      data: inventory,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Error transferring stock",
      error: error.message,
    });
  }
};

// Delete inventory item
exports.deleteInventory = async (req, res) => {
  try {
    const inventory = await Inventory.findByIdAndDelete(req.params.id);

    if (!inventory) {
      return res.status(404).json({
        success: false,
        message: "Inventory item not found",
      });
    }

    res.json({
      success: true,
      message: "Inventory item deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting inventory item",
      error: error.message,
    });
  }
};

// Get low stock items
exports.getLowStock = async (req, res) => {
  try {
    const lowStockItems = await Inventory.find({
      $or: [
        { stockRoomQuantity: { $lte: "$minStockLevel" } },
        { shopQuantity: { $lte: "$minStockLevel" } },
      ],
      isActive: true,
    });

    res.json({
      success: true,
      data: lowStockItems,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching low stock items",
      error: error.message,
    });
  }
};
