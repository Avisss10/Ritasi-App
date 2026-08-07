// ============================================================================
// REVIEW MODULE (BULK EDIT RITASI)
// Adaptasi logika order.js, buangan.js, dan rekap.js (buildFiltersGabungan)
// untuk mendukung koreksi data massal dari satu halaman grid.
// ============================================================================

import express from "express";
import db from "../config/db.js";
import { success, error } from "../utils/response.js";
import {
  fixTanggalForMySQL,
  normalizeKmForStorage,
  isExactOdoVariant,
  parseKmFromDb,
} from "../utils/normalize.js";

const router = express.Router();

// ============================================================================
// HELPER: Build IN clause for comma-separated IDs (disalin dari rekap.js)
// ============================================================================
function buildInClause(value, column) {
  const ids = value.split(',').map(id => id.trim()).filter(id => id && id !== 'null' && id !== 'undefined');
  if (ids.length === 0) return null;
  if (ids.length === 1) return { sql: `${column} = ?`, values: [ids[0]] };
  return { sql: `${column} IN (${ids.map(() => '?').join(',')})`, values: ids };
}

// ============================================================================
// HELPER: Build WHERE clause gabungan order+buangan (disalin/adaptasi dari
// rekap.js buildFiltersGabungan, TIDAK mengimpor rekap.js karena fungsi ini
// tidak diekspor dan rekap.js tidak boleh diubah)
// ============================================================================
function buildFiltersGabungan(req, allowedFields) {
  const conditions = [];
  const values = [];

  for (const key of allowedFields) {
    const value = req.query[key];
    if (value && value !== '' && value !== 'null' && value !== 'undefined') {
      if (key === 'proyek_id') {
        const clause = buildInClause(value, 'o.proyek_id');
        if (clause) { conditions.push(clause.sql); values.push(...clause.values); }
      } else if (key === 'galian_id') {
        const clause = buildInClause(value, 'o.galian_id');
        if (clause) { conditions.push(clause.sql); values.push(...clause.values); }
      } else if (key === 'no_do') {
        conditions.push(`o.no_do LIKE ?`);
        values.push(`%${value}%`);
      } else if (key === 'lokasi_bongkar') {
        conditions.push(`LOWER(b.${key}) LIKE LOWER(?)`);
        values.push(`${value}%`);
      } else if (key === 'galian_alihan_id') {
        conditions.push(`b.${key} = ?`);
        values.push(value);
      } else if (key === 'alihan') {
        conditions.push(`b.${key} = ?`);
        values.push(value);
      } else if (key === 'status') {
        conditions.push(`LOWER(REPLACE(o.status, ' ', '_')) = LOWER(REPLACE(?, ' ', '_'))`);
        values.push(value);
      } else if (key === 'kendaraan_id' || key === 'supir_id') {
        conditions.push(`o.${key} = ?`);
        values.push(value);
      } else if (key === 'petugas_order') {
        conditions.push(`o.petugas_order LIKE ?`);
        values.push(`%${value}%`);
      } else {
        conditions.push(`o.${key} = ?`);
        values.push(value);
      }
    }
  }

  if (req.query.tanggal_order_dari && req.query.tanggal_order_sampai) {
    conditions.push(`o.tanggal_order BETWEEN ? AND ?`);
    values.push(req.query.tanggal_order_dari, req.query.tanggal_order_sampai);
  } else if (req.query.tanggal_order_dari) {
    conditions.push(`o.tanggal_order >= ?`);
    values.push(req.query.tanggal_order_dari);
  } else if (req.query.tanggal_order_sampai) {
    conditions.push(`o.tanggal_order <= ?`);
    values.push(req.query.tanggal_order_sampai);
  }

  if (req.query.tanggal_bongkar_dari && req.query.tanggal_bongkar_sampai) {
    conditions.push(`b.tanggal_bongkar BETWEEN ? AND ?`);
    values.push(req.query.tanggal_bongkar_dari, req.query.tanggal_bongkar_sampai);
  } else if (req.query.tanggal_bongkar_dari) {
    conditions.push(`b.tanggal_bongkar >= ?`);
    values.push(req.query.tanggal_bongkar_dari);
  } else if (req.query.tanggal_bongkar_sampai) {
    conditions.push(`b.tanggal_bongkar <= ?`);
    values.push(req.query.tanggal_bongkar_sampai);
  }

  return {
    where: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    values
  };
}

