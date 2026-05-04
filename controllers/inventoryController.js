const Inventory = require("../models/Inventory");
const Order = require("../models/orderModel");
const { Menu } = require("../models/menuModel");

// Get all inventory items
exports.getInventory = async (req, res) => {
  try {
    const { search, lowStock, category } = req.query;
    let query = { isActive: true };

    if (search) {
      query.itemName = { $regex: search, $options: "i" };
    }

    if (category) {
      query.category = category;
    }

    let items = await Inventory.find(query).sort({ itemName: 1 });

    if (lowStock === "true") {
      items = items.filter(
        (item) => item.remainingQuantity <= 10 && item.remainingQuantity > 0,
      );
    }

    const totalValue = items.reduce(
      (sum, item) => sum + item.remainingQuantity * item.unitPrice,
      0,
    );
    const totalPurchased = items.reduce((sum, item) => sum + item.totalCost, 0);
    const totalUsed = items.reduce(
      (sum, item) => sum + item.usedQuantity * item.unitPrice,
      0,
    );

    res.json({
      success: true,
      data: items,
      count: items.length,
      summary: {
        totalValue: totalValue,
        totalPurchased: totalPurchased,
        totalUsed: totalUsed,
      },
    });
  } catch (error) {
    console.error("Error fetching inventory:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching inventory",
      error: error.message,
    });
  }
};

// Get single inventory item
exports.getInventoryById = async (req, res) => {
  try {
    const item = await Inventory.findById(req.params.id);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found",
      });
    }
    res.json({
      success: true,
      data: item,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching item",
      error: error.message,
    });
  }
};

// Create new inventory item - FIXED
exports.createInventory = async (req, res) => {
  try {
    const {
      itemName,
      description,
      category,
      quantity,
      unit,
      unitPrice,
      supplier,
      datePurchased,
      receiptNumber,
      notes,
      linkedMenuItems,
    } = req.body;

    console.log("📦 Creating inventory item:", req.body);

    // Validation
    if (!itemName || !itemName.trim()) {
      return res.status(400).json({
        success: false,
        message: "Item name is required",
      });
    }

    if (!quantity || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be greater than 0",
      });
    }

    if (!unitPrice || unitPrice <= 0) {
      return res.status(400).json({
        success: false,
        message: "Unit price must be greater than 0",
      });
    }

    // Check for existing item (case insensitive)
    const existingItem = await Inventory.findOne({
      itemName: { $regex: new RegExp(`^${itemName.trim()}$`, "i") },
      isActive: true,
    });

    if (existingItem) {
      return res.status(400).json({
        success: false,
        message: `Inventory item "${itemName}" already exists`,
      });
    }

    const numQuantity = Number(quantity);
    const numUnitPrice = Number(unitPrice);
    const totalCost = numQuantity * numUnitPrice;

    const item = new Inventory({
      itemName: itemName.trim(),
      description: description || "",
      category: category || "Ingredients",
      quantity: numQuantity,
      usedQuantity: 0,
      remainingQuantity: numQuantity,
      unit: unit || "pcs",
      unitPrice: numUnitPrice,
      totalCost: totalCost,
      supplier: supplier || "",
      datePurchased: datePurchased || new Date(),
      receiptNumber: receiptNumber || "",
      notes: notes || "",
      linkedMenuItems: linkedMenuItems || [],
      isActive: true,
    });

    await item.save();

    console.log("✅ Inventory item created:", item);

    res.status(201).json({
      success: true,
      message: "Inventory item added successfully",
      data: item,
    });
  } catch (error) {
    console.error("Error creating inventory item:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Error creating inventory item",
    });
  }
};

