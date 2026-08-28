// ============================================================================
// BUANGAN MODULE (RITASI) - UPDATED VERSION
// ============================================================================

import express from "express";
import db from "../config/db.js";
import { success, error } from "../utils/response.js";
import { isExactOdoVariant, parseKmFromDb } from "../utils/normalize.js";
import { runStartupMigration } from "../utils/runStartupMigration.js";

const router = express.Router();

// Startup migration: make all mobil_luar non-id columns nullable.
// Dipanggil dari server.js setelah koneksi DB terkonfirmasi hidup (lihat
// runStartupMigration untuk retry terhadap timeout koneksi sementara).
export async function migrateMobilLuarNullable() {
  await runStartupMigration("nullable mobil_luar", async () => {
    const [cols] = await db.query(`
      SELECT COLUMN_NAME, COLUMN_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'mobil_luar'
        AND COLUMN_NAME != 'id'
        AND IS_NULLABLE = 'NO'
    `);
    for (const col of cols) {
      try {
        await db.query(
          `ALTER TABLE mobil_luar MODIFY COLUMN \`${col.COLUMN_NAME}\` ${col.COLUMN_TYPE} NULL`
        );
      } catch (e) {
        console.warn(`Gagal ALTER mobil_luar.${col.COLUMN_NAME}:`, e.message);
      }
    }
  });
}

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
// MOBIL LUAR - GET ALL
// ============================================================================
router.get("/mobil-luar", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT * FROM mobil_luar ORDER BY id DESC
    `);
    return success(res, "Data mobil luar", rows);
  } catch (err) {
    console.error("Error GET /buangan/mobil-luar:", err);
    return error(res, 500, "Gagal mengambil data mobil luar", err);
  }
});

// ============================================================================
// MOBIL LUAR - SUGGESTIONS (distinct values untuk datalist autocomplete)
// ============================================================================
router.get("/mobil-luar/suggestions", async (req, res) => {
  try {
    const fields = ["pengirim", "galian", "no_plat", "supir", "proyek", "lokasi_buang"];
    const result = {};

    await Promise.all(
      fields.map(async (field) => {
        const [rows] = await db.query(
          `SELECT DISTINCT \`${field}\` FROM mobil_luar
           WHERE \`${field}\` IS NOT NULL AND \`${field}\` != ''
           ORDER BY \`${field}\` ASC`
        );
        result[field] = rows.map((r) => r[field]);
      })
    );

    return success(res, "Suggestions mobil luar", result);
  } catch (err) {
    console.error("Error GET /buangan/mobil-luar/suggestions:", err);
    return error(res, 500, "Gagal mengambil suggestions", err);
  }
});

// ============================================================================
// MOBIL LUAR - GET BY ID
// ============================================================================
router.get("/mobil-luar/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query(`SELECT * FROM mobil_luar WHERE id = ? LIMIT 1`, [id]);
    if (rows.length === 0) return error(res, 404, `Mobil luar ID ${id} tidak ditemukan`);
    return success(res, "Detail mobil luar", rows[0]);
  } catch (err) {
    console.error(`Error GET /buangan/mobil-luar/${id}:`, err);
    return error(res, 500, "Gagal mengambil detail mobil luar", err);
  }
});

