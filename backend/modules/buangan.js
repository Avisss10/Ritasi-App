// ============================================================================
// BUANGAN MODULE (RITASI)
// ============================================================================

import express from "express";
import db from "../config/db.js";
import { success, error } from "../utils/response.js";

const router = express.Router();

// ============================================================================
// GET ALL BUANGAN
// ============================================================================
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        b.*,
        o.no_order,
        o.tanggal_order,
        k.no_pintu,
        s.nama AS supir,
        g.nama_galian,
        ga.nama_galian AS galian_alihan
      FROM buangan b
      LEFT JOIN orders o ON b.order_id = o.id
      LEFT JOIN master_kendaraan k ON o.kendaraan_id = k.id
      LEFT JOIN master_supir s ON o.supir_id = s.id
      LEFT JOIN master_galian g ON o.galian_id = g.id
      LEFT JOIN master_galian ga ON b.galian_alihan_id = ga.id
      ORDER BY b.id DESC
    `);

    return success(res, "Data semua buangan", rows);
  } catch (err) {
    return error(res, 500, "Gagal mengambil data buangan", err);
  }
});

// ============================================================================
// GET BUANGAN BY ID 
// ============================================================================
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await db.query(
      `
      SELECT 
        b.*,
        o.no_order,
        o.tanggal_order,
        o.jam_order,
        o.no_do,
        k.no_pintu,
        s.nama AS supir,
        g.nama_galian,
        ga.nama_galian AS galian_alihan,
        o.uang_jalan,
        o.potongan,
        o.hasil_akhir,
        o.status,
        o.km_awal,
        o.proyek_input
      FROM buangan b
      LEFT JOIN orders o ON b.order_id = o.id
      LEFT JOIN master_kendaraan k ON o.kendaraan_id = k.id
      LEFT JOIN master_supir s ON o.supir_id = s.id
      LEFT JOIN master_galian g ON o.galian_id = g.id
      LEFT JOIN master_galian ga ON b.galian_alihan_id = ga.id
      WHERE b.id = ?
      LIMIT 1
      `,
      [id]
    );

    if (rows.length === 0) {
      return error(res, 404, `Buangan ID ${id} tidak ditemukan`);
    }

    return success(res, "Detail buangan", rows[0]);

  } catch (err) {
    return error(res, 500, "Gagal mengambil detail buangan", err);
  }
});

// ============================================================================
// CREATE BUANGAN (RITASI)
// ============================================================================
router.post("/", async (req, res) => {
  try {
    const {
      order_id,
      tanggal_bongkar,
      jam_bongkar,
      km_akhir,
      jarak_km,
      alihan = false,
      galian_alihan_id = null,
      keterangan = null,
      uang_alihan = null,
      no_urut
    } = req.body;

    if (!order_id || !tanggal_bongkar || !jam_bongkar || km_akhir == null || !no_urut) {
      return error(res, 400, "Field wajib tidak lengkap");
    }

    // ============================================================
    // CEK ORDER VALID
    // ============================================================
    const [order] = await db.query(
      `SELECT km_awal FROM orders WHERE id = ? LIMIT 1`,
      [order_id]
    );

    if (order.length === 0) {
      return error(res, 404, `Order ID ${order_id} tidak ditemukan`);
    }

    // ✅ GUNAKAN jarak_km dari frontend (sudah dihitung real-time)
    // Tapi tetap validasi di backend untuk keamanan
    const km_awal = order[0].km_awal;
    const jarak_km_calculated = km_akhir - km_awal;

    // Gunakan yang dari frontend, tapi validasi dulu
    const final_jarak_km = jarak_km || jarak_km_calculated;

    if (final_jarak_km <= 0) {
      return error(res, 400, "Jarak KM harus lebih dari 0");
    }

    // ============================================================
    // CEK DUPLICATE NO_URUT
    // ============================================================
    const [cekUrut] = await db.query(
      `SELECT id FROM buangan WHERE order_id = ? AND no_urut = ? LIMIT 1`,
      [order_id, no_urut]
    );

    if (cekUrut.length > 0) {
      return error(res, 400, `No Urut ${no_urut} sudah dipakai untuk order ini`);
    }

    // ============================================================
    // INSERT BUANGAN
    // ============================================================
    const [result] = await db.query(
      `
      INSERT INTO buangan (
        order_id, tanggal_bongkar, jam_bongkar,
        km_akhir, jarak_km, alihan, galian_alihan_id,
        keterangan, uang_alihan, no_urut
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        order_id,
        tanggal_bongkar,
        jam_bongkar,
        km_akhir,
        final_jarak_km,
        alihan,
        galian_alihan_id,
        keterangan,
        uang_alihan,
        no_urut
      ]
    );

    // ============================================================
    // UBAH STATUS ORDER -> COMPLETE
    // ============================================================
    await db.query(
      `UPDATE orders SET status = 'COMPLETE' WHERE id = ?`,
      [order_id]
    );

    return success(res, "Ritasi berhasil ditambahkan", {
      id: result.insertId,
      order_id,
      jarak_km: final_jarak_km
    });

  } catch (err) {
    return error(res, 500, "Gagal membuat buangan", err);
  }
});

// ============================================================================
// UPDATE BUANGAN
// ============================================================================
router.put("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const fields = [];
    const values = [];

    const allowedFields = [
      "tanggal_bongkar",
      "jam_bongkar",
      "km_akhir",
      "alihan",
      "galian_alihan_id",
      "keterangan",
      "uang_alihan",
      "no_urut"
    ];

    // Tambahkan jarak_km ketika km_akhir berubah
    if (req.body.km_akhir !== undefined) {
      const [[order]] = await db.query(
        `SELECT o.km_awal 
         FROM buangan b 
         JOIN orders o ON b.order_id = o.id 
         WHERE b.id = ? LIMIT 1`,
        [id]
      );

      if (!order) {
        return error(res, 404, "Data tidak valid untuk hitung jarak");
      }

      const jarak_km = req.body.km_akhir - order.km_awal;
      fields.push(`jarak_km = ?`);
      values.push(jarak_km);
    }

    allowedFields.forEach(f => {
      if (req.body[f] !== undefined) {
        fields.push(`${f} = ?`);
        values.push(req.body[f]);
      }
    });

    if (fields.length === 0) {
      return error(res, 400, "Tidak ada field yang dikirim");
    }

    values.push(id);

    const [result] = await db.query(
      `UPDATE buangan SET ${fields.join(", ")} WHERE id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return error(res, 404, `Buangan ID ${id} tidak ditemukan`);
    }

    return success(res, "Buangan berhasil diupdate");

  } catch (err) {
    return error(res, 500, "Gagal update buangan", err);
  }
});

// ============================================================================
// DELETE BUANGAN
// ============================================================================
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // Get the buangan record to find associated order_id
    const [buanganRows] = await db.query(
      `SELECT order_id FROM buangan WHERE id = ? LIMIT 1`,
      [id]
    );

    if (buanganRows.length === 0) {
      return error(res, 404, `Buangan ID ${id} tidak ditemukan`);
    }

    const orderId = buanganRows[0].order_id;

    const [result] = await db.query(
      `DELETE FROM buangan WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return error(res, 404, `Buangan ID ${id} tidak ditemukan`);
    }

    // Update order status back to 'ON PROCESS'
    await db.query(
      `UPDATE orders SET status = 'ON PROCESS' WHERE id = ?`,
      [orderId]
    );

    return success(res, "Ritasi berhasil dihapus");
  } catch (err) {
    return error(res, 500, "Gagal menghapus ritasi", err);
  }
});

// ============================================================================

export default router;