// Update inventory item
exports.updateInventory = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const item = await Inventory.findById(id);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found",
      });
    }

    // Handle quantity updates
    if (
      updateData.quantity !== undefined &&
      updateData.quantity !== item.quantity
    ) {
      const newQuantity = Number(updateData.quantity);
      const quantityDiff = newQuantity - item.quantity;
      if (quantityDiff > 0) {
        item.quantity = newQuantity;
        item.remainingQuantity = newQuantity - item.usedQuantity;
      } else if (quantityDiff < 0) {
        const removalAmount = Math.abs(quantityDiff);
        if (item.remainingQuantity < removalAmount) {
          return res.status(400).json({
            success: false,
            message: `Cannot remove ${removalAmount} ${item.unit}. Only ${item.remainingQuantity} remaining.`,
          });
        }
        item.quantity = newQuantity;
        item.remainingQuantity = item.quantity - item.usedQuantity;
      }
    }

    // Update other fields
    if (updateData.unitPrice !== undefined) {
      item.unitPrice = Number(updateData.unitPrice);
      item.totalCost = item.quantity * item.unitPrice;
    }
    if (updateData.category !== undefined) item.category = updateData.category;
    if (updateData.unit !== undefined) item.unit = updateData.unit;
    if (updateData.supplier !== undefined) item.supplier = updateData.supplier;
    if (updateData.description !== undefined)
      item.description = updateData.description;
    if (updateData.notes !== undefined) item.notes = updateData.notes;
    if (updateData.receiptNumber !== undefined)
      item.receiptNumber = updateData.receiptNumber;
    if (updateData.linkedMenuItems !== undefined)
      item.linkedMenuItems = updateData.linkedMenuItems;

    await item.save();

    res.json({
      success: true,
      message: "Inventory item updated successfully",
      data: item,
    });
  } catch (error) {
    console.error("Error updating inventory item:", error);
    res.status(400).json({
      success: false,
      message: "Error updating inventory item",
      error: error.message,
    });
  }
};

// Delete inventory item (soft delete)
exports.deleteInventory = async (req, res) => {
  try {
    const item = await Inventory.findById(req.params.id);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found",
      });
    }

    item.isActive = false;
    await item.save();

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

