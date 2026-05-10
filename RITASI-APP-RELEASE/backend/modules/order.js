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

// --- normalize km_awal for storage: if fuzzy-match to odo error → 'ODO ERROR', else keep original ---
function normalizeKmForStorage(kmValue) {
  if (kmValue === undefined || kmValue === null) return kmValue;
  const s = String(kmValue).trim();
  if (!s) return s;

  // normalize: lowercase, remove non-alphanum, replace confusions
  const norm = s.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/0/g, 'o').replace(/1/g, 'l');
  const target = 'odoerror';

  // simple Levenshtein implementation
  function lev(a, b) {
    if (a === b) return 0;
    const al = a.length, bl = b.length;
    if (al === 0) return bl;
    if (bl === 0) return al;
    let v0 = new Array(bl + 1), v1 = new Array(bl + 1);
    for (let j = 0; j <= bl; j++) v0[j] = j;
    for (let i = 0; i < al; i++) {
      v1[0] = i + 1;
      for (let j = 0; j < bl; j++) {
        const cost = a[i] === b[j] ? 0 : 1;
        v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
      }
      const tmp = v0; v0 = v1; v1 = tmp;
    }
    return v0[bl];
  }

  if (norm === target) return 'ODO ERROR';
  const dist = lev(norm, target);
  if (dist <= 1) return 'ODO ERROR';
  return kmValue;
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

    // Validasi: terima km_awal baik angka maupun teks (harus ada)
    const kmMissing = km_awal === undefined || km_awal === null || (typeof km_awal === 'string' && km_awal.trim() === '');
    if (!tanggal_order || !no_order || !petugas_order || !kendaraan_id ||
        !supir_id || !galian_id || !no_do || !jam_order || kmMissing || uang_jalan === undefined || uang_jalan === null) {
      return error(res, 400, "Semua field wajib diisi");
    }

    // Normalisasi km sebelum disimpan (jika fuzzy-match ke odo error -> 'ODO ERROR')
    const kmToStore = normalizeKmForStorage(km_awal);

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
      kmToStore,
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