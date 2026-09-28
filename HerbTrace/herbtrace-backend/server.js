const express = require("express");
const http = require("http");
const cors = require("cors");
require("dotenv").config();
const { Server } = require("socket.io");
const connectDB = require("./config/db");
const digitalTwinBootstrap = require("./services/digitalTwinBootstrap");

const app = express();
const httpServer = http.createServer(app);

connectDB();

app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173" }));
app.use(express.json());

// Routes
const authRoutes = require("./routes/authRoutes");
const batchRoutes = require("./routes/batchRoutes");

app.use("/auth", authRoutes);
app.use("/batch", batchRoutes);

app.get("/", (req, res) => {
  res.send("HerbTrace Backend is Running");
});

// Socket.IO for Digital Twin Layer
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

// Bootstrap Digital Twin Layer (isolated, non-fatal for Express REST API)
digitalTwinBootstrap(io).catch((err) => {
  console.warn("[SERVER] Digital Twin bootstrap error (REST API operational):", err.message);
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});