// ============================================================================
// GET /api/review/data
// ============================================================================
router.get("/data", async (req, res) => {
  try {
    const hasDateFilter =
      req.query.tanggal_order_dari || req.query.tanggal_order_sampai ||
      req.query.tanggal_bongkar_dari || req.query.tanggal_bongkar_sampai;

    if (!hasDateFilter) {
      return error(res, 400, "Filter tanggal wajib diisi (Tanggal Order atau Tanggal Bongkar)");
    }

    const parsedLimit = parseInt(req.query.limit);
    const limit = Math.min(2000, Math.max(1, Number.isNaN(parsedLimit) ? 1000 : parsedLimit));

    const { where, values } = buildFiltersGabungan(req, [
      "proyek_id", "galian_id", "galian_alihan_id", "kendaraan_id", "supir_id",
      "petugas_order", "no_do", "lokasi_bongkar", "alihan", "status"
    ]);

    const countSql = `
      SELECT COUNT(*) AS total
      FROM orders o
      LEFT JOIN buangan b ON o.id = b.order_id
      ${where}
    `;
    const [countRows] = await db.query(countSql, values);
    const total = countRows[0].total;

    const sql = `
      SELECT
        o.id AS order_id,
        b.id AS buangan_id,
        DATE_FORMAT(o.tanggal_order, '%Y-%m-%d') AS tanggal_order,
        o.no_order,
        o.petugas_order,
        o.kendaraan_id,
        k.no_pintu,
        o.supir_id,
        s.nama AS supir_nama,
        o.galian_id,
        g.nama_galian,
        o.no_do,
        o.jam_order,
        o.km_awal,
        o.uang_jalan,
        o.potongan,
        o.hasil_akhir,
        o.proyek_id,
        p.nama_proyek,
        o.status,
        DATE_FORMAT(b.tanggal_bongkar, '%Y-%m-%d') AS tanggal_bongkar,
        b.jam_bongkar,
        b.km_akhir,
        b.jarak_km,
        b.lokasi_bongkar,
        b.alihan,
        b.galian_alihan_id,
        ga.nama_galian AS galian_alihan_nama,
        b.keterangan,
        b.uang_alihan,
        b.no_urut
      FROM orders o
      LEFT JOIN buangan b ON o.id = b.order_id
      LEFT JOIN master_kendaraan k ON o.kendaraan_id = k.id
      LEFT JOIN master_supir s ON o.supir_id = s.id
      LEFT JOIN master_galian g ON o.galian_id = g.id
      LEFT JOIN master_proyek p ON o.proyek_id = p.id
      LEFT JOIN master_galian ga ON b.galian_alihan_id = ga.id
      ${where}
      ORDER BY o.tanggal_order DESC, o.id DESC, b.id DESC
      LIMIT ?
    `;

    const [rows] = await db.query(sql, [...values, limit]);

    return success(res, "Berhasil mengambil data review", {
      rows,
      total,
      limit,
      truncated: total > rows.length,
    });
  } catch (err) {
    console.error("Error GET /review/data:", err);
    return error(res, 500, "Gagal mengambil data review", err);
  }
});

