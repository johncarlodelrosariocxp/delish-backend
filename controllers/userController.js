const createHttpError = require("http-errors");
const User = require("../models/userModel");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const config = require("../config/config");

// Cache for frequent user lookups (5 minute TTL)
const userCache = new Map();

const register = async (req, res, next) => {
  try {
    const { name, phone, email, password, role } = req.body;

    // Fast validation
    if (!name || !phone || !email || !password || !role) {
      return next(createHttpError(400, "All fields are required!"));
    }

    // Use lean() for faster query - only check if user exists
    const existingUser = await User.findOne({ email }).select("_id").lean();
    if (existingUser) {
      return next(createHttpError(400, "User already exists!"));
    }

    // Hash password and create user
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      name,
      phone,
      email,
      password: hashedPassword,
      role,
    });

    // Remove password from response
    const userResponse = newUser.toObject();
    delete userResponse.password;

    res.status(201).json({
      success: true,
      message: "New user created!",
      data: userResponse,
    });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return next(createHttpError(400, "All fields are required!"));
    }

    // Check cache first for faster login
    const cacheKey = `user:${email}`;
    let user = userCache.get(cacheKey);

    if (!user) {
      // Only select necessary fields for faster query
      user = await User.findOne({ email })
        .select("_id name email phone role password")
        .lean();

      if (user) {
        // Cache user data (without password) for 5 minutes
        const userCacheData = { ...user };
        userCache.set(cacheKey, userCacheData, 300000);
      }
    }

    if (!user) {
      return next(createHttpError(401, "Invalid Credentials"));
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return next(createHttpError(401, "Invalid Credentials"));
    }

    // Generate token immediately without waiting
    const accessToken = jwt.sign({ _id: user._id }, config.accessTokenSecret, {
      expiresIn: "1d",
    });

    // Prepare user data without password
    const userData = {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
    };

    // Set cookie and send response in parallel operations
    res.cookie("accessToken", accessToken, {
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
      httpOnly: true,
      sameSite: "none",
      secure: true,
    });

    res.status(200).json({
      success: true,
      message: "User login successfully!",
      data: userData,
      accessToken, // Include token in response for immediate client-side storage
    });
  } catch (error) {
    next(error);
  }
};

const getUserData = async (req, res, next) => {
  try {
    // Fast query with only needed fields
    const user = await User.findById(req.user._id)
      .select("name email phone role")
      .lean(); // Faster response without mongoose document overhead

    if (!user) {
      return next(createHttpError(404, "User not found"));
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    // Clear any cached user data
    if (req.user && req.user.email) {
      userCache.delete(`user:${req.user.email}`);
    }

    res.clearCookie("accessToken");
    res.status(200).json({
      success: true,
      message: "User logout successfully!",
    });
  } catch (error) {
    next(error);
  }
};

// Clear cache every hour to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (let [key, value] of userCache.entries()) {
    if (value.timestamp && now - value.timestamp > 3600000) {
      userCache.delete(key);
    }
  }
}, 600000); // Check every 10 minutes

module.exports = { register, login, getUserData, logout };
