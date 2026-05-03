const mongoose = require("mongoose");

// Flavor Option Schema
const flavorOptionSchema = new mongoose.Schema({
  label: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
});

// Variant Schema
const variantSchema = new mongoose.Schema({
  label: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
});

// Inventory Requirement Schema - NEW
const inventoryRequirementSchema = new mongoose.Schema({
  inventoryItemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Inventory",
    required: true,
  },
  inventoryItemName: {
    type: String,
    required: true,
  },
  quantityPerServing: {
    type: Number,
    required: true,
    min: 0,
    default: 1,
  },
  unit: {
    type: String,
    default: "pcs",
  },
});

// Item Schema with inventory requirements
const itemSchema = new mongoose.Schema({
  id: {
    type: Number,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    required: true,
  },
  tag: {
    type: String,
    enum: ["food", "drink"],
    required: true,
  },
  variants: [variantSchema],
  hasFlavorSelection: {
    type: Boolean,
    default: false,
  },
  flavorOptions: [flavorOptionSchema],
  // NEW: Inventory requirements for this menu item
  inventoryRequirements: [inventoryRequirementSchema],
  // Flag if inventory tracking is enabled for this item
  trackInventory: {
    type: Boolean,
    default: false,
  },
  // Cost breakdown
  totalIngredientCost: {
    type: Number,
    default: 0,
  },
});

// Menu Schema
const menuSchema = new mongoose.Schema(
  {
    id: {
      type: Number,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
    },
    bgColor: {
      type: String,
      required: true,
    },
    icon: {
      type: String,
      required: true,
    },
    tag: {
      type: String,
      enum: ["food", "drink"],
      required: true,
    },
    items: [itemSchema],
  },
  {
    timestamps: true,
  },
);

// Item Flavor Options Schema (Global)
const itemFlavorSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    category: {
      type: String,
      enum: ["regular", "keto"],
      default: "regular",
    },
  },
  {
    timestamps: true,
  },
);

// Method to calculate total ingredient cost for an item
menuSchema.methods.calculateItemCost = async function (
  menuId,
  itemId,
  quantity = 1,
) {
  const menu = await Menu.findOne({ id: menuId });
  if (!menu) return 0;

  const item = menu.items.find((i) => i.id === itemId);
  if (!item || !item.trackInventory) return 0;

  let totalCost = 0;
  const Inventory = mongoose.model("Inventory");

  for (const req of item.inventoryRequirements) {
    const inventoryItem = await Inventory.findById(req.inventoryItemId);
    if (inventoryItem) {
      const requiredQty = req.quantityPerServing * quantity;
      totalCost += requiredQty * inventoryItem.unitPrice;
    }
  }

  return totalCost;
};

// Method to check and deduct inventory for a menu item
menuSchema.methods.deductInventoryForItem = async function (
  menuId,
  itemId,
  quantity = 1,
) {
  const menu = await Menu.findOne({ id: menuId });
  if (!menu) {
    throw new Error(`Menu with ID ${menuId} not found`);
  }

  const item = menu.items.find((i) => i.id === itemId);
  if (!item) {
    throw new Error(`Item with ID ${itemId} not found in menu`);
  }

  if (!item.trackInventory || item.inventoryRequirements.length === 0) {
    return {
      deducted: false,
      message: "No inventory tracking for this item",
      deductions: [],
    };
  }

  const deductions = [];
  const Inventory = mongoose.model("Inventory");

  for (const req of item.inventoryRequirements) {
    const inventoryItem = await Inventory.findById(req.inventoryItemId);
    if (!inventoryItem) {
      throw new Error(`Inventory item ${req.inventoryItemName} not found`);
    }

    const requiredQty = req.quantityPerServing * quantity;

    if (inventoryItem.remainingQuantity < requiredQty) {
      throw new Error(
        `Insufficient ${inventoryItem.itemName}. Available: ${inventoryItem.remainingQuantity} ${inventoryItem.unit}, Required: ${requiredQty} ${req.unit}`,
      );
    }

    const deduction = await inventoryItem.useStock(requiredQty, item.name);
    deductions.push(deduction);
  }

  return {
    deducted: true,
    message: `Successfully deducted ${quantity} ${item.name}(s) from inventory`,
    deductions: deductions,
    totalCost: deductions.reduce((sum, d) => sum + d.totalCost, 0),
  };
};

const Menu = mongoose.model("Menu", menuSchema);
const ItemFlavor = mongoose.model("ItemFlavor", itemFlavorSchema);

module.exports = { Menu, ItemFlavor };