// ============================================================================
// HELPER: Update satu order (adaptasi persis order.js PUT /:id) di dalam
// sebuah connection/transaction. Return { changedKmAwal, newKmAwal }.
// ============================================================================
async function updateOrderRow(conn, orderId, orderBody) {
  const fields = [];
  const values = [];

  const allowedFields = [
    "tanggal_order", "no_order", "petugas_order",
    "kendaraan_id", "supir_id", "galian_id",
    "no_do", "jam_order", "km_awal",
    "uang_jalan", "potongan", "status"
  ];

  let changedKmAwal = false;
  let newKmAwal;

  allowedFields.forEach(f => {
    if (orderBody[f] !== undefined) {
      let value;
      if (f === "tanggal_order") {
        value = fixTanggalForMySQL(orderBody[f]);
      } else if (f === "km_awal") {
        value = normalizeKmForStorage(orderBody[f]);
        changedKmAwal = true;
        newKmAwal = value;
      } else {
        value = orderBody[f];
      }
      fields.push(`${f} = ?`);
      values.push(value);
    }
  });

  if (orderBody.proyek_id !== undefined) {
    const newProyekId = orderBody.proyek_id ? parseInt(orderBody.proyek_id) : null;
    fields.push(`proyek_id = ?`);
    values.push(newProyekId);

    let newProyekHarga = null;
    if (newProyekId) {
      const [proyekRows] = await conn.query(`SELECT harga FROM master_proyek WHERE id = ? LIMIT 1`, [newProyekId]);
      if (proyekRows.length > 0) newProyekHarga = proyekRows[0].harga;
    }
    fields.push(`proyek_harga = ?`);
    values.push(newProyekHarga);
  }

  if (orderBody.uang_jalan !== undefined || orderBody.potongan !== undefined) {
    const uang_jalan = orderBody.uang_jalan ?? 0;
    const potongan = orderBody.potongan ?? 0;
    fields.push(`hasil_akhir = ?`);
    values.push(uang_jalan - potongan);
  }

  if (fields.length === 0) {
    return { changedKmAwal: false, newKmAwal: undefined };
  }

  values.push(orderId);

  const [result] = await conn.query(
    `UPDATE orders SET ${fields.join(", ")} WHERE id = ?`,
    values
  );

  if (result.affectedRows === 0) {
    throw new Error(`Order ID ${orderId} tidak ditemukan`);
  }

  return { changedKmAwal, newKmAwal };
}

// ============================================================================
// HELPER: Update satu buangan (adaptasi persis buangan.js PUT /:id) di dalam
// sebuah connection/transaction. overrideKmAwal dipakai kalau order di baris
// yang sama juga mengubah km_awal, supaya jarak_km dihitung dari nilai baru.
// ============================================================================
async function updateBuanganRow(conn, buanganId, buanganBody, overrideKmAwal) {
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

  const getKmAwal = async () => {
    if (overrideKmAwal !== undefined) return parseKmFromDb(overrideKmAwal);
    const [[order]] = await conn.query(
      `SELECT o.km_awal
       FROM buangan b
       JOIN orders o ON b.order_id = o.id
       WHERE b.id = ? LIMIT 1`,
      [buanganId]
    );
    if (!order) throw new Error("Data tidak valid untuk hitung jarak");
    return parseKmFromDb(order.km_awal);
  };

  if (buanganBody.km_akhir !== undefined) {
    const km_akhir = buanganBody.km_akhir;

    if (typeof km_akhir === 'string') {
      if (isExactOdoVariant(km_akhir)) {
        fields.push(`km_akhir = ?`);
        values.push('ODO ERROR');
        fields.push(`jarak_km = ?`);
        values.push(null);
      } else {
        const km_akhir_number = parseFloat(km_akhir.toString().replace(/[^0-9.\-]/g, ''));

        if (!isNaN(km_akhir_number)) {
          const km_awal_parsed = await getKmAwal();
          const jarak_km = !isNaN(km_awal_parsed) ? km_akhir_number - km_awal_parsed : null;

          fields.push(`km_akhir = ?`);
          values.push(km_akhir_number);
          fields.push(`jarak_km = ?`);
          values.push(jarak_km);
        } else {
          fields.push(`km_akhir = ?`);
          values.push(km_akhir);
          fields.push(`jarak_km = ?`);
          values.push(null);
        }
      }
    } else {
      const km_akhir_number = parseFloat(km_akhir);
      const km_awal_parsed = await getKmAwal();
      const jarak_km = !isNaN(km_awal_parsed) ? km_akhir_number - km_awal_parsed : null;

      fields.push(`km_akhir = ?`);
      values.push(km_akhir_number);
      fields.push(`jarak_km = ?`);
      values.push(jarak_km);
    }
  } else if (overrideKmAwal !== undefined) {
    // km_akhir tidak diubah di request ini, tapi km_awal order berubah ->
    // recalculate jarak_km dari km_akhir yang sudah tersimpan di DB (celah
    // yang diperbaiki di endpoint bulk ini, tidak ada di buangan.js PUT /:id)
    const [[current]] = await conn.query(
      `SELECT km_akhir FROM buangan WHERE id = ? LIMIT 1`,
      [buanganId]
    );
    if (current && current.km_akhir !== null && !isExactOdoVariant(current.km_akhir)) {
      const km_akhir_parsed = parseKmFromDb(current.km_akhir);
      const km_awal_parsed = parseKmFromDb(overrideKmAwal);
      if (!isNaN(km_akhir_parsed) && !isNaN(km_awal_parsed)) {
        fields.push(`jarak_km = ?`);
        values.push(km_akhir_parsed - km_awal_parsed);
      }
    }
  }

  allowedFields.forEach(f => {
    if (buanganBody[f] !== undefined && f !== 'km_akhir') {
      fields.push(`${f} = ?`);
      values.push(buanganBody[f]);
    }
  });

  if (fields.length === 0) {
    return;
  }

  values.push(buanganId);

  const [result] = await conn.query(
    `UPDATE buangan SET ${fields.join(", ")} WHERE id = ?`,
    values
  );

  if (result.affectedRows === 0) {
    throw new Error(`Buangan ID ${buanganId} tidak ditemukan`);
  }

  // Kalau order sebelumnya BATAL, kembalikan ke COMPLETE (replikasi buangan.js:588-612)
  const [buanganRows] = await conn.query(
    `SELECT order_id FROM buangan WHERE id = ? LIMIT 1`,
    [buanganId]
  );
  if (buanganRows.length > 0) {
    const orderId = buanganRows[0].order_id;
    const [orderRows] = await conn.query(
      `SELECT status FROM orders WHERE id = ? LIMIT 1`,
      [orderId]
    );
    if (orderRows.length > 0 && orderRows[0].status === 'BATAL') {
      await conn.query(`UPDATE orders SET status = 'COMPLETE' WHERE id = ?`, [orderId]);
    }
  }
}

