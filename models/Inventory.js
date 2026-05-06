// models/Inventory.js - Add sku field to the schema
const mongoose = require("mongoose");

const inventoryTransactionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["add", "remove", "create", "update"],
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
    },
    previousQuantity: {
      type: Number,
      required: true,
    },
    newQuantity: {
      type: Number,
      required: true,
    },
    previousRemaining: {
      type: Number,
      required: true,
    },
    newRemaining: {
      type: Number,
      required: true,
    },
    reason: {
      type: String,
      default: "",
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    performedByName: {
      type: String,
      default: "System",
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

const inventorySchema = new mongoose.Schema(
  {
    // ADD THIS SKU FIELD TO FIX THE ERROR
    sku: {
      type: String,
      unique: true,
      sparse: true, // This allows multiple null/undefined values
      trim: true,
      uppercase: true,
      index: true,
    },
    itemName: {
      type: String,
      required: [true, "Item name is required"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    category: {
      type: String,
      enum: ["Ingredients", "Supplies", "Equipment", "Utilities", "Other"],
      default: "Ingredients",
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    usedQuantity: {
      type: Number,
      default: 0,
    },
    remainingQuantity: {
      type: Number,
      default: 0,
    },
    unit: {
      type: String,
      default: "pcs",
      enum: [
        "pcs",
        "kg",
        "g",
        "L",
        "ml",
        "box",
        "pack",
        "sack",
        "bottle",
        "cup",
        "oz",
        "lb",
      ],
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    totalCost: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    supplier: {
      type: String,
      trim: true,
      default: "",
    },
    datePurchased: {
      type: Date,
      default: Date.now,
    },
    receiptNumber: {
      type: String,
      trim: true,
      default: "",
    },
    notes: {
      type: String,
      default: "",
    },
    linkedMenuItems: [
      {
        menuItemId: {
          type: Number,
          ref: "Menu",
        },
        menuItemName: {
          type: String,
        },
        quantityPerUnit: {
          type: Number,
          default: 1,
          min: 0,
        },
      },
    ],
    transactions: [inventoryTransactionSchema],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

// Auto-calculate totalCost and remainingQuantity before saving
inventorySchema.pre("save", function (next) {
  if (this.quantity && this.unitPrice) {
    this.totalCost = this.quantity * this.unitPrice;
  }
  this.remainingQuantity = this.quantity - this.usedQuantity;

  // Auto-generate SKU if not provided
  if (!this.sku) {
    const prefix = this.itemName
      .replace(/[^a-zA-Z]/g, "")
      .substring(0, 3)
      .toUpperCase();
    const randomNum = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, "0");
    const timestamp = Date.now().toString().slice(-4);
    this.sku = `${prefix}${randomNum}${timestamp}`;
  }

  next();
});

// Method to add transaction
inventorySchema.methods.addTransaction = async function (
  type,
  quantity,
  previousQuantity,
  newQuantity,
  previousRemaining,
  newRemaining,
  reason = "",
  userId = null,
  userName = "System",
) {
  this.transactions.push({
    type,
    quantity,
    previousQuantity,
    newQuantity,
    previousRemaining,
    newRemaining,
    reason,
    performedBy: userId,
    performedByName: userName,
    timestamp: new Date(),
  });
  await this.save();
};

// Method to use stock for a menu item
inventorySchema.methods.useStock = async function (
  quantity,
  menuItemName = null,
  userId = null,
  userName = "System",
) {
  if (this.remainingQuantity < quantity) {
    throw new Error(
      `Insufficient stock for ${this.itemName}. Available: ${this.remainingQuantity}, Required: ${quantity}`,
    );
  }

  const previousQuantity = this.quantity;
  const previousRemaining = this.remainingQuantity;

  this.usedQuantity += quantity;
  this.remainingQuantity = this.quantity - this.usedQuantity;

  await this.addTransaction(
    "remove",
    quantity,
    previousQuantity,
    this.quantity,
    previousRemaining,
    this.remainingQuantity,
    `Used for ${menuItemName || "menu item"}`,
    userId,
    userName,
  );

  await this.save();

  return {
    itemName: this.itemName,
    quantityUsed: quantity,
    costPerUnit: this.unitPrice,
    totalCost: quantity * this.unitPrice,
    remainingStock: this.remainingQuantity,
    menuItem: menuItemName,
  };
};

// Method to check if inventory can fulfill a menu item
inventorySchema.methods.canFulfillMenuItem = function (
  menuItemId,
  quantity = 1,
) {
  const linkedItem = this.linkedMenuItems.find(
    (item) => item.menuItemId === menuItemId,
  );
  if (!linkedItem) return true;
  const requiredQuantity = linkedItem.quantityPerUnit * quantity;
  return this.remainingQuantity >= requiredQuantity;
};

// Method to get required quantity for a menu item
inventorySchema.methods.getRequiredQuantity = function (
  menuItemId,
  quantity = 1,
) {
  const linkedItem = this.linkedMenuItems.find(
    (item) => item.menuItemId === menuItemId,
  );
  if (!linkedItem) return 0;
  return linkedItem.quantityPerUnit * quantity;
};

module.exports = mongoose.model("Inventory", inventorySchema);
