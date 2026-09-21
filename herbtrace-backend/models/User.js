const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name:             { type: String, required: true },
    email:            { type: String, required: true, unique: true, lowercase: true },
    password:         { type: String, required: true }, // stores HASHED password, never plain text
    phone:            { type: String }, // optional — for admin verification contact
    organizationName: { type: String }, // farm name for farmers, company name for others
    state:            { type: String }, // Indian state / region
    role:             { type: String, enum: ["farmer", "lab", "processor", "distributor", "admin"], required: true },
    proofDocumentUrl: { type: String, required: true }, // IPFS/Pinata link to uploaded proof document
    status:           { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);