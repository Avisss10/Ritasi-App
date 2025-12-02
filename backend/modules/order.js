// ============================================================================
// ORDER MODULE (FORM ORDER) - FIXED TIMEZONE
// ============================================================================

import express from "express";
import db from "../config/db.js";
import { success, error } from "../utils/response.js";

const router = express.Router();

// ============================================================================
// HELPER: Fix tanggal untuk MySQL (format YYYY-MM-DD)
// ============================================================================
function fixTanggalForMySQL(tanggalInput) {
  // Input format: "2025-11-25" (dari input type="date")
  // Output: "2025-11-25" (tanpa timezone conversion)
  
  if (!tanggalInput) return null;
  
  // Ambil hanya bagian tanggal (YYYY-MM-DD), abaikan timezone
  const tanggal = tanggalInput.split('T')[0];
  return tanggal;
}

// ============================================================================
// GET ALL ORDERS
// ============================================================================
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        o.*, 
        k.no_pintu,
        s.nama AS supir,
        g.nama_galian,
        DATE_FORMAT(o.tanggal_order, '%Y-%m-%d') as tanggal_order
      FROM orders o
      LEFT JOIN master_kendaraan k ON o.kendaraan_id = k.id
      LEFT JOIN master_supir s ON o.supir_id = s.id
      LEFT JOIN master_galian g ON o.galian_id = g.id
      ORDER BY o.id DESC
    `);

    return success(res, "Data semua order", rows);
  } catch (err) {
    return error(res, 500, "Gagal mengambil data order", err);
  }
});

// Endpoint untuk mendapatkan order berdasarkan tanggal hari ini
router.get('/today', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
    
    const [rows] = await db.query(`
      SELECT 
        o.*, 
        k.no_pintu,
        s.nama AS supir,
        g.nama_galian,
        DATE_FORMAT(o.tanggal_order, '%Y-%m-%d') as tanggal_order
      FROM orders o
      LEFT JOIN master_kendaraan k ON o.kendaraan_id = k.id
      LEFT JOIN master_supir s ON o.supir_id = s.id
      LEFT JOIN master_galian g ON o.galian_id = g.id
      WHERE DATE(o.tanggal_order) = ? 
      ORDER BY o.tanggal_order DESC
    `, [today]);
    
    return success(res, "Data order hari ini berhasil diambil", rows);
  } catch (err) {
    return error(res, 500, "Gagal mengambil data order hari ini", err);
  }
});


// ============================================================================
// GET ORDER DETAIL
// ============================================================================
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await db.query(`
      SELECT 
        o.*, 
        k.no_pintu,
        s.nama AS supir,
        g.nama_galian,
        DATE_FORMAT(o.tanggal_order, '%Y-%m-%d') as tanggal_order
      FROM orders o
      LEFT JOIN master_kendaraan k ON o.kendaraan_id = k.id
      LEFT JOIN master_supir s ON o.supir_id = s.id
      LEFT JOIN master_galian g ON o.galian_id = g.id
      WHERE o.id = ?
      LIMIT 1
    `, [id]);

    if (rows.length === 0) {
      return error(res, 404, `Order ID ${id} tidak ditemukan`);
    }

    return success(res, "Detail order", rows[0]);
  } catch (err) {
    return error(res, 500, "Gagal mengambil detail order", err);
  }
});

// ============================================================================
// CREATE ORDER
// ============================================================================
router.post("/", async (req, res) => {
  try {
    const {
      tanggal_order,
      no_order,
      petugas_order,
      kendaraan_id,
      supir_id,
      galian_id,
      no_do,
      jam_order,
      km_awal,
      uang_jalan,
      potongan = 0,
      proyek_input
    } = req.body;

    // FIX: Gunakan tanggal langsung tanpa konversi timezone
    const tanggalFixed = fixTanggalForMySQL(tanggal_order);

    if (!tanggal_order || !no_order || !petugas_order || !kendaraan_id ||
        !supir_id || !galian_id || !no_do || !jam_order || !km_awal || !uang_jalan) {
      return error(res, 400, "Semua field wajib diisi");
    }

    const hasil_akhir = uang_jalan - potongan;

    const [result] = await db.query(`
      INSERT INTO orders (
        tanggal_order, no_order, petugas_order,
        kendaraan_id, supir_id, galian_id,
        no_do, jam_order, km_awal,
        uang_jalan, potongan, hasil_akhir,
        proyek_input, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ON PROCESS')
    `, [
      tanggalFixed,
      no_order,
      petugas_order,
      kendaraan_id,
      supir_id,
      galian_id,
      no_do,
      jam_order,
      km_awal,
      uang_jalan,
      potongan,
      hasil_akhir,
      proyek_input
    ]);

    return success(res, "Order berhasil dibuat", {
      id: result.insertId,
      hasil_akhir,
      tanggal_order: tanggalFixed
    });

  } catch (err) {
    return error(res, 500, "Gagal membuat order", err);
  }
});

// ============================================================================
// UPDATE ORDER
// ============================================================================
router.put("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const fields = [];
    const values = [];

    const allowedFields = [
      "tanggal_order", "no_order", "petugas_order",
      "kendaraan_id", "supir_id", "galian_id",
      "no_do", "jam_order", "km_awal",
      "uang_jalan", "potongan", "proyek_input"
    ];

    allowedFields.forEach(f => {
      if (req.body[f] !== undefined) {
        // FIX: Jika field tanggal_order, gunakan helper function
        const value = f === "tanggal_order" 
          ? fixTanggalForMySQL(req.body[f]) 
          : req.body[f];
        
        fields.push(`${f} = ?`);
        values.push(value);
      }
    });

    // jika ada perubahan uang_jalan atau potongan → update hasil_akhir
    if (req.body.uang_jalan !== undefined || req.body.potongan !== undefined) {
      const uang_jalan = req.body.uang_jalan ?? 0;
      const potongan = req.body.potongan ?? 0;

      fields.push(`hasil_akhir = ?`);
      values.push(uang_jalan - potongan);
    }

    if (fields.length === 0) {
      return error(res, 400, "Tidak ada field yang dikirim");
    }

    values.push(id);

    const [result] = await db.query(`
      UPDATE orders SET ${fields.join(", ")} WHERE id = ?
    `, values);

    if (result.affectedRows === 0) {
      return error(res, 404, `Order ID ${id} tidak ditemukan`);
    }

    return success(res, "Order berhasil diupdate");

  } catch (err) {
    return error(res, 500, "Gagal update order", err);
  }
});

// ============================================================================
// DELETE ORDER
// ============================================================================
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await db.query(`DELETE FROM orders WHERE id = ?`, [id]);

    if (result.affectedRows === 0) {
      return error(res, 404, `Order ID ${id} tidak ditemukan`);
    }

    return success(res, "Order berhasil dihapus");

  } catch (err) {
    return error(res, 500, "Gagal menghapus order", err);
  }
});

// ============================================================================

export default router;