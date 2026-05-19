import pool from "./config/db.js";

async function testConnection() {
  try {
    const [rows] = await pool.query("SELECT 1");
    console.log("CONNECTED:", rows);
  } catch (error) {
    console.error("ERROR:", error);
  }
}

testConnection();
