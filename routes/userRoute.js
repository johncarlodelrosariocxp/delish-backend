const express = require("express");
const {
  register,
  login,
  getUserData,
  logout,
  getUserDashboardStats,
  getAdminDashboardStats,
  debugUser,
} = require("../controllers/userController");
const { isVerifiedUser } = require("../middlewares/tokenVerification");
const router = express.Router();

// 👥 AUTH ROUTES
router.post("/register", register);
router.post("/login", login);
router.post("/logout", isVerifiedUser, logout);
router.post("/debug-user", debugUser);

// 👤 USER ROUTES
router.get("/me", isVerifiedUser, getUserData);
router.get("/dashboard/stats", isVerifiedUser, getUserDashboardStats);

// 🔐 ADMIN ROUTES
router.get("/admin/dashboard/stats", isVerifiedUser, getAdminDashboardStats);

module.exports = router;
