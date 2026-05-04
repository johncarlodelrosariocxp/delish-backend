const express = require("express");
const router = express.Router();
const menuController = require("../controllers/menuController");
const { protect, admin } = require("../middlewares/authMiddleware");

// Public routes (everyone can view menu)
router.get("/", protect, menuController.getAllMenus);
router.get("/tag/:tag", protect, menuController.getMenusByTag);
router.get("/:id", protect, menuController.getMenuById);
router.get("/:menuId/items", protect, menuController.getMenuItems);
router.get("/:menuId/items/:itemId", protect, menuController.getMenuItem);
router.get(
  "/:menuId/items/:itemId/availability",
  protect,
  menuController.checkMenuItemAvailability,
);
router.get("/item/flavors", protect, menuController.getAllItemFlavors);
router.get(
  "/item/flavors/category/:category",
  protect,
  menuController.getItemFlavorsByCategory,
);

// Admin only routes
router.post("/", protect, admin, menuController.createMenu);
router.put("/:id", protect, admin, menuController.updateMenu);
router.delete("/:id", protect, admin, menuController.deleteMenu);
router.post("/:menuId/items", protect, admin, menuController.addMenuItem);
router.put(
  "/:menuId/items/:itemId",
  protect,
  admin,
  menuController.updateMenuItem,
);
router.delete(
  "/:menuId/items/:itemId",
  protect,
  admin,
  menuController.deleteMenuItem,
);
router.post("/item/flavors", protect, admin, menuController.createItemFlavor);
router.put(
  "/item/flavors/:id",
  protect,
  admin,
  menuController.updateItemFlavor,
);
router.delete(
  "/item/flavors/:id",
  protect,
  admin,
  menuController.deleteItemFlavor,
);
router.post("/import", protect, admin, menuController.importMenuData);

module.exports = router;
