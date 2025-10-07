require("dotenv").config();

const config = Object.freeze({
  port: process.env.PORT || 8000,
  databaseURI:
    process.env.MONGODB_URI ||
    "mongodb+srv://johncarlodelrosario36:admin1234@cluster0.ixqvmup.mongodb.net/restaurant-pos?retryWrites=true&w=majority&appName=Cluster0",
  nodeEnv: process.env.NODE_ENV || "development",
  accessTokenSecret: process.env.JWT_SECRET,
  razorpayKeyId: process.env.RAZORPAY_KEY_ID,
  razorpaySecretKey: process.env.RAZORPAY_KEY_SECRET,
  razorpyWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
});

module.exports = config;
