// routes/menuRoutes.js
const express = require('express');
const router = express.Router();
const menuController = require('../controllers/menuController');
const { isVerifiedUser } = require('../middlewares/tokenVerification');

// Public routes (no authentication required)
router.get('/', menuController.getAllMenus);
router.get('/tag/:tag', menuController.getMenusByTag);
router.get('/:id', menuController.getMenuById);

// Menu Item routes (public)
router.get('/:menuId/items', menuController.getMenuItems);
router.get('/:menuId/items/:itemId', menuController.getMenuItem);

// Cheesecake flavor routes (public)
router.get('/cheesecake/flavors', menuController.getAllCheesecakeFlavors);
router.get('/cheesecake/flavors/category/:category', menuController.getCheesecakeFlavorsByCategory);

// Protected routes (require authentication)
// All routes below this require authentication
router.use(isVerifiedUser);

// Admin check middleware
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
};

// Admin only routes
router.use(isAdmin);

// Menu CRUD
router.post('/', menuController.createMenu);
router.put('/:id', menuController.updateMenu);
router.delete('/:id', menuController.deleteMenu);

// Menu Item CRUD
router.post('/:menuId/items', menuController.addMenuItem);
router.put('/:menuId/items/:itemId', menuController.updateMenuItem);
router.delete('/:menuId/items/:itemId', menuController.deleteMenuItem);

// Cheesecake flavor CRUD
router.post('/cheesecake/flavors', menuController.createCheesecakeFlavor);
router.put('/cheesecake/flavors/:id', menuController.updateCheesecakeFlavor);
router.delete('/cheesecake/flavors/:id', menuController.deleteCheesecakeFlavor);

// Bulk import (admin only)
router.post('/import', menuController.importMenuData);

module.exports = router;