// ============================================================================
// PUT /api/review/bulk-update
// ============================================================================
router.put("/bulk-update", async (req, res) => {
  const { rows } = req.body;

  if (!Array.isArray(rows) || rows.length === 0) {
    return error(res, 400, "Tidak ada baris yang dikirim");
  }

  let conn;
  let updated = 0;
  const failed = [];

  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    for (const row of rows) {
      const { order_id, buangan_id, order: orderBody, buangan: buanganBody } = row;

      try {
        let newKmAwal;

        if (orderBody && Object.keys(orderBody).length > 0) {
          if (!order_id) throw new Error("order_id wajib diisi");
          const result = await updateOrderRow(conn, order_id, orderBody);
          if (result.changedKmAwal) newKmAwal = result.newKmAwal;
        }

        if (buanganBody && Object.keys(buanganBody).length > 0) {
          if (!buangan_id) {
            throw new Error("Order ini belum punya data buangan, tidak bisa diedit dari sini");
          }
          await updateBuanganRow(conn, buangan_id, buanganBody, newKmAwal);
        } else if (newKmAwal !== undefined && buangan_id) {
          // km_awal order berubah, buangan_id ada, tapi tidak ada perubahan buangan lain
          // di request ini -> tetap recalculate jarak_km dari km_akhir yang tersimpan
          await updateBuanganRow(conn, buangan_id, {}, newKmAwal);
        }

        updated++;
      } catch (rowErr) {
        failed.push({
          order_id: order_id ?? null,
          buangan_id: buangan_id ?? null,
          message: rowErr.message,
        });
      }
    }

    await conn.commit();
    return success(res, "Bulk update selesai diproses", { updated, failed });
  } catch (err) {
    if (conn) await conn.rollback().catch(() => {});
    console.error("Error PUT /review/bulk-update:", err);
    return error(res, 500, "Gagal memproses bulk update", err);
  } finally {
    if (conn) conn.release();
  }
});