// Update stock quantity (add or remove)
exports.updateStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, type, reason } = req.body;

    console.log("📦 Updating stock:", { id, quantity, type, reason });

    if (quantity === undefined || !type) {
      return res.status(400).json({
        success: false,
        message: "Quantity and type are required",
      });
    }

    const item = await Inventory.findById(id);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found",
      });
    }

    const oldRemaining = item.remainingQuantity;

    if (type === "add") {
      item.quantity += Number(quantity);
      item.remainingQuantity = item.quantity - item.usedQuantity;
    } else if (type === "remove") {
      if (item.remainingQuantity < Number(quantity)) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock. Only ${item.remainingQuantity} ${item.unit} available`,
        });
      }
      item.usedQuantity += Number(quantity);
      item.remainingQuantity = item.quantity - item.usedQuantity;
    } else {
      return res.status(400).json({
        success: false,
        message: "Type must be 'add' or 'remove'",
      });
    }

    item.totalCost = item.quantity * item.unitPrice;
    await item.save();

    res.json({
      success: true,
      message: `Stock ${type === "add" ? "added" : "removed"} successfully`,
      data: {
        itemName: item.itemName,
        oldRemaining: oldRemaining,
        newRemaining: item.remainingQuantity,
        quantityChanged: quantity,
        reason: reason || "Manual adjustment",
      },
    });
  } catch (error) {
    console.error("Error updating stock:", error);
    res.status(400).json({
      success: false,
      message: "Error updating stock",
      error: error.message,
    });
  }
};

// Get low stock items
exports.getLowStock = async (req, res) => {
  try {
    const items = await Inventory.find({
      isActive: true,
      remainingQuantity: { $lte: 10, $gt: 0 },
    }).sort({ remainingQuantity: 1 });

    res.json({
      success: true,
      data: items,
      count: items.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching low stock items",
      error: error.message,
    });
  }
};

// Link inventory item to menu items
exports.linkToMenuItems = async (req, res) => {
  try {
    const { id } = req.params;
    const { linkedMenuItems } = req.body;

    const item = await Inventory.findById(id);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Inventory item not found",
      });
    }

    item.linkedMenuItems = linkedMenuItems;
    await item.save();

    res.json({
      success: true,
      message: "Inventory item linked to menu items successfully",
      data: item,
    });
  } catch (error) {
    console.error("Error linking to menu items:", error);
    res.status(500).json({
      success: false,
      message: "Error linking to menu items",
      error: error.message,
    });
  }
};

// Get inventory value
exports.getInventoryValue = async (req, res) => {
  try {
    const items = await Inventory.find({
      isActive: true,
      remainingQuantity: { $gt: 0 },
    });

    const totalInventoryValue = items.reduce(
      (sum, item) => sum + item.remainingQuantity * item.unitPrice,
      0,
    );
    const itemsList = items.map((item) => ({
      itemName: item.itemName,
      remainingQuantity: item.remainingQuantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
      value: item.remainingQuantity * item.unitPrice,
    }));

    res.json({
      success: true,
      data: {
        totalInventoryValue: totalInventoryValue,
        items: itemsList,
        count: itemsList.length,
      },
    });
  } catch (error) {
    console.error("Error getting inventory value:", error);
    res.status(500).json({
      success: false,
      message: "Error getting inventory value",
      error: error.message,
    });
  }
};

// Get inventory usage report
exports.getInventoryUsageReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    const orders = await Order.find({
      orderStatus: "completed",
      ...dateFilter,
    });

    const inventoryUsage = {};
    const inventoryItems = await Inventory.find({ isActive: true });

    inventoryItems.forEach((item) => {
      inventoryUsage[item._id] = {
        itemName: item.itemName,
        totalUsed: 0,
        totalCost: 0,
        usedInOrders: [],
      };
    });

    for (const order of orders) {
      for (const orderItem of order.items) {
        if (orderItem.expenseId) {
          const invItem = inventoryItems.find(
            (i) => i._id.toString() === orderItem.expenseId?.toString(),
          );
          if (invItem && inventoryUsage[invItem._id]) {
            inventoryUsage[invItem._id].totalUsed += orderItem.quantity;
            inventoryUsage[invItem._id].totalCost += orderItem.totalCost || 0;
            inventoryUsage[invItem._id].usedInOrders.push({
              orderNumber: order.orderNumber,
              quantity: orderItem.quantity,
              cost: orderItem.totalCost,
              date: order.createdAt,
            });
          }
        }
      }
    }

    const currentStock = inventoryItems.map((item) => ({
      itemName: item.itemName,
      currentStock: item.remainingQuantity,
      unit: item.unit,
      value: item.remainingQuantity * item.unitPrice,
    }));

    res.json({
      success: true,
      data: {
        inventoryUsage: Object.values(inventoryUsage),
        currentStock: currentStock,
        totalInventoryValue: currentStock.reduce((sum, s) => sum + s.value, 0),
        dateRange: {
          startDate: startDate || "all time",
          endDate: endDate || "present",
        },
      },
    });
  } catch (error) {
    console.error("Error getting inventory usage report:", error);
    res.status(500).json({
      success: false,
      message: "Error getting inventory usage report",
      error: error.message,
    });
  }
};

// Get financial summary
exports.getFinancialSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const orderSummary = await Order.getFinancialSummary(startDate, endDate);

    const inventoryItems = await Inventory.find({ isActive: true });
    const inventoryValue = inventoryItems.reduce(
      (sum, item) => sum + item.remainingQuantity * item.unitPrice,
      0,
    );
    const totalInventoryPurchased = inventoryItems.reduce(
      (sum, item) => sum + item.totalCost,
      0,
    );
    const totalInventoryUsed = inventoryItems.reduce(
      (sum, item) => sum + item.usedQuantity * item.unitPrice,
      0,
    );

    const topSelling = await Order.getTopSellingItems(10);

    const dateRange = {};
    if (startDate) dateRange.$gte = new Date(startDate);
    if (endDate) dateRange.$lte = new Date(endDate);

    const dailySales = await Order.aggregate([
      {
        $match: {
          orderStatus: "completed",
          ...(Object.keys(dateRange).length && { createdAt: dateRange }),
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          revenue: { $sum: "$totalAmount" },
          cost: { $sum: "$totalCost" },
          profit: { $sum: "$profit" },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      success: true,
      data: {
        summary: {
          totalRevenue: orderSummary.totalRevenue,
          totalCost: orderSummary.totalCost,
          totalProfit: orderSummary.totalProfit,
          totalOrders: orderSummary.totalOrders,
          averageOrderValue: orderSummary.avgOrderValue,
          inventoryValue: inventoryValue,
          totalInventoryPurchased: totalInventoryPurchased,
          totalInventoryUsed: totalInventoryUsed,
        },
        topSellingItems: topSelling,
        dailySales: dailySales,
        dateRange: {
          startDate: startDate || "all time",
          endDate: endDate || "present",
        },
      },
    });
  } catch (error) {
    console.error("Error getting financial summary:", error);
    res.status(500).json({
      success: false,
      message: "Error getting financial summary",
      error: error.message,
    });
  }
};
