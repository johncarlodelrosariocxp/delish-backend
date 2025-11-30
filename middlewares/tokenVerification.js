const createHttpError = require("http-errors");
const jwt = require("jsonwebtoken");
const config = require("../config/config");
const User = require("../models/userModel");

const isVerifiedUser = async (req, res, next) => {
  try {
    let token;

    // Check for token in multiple locations for frontend compatibility
    if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    } else if (req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.headers["x-access-token"]) {
      token = req.headers["x-access-token"];
    }

    if (!token) {
      const error = createHttpError(401, "Access token required!");
      return next(error);
    }

    // Verify token
    const decodeToken = jwt.verify(token, config.accessTokenSecret);

    // Use lean() for better performance
    const user = await User.findById(decodeToken._id)
      .select("_id name email phone role")
      .lean();

    if (!user) {
      const error = createHttpError(401, "User not found!");
      return next(error);
    }

    // Store user data in request
    req.user = {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
    };

    next();
  } catch (error) {
    // Handle specific JWT errors
    if (error.name === "TokenExpiredError") {
      const err = createHttpError(401, "Token expired!");
      return next(err);
    }
    if (error.name === "JsonWebTokenError") {
      const err = createHttpError(401, "Invalid token!");
      return next(err);
    }

    const err = createHttpError(401, "Authentication failed!");
    next(err);
  }
};

module.exports = { isVerifiedUser };