// ============================================================================
// POST /api/review/bulk-batal
// ============================================================================
router.post("/bulk-batal", async (req, res) => {
  const { order_ids, keterangan_mode, keterangan_shared, keterangan_per_row } = req.body;

  if (!Array.isArray(order_ids) || order_ids.length === 0) {
    return error(res, 400, "order_ids wajib diisi");
  }
  if (keterangan_mode !== "shared" && keterangan_mode !== "per_row") {
    return error(res, 400, "keterangan_mode harus 'shared' atau 'per_row'");
  }

  let updated = 0;
  const failed = [];

  for (const orderId of order_ids) {
    let conn;
    try {
      let keterangan;
      if (keterangan_mode === "shared") {
        keterangan = keterangan_shared;
      } else {
        keterangan = keterangan_per_row ? keterangan_per_row[orderId] : undefined;
      }

      if (!keterangan || String(keterangan).trim() === "") {
        failed.push({ order_id: orderId, buangan_id: null, message: "Keterangan pembatalan wajib diisi" });
        continue;
      }

      conn = await db.getConnection();
      await conn.beginTransaction();

      const [orderRows] = await conn.query(`SELECT id FROM orders WHERE id = ? LIMIT 1`, [orderId]);
      if (orderRows.length === 0) {
        await conn.rollback();
        failed.push({ order_id: orderId, buangan_id: null, message: `Order ID ${orderId} tidak ditemukan` });
        continue;
      }

      const [existingBuangan] = await conn.query(`SELECT id FROM buangan WHERE order_id = ? LIMIT 1`, [orderId]);

      if (existingBuangan.length > 0) {
        await conn.query(`UPDATE buangan SET keterangan = ? WHERE order_id = ?`, [keterangan, orderId]);
      } else {
        await conn.query(
          `INSERT INTO buangan (
             order_id, tanggal_bongkar, jam_bongkar, km_akhir, jarak_km,
             lokasi_bongkar, alihan, galian_alihan_id, keterangan, uang_alihan, no_urut
           ) VALUES (?, NULL, NULL, NULL, NULL, NULL, 0, NULL, ?, NULL, NULL)`,
          [orderId, keterangan]
        );
      }

      await conn.query(`UPDATE orders SET status = 'BATAL' WHERE id = ?`, [orderId]);
      await conn.commit();
      updated++;
    } catch (rowErr) {
      if (conn) await conn.rollback().catch(() => {});
      console.error(`Error bulk-batal order ${orderId}:`, rowErr);
      failed.push({ order_id: orderId, buangan_id: null, message: rowErr.message });
    } finally {
      if (conn) conn.release();
    }
  }

  return success(res, "Bulk batal selesai diproses", { updated, failed });
});

// ============================================================================
// POST /api/review/bulk-unbatal
// ============================================================================
router.post("/bulk-unbatal", async (req, res) => {
  const { order_ids } = req.body;

  if (!Array.isArray(order_ids) || order_ids.length === 0) {
    return error(res, 400, "order_ids wajib diisi");
  }

  let updated = 0;
  const failed = [];

  for (const orderId of order_ids) {
    let conn;
    try {
      conn = await db.getConnection();
      await conn.beginTransaction();

      const [orderRows] = await conn.query(`SELECT id, status FROM orders WHERE id = ? LIMIT 1`, [orderId]);

      if (orderRows.length === 0) {
        await conn.rollback();
        failed.push({ order_id: orderId, buangan_id: null, message: `Order ID ${orderId} tidak ditemukan` });
        continue;
      }

      if (orderRows[0].status !== "BATAL") {
        await conn.rollback();
        failed.push({ order_id: orderId, buangan_id: null, message: "Order ini tidak berstatus BATAL" });
        continue;
      }

      const [buanganRows] = await conn.query(
        `SELECT id, tanggal_bongkar, km_akhir, no_urut FROM buangan WHERE order_id = ?`,
        [orderId]
      );

      const isPlaceholder = (b) => b.tanggal_bongkar === null && b.km_akhir === null && b.no_urut === null;
      const placeholders = buanganRows.filter(isPlaceholder);
      const ritasiAsli = buanganRows.filter((b) => !isPlaceholder(b));

      if (placeholders.length > 0) {
        await conn.query(`DELETE FROM buangan WHERE id IN (?)`, [placeholders.map((b) => b.id)]);
      }

      const newStatus = ritasiAsli.length > 0 ? "COMPLETE" : "ON PROCESS";
      await conn.query(`UPDATE orders SET status = ? WHERE id = ?`, [newStatus, orderId]);
      await conn.commit();
      updated++;
    } catch (rowErr) {
      if (conn) await conn.rollback().catch(() => {});
      console.error(`Error bulk-unbatal order ${orderId}:`, rowErr);
      failed.push({ order_id: orderId, buangan_id: null, message: rowErr.message });
    } finally {
      if (conn) conn.release();
    }
  }

  return success(res, "Bulk un-batal selesai diproses", { updated, failed });
});

