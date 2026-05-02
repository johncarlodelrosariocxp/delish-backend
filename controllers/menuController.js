const { Menu, ItemFlavor } = require("../models/menuModel");

// ==================== MENU CONTROLLERS ====================

// Get all menus
exports.getAllMenus = async (req, res) => {
  try {
    const menus = await Menu.find().sort({ id: 1 });
    res.status(200).json({
      success: true,
      count: menus.length,
      menus,
    });
  } catch (error) {
    console.error("❌ Get all menus error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch menus",
      error: error.message,
    });
  }
};

// Get menu by ID
exports.getMenuById = async (req, res) => {
  try {
    const menu = await Menu.findOne({ id: parseInt(req.params.id) });

    if (!menu) {
      return res.status(404).json({
        success: false,
        message: "Menu not found",
      });
    }

    res.status(200).json({
      success: true,
      menu,
    });
  } catch (error) {
    console.error("❌ Get menu by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch menu",
      error: error.message,
    });
  }
};

// Get menus by tag (food/drink)
exports.getMenusByTag = async (req, res) => {
  try {
    const { tag } = req.params;

    if (!["food", "drink"].includes(tag)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tag. Must be "food" or "drink"',
      });
    }

    const menus = await Menu.find({ tag }).sort({ id: 1 });

    res.status(200).json({
      success: true,
      count: menus.length,
      tag,
      menus,
    });
  } catch (error) {
    console.error("❌ Get menus by tag error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch menus by tag",
      error: error.message,
    });
  }
};

// Create new menu
exports.createMenu = async (req, res) => {
  try {
    const { id, name, bgColor, icon, tag, items } = req.body;

    // Check if menu with this ID already exists
    const existingMenu = await Menu.findOne({ id });
    if (existingMenu) {
      return res.status(400).json({
        success: false,
        message: `Menu with ID ${id} already exists`,
      });
    }

    const menu = await Menu.create({
      id,
      name,
      bgColor,
      icon,
      tag,
      items: items || [],
    });

    res.status(201).json({
      success: true,
      message: "Menu created successfully",
      menu,
    });
  } catch (error) {
    console.error("❌ Create menu error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create menu",
      error: error.message,
    });
  }
};

// Update menu
exports.updateMenu = async (req, res) => {
  try {
    const menuId = parseInt(req.params.id);
    const updateData = req.body;

    const menu = await Menu.findOneAndUpdate({ id: menuId }, updateData, {
      new: true,
      runValidators: true,
    });

    if (!menu) {
      return res.status(404).json({
        success: false,
        message: "Menu not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Menu updated successfully",
      menu,
    });
  } catch (error) {
    console.error("❌ Update menu error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update menu",
      error: error.message,
    });
  }
};

// Delete menu
exports.deleteMenu = async (req, res) => {
  try {
    const menu = await Menu.findOneAndDelete({ id: parseInt(req.params.id) });

    if (!menu) {
      return res.status(404).json({
        success: false,
        message: "Menu not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Menu deleted successfully",
      menu,
    });
  } catch (error) {
    console.error("❌ Delete menu error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete menu",
      error: error.message,
    });
  }
};

// ==================== MENU ITEM CONTROLLERS ====================

// Get all items from a menu
exports.getMenuItems = async (req, res) => {
  try {
    const menu = await Menu.findOne({ id: parseInt(req.params.menuId) });

    if (!menu) {
      return res.status(404).json({
        success: false,
        message: "Menu not found",
      });
    }

    res.status(200).json({
      success: true,
      menuId: menu.id,
      menuName: menu.name,
      count: menu.items.length,
      items: menu.items,
    });
  } catch (error) {
    console.error("❌ Get menu items error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch menu items",
      error: error.message,
    });
  }
};

// Get specific item from menu
exports.getMenuItem = async (req, res) => {
  try {
    const menu = await Menu.findOne({ id: parseInt(req.params.menuId) });

    if (!menu) {
      return res.status(404).json({
        success: false,
        message: "Menu not found",
      });
    }

    const item = menu.items.find(
      (item) => item.id === parseInt(req.params.itemId),
    );

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found",
      });
    }

    res.status(200).json({
      success: true,
      item,
    });
  } catch (error) {
    console.error("❌ Get menu item error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch menu item",
      error: error.message,
    });
  }
};

// Add item to menu
exports.addMenuItem = async (req, res) => {
  try {
    const menu = await Menu.findOne({ id: parseInt(req.params.menuId) });

    if (!menu) {
      return res.status(404).json({
        success: false,
        message: "Menu not found",
      });
    }

    const newItem = req.body;

    // Check if item with this ID already exists in this menu
    const existingItem = menu.items.find((item) => item.id === newItem.id);
    if (existingItem) {
      return res.status(400).json({
        success: false,
        message: `Item with ID ${newItem.id} already exists in this menu`,
      });
    }

    menu.items.push(newItem);
    await menu.save();

    res.status(201).json({
      success: true,
      message: "Item added successfully",
      item: newItem,
    });
  } catch (error) {
    console.error("❌ Add menu item error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add menu item",
      error: error.message,
    });
  }
};

