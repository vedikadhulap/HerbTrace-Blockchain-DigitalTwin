const express = require("express");
const cors = require("cors");
require("dotenv").config();
const connectDB = require("./config/db");

const app = express();

connectDB();
app.use(cors({
  origin: "http://localhost:5173",
}));

app.use(cors());
app.use(express.json());
const authRoutes = require("./routes/authRoutes");
app.use("/auth", authRoutes);
app.get("/", (req, res) => {
    res.send("HerbTrace Backend is Running 🚀");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

const batchRoutes = require("./routes/batchRoutes");
// ...
app.use("/batch", batchRoutes);