// ============================================================================
// POST /api/review/recalc-jarak
// ============================================================================
router.post("/recalc-jarak", async (req, res) => {
  const { buangan_ids } = req.body;

  if (!Array.isArray(buangan_ids) || buangan_ids.length === 0) {
    return error(res, 400, "buangan_ids wajib diisi");
  }

  let updated = 0;
  const failed = [];

  for (const buanganId of buangan_ids) {
    try {
      const [[row]] = await db.query(
        `SELECT b.km_akhir, o.km_awal
         FROM buangan b
         JOIN orders o ON b.order_id = o.id
         WHERE b.id = ? LIMIT 1`,
        [buanganId]
      );

      if (!row) {
        failed.push({ order_id: null, buangan_id: buanganId, message: `Buangan ID ${buanganId} tidak ditemukan` });
        continue;
      }

      const kmAkhirParsed = parseKmFromDb(row.km_akhir);
      const kmAwalParsed = parseKmFromDb(row.km_awal);

      if (isNaN(kmAkhirParsed) || isNaN(kmAwalParsed)) {
        await db.query(`UPDATE buangan SET jarak_km = NULL WHERE id = ?`, [buanganId]);
        const reason = isExactOdoVariant(row.km_akhir) || row.km_akhir === null
          ? "KM Akhir kosong atau berisi ODO ERROR"
          : "KM Awal kosong atau berisi ODO ERROR";
        failed.push({ order_id: null, buangan_id: buanganId, message: `Tidak bisa menghitung jarak: ${reason}` });
        continue;
      }

      await db.query(`UPDATE buangan SET jarak_km = ? WHERE id = ?`, [kmAkhirParsed - kmAwalParsed, buanganId]);
      updated++;
    } catch (rowErr) {
      console.error(`Error recalc-jarak buangan ${buanganId}:`, rowErr);
      failed.push({ order_id: null, buangan_id: buanganId, message: rowErr.message });
    }
  }

  return success(res, "Hitung ulang jarak KM selesai diproses", { updated, failed });
});

// ============================================================================
// DELETE /api/review/bulk-delete-ritasi
// ============================================================================
router.delete("/bulk-delete-ritasi", async (req, res) => {
  const { buangan_ids, confirm } = req.body;

  if (confirm !== true) {
    return error(res, 400, "Konfirmasi diperlukan");
  }
  if (!Array.isArray(buangan_ids) || buangan_ids.length === 0) {
    return error(res, 400, "buangan_ids wajib diisi");
  }

  let deleted = 0;
  const failed = [];

  for (const buanganId of buangan_ids) {
    let conn;
    try {
      conn = await db.getConnection();
      await conn.beginTransaction();

      const [buanganRows] = await conn.query(`SELECT order_id FROM buangan WHERE id = ? LIMIT 1`, [buanganId]);

      if (buanganRows.length === 0) {
        await conn.rollback();
        failed.push({ order_id: null, buangan_id: buanganId, message: `Buangan ID ${buanganId} tidak ditemukan` });
        continue;
      }

      const orderId = buanganRows[0].order_id;

      const [countRows] = await conn.query(`SELECT COUNT(*) as cnt FROM buangan WHERE order_id = ?`, [orderId]);
      if (countRows[0].cnt > 1) {
        await conn.rollback();
        failed.push({
          order_id: orderId,
          buangan_id: buanganId,
          message: "Terdapat ritasi lain untuk order ini. Hapus ritasi lainnya terlebih dahulu.",
        });
        continue;
      }

      const [delBuangan] = await conn.query(`DELETE FROM buangan WHERE id = ?`, [buanganId]);
      if (delBuangan.affectedRows === 0) {
        await conn.rollback();
        failed.push({ order_id: orderId, buangan_id: buanganId, message: `Buangan ID ${buanganId} tidak ditemukan` });
        continue;
      }

      const [delOrder] = await conn.query(`DELETE FROM orders WHERE id = ?`, [orderId]);
      if (delOrder.affectedRows === 0) {
        await conn.rollback();
        failed.push({ order_id: orderId, buangan_id: buanganId, message: `Order ID ${orderId} tidak ditemukan` });
        continue;
      }

      await conn.commit();
      deleted++;
    } catch (rowErr) {
      if (conn) await conn.rollback().catch(() => {});
      console.error(`Error bulk-delete-ritasi buangan ${buanganId}:`, rowErr);
      failed.push({ order_id: null, buangan_id: buanganId, message: rowErr.message });
    } finally {
      if (conn) conn.release();
    }
  }

  return success(res, "Bulk hapus ritasi selesai diproses", { deleted, failed });
});

export default router;
