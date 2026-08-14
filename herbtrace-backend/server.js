const express = require("express");
const cors = require("cors");
require("dotenv").config();
const connectDB = require("./config/db");

const app = express();

connectDB();

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

// Routes
const authRoutes = require("./routes/authRoutes");
const batchRoutes = require("./routes/batchRoutes");

app.use("/auth", authRoutes);
app.use("/batch", batchRoutes);

app.get("/", (req, res) => {
  res.send("HerbTrace Backend is Running 🚀");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});