import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pool from "./config/db.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();

// ======================================================
// MIDDLEWARE
// ======================================================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ======================================================
// TEST ROOT ROUTE
// ======================================================
app.get("/api", (req, res) => {
  res.json({ status: "Ritasi App Is Running 🚚" });
});

// ======================================================
// LOAD ROUTES (MODULES)
// ======================================================
import masterRoutes from "./modules/master.js";
app.use("/api/master", masterRoutes);

import orderRoutes from "./modules/order.js";
app.use("/api/order", orderRoutes);

import buanganRoutes from "./modules/buangan.js";
app.use("/api/buangan", buanganRoutes);

import rekapRoutes from "./modules/rekap.js";
app.use("/api/rekap", rekapRoutes);

// ======================================================
// GLOBAL ERROR HANDLING
// ======================================================
app.use((err, req, res, next) => {
  console.error("🔥 ERROR:", err);
  res.status(500).json({
    status: false,
    message: "Terjadi masalah pada server",
    error: err.message,
  });
});

// ======================================================
// SERVE FRONTEND STATIC FILES
// ======================================================
app.use(express.static(path.join(__dirname, "../frontend")));

app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// ======================================================
// START SERVER & AUTO OPEN BROWSER
// ======================================================
const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`🚀 Server berjalan di http://localhost:${PORT}`);

  try {
    const conn = await pool.query("SELECT NOW() as time");
    console.log("💾 DB Connected:", conn[0][0].time);
    
    // Auto open browser after DB connected
    console.log("🌐 Membuka browser...");
    
    const { exec } = await import('child_process');
    const url = `http://localhost:${PORT}`;
    
    // Open browser based on OS
    const command = process.platform === 'win32' 
      ? `start ${url}` 
      : process.platform === 'darwin' 
      ? `open ${url}` 
      : `xdg-open ${url}`;
    
    exec(command);
    
  } catch (error) {
    console.error("❌ DB Connection Error:", error.message);
    console.log("⚠️  Server tetap berjalan, tapi database tidak terhubung");
  }
});