const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.warn("MongoDB connection warning:", error.message);
    console.warn("[SERVER] Ensure your IP address is whitelisted on MongoDB Atlas if you need full REST API persistence.");
  }
};

module.exports = connectDB;