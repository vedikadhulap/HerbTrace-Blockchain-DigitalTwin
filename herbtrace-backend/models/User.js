const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true, // stores the HASHED password, never plain text
    },
    role: {
      type: String,
      enum: ["farmer", "lab", "processor", "distributor", "admin"],
      required: true,
    },
    proofDocumentUrl: {
      type: String,
      required: true, // IPFS/Pinata link to their uploaded proof document
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);