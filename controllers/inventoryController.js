// controllers/inventoryController.js
const Inventory = require("../models/Inventory");
const Order = require("../models/orderModel");
const mongoose = require("mongoose");

// Get all inventory items
exports.getInventory = async (req, res) => {
  try {
    const { search, lowStock } = req.query;
    let query = { isActive: true };

    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    let items = await Inventory.find(query).sort({ name: 1 });

    if (lowStock === "true") {
      items = items.filter(item => item.quantity <= item.minStockLevel);
    }

    const totalValue = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);

    res.json({
      success: true,
      data: items,
      count: items.length,
      totalValue: totalValue,
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

// Create new inventory item
exports.createInventory = async (req, res) => {
  try {
    const { name, description, price, quantity, unit, minStockLevel } = req.body;

    console.log("📦 Creating inventory item:", req.body);

    if (!name || price === undefined) {
      return res.status(400).json({
        success: false,
        message: "Name and price are required",
      });
    }

    const existingItem = await Inventory.findOne({ name: name.trim() });
    if (existingItem) {
      return res.status(400).json({
        success: false,
        message: "Item with this name already exists",
      });
    }

    const item = new Inventory({
      name: name.trim(),
      description: description || "",
      price: Number(price),
      quantity: quantity || 0,
      unit: unit || "pcs",
      minStockLevel: minStockLevel || 5,
    });

    await item.save();

    console.log("✅ Item created:", item);

    res.status(201).json({
      success: true,
      message: "Item created successfully",
      data: item,
    });
  } catch (error) {
    console.error("Error creating inventory item:", error);
    res.status(400).json({
      success: false,
      message: "Error creating item",
      error: error.message,
    });
  }
};

// Update inventory item
exports.updateInventory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, quantity, unit, minStockLevel } = req.body;

    const item = await Inventory.findById(id);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found",
      });
    }

    if (name) item.name = name.trim();
    if (description !== undefined) item.description = description;
    if (price !== undefined) item.price = Number(price);
    if (quantity !== undefined) item.quantity = Number(quantity);
    if (unit) item.unit = unit;
    if (minStockLevel !== undefined) item.minStockLevel = Number(minStockLevel);

    await item.save();

    res.json({
      success: true,
      message: "Item updated successfully",
      data: item,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Error updating item",
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
      message: "Item deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting item",
      error: error.message,
    });
  }
};

// Update stock quantity (add or remove)
exports.updateStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, type } = req.body;

    console.log("📦 Updating stock:", { id, quantity, type });

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

    const oldQuantity = item.quantity;
    
    if (type === "add") {
      item.quantity += Number(quantity);
    } else if (type === "remove") {
      if (item.quantity < Number(quantity)) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock. Only ${item.quantity} available`,
        });
      }
      item.quantity -= Number(quantity);
    } else {
      return res.status(400).json({
        success: false,
        message: "Type must be 'add' or 'remove'",
      });
    }

    await item.save();

    res.json({
      success: true,
      message: `Stock ${type === "add" ? "added" : "removed"} successfully`,
      data: {
        name: item.name,
        oldQuantity: oldQuantity,
        newQuantity: item.quantity,
        changedBy: quantity,
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

// Transfer stock (for compatibility)
exports.transferStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { from, to, quantity } = req.body;

    const item = await Inventory.findById(id);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found",
      });
    }

    res.json({
      success: true,
      message: "Transfer function - use updateStock instead",
      data: item,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Error in transfer",
      error: error.message,
    });
  }
};

// Get low stock items
exports.getLowStock = async (req, res) => {
  try {
    const items = await Inventory.find({
      isActive: true,
      $expr: { $lte: ["$quantity", "$minStockLevel"] },
    }).sort({ quantity: 1 });

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

// Get financial summary
exports.getFinancialSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const orderSummary = await Order.getFinancialSummary(startDate, endDate);
    
    const inventoryItems = await Inventory.find({ isActive: true });
    const inventoryValue = inventoryItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    
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

// Get profit report (expenses vs income)
exports.getProfitReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Build date filter
    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }
    
    // Get all completed orders
    const orders = await Order.find({
      orderStatus: "completed",
      ...dateFilter
    });
    
    // Calculate totals
    let totalRevenue = 0;
    let totalCost = 0;
    let productSales = {};
    
    orders.forEach(order => {
      totalRevenue += order.totalAmount || 0;
      totalCost += order.totalCost || 0;
      
      // Per product tracking
      if (order.items && Array.isArray(order.items)) {
        order.items.forEach(item => {
          if (!productSales[item.name]) {
            productSales[item.name] = {
              revenue: 0,
              cost: 0,
              quantity: 0
            };
          }
          productSales[item.name].revenue += (item.price * item.quantity);
          productSales[item.name].cost += (item.costPerUnit * item.quantity);
          productSales[item.name].quantity += item.quantity;
        });
      }
    });
    
    const totalProfit = totalRevenue - totalCost;
    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    
    // Convert productSales to array and add profit
    const productsList = Object.entries(productSales).map(([name, data]) => ({
      name,
      revenue: data.revenue,
      cost: data.cost,
      profit: data.revenue - data.cost,
      quantity: data.quantity,
      margin: data.revenue > 0 ? ((data.revenue - data.cost) / data.revenue) * 100 : 0
    })).sort((a, b) => b.profit - a.profit);
    
    // Get inventory summary (total gastos sa ingredients)
    const inventoryItems = await Inventory.find({ isActive: true });
    const totalInventoryValue = inventoryItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    const totalInventoryCost = inventoryItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    
    res.json({
      success: true,
      data: {
        summary: {
          totalRevenue: totalRevenue,
          totalCost: totalCost,
          totalProfit: totalProfit,
          profitMargin: profitMargin.toFixed(2) + "%",
          totalOrders: orders.length,
          averageOrderValue: orders.length > 0 ? totalRevenue / orders.length : 0,
          inventoryValue: totalInventoryValue,
          totalInventoryCost: totalInventoryCost
        },
        topProducts: productsList.slice(0, 10),
        dateRange: {
          startDate: startDate || "all time",
          endDate: endDate || "present"
        }
      }
    });
  } catch (error) {
    console.error("Error getting profit report:", error);
    res.status(500).json({
      success: false,
      message: "Error getting profit report",
      error: error.message
    });
  }
};