const { Menu, ItemFlavor } = require("../models/menuModel");
const Inventory = require("../models/Inventory");

// ==================== MENU CONTROLLERS ====================

// Get all menus
exports.getAllMenus = async (req, res) => {
  try {
    const menus = await Menu.find().sort({ id: 1 });

    // Enrich menu items with current inventory stock info
    const enrichedMenus = await Promise.all(
      menus.map(async (menu) => {
        const enrichedItems = await Promise.all(
          menu.items.map(async (item) => {
            if (item.trackInventory && item.inventoryRequirements.length > 0) {
              let canFulfill = true;
              let stockStatus = [];

              for (const req of item.inventoryRequirements) {
                const invItem = await Inventory.findById(req.inventoryItemId);
                if (invItem) {
                  const requiredQty = req.quantityPerServing;
                  const isAvailable = invItem.remainingQuantity >= requiredQty;
                  canFulfill = canFulfill && isAvailable;
                  stockStatus.push({
                    itemName: invItem.itemName,
                    required: requiredQty,
                    available: invItem.remainingQuantity,
                    unit: invItem.unit,
                    isAvailable: isAvailable,
                  });
                }
              }

              return {
                ...item.toObject(),
                canFulfill,
                stockStatus,
              };
            }
            return item.toObject();
          }),
        );

        return {
          ...menu.toObject(),
          items: enrichedItems,
        };
      }),
    );

    res.status(200).json({
      success: true,
      count: menus.length,
      menus: enrichedMenus,
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

    // Enrich items with inventory info
    const enrichedItems = await Promise.all(
      menu.items.map(async (item) => {
        if (item.trackInventory && item.inventoryRequirements.length > 0) {
          let canFulfill = true;
          let stockStatus = [];
          let totalCost = 0;

          for (const req of item.inventoryRequirements) {
            const invItem = await Inventory.findById(req.inventoryItemId);
            if (invItem) {
              const requiredQty = req.quantityPerServing;
              const isAvailable = invItem.remainingQuantity >= requiredQty;
              canFulfill = canFulfill && isAvailable;
              totalCost += requiredQty * invItem.unitPrice;
              stockStatus.push({
                itemName: invItem.itemName,
                required: requiredQty,
                available: invItem.remainingQuantity,
                unit: invItem.unit,
                isAvailable: isAvailable,
                costPerUnit: invItem.unitPrice,
                cost: requiredQty * invItem.unitPrice,
              });
            }
          }

          return {
            ...item.toObject(),
            canFulfill,
            stockStatus,
            currentIngredientCost: totalCost,
          };
        }
        return item.toObject();
      }),
    );

    res.status(200).json({
      success: true,
      menu: {
        ...menu.toObject(),
        items: enrichedItems,
      },
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

    // Enrich with inventory info
    const enrichedMenus = await Promise.all(
      menus.map(async (menu) => {
        const enrichedItems = await Promise.all(
          menu.items.map(async (item) => {
            if (item.trackInventory && item.inventoryRequirements.length > 0) {
              let canFulfill = true;
              for (const req of item.inventoryRequirements) {
                const invItem = await Inventory.findById(req.inventoryItemId);
                if (
                  invItem &&
                  invItem.remainingQuantity < req.quantityPerServing
                ) {
                  canFulfill = false;
                  break;
                }
              }
              return { ...item.toObject(), canFulfill };
            }
            return item.toObject();
          }),
        );
        return { ...menu.toObject(), items: enrichedItems };
      }),
    );

    res.status(200).json({
      success: true,
      count: menus.length,
      tag,
      menus: enrichedMenus,
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

    // Enrich items with inventory info
    const enrichedItems = await Promise.all(
      menu.items.map(async (item) => {
        if (item.trackInventory && item.inventoryRequirements.length > 0) {
          let canFulfill = true;
          let stockStatus = [];

          for (const req of item.inventoryRequirements) {
            const invItem = await Inventory.findById(req.inventoryItemId);
            if (invItem) {
              const isAvailable =
                invItem.remainingQuantity >= req.quantityPerServing;
              canFulfill = canFulfill && isAvailable;
              stockStatus.push({
                itemName: invItem.itemName,
                required: req.quantityPerServing,
                available: invItem.remainingQuantity,
                isAvailable: isAvailable,
              });
            }
          }

          return { ...item.toObject(), canFulfill, stockStatus };
        }
        return item.toObject();
      }),
    );

    res.status(200).json({
      success: true,
      menuId: menu.id,
      menuName: menu.name,
      count: enrichedItems.length,
      items: enrichedItems,
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

    // Enrich with inventory info
    let enrichedItem = item.toObject();
    if (item.trackInventory && item.inventoryRequirements.length > 0) {
      let canFulfill = true;
      let stockStatus = [];
      let totalIngredientCost = 0;

      for (const req of item.inventoryRequirements) {
        const invItem = await Inventory.findById(req.inventoryItemId);
        if (invItem) {
          const requiredQty = req.quantityPerServing;
          const isAvailable = invItem.remainingQuantity >= requiredQty;
          canFulfill = canFulfill && isAvailable;
          const cost = requiredQty * invItem.unitPrice;
          totalIngredientCost += cost;
          stockStatus.push({
            inventoryItemId: req.inventoryItemId,
            inventoryItemName: invItem.itemName,
            requiredQuantity: requiredQty,
            availableQuantity: invItem.remainingQuantity,
            unit: invItem.unit,
            unitPrice: invItem.unitPrice,
            cost: cost,
            isAvailable: isAvailable,
          });
        }
      }

      enrichedItem = {
        ...enrichedItem,
        canFulfill,
        stockStatus,
        totalIngredientCost,
        suggestedPrice: totalIngredientCost * 3, // Suggested 300% markup
      };
    }

    res.status(200).json({
      success: true,
      item: enrichedItem,
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

    const existingItem = menu.items.find((item) => item.id === newItem.id);
    if (existingItem) {
      return res.status(400).json({
        success: false,
        message: `Item with ID ${newItem.id} already exists in this menu`,
      });
    }

    // If item has inventory requirements, validate them
    if (newItem.trackInventory && newItem.inventoryRequirements) {
      for (const req of newItem.inventoryRequirements) {
        const invItem = await Inventory.findById(req.inventoryItemId);
        if (!invItem) {
          return res.status(400).json({
            success: false,
            message: `Inventory item ${req.inventoryItemName} not found`,
          });
        }
        req.inventoryItemName = invItem.itemName;
        req.unit = invItem.unit;
      }

      // Calculate total ingredient cost
      let totalCost = 0;
      for (const req of newItem.inventoryRequirements) {
        const invItem = await Inventory.findById(req.inventoryItemId);
        if (invItem) {
          totalCost += req.quantityPerServing * invItem.unitPrice;
        }
      }
      newItem.totalIngredientCost = totalCost;
    }

    menu.items.push(newItem);
    await menu.save();

    // Also update inventory items to link back to this menu item
    if (newItem.trackInventory && newItem.inventoryRequirements) {
      for (const req of newItem.inventoryRequirements) {
        const invItem = await Inventory.findById(req.inventoryItemId);
        if (invItem) {
          const existingLink = invItem.linkedMenuItems.find(
            (link) => link.menuItemId === newItem.id,
          );
          if (!existingLink) {
            invItem.linkedMenuItems.push({
              menuItemId: newItem.id,
              menuItemName: newItem.name,
              quantityPerUnit: req.quantityPerServing,
            });
            await invItem.save();
          }
        }
      }
    }

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

    const updateData = req.body;

    // If updating inventory requirements, validate and recalculate cost
    if (
      updateData.inventoryRequirements ||
      updateData.trackInventory !== undefined
    ) {
      const currentItem = menu.items[itemIndex];

      if (updateData.trackInventory !== undefined) {
        currentItem.trackInventory = updateData.trackInventory;
      }

      if (updateData.inventoryRequirements) {
        currentItem.inventoryRequirements = updateData.inventoryRequirements;

        // Validate and calculate total cost
        let totalCost = 0;
        for (const req of currentItem.inventoryRequirements) {
          const invItem = await Inventory.findById(req.inventoryItemId);
          if (invItem) {
            req.inventoryItemName = invItem.itemName;
            req.unit = invItem.unit;
            totalCost += req.quantityPerServing * invItem.unitPrice;
          }
        }
        currentItem.totalIngredientCost = totalCost;
      }

      // Update other fields
      Object.keys(updateData).forEach((key) => {
        if (key !== "inventoryRequirements" && key !== "trackInventory") {
          currentItem[key] = updateData[key];
        }
      });

      menu.items[itemIndex] = currentItem;
    } else {
      // Regular update without inventory changes
      menu.items[itemIndex] = {
        ...menu.items[itemIndex].toObject(),
        ...updateData,
      };
    }

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

    const deletedItem = menu.items.find(
      (item) => item.id === parseInt(req.params.itemId),
    );

    const itemIndex = menu.items.findIndex(
      (item) => item.id === parseInt(req.params.itemId),
    );

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Item not found",
      });
    }

    // Remove links from inventory items
    if (
      deletedItem &&
      deletedItem.trackInventory &&
      deletedItem.inventoryRequirements
    ) {
      for (const req of deletedItem.inventoryRequirements) {
        const invItem = await Inventory.findById(req.inventoryItemId);
        if (invItem) {
          invItem.linkedMenuItems = invItem.linkedMenuItems.filter(
            (link) => link.menuItemId !== deletedItem.id,
          );
          await invItem.save();
        }
      }
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

// Check if menu item can be fulfilled (inventory check)
exports.checkMenuItemAvailability = async (req, res) => {
  try {
    const { menuId, itemId, quantity = 1 } = req.params;

    const menu = await Menu.findOne({ id: parseInt(menuId) });
    if (!menu) {
      return res.status(404).json({
        success: false,
        message: "Menu not found",
      });
    }

    const item = menu.items.find((i) => i.id === parseInt(itemId));
    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found",
      });
    }

    if (!item.trackInventory || item.inventoryRequirements.length === 0) {
      return res.json({
        success: true,
        available: true,
        message: "Item does not require inventory tracking",
      });
    }

    const requirements = [];
    let canFulfill = true;
    let totalCost = 0;

    for (const req of item.inventoryRequirements) {
      const invItem = await Inventory.findById(req.inventoryItemId);
      if (!invItem) {
        requirements.push({
          itemName: req.inventoryItemName,
          required: req.quantityPerServing * quantity,
          available: 0,
          availableStock: false,
        });
        canFulfill = false;
      } else {
        const requiredQty = req.quantityPerServing * quantity;
        const isAvailable = invItem.remainingQuantity >= requiredQty;
        canFulfill = canFulfill && isAvailable;
        totalCost += requiredQty * invItem.unitPrice;

        requirements.push({
          itemName: invItem.itemName,
          required: requiredQty,
          available: invItem.remainingQuantity,
          unit: invItem.unit,
          costPerUnit: invItem.unitPrice,
          totalCost: requiredQty * invItem.unitPrice,
          availableStock: isAvailable,
        });
      }
    }

    res.json({
      success: true,
      data: {
        itemName: item.name,
        quantity: quantity,
        available: canFulfill,
        totalIngredientCost: totalCost,
        requirements: requirements,
        suggestedSellingPrice: totalCost * 3,
      },
    });
  } catch (error) {
    console.error("❌ Check availability error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check availability",
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

    if (regularFlavorOptions && regularFlavorOptions.length > 0) {
      await ItemFlavor.deleteMany({ category: "regular" });
      const regularFlavors = regularFlavorOptions.map((flavor) => ({
        ...flavor,
        category: "regular",
      }));
      importedFlavors = await ItemFlavor.insertMany(regularFlavors);
    }

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
