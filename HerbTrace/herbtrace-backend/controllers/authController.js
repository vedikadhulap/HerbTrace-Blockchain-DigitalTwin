const bcrypt = require("bcrypt");
const User  = require("../models/User");
const Batch = require("../models/Batch");
const jwt   = require("jsonwebtoken");

const signup = async (req, res) => {
  try {
    const { name, email, password, phone, organizationName, state, role, proofDocumentUrl } = req.body;

    if (!name || !email || !password || !role || !proofDocumentUrl) {
      return res.status(400).json({ error: "All fields, including a proof document, are required." });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "An account with this email already exists." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name, email,
      password: hashedPassword,
      phone, organizationName, state,
      role, proofDocumentUrl,
      status: "pending",
    });

    res.status(201).json({
      message: "Account created. Your role request is pending admin approval.",
      userId: user._id,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Signup failed." });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: "Invalid email or password." });

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) return res.status(401).json({ error: "Invalid email or password." });

    if (user.status !== "approved") {
      return res.status(403).json({
        error: user.status === "pending"
          ? "Your account is pending admin review. You'll receive access once approved."
          : "Your application was not approved. Contact support for more information.",
        status: user.status,
      });
    }

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful.",
      token,
      role:  user.role,
      name:  user.name,
      userId: user._id,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed." });
  }
};

// GET /auth/pending — admin only: pending applications
const getPendingUsers = async (req, res) => {
  try {
    const users = await User.find({ status: "pending" }).select("-password").sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch pending users." });
  }
};

// PATCH /auth/approve/:userId — admin only: approve or reject
const approveUser = async (req, res) => {
  try {
    const { userId }   = req.params;
    const { decision } = req.body; // "approved" or "rejected"

    if (!["approved", "rejected"].includes(decision)) {
      return res.status(400).json({ error: "Decision must be 'approved' or 'rejected'." });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found." });

    user.status = decision;
    await user.save();

    res.json({ message: `User ${decision}.`, userId: user._id, status: user.status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Approval update failed." });
  }
};

// GET /auth/users?status=approved|rejected — admin only
const getUsers = async (req, res) => {
  try {
    const { status } = req.query;
    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ error: "Query param status must be 'approved' or 'rejected'." });
    }
    const users = await User.find({ status }).select("-password").sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch users." });
  }
};

// PATCH /auth/revoke/:userId — admin only: set status back to "rejected"
const revokeUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: "User not found." });
    user.status = "rejected";
    await user.save();
    res.json({ message: "User access revoked.", userId: user._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Revoke failed." });
  }
};

// GET /auth/me — any authenticated user: returns own profile from JWT userId
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-password");
    if (!user) return res.status(404).json({ error: "User not found." });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch profile." });
  }
};

// GET /auth/my-batches — any authenticated user: returns batches associated with their specific account
const getMyBatches = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-password");
    if (!user) return res.status(404).json({ error: "User not found." });

    let query = {};
    if (user.role === "farmer") {
      query = { createdBy: user._id };
    } else if (user.role === "lab") {
      query = { testedBy: user._id };
    } else if (user.role === "processor") {
      query = { processedBy: user._id };
    } else if (user.role === "distributor") {
      query = { transferredBy: user._id };
    } else if (user.role === "admin") {
      query = {}; // Admin can inspect all batches
    }

    const batches = await Batch.find(query).sort({ updatedAt: -1, createdAt: -1 }).limit(50);
    res.json(batches);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch batches." });
  }
};

module.exports = { signup, login, approveUser, getPendingUsers, getUsers, revokeUser, getMe, getMyBatches };