// ============================================================================
// MOBIL LUAR - CREATE
// ============================================================================
router.post("/mobil-luar", async (req, res) => {
  try {
    const { no_urut, pengirim, galian, no_plat, supir, tanggal_bongkar, jam_bongkar, proyek, lokasi_buang } = req.body;

    const noUrutVal       = no_urut ? parseInt(no_urut) : null;
    const pengirimVal     = (pengirim && pengirim.trim() !== '') ? pengirim.trim() : null;
    const galianVal       = (galian && galian.trim() !== '') ? galian.trim() : null;
    const noPlatVal       = (no_plat && no_plat.trim() !== '') ? no_plat.trim() : null;
    const supirVal        = (supir && supir.trim() !== '') ? supir.trim() : null;
    const tanggalVal      = tanggal_bongkar || null;
    const jamVal          = jam_bongkar || null;
    const proyekVal       = (proyek && proyek.trim() !== '') ? proyek.trim() : null;
    const lokasiBuangVal  = (lokasi_buang && lokasi_buang.trim() !== '') ? lokasi_buang.trim() : null;

    const [result] = await db.query(
      `INSERT INTO mobil_luar (no_urut, pengirim, galian, no_plat, supir, tanggal_bongkar, jam_bongkar, proyek, lokasi_buang)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [noUrutVal, pengirimVal, galianVal, noPlatVal, supirVal, tanggalVal, jamVal, proyekVal, lokasiBuangVal]
    );

    return success(res, "Mobil luar berhasil ditambahkan", { id: result.insertId });
  } catch (err) {
    console.error("Error POST /buangan/mobil-luar:", err);
    return error(res, 500, "Gagal menambahkan mobil luar", err);
  }
});

// ============================================================================
// MOBIL LUAR - UPDATE
// ============================================================================
router.put("/mobil-luar/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const allowed = ["no_urut", "pengirim", "galian", "no_plat", "supir", "tanggal_bongkar", "jam_bongkar", "proyek", "lokasi_buang"];
    const fields = [];
    const values = [];

    allowed.forEach(f => {
      if (req.body[f] !== undefined) {
        fields.push(`${f} = ?`);
        values.push(req.body[f]);
      }
    });

    if (fields.length === 0) return error(res, 400, "Tidak ada field yang dikirim");

    values.push(id);
    const [result] = await db.query(`UPDATE mobil_luar SET ${fields.join(", ")} WHERE id = ?`, values);

    if (result.affectedRows === 0) return error(res, 404, `Mobil luar ID ${id} tidak ditemukan`);
    return success(res, "Mobil luar berhasil diupdate");
  } catch (err) {
    console.error(`Error PUT /buangan/mobil-luar/${id}:`, err);
    return error(res, 500, "Gagal update mobil luar", err);
  }
});

// ============================================================================
// MOBIL LUAR - DELETE
// ============================================================================
router.delete("/mobil-luar/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.query(`DELETE FROM mobil_luar WHERE id = ?`, [id]);
    if (result.affectedRows === 0) return error(res, 404, `Mobil luar ID ${id} tidak ditemukan`);
    return success(res, "Mobil luar berhasil dihapus");
  } catch (err) {
    console.error(`Error DELETE /buangan/mobil-luar/${id}:`, err);
    return error(res, 500, "Gagal menghapus mobil luar", err);
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
        o.proyek_input,
        p.nama_proyek
      FROM buangan b
      LEFT JOIN orders o ON b.order_id = o.id
      LEFT JOIN master_kendaraan k ON o.kendaraan_id = k.id
      LEFT JOIN master_supir s ON o.supir_id = s.id
      LEFT JOIN master_galian g ON o.galian_id = g.id
      LEFT JOIN master_galian ga ON b.galian_alihan_id = ga.id
      LEFT JOIN master_proyek p ON o.proyek_id = p.id
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

    // If km_akhir is provided as a string, allow arbitrary text; only exact 'ODO ERROR' is treated specially
    if (typeof km_akhir === 'string') {
      if (isExactOdoVariant(km_akhir)) {
        final_km_akhir = 'ODO ERROR';
        final_jarak_km = 'ODO ERROR';
      } else {
        // Try to parse numeric value from string (handles '12.345' or formatted strings)
        const km_akhir_number = parseFloat(km_akhir.toString().replace(/[^0-9.\-]/g, ''));
        if (!isNaN(km_akhir_number)) {
          final_km_akhir = km_akhir_number;

          // jarak_km from frontend can be 'ODO ERROR' or number
          if (typeof jarak_km === 'string' && isExactOdoVariant(jarak_km)) {
            final_jarak_km = 'ODO ERROR';
          } else {
            const km_awal = parseKmFromDb(order[0].km_awal);
            const jarak_km_calculated = km_akhir_number - km_awal;

            const jarak_from_body = (jarak_km !== undefined && jarak_km !== null && jarak_km !== '')
              ? (isNaN(parseFloat(jarak_km)) ? null : parseFloat(jarak_km))
              : null;

            if (jarak_from_body !== null) {
              final_jarak_km = jarak_from_body;
            } else {
              final_jarak_km = jarak_km_calculated;
            }
          }

          // Allow negative distances (km_awal > km_akhir). Save as-is but warn.
          if (final_jarak_km < 0) {
            console.warn(`⚠️ Jarak KM negatif (${final_jarak_km}).`);
          }
        } else {
          // Non-numeric arbitrary text (not an ODO typo) -> save raw text and leave jarak_km null
          final_km_akhir = km_akhir;
          final_jarak_km = null;
        }
      }
    } else {
      // km_akhir provided as a number
      const km_akhir_number = parseFloat(km_akhir);
      final_km_akhir = km_akhir_number;

      if (typeof jarak_km === 'string' && isExactOdoVariant(jarak_km)) {
        final_jarak_km = 'ODO ERROR';
      } else {
        const km_awal = parseKmFromDb(order[0].km_awal);
        final_jarak_km = (jarak_km !== undefined && jarak_km !== null && jarak_km !== '' && !isNaN(parseFloat(jarak_km)))
          ? parseFloat(jarak_km)
          : (km_akhir_number - km_awal);
      }

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

    return success(res, "Buangan berhasil ditambahkan", {
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

      if (typeof km_akhir === 'string') {
        if (isExactOdoVariant(km_akhir)) {
          fields.push(`km_akhir = ?`);
          values.push('ODO ERROR');
          fields.push(`jarak_km = ?`);
          values.push(null);
        } else {
          // try to extract numeric from string
          const km_akhir_number = parseFloat(km_akhir.toString().replace(/[^0-9.\-]/g, ''));

          if (!isNaN(km_akhir_number)) {
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

            const km_awal_parsed = parseKmFromDb(order.km_awal);
            const jarak_km = !isNaN(km_awal_parsed) ? km_akhir_number - km_awal_parsed : null;

            fields.push(`km_akhir = ?`);
            values.push(km_akhir_number);
            fields.push(`jarak_km = ?`);
            values.push(jarak_km);
          } else {
            // arbitrary text -> save as-is, clear jarak_km
            fields.push(`km_akhir = ?`);
            values.push(km_akhir);
            fields.push(`jarak_km = ?`);
            values.push(null);
          }
        }
      } else {
        // numeric value
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
        const km_awal_parsed = parseKmFromDb(order.km_awal);
        const jarak_km = !isNaN(km_awal_parsed) ? km_akhir_number - km_awal_parsed : null;

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

    // If the related order was previously canceled (BATAL), set it to COMPLETE
    try {
      const [buanganRows] = await db.query(
        `SELECT order_id FROM buangan WHERE id = ? LIMIT 1`,
        [id]
      );

      if (buanganRows.length > 0) {
        const orderId = buanganRows[0].order_id;
        const [orderRows] = await db.query(
          `SELECT status FROM orders WHERE id = ? LIMIT 1`,
          [orderId]
        );

        if (orderRows.length > 0 && orderRows[0].status === 'BATAL') {
          await db.query(
            `UPDATE orders SET status = 'COMPLETE' WHERE id = ?`,
            [orderId]
          );
          console.log(`✅ Order ID ${orderId} status updated from BATAL to COMPLETE`);
        }
      }
    } catch (err) {
      console.warn("Warning while checking/updating order status after buangan edit:", err);
      // don't fail the buangan update if order status change fails
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

    return success(res, "Buangan berhasil dihapus");
  } catch (err) {
    console.error("Error DELETE /buangan:", err);
    return error(res, 500, "Gagal menghapus buangan", err);
  }
});

// ============================================================================
// DELETE RITASI (hapus buangan + order)
// ============================================================================
router.delete("/:id/ritasi", async (req, res) => {
  const { id } = req.params;
  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    // Get the buangan record to find associated order_id
    const [buanganRows] = await conn.query(
      `SELECT order_id FROM buangan WHERE id = ? LIMIT 1`,
      [id]
    );

    if (buanganRows.length === 0) {
      await conn.rollback();
      return error(res, 404, `Buangan ID ${id} tidak ditemukan`);
    }

    const orderId = buanganRows[0].order_id;

    // Check if there are other buangan records for the same order
    const [countRows] = await conn.query(
      `SELECT COUNT(*) as cnt FROM buangan WHERE order_id = ?`,
      [orderId]
    );

    if (countRows[0].cnt > 1) {
      await conn.rollback();
      return error(res, 400, "Terdapat ritasi lain untuk order ini. Hapus ritasi lainnya terlebih dahulu.");
    }

    // Delete the buangan
    const [delBuangan] = await conn.query(
      `DELETE FROM buangan WHERE id = ?`,
      [id]
    );

    if (delBuangan.affectedRows === 0) {
      await conn.rollback();
      return error(res, 404, `Buangan ID ${id} tidak ditemukan`);
    }

    // Delete the order
    const [delOrder] = await conn.query(
      `DELETE FROM orders WHERE id = ?`,
      [orderId]
    );

    if (delOrder.affectedRows === 0) {
      await conn.rollback();
      return error(res, 404, `Order ID ${orderId} tidak ditemukan`);
    }

    await conn.commit();

    return success(res, "Ritasi dan order berhasil dihapus");
  } catch (err) {
    if (conn) await conn.rollback().catch(()=>{});
    console.error("Error DELETE /buangan/:id/ritasi:", err);
    return error(res, 500, "Gagal menghapus ritasi", err);
  } finally {
    if (conn) conn.release();
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