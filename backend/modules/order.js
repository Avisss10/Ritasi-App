// ============================================================================
// ORDER MODULE (FORM ORDER)
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

// --- normalize km_awal for storage: exact ODO ERROR check, then strip thousand separators and store as integer ---
function normalizeKmForStorage(kmValue) {
  if (kmValue === undefined || kmValue === null) return kmValue;
  const s = String(kmValue).trim();
  if (!s) return s;

  // Exact ODO ERROR check (case-insensitive, ignore spaces)
  const upper = s.toUpperCase().replace(/\s/g, '');
  if (upper === 'ODOERROR' || upper === 'ODOERR') return 'ODO ERROR';

  // Strip Indonesian thousand separators (dots) and store as integer
  const numeric = parseInt(s.replace(/\./g, '').replace(/,/g, ''), 10);
  if (!isNaN(numeric)) return numeric;

  return s;
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
        p.nama_proyek,
        DATE_FORMAT(o.tanggal_order, '%Y-%m-%d') as tanggal_order
      FROM orders o
      LEFT JOIN master_kendaraan k ON o.kendaraan_id = k.id
      LEFT JOIN master_supir s ON o.supir_id = s.id
      LEFT JOIN master_galian g ON o.galian_id = g.id
      LEFT JOIN master_proyek p ON o.proyek_id = p.id
      ORDER BY o.id DESC
    `);

    return success(res, "Data semua order", rows);
  } catch (err) {
    return error(res, 500, "Gagal mengambil data order", err);
  }
});

// ============================================================================
// GET ORDER HARI INI DAN KEMARIN
// ============================================================================
router.get('/today-yesterday', async (req, res) => {
  try {
    // Hitung tanggal hari ini
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0]; // Format: YYYY-MM-DD
    
    // Hitung tanggal kemarin (today - 1 hari)
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0]; // Format: YYYY-MM-DD
    
    const [rows] = await db.query(`
      SELECT
        o.*,
        k.no_pintu,
        s.nama AS supir,
        g.nama_galian,
        p.nama_proyek,
        DATE_FORMAT(o.tanggal_order, '%Y-%m-%d') as tanggal_order,
        CASE
          WHEN DATE(o.tanggal_order) = ? THEN 'Hari Ini'
          WHEN DATE(o.tanggal_order) = ? THEN 'Kemarin'
          ELSE 'Lainnya'
        END as kategori_waktu
      FROM orders o
      LEFT JOIN master_kendaraan k ON o.kendaraan_id = k.id
      LEFT JOIN master_supir s ON o.supir_id = s.id
      LEFT JOIN master_galian g ON o.galian_id = g.id
      LEFT JOIN master_proyek p ON o.proyek_id = p.id
      WHERE DATE(o.tanggal_order) IN (?, ?)
      ORDER BY o.tanggal_order DESC, o.id DESC
    `, [todayStr, yesterdayStr, todayStr, yesterdayStr]);
    
    return success(res, "Data order hari ini dan kemarin berhasil diambil", {
      today: todayStr,
      yesterday: yesterdayStr,
      orders: rows
    });
  } catch (err) {
    return error(res, 500, "Gagal mengambil data order hari ini dan kemarin", err);
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
        p.nama_proyek,
        DATE_FORMAT(o.tanggal_order, '%Y-%m-%d') as tanggal_order
      FROM orders o
      LEFT JOIN master_kendaraan k ON o.kendaraan_id = k.id
      LEFT JOIN master_supir s ON o.supir_id = s.id
      LEFT JOIN master_galian g ON o.galian_id = g.id
      LEFT JOIN master_proyek p ON o.proyek_id = p.id
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
        p.nama_proyek,
        DATE_FORMAT(o.tanggal_order, '%Y-%m-%d') as tanggal_order
      FROM orders o
      LEFT JOIN master_kendaraan k ON o.kendaraan_id = k.id
      LEFT JOIN master_supir s ON o.supir_id = s.id
      LEFT JOIN master_galian g ON o.galian_id = g.id
      LEFT JOIN master_proyek p ON o.proyek_id = p.id
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
      proyek_id
    } = req.body;

    const tanggalFixed = fixTanggalForMySQL(tanggal_order);

    const kmMissing = km_awal === undefined || km_awal === null || (typeof km_awal === 'string' && km_awal.trim() === '');
    if (!tanggal_order || !no_order || !petugas_order || !kendaraan_id ||
        !supir_id || !galian_id || !no_do || !jam_order || kmMissing || uang_jalan === undefined || uang_jalan === null) {
      return error(res, 400, "Semua field wajib diisi");
    }

    const kmToStore = normalizeKmForStorage(km_awal);
    const hasil_akhir = uang_jalan - potongan;

    // Snapshot harga proyek saat order dibuat agar tidak berubah jika master diupdate
    let proyek_harga = null;
    const proyekIdToStore = proyek_id ? parseInt(proyek_id) : null;
    if (proyekIdToStore) {
      const [proyekRows] = await db.query(`SELECT harga FROM master_proyek WHERE id = ? LIMIT 1`, [proyekIdToStore]);
      if (proyekRows.length > 0) proyek_harga = proyekRows[0].harga;
    }

    const [result] = await db.query(`
      INSERT INTO orders (
        tanggal_order, no_order, petugas_order,
        kendaraan_id, supir_id, galian_id,
        no_do, jam_order, km_awal,
        uang_jalan, potongan, hasil_akhir,
        proyek_id, proyek_harga, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ON PROCESS')
    `, [
      tanggalFixed, no_order, petugas_order,
      kendaraan_id, supir_id, galian_id,
      no_do, jam_order, kmToStore,
      uang_jalan, potongan, hasil_akhir,
      proyekIdToStore, proyek_harga
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
      "uang_jalan", "potongan"
    ];

    allowedFields.forEach(f => {
      if (req.body[f] !== undefined) {
        let value;
        if (f === "tanggal_order") {
          value = fixTanggalForMySQL(req.body[f]);
        } else if (f === "km_awal") {
          value = normalizeKmForStorage(req.body[f]);
        } else {
          value = req.body[f];
        }
        fields.push(`${f} = ?`);
        values.push(value);
      }
    });

    // Jika proyek_id diubah, update proyek_id dan snapshot proyek_harga baru
    if (req.body.proyek_id !== undefined) {
      const newProyekId = req.body.proyek_id ? parseInt(req.body.proyek_id) : null;
      fields.push(`proyek_id = ?`);
      values.push(newProyekId);

      let newProyekHarga = null;
      if (newProyekId) {
        const [proyekRows] = await db.query(`SELECT harga FROM master_proyek WHERE id = ? LIMIT 1`, [newProyekId]);
        if (proyekRows.length > 0) newProyekHarga = proyekRows[0].harga;
      }
      fields.push(`proyek_harga = ?`);
      values.push(newProyekHarga);
    }

    // Jika ada perubahan uang_jalan atau potongan → update hasil_akhir
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