// Update menu item
exports.updateMenuItem = async (req, res) => {
  try {
    const menu = await Menu.findOne({ id: parseInt(req.params.menuId) });

    if (!menu) {
      return res.status(404).json({
        success: false,
        message: "Menu not found",
      });
    }

    const itemIndex = menu.items.findIndex(
      (item) => item.id === parseInt(req.params.itemId),
    );

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Item not found",
      });
    }

    // Update item
    menu.items[itemIndex] = {
      ...menu.items[itemIndex].toObject(),
      ...req.body,
    };
    await menu.save();

    res.status(200).json({
      success: true,
      message: "Item updated successfully",
      item: menu.items[itemIndex],
    });
  } catch (error) {
    console.error("❌ Update menu item error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update menu item",
      error: error.message,
    });
  }
};

// Delete menu item
exports.deleteMenuItem = async (req, res) => {
  try {
    const menu = await Menu.findOne({ id: parseInt(req.params.menuId) });

    if (!menu) {
      return res.status(404).json({
        success: false,
        message: "Menu not found",
      });
    }

    const itemIndex = menu.items.findIndex(
      (item) => item.id === parseInt(req.params.itemId),
    );

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Item not found",
      });
    }

    menu.items.splice(itemIndex, 1);
    await menu.save();

    res.status(200).json({
      success: true,
      message: "Item deleted successfully",
    });
  } catch (error) {
    console.error("❌ Delete menu item error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete menu item",
      error: error.message,
    });
  }
};

// ==================== ITEM FLAVOR CONTROLLERS ====================

// Get all item flavors
exports.getAllItemFlavors = async (req, res) => {
  try {
    const flavors = await ItemFlavor.find().sort({ category: 1, label: 1 });
    res.status(200).json({
      success: true,
      count: flavors.length,
      flavors,
    });
  } catch (error) {
    console.error("❌ Get item flavors error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch item flavors",
      error: error.message,
    });
  }
};

// Get item flavors by category
exports.getItemFlavorsByCategory = async (req, res) => {
  try {
    const { category } = req.params;

    if (!["regular", "keto"].includes(category)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category. Must be "regular" or "keto"',
      });
    }

    const flavors = await ItemFlavor.find({ category }).sort({ label: 1 });

    res.status(200).json({
      success: true,
      category,
      count: flavors.length,
      flavors,
    });
  } catch (error) {
    console.error("❌ Get item flavors by category error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch item flavors by category",
      error: error.message,
    });
  }
};

// Create item flavor
exports.createItemFlavor = async (req, res) => {
  try {
    const { label, price, category } = req.body;

    // Check if flavor already exists
    const existingFlavor = await ItemFlavor.findOne({ label, category });
    if (existingFlavor) {
      return res.status(400).json({
        success: false,
        message: `Flavor "${label}" already exists in ${category} category`,
      });
    }

    const flavor = await ItemFlavor.create({
      label,
      price,
      category: category || "regular",
    });

    res.status(201).json({
      success: true,
      message: "Item flavor created successfully",
      flavor,
    });
  } catch (error) {
    console.error("❌ Create item flavor error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create item flavor",
      error: error.message,
    });
  }
};

// Update item flavor
exports.updateItemFlavor = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const flavor = await ItemFlavor.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!flavor) {
      return res.status(404).json({
        success: false,
        message: "Item flavor not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Item flavor updated successfully",
      flavor,
    });
  } catch (error) {
    console.error("❌ Update item flavor error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update item flavor",
      error: error.message,
    });
  }
};

// Delete item flavor
exports.deleteItemFlavor = async (req, res) => {
  try {
    const { id } = req.params;
    const flavor = await ItemFlavor.findByIdAndDelete(id);

    if (!flavor) {
      return res.status(404).json({
        success: false,
        message: "Item flavor not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Item flavor deleted successfully",
    });
  } catch (error) {
    console.error("❌ Delete item flavor error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete item flavor",
      error: error.message,
    });
  }
};

// ==================== BULK IMPORT CONTROLLER ====================

// Import initial menu data
exports.importMenuData = async (req, res) => {
  try {
    const { menus, regularFlavorOptions, ketoFlavorOptions } = req.body;

    let importedMenus = [];
    let importedFlavors = [];

    // Import regular flavors first
    if (regularFlavorOptions && regularFlavorOptions.length > 0) {
      await ItemFlavor.deleteMany({ category: "regular" });
      const regularFlavors = regularFlavorOptions.map((flavor) => ({
        ...flavor,
        category: "regular",
      }));
      importedFlavors = await ItemFlavor.insertMany(regularFlavors);
    }

    // Import keto flavors
    if (ketoFlavorOptions && ketoFlavorOptions.length > 0) {
      await ItemFlavor.deleteMany({ category: "keto" });
      const ketoFlavors = ketoFlavorOptions.map((flavor) => ({
        ...flavor,
        category: "keto",
      }));
      importedFlavors = [
        ...importedFlavors,
        ...(await ItemFlavor.insertMany(ketoFlavors)),
      ];
    }

    // Import menus
    if (menus && menus.length > 0) {
      await Menu.deleteMany({});
      importedMenus = await Menu.insertMany(menus);
    }

    res.status(201).json({
      success: true,
      message: "Menu data imported successfully",
      stats: {
        menus: importedMenus.length,
        flavors: importedFlavors.length,
      },
    });
  } catch (error) {
    console.error("❌ Import menu data error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to import menu data",
      error: error.message,
    });
  }
};
