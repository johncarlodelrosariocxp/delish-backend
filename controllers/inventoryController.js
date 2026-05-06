const Inventory = require("../models/Inventory");
const Order = require("../models/orderModel");
const { Menu } = require("../models/menuModel");

// Get all inventory items
exports.getInventory = async (req, res) => {
  try {
    const { search, lowStock, category, startDate, endDate, transactionType } =
      req.query;
    let query = { isActive: true };

    if (search) {
      query.itemName = { $regex: search, $options: "i" };
    }

    if (category) {
      query.category = category;
    }

    let items = await Inventory.find(query).sort({ itemName: 1 });

    // Filter by date range if provided
    if (startDate || endDate) {
      items = items.filter((item) => {
        let hasTransactionsInRange = false;

        if (item.transactions && item.transactions.length > 0) {
          const filteredTransactions = item.transactions.filter(
            (transaction) => {
              let match = true;
              if (startDate) {
                match =
                  match &&
                  new Date(transaction.timestamp) >= new Date(startDate);
              }
              if (endDate) {
                match =
                  match && new Date(transaction.timestamp) <= new Date(endDate);
              }
              if (transactionType && transactionType !== "all") {
                match = match && transaction.type === transactionType;
              }
              return match;
            },
          );

          if (filteredTransactions.length > 0) {
            hasTransactionsInRange = true;
          }
        }

        return hasTransactionsInRange;
      });
    }

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
      summary: { totalValue, totalPurchased, totalUsed },
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

// Get inventory transaction report by date
exports.getInventoryTransactionReport = async (req, res) => {
  try {
    const { startDate, endDate, itemId, transactionType } = req.query;

    let query = { isActive: true };

    if (itemId) {
      query._id = itemId;
    }

    const items = await Inventory.find(query);

    let allTransactions = [];

    for (const item of items) {
      if (item.transactions && item.transactions.length > 0) {
        let filteredTransactions = [...item.transactions];

        if (startDate) {
          filteredTransactions = filteredTransactions.filter(
            (t) => new Date(t.timestamp) >= new Date(startDate),
          );
        }

        if (endDate) {
          filteredTransactions = filteredTransactions.filter(
            (t) => new Date(t.timestamp) <= new Date(endDate),
          );
        }

        if (transactionType && transactionType !== "all") {
          filteredTransactions = filteredTransactions.filter(
            (t) => t.type === transactionType,
          );
        }

        filteredTransactions.forEach((transaction) => {
          allTransactions.push({
            itemId: item._id,
            itemName: item.itemName,
            category: item.category,
            unit: item.unit,
            unitPrice: item.unitPrice,
            transaction: transaction,
          });
        });
      }
    }

    // Sort by timestamp
    allTransactions.sort(
      (a, b) =>
        new Date(b.transaction.timestamp) - new Date(a.transaction.timestamp),
    );

    // Group by date for daily report
    const dailyReport = {};
    allTransactions.forEach((transaction) => {
      const date = new Date(transaction.transaction.timestamp)
        .toISOString()
        .split("T")[0];
      if (!dailyReport[date]) {
        dailyReport[date] = {
          date: date,
          added: [],
          removed: [],
          totalAdded: 0,
          totalRemoved: 0,
          totalAddedValue: 0,
          totalRemovedValue: 0,
          transactions: [],
        };
      }

      const transactionValue =
        transaction.transaction.quantity * transaction.unitPrice;

      if (transaction.transaction.type === "add") {
        dailyReport[date].added.push({
          itemName: transaction.itemName,
          quantity: transaction.transaction.quantity,
          unit: transaction.unit,
          value: transactionValue,
          reason: transaction.transaction.reason,
          timestamp: transaction.transaction.timestamp,
          performedBy: transaction.transaction.performedByName,
        });
        dailyReport[date].totalAdded += transaction.transaction.quantity;
        dailyReport[date].totalAddedValue += transactionValue;
      } else if (transaction.transaction.type === "remove") {
        dailyReport[date].removed.push({
          itemName: transaction.itemName,
          quantity: transaction.transaction.quantity,
          unit: transaction.unit,
          value: transactionValue,
          reason: transaction.transaction.reason,
          timestamp: transaction.transaction.timestamp,
          performedBy: transaction.transaction.performedByName,
        });
        dailyReport[date].totalRemoved += transaction.transaction.quantity;
        dailyReport[date].totalRemovedValue += transactionValue;
      }

      dailyReport[date].transactions.push({
        itemName: transaction.itemName,
        type: transaction.transaction.type,
        quantity: transaction.transaction.quantity,
        previousQuantity: transaction.transaction.previousQuantity,
        newQuantity: transaction.transaction.newQuantity,
        previousRemaining: transaction.transaction.previousRemaining,
        newRemaining: transaction.transaction.newRemaining,
        reason: transaction.transaction.reason,
        timestamp: transaction.transaction.timestamp,
        performedBy: transaction.transaction.performedByName,
        value: transactionValue,
      });
    });

    const dailyReportArray = Object.values(dailyReport).sort(
      (a, b) => new Date(b.date) - new Date(a.date),
    );

    // Calculate summary
    const summary = {
      totalTransactions: allTransactions.length,
      totalAdded: dailyReportArray.reduce(
        (sum, day) => sum + day.totalAdded,
        0,
      ),
      totalRemoved: dailyReportArray.reduce(
        (sum, day) => sum + day.totalRemoved,
        0,
      ),
      totalAddedValue: dailyReportArray.reduce(
        (sum, day) => sum + day.totalAddedValue,
        0,
      ),
      totalRemovedValue: dailyReportArray.reduce(
        (sum, day) => sum + day.totalRemovedValue,
        0,
      ),
      dateRange: {
        startDate: startDate || "all time",
        endDate: endDate || "present",
      },
    };

    res.json({
      success: true,
      data: {
        dailyReport: dailyReportArray,
        allTransactions,
        summary,
        filters: {
          startDate: startDate || null,
          endDate: endDate || null,
          itemId: itemId || null,
          transactionType: transactionType || "all",
        },
      },
    });
  } catch (error) {
    console.error("Error getting inventory transaction report:", error);
    res.status(500).json({
      success: false,
      message: "Error getting inventory transaction report",
      error: error.message,
    });
  }
};

// Get single inventory item
exports.getInventoryById = async (req, res) => {
  try {
    const item = await Inventory.findById(req.params.id);
    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: "Item not found" });
    }
    res.json({ success: true, data: item });
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

    if (!itemName || !itemName.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Item name is required" });
    }

    if (!quantity || quantity <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Quantity must be greater than 0" });
    }

    if (!unitPrice || unitPrice <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Unit price must be greater than 0" });
    }

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
      transactions: [],
      isActive: true,
    });

    // Add creation transaction
    await item.addTransaction(
      "create",
      numQuantity,
      0,
      numQuantity,
      0,
      numQuantity,
      "Initial stock creation",
      req.user?._id,
      req.user?.name || "System",
    );

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
      return res
        .status(404)
        .json({ success: false, message: "Item not found" });
    }

    if (
      updateData.quantity !== undefined &&
      updateData.quantity !== item.quantity
    ) {
      const previousQuantity = item.quantity;
      const previousRemaining = item.remainingQuantity;
      const newQuantity = Number(updateData.quantity);
      const quantityDiff = newQuantity - item.quantity;

      if (quantityDiff > 0) {
        item.quantity = newQuantity;
        item.remainingQuantity = newQuantity - item.usedQuantity;
        await item.addTransaction(
          "add",
          quantityDiff,
          previousQuantity,
          newQuantity,
          previousRemaining,
          item.remainingQuantity,
          "Stock adjustment (update)",
          req.user?._id,
          req.user?.name || "System",
        );
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
        await item.addTransaction(
          "remove",
          removalAmount,
          previousQuantity,
          newQuantity,
          previousRemaining,
          item.remainingQuantity,
          "Stock adjustment (update)",
          req.user?._id,
          req.user?.name || "System",
        );
      }
    }

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
      return res
        .status(404)
        .json({ success: false, message: "Item not found" });
    }

    item.isActive = false;
    await item.save();

    res.json({ success: true, message: "Inventory item deleted successfully" });
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

    if (quantity === undefined || !type) {
      return res
        .status(400)
        .json({ success: false, message: "Quantity and type are required" });
    }

    const item = await Inventory.findById(id);
    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: "Item not found" });
    }

    const previousQuantity = item.quantity;
    const previousRemaining = item.remainingQuantity;
    const oldRemaining = item.remainingQuantity;

    if (type === "add") {
      item.quantity += Number(quantity);
      item.remainingQuantity = item.quantity - item.usedQuantity;

      await item.addTransaction(
        "add",
        Number(quantity),
        previousQuantity,
        item.quantity,
        previousRemaining,
        item.remainingQuantity,
        reason || "Manual stock addition",
        req.user?._id,
        req.user?.name || "System",
      );
    } else if (type === "remove") {
      if (item.remainingQuantity < Number(quantity)) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock. Only ${item.remainingQuantity} ${item.unit} available`,
        });
      }
      item.usedQuantity += Number(quantity);
      item.remainingQuantity = item.quantity - item.usedQuantity;

      await item.addTransaction(
        "remove",
        Number(quantity),
        previousQuantity,
        item.quantity,
        previousRemaining,
        item.remainingQuantity,
        reason || "Manual stock removal",
        req.user?._id,
        req.user?.name || "System",
      );
    } else {
      return res
        .status(400)
        .json({ success: false, message: "Type must be 'add' or 'remove'" });
    }

    item.totalCost = item.quantity * item.unitPrice;
    await item.save();

    res.json({
      success: true,
      message: `Stock ${type === "add" ? "added" : "removed"} successfully`,
      data: {
        itemName: item.itemName,
        oldRemaining,
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
    res.json({ success: true, data: items, count: items.length });
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
      return res
        .status(404)
        .json({ success: false, message: "Inventory item not found" });
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
      data: { totalInventoryValue, items: itemsList, count: itemsList.length },
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
        currentStock,
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
          inventoryValue,
          totalInventoryPurchased,
          totalInventoryUsed,
        },
        topSellingItems: topSelling,
        dailySales,
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
