const mongoose = require("mongoose");

const inventorySchema = new mongoose.Schema(
  {
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
    // NEW: Link to menu items that use this inventory item
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
  next();
});

// Method to use stock for a menu item
inventorySchema.methods.useStock = async function (
  quantity,
  menuItemName = null,
) {
  if (this.remainingQuantity < quantity) {
    throw new Error(
      `Insufficient stock for ${this.itemName}. Available: ${this.remainingQuantity}, Required: ${quantity}`,
    );
  }
  this.usedQuantity += quantity;
  this.remainingQuantity = this.quantity - this.usedQuantity;
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
  if (!linkedItem) return true; // Not linked, no restriction
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
