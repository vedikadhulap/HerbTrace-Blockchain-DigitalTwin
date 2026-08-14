const bcrypt = require("bcrypt");
const User = require("../models/User");
const jwt = require("jsonwebtoken");

const signup = async (req, res) => {
  try {
    const { name, email, password, role, proofDocumentUrl } = req.body;

    if (!name || !email || !password || !role || !proofDocumentUrl) {
      return res.status(400).json({ error: "All fields, including a proof document, are required." });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "An account with this email already exists." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
      proofDocumentUrl,
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

const approveUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { decision } = req.body; // "approved" or "rejected"

    if (!["approved", "rejected"].includes(decision)) {
      return res.status(400).json({ error: "Decision must be 'approved' or 'rejected'." });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    user.status = decision;
    await user.save();

    res.json({ message: `User ${decision}.`, userId: user._id, status: user.status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Approval update failed." });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    if (user.status !== "approved") {
      return res.status(403).json({ error: `Your account is ${user.status}. You cannot log in yet.` });
    }

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful.",
      token,
      role: user.role,
      name: user.name,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed." });
  }
};

const getPendingUsers = async (req, res) => {
  try {
    const pendingUsers = await User.find({ status: "pending" }).select("-password");
    res.json(pendingUsers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch pending users." });
  }
};
module.exports = { signup, approveUser, login, getPendingUsers };