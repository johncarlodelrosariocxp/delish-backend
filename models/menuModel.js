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

// Item Schema
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

const Menu = mongoose.model("Menu", menuSchema);
const ItemFlavor = mongoose.model("ItemFlavor", itemFlavorSchema);

module.exports = { Menu, ItemFlavor };
