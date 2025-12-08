// ============================================================================
// BUANGAN MODULE (RITASI) - UPDATED VERSION
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
        b.id,
        b.order_id,
        b.tanggal_bongkar,
        b.jam_bongkar,
        b.km_akhir,
        b.jarak_km,
        b.lokasi_bongkar,
        b.alihan,
        b.galian_alihan_id,
        b.keterangan,
        b.uang_alihan,
        b.no_urut,
        o.no_order,
        o.tanggal_order,
        o.status,
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
    console.error("Error GET /buangan:", err);
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
        b.id,
        b.order_id,
        b.tanggal_bongkar,
        b.jam_bongkar,
        b.km_akhir,
        b.jarak_km,
        b.lokasi_bongkar,
        b.alihan,
        b.galian_alihan_id,
        b.keterangan,
        b.uang_alihan,
        b.no_urut,
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
    console.error(`Error GET /buangan/${id}:`, err);
    return error(res, 500, "Gagal mengambil detail buangan", err);
  }
});

// ============================================================================
// CREATE BUANGAN (RITASI)
// ============================================================================
router.post("/", async (req, res) => {
  try {
    console.log("📥 Request body:", JSON.stringify(req.body, null, 2));

    const {
      order_id,
      tanggal_bongkar,
      jam_bongkar,
      km_akhir,
      jarak_km,
      lokasi_bongkar,
      alihan = false,
      galian_alihan_id = null,
      keterangan = null,
      uang_alihan = null,
      no_urut
    } = req.body;

    // ============================================================
    // VALIDASI FIELD WAJIB
    // ============================================================
    if (!order_id) {
      return error(res, 400, "Order ID wajib diisi");
    }

    if (!tanggal_bongkar) {
      return error(res, 400, "Tanggal bongkar wajib diisi");
    }

    if (!jam_bongkar) {
      return error(res, 400, "Jam bongkar wajib diisi");
    }

    if (km_akhir === null || km_akhir === undefined || km_akhir === '') {
      return error(res, 400, "KM Akhir wajib diisi");
    }

    if (!no_urut && no_urut !== 0) {
      return error(res, 400, "No Urut wajib diisi");
    }

    // Validasi lokasi_bongkar wajib diisi
    if (!lokasi_bongkar || lokasi_bongkar.trim() === '') {
      return error(res, 400, "Lokasi bongkar wajib diisi");
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

    // ============================================================
    // HANDLE KM_AKHIR DAN JARAK_KM
    // ============================================================
    let final_km_akhir = km_akhir;
    let final_jarak_km = jarak_km;

    // Cek apakah km_akhir adalah "ODO ERROR"
    if (typeof km_akhir === 'string' && 
        (km_akhir.toUpperCase() === 'ODO ERROR' || 
         km_akhir.toUpperCase() === 'ODOERROR' ||
         km_akhir.toUpperCase() === 'ODO ERR' ||
         km_akhir.toUpperCase() === 'ODOERR')) {
      
      console.log("⚠️ KM Akhir = ODO ERROR");
      final_km_akhir = 'ODO ERROR';
      final_jarak_km = null;
    } else {
      // Validasi km_akhir adalah angka
      const km_akhir_number = parseFloat(km_akhir);
      
      if (isNaN(km_akhir_number)) {
        return error(res, 400, "KM Akhir harus berupa angka atau 'ODO ERROR'");
      }

      final_km_akhir = km_akhir_number;

      const km_awal = parseFloat(order[0].km_awal);
      const jarak_km_calculated = km_akhir_number - km_awal;

      // Respect jarak_km sent by frontend even if zero;
      // otherwise fall back to calculated value
      const jarak_from_body = (jarak_km !== undefined && jarak_km !== null && jarak_km !== '')
        ? parseFloat(jarak_km)
        : null;

      if (jarak_from_body !== null && !isNaN(jarak_from_body)) {
        final_jarak_km = jarak_from_body;
      } else {
        final_jarak_km = jarak_km_calculated;
      }

      // Allow negative distances (km_awal > km_akhir). Save as-is.
      if (final_jarak_km < 0) {
        console.warn(`⚠️ Jarak KM negatif (${final_jarak_km}).`);
      }
    }

    // ============================================================
    // CEK DUPLICATE NO_URUT (OPSIONAL - BISA DIHAPUS JIKA TIDAK PERLU)
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
    console.log("💾 Inserting buangan...");
    console.log("Data to insert:", {
      order_id,
      tanggal_bongkar,
      jam_bongkar,
      final_km_akhir,
      final_jarak_km,
      lokasi_bongkar,
      alihan,
      galian_alihan_id,
      keterangan,
      uang_alihan,
      no_urut
    });

    const [result] = await db.query(
      `
      INSERT INTO buangan (
        order_id, tanggal_bongkar, jam_bongkar,
        km_akhir, jarak_km, lokasi_bongkar, alihan, galian_alihan_id,
        keterangan, uang_alihan, no_urut
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        order_id,
        tanggal_bongkar,
        jam_bongkar,
        final_km_akhir,
        final_jarak_km,
        lokasi_bongkar,
        alihan,
        galian_alihan_id,
        keterangan,
        uang_alihan,
        no_urut
      ]
    );

    console.log("✅ Buangan inserted, ID:", result.insertId);

    // ============================================================
    // UBAH STATUS ORDER -> COMPLETE
    // ============================================================
    await db.query(
      `UPDATE orders SET status = 'COMPLETE' WHERE id = ?`,
      [order_id]
    );

    console.log("✅ Order status updated to COMPLETE");

    return success(res, "Ritasi berhasil ditambahkan", {
      id: result.insertId,
      order_id,
      km_akhir: final_km_akhir,
      jarak_km: final_jarak_km,
      no_urut
    });

  } catch (err) {
    console.error("❌ Error POST /buangan:", err);
    return error(res, 500, "Gagal membuat buangan: " + err.message, err);
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
      "lokasi_bongkar",
      "alihan",
      "galian_alihan_id",
      "keterangan",
      "uang_alihan",
      "no_urut"
    ];

    // Handle km_akhir dan jarak_km
    if (req.body.km_akhir !== undefined) {
      const km_akhir = req.body.km_akhir;
      
      // Cek apakah ODO ERROR
      if (typeof km_akhir === 'string' && 
          (km_akhir.toUpperCase() === 'ODO ERROR' || 
           km_akhir.toUpperCase() === 'ODOERROR' ||
           km_akhir.toUpperCase() === 'ODO ERR' ||
           km_akhir.toUpperCase() === 'ODOERR')) {
        fields.push(`km_akhir = ?`);
        values.push('ODO ERROR');
        fields.push(`jarak_km = ?`);
        values.push(null);
      } else {
        // Hitung jarak_km jika km_akhir adalah angka
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

        const km_akhir_number = parseFloat(km_akhir);
        if (isNaN(km_akhir_number)) {
          return error(res, 400, "KM Akhir harus berupa angka atau 'ODO ERROR'");
        }

        const jarak_km = km_akhir_number - order.km_awal;
        
        fields.push(`km_akhir = ?`);
        values.push(km_akhir_number);
        fields.push(`jarak_km = ?`);
        values.push(jarak_km);
      }
    }

    allowedFields.forEach(f => {
      if (req.body[f] !== undefined && f !== 'km_akhir') {
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
    console.error("Error PUT /buangan:", err);
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
    console.error("Error DELETE /buangan:", err);
    return error(res, 500, "Gagal menghapus ritasi", err);
  }
});

// ============================================================================
// BATAL ORDER
// ============================================================================
router.post("/:id/batal", async (req, res) => {
  const { id } = req.params;
  const { keterangan } = req.body;

  try {
    if (!keterangan || keterangan.trim() === '') {
      return error(res, 400, "Keterangan pembatalan wajib diisi");
    }

    // cek apakah id merujuk ke buangan.id
    const [buanganRows] = await db.query(
      `SELECT order_id FROM buangan WHERE id = ? LIMIT 1`,
      [id]
    );

    let orderId;

    if (buanganRows.length > 0) {
      // id adalah buangan_id -> ambil order_id dan update keterangan di record buangan itu
      orderId = buanganRows[0].order_id;

      await db.query(
        `UPDATE buangan SET keterangan = ? WHERE id = ?`,
        [keterangan, id]
      );
    } else {
      // id kemungkinan adalah order_id
      orderId = parseInt(id, 10);

      // validasi order exists
      const [orderRows] = await db.query(
        `SELECT id FROM orders WHERE id = ? LIMIT 1`,
        [orderId]
      );

      if (orderRows.length === 0) {
        return error(res, 404, `Order ID ${orderId} tidak ditemukan`);
      }

      // cek apakah sudah ada buangan untuk order ini
      const [existingBuangan] = await db.query(
        `SELECT id FROM buangan WHERE order_id = ? LIMIT 1`,
        [orderId]
      );

      if (existingBuangan.length > 0) {
        // jika ada, update keterangan pada baris buangan yang ada
        await db.query(
          `UPDATE buangan SET keterangan = ? WHERE order_id = ?`,
          [keterangan, orderId]
        );
      } else {
        // tidak ada buangan -> insert baris buangan minimal
        await db.query(
          `INSERT INTO buangan (
             order_id,
             tanggal_bongkar,
             jam_bongkar,
             km_akhir,
             jarak_km,
             lokasi_bongkar,
             alihan,
             galian_alihan_id,
             keterangan,
             uang_alihan,
             no_urut
           ) VALUES (
             ?, NULL, NULL, NULL, NULL, NULL, 0, NULL, ?, NULL, NULL
           )`,
          [orderId, keterangan]
        );
      }
    }

    // Update order status menjadi BATAL
    const [result] = await db.query(
      `UPDATE orders SET status = 'BATAL' WHERE id = ?`,
      [orderId]
    );

    if (result.affectedRows === 0) {
      return error(res, 500, "Gagal membatalkan order");
    }

    return success(res, "Order berhasil dibatalkan", {
      order_id: orderId,
      keterangan: keterangan
    });
  } catch (err) {
    console.error("Error POST /buangan/batal:", err);
    return error(res, 500, "Gagal membatalkan order", err);
  }
});

export default router;