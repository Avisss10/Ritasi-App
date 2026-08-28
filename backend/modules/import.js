// ============================================================================
// IMPORT MODULE (Bulk Import CSV: master, ritasi, mobil luar)
// ============================================================================

import express from "express";
import multer from "multer";
import db from "../config/db.js";
import { success, error } from "../utils/response.js";
import {
  ENTITY_SCHEMAS,
  CSV_TEMPLATES,
  MAX_ROWS,
  MAX_FILE_SIZE_BYTES,
  parseCsvBuffer,
  validateHeaderAndMapRows,
  loadMasterCache,
  loadOrderIndex,
  loadBuanganIndex,
  loadBatalKeteranganMap,
  runValidation,
  computeSummary,
  serializeRow,
  createBatch,
  getBatch,
  deleteBatch,
  applyOverride,
  editRowField,
  revalidateBatch,
  commitBatch,
  normalizeForMatch,
} from "../utils/csvImport.js";
import { buildTemplateWorkbook } from "../utils/templateExcel.js";
import { generateExcel } from "../utils/exportExcel.js";
import { runStartupMigration } from "../utils/runStartupMigration.js";

const router = express.Router();

// Startup migration: buat tabel import_log jika belum ada (pola self-migration
// mengikuti buangan.js). Dipanggil dari server.js setelah koneksi DB
// terkonfirmasi hidup (lihat runStartupMigration untuk retry terhadap
// timeout koneksi sementara).
export async function migrateImportLogTable() {
  await runStartupMigration("tabel import_log", async () => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS import_log (
        id INT AUTO_INCREMENT PRIMARY KEY,
        batch_id VARCHAR(64) NOT NULL,
        entitas VARCHAR(32) NOT NULL,
        filename VARCHAR(255),
        total_baris INT NOT NULL,
        berhasil INT NOT NULL,
        dilewati INT NOT NULL,
        detail_error JSON NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  });
}

// Startup migration: tambah kolom import_batch_id di orders & buangan agar
// data hasil commit import bisa ditelusuri per sesi (dipakai fitur undo-last).
export async function migrateImportBatchIdColumns() {
  await runStartupMigration("import_batch_id pada orders/buangan", async () => {
    for (const table of ["orders", "buangan"]) {
      const [cols] = await db.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'import_batch_id'`,
        [table]
      );
      if (cols.length === 0) {
        await db.query(`ALTER TABLE ${table} ADD COLUMN import_batch_id VARCHAR(64) NULL`);
      }
    }
  });
}

// ============================================================================
// UPLOAD MIDDLEWARE (multer memoryStorage, limit 5 MB)
// ============================================================================
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
});

function singleFileUpload(req, res, next) {
  upload.single("file")(req, res, (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return error(res, 400, "Ukuran file melebihi batas 5 MB");
      }
      return error(res, 400, "Gagal upload file", err);
    }
    next();
  });
}

// Field yang bisa "ditambahkan ke master" dari preview ritasi
const ADD_MASTER_FIELD_MAP = {
  no_pintu: { table: "master_kendaraan", nameCol: "no_pintu", cacheKey: "kendaraan" },
  nama_supir: { table: "master_supir", nameCol: "nama", cacheKey: "supir" },
  nama_galian: { table: "master_galian", nameCol: "nama_galian", cacheKey: "galian", hargaCol: "harga_galian" },
  nama_galian_alihan: { table: "master_galian", nameCol: "nama_galian", cacheKey: "galian", hargaCol: "harga_galian" },
  nama_proyek: { table: "master_proyek", nameCol: "nama_proyek", cacheKey: "proyek", hargaCol: "harga" },
};

// ============================================================================
// GET /api/import/log - riwayat import
// ============================================================================
router.get("/log", async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT * FROM import_log ORDER BY id DESC LIMIT 100`);
    return success(res, "Riwayat import", rows);
  } catch (err) {
    return error(res, 500, "Gagal mengambil riwayat import", err);
  }
});

// ============================================================================
// GET /api/import/log/:id - detail satu sesi import, termasuk baris yang
// dilewati/gagal (detail_error) yang selama ini tersimpan tapi tak ditampilkan
// ============================================================================
router.get("/log/:id", async (req, res) => {
  try {
    const [logs] = await db.query(`SELECT * FROM import_log WHERE id = ?`, [req.params.id]);
    if (logs.length === 0) return error(res, 404, "Riwayat import tidak ditemukan");
    return success(res, "Detail riwayat import", logs[0]);
  } catch (err) {
    return error(res, 500, "Gagal mengambil detail riwayat import", err);
  }
});

// ============================================================================
// GET /api/import/log/:id/download - unduh ulang (.xlsx) data hasil sesi
// import ini, direkonstruksi dari DB via import_batch_id (bukan file asli,
// yang tidak pernah disimpan). Hanya didukung untuk entitas 'ritasi' karena
// hanya orders/buangan yang memiliki kolom import_batch_id saat ini.
// ============================================================================
router.get("/log/:id/download", async (req, res) => {
  try {
    const [logs] = await db.query(`SELECT * FROM import_log WHERE id = ?`, [req.params.id]);
    if (logs.length === 0) return error(res, 404, "Riwayat import tidak ditemukan");
    const log = logs[0];

    if (log.entitas !== "ritasi") {
      return error(res, 400, "Download hanya didukung untuk data ritasi saat ini");
    }

    // Dua sumber baris buangan milik batch ini: (a) menempel di order yang
    // juga dibuat batch ini, (b) menempel di order LAMA yang "ketiban"
    // baris buangan tambahan dari batch ini (kasus APPEND, sama seperti
    // yang ditelusuri fitur undo-last).
    const sql = `
      SELECT
        ROW_NUMBER() OVER (ORDER BY o.tanggal_order, o.id, b.id) AS no,
        o.no_order,
        o.tanggal_order,
        o.petugas_order AS petugas,
        k.no_pintu AS kendaraan,
        s.nama AS supir,
        g.nama_galian AS galian,
        o.no_do,
        o.jam_order,
        o.km_awal,
        b.tanggal_bongkar,
        b.jam_bongkar,
        b.km_akhir,
        b.jarak_km,
        o.uang_jalan,
        o.potongan,
        o.hasil_akhir AS total,
        COALESCE(p.nama_proyek, o.proyek_input) AS proyek,
        b.lokasi_bongkar AS buangan,
        b.alihan,
        g2.nama_galian AS galian_alihan,
        b.uang_alihan,
        b.keterangan,
        o.status
      FROM orders o
      LEFT JOIN buangan b ON o.id = b.order_id AND b.import_batch_id = ?
      LEFT JOIN master_kendaraan k ON o.kendaraan_id = k.id
      LEFT JOIN master_supir s ON o.supir_id = s.id
      LEFT JOIN master_galian g ON o.galian_id = g.id
      LEFT JOIN master_galian g2 ON b.galian_alihan_id = g2.id
      LEFT JOIN master_proyek p ON o.proyek_id = p.id
      WHERE o.import_batch_id = ? OR b.import_batch_id = ?
      ORDER BY o.tanggal_order, o.id, b.id
    `;
    const [rows] = await db.query(sql, [log.batch_id, log.batch_id, log.batch_id]);

    if (rows.length === 0) {
      return error(
        res,
        404,
        "Data batch ini tidak memiliki jejak untuk direkonstruksi (kemungkinan diimpor sebelum fitur ini aktif)"
      );
    }

    const headers = [
      { label: "No", key: "no", width: 8 },
      { label: "No Order", key: "no_order", width: 15 },
      { label: "Tgl Order", key: "tanggal_order", width: 12 },
      { label: "Petugas", key: "petugas", width: 15 },
      { label: "Kendaraan", key: "kendaraan", width: 15 },
      { label: "Supir", key: "supir", width: 15 },
      { label: "Galian", key: "galian", width: 15 },
      { label: "No DO", key: "no_do", width: 12 },
      { label: "Jam Order", key: "jam_order", width: 10 },
      { label: "KM Awal", key: "km_awal", width: 10 },
      { label: "Tgl Bongkar", key: "tanggal_bongkar", width: 12 },
      { label: "Jam Bongkar", key: "jam_bongkar", width: 10 },
      { label: "KM Akhir", key: "km_akhir", width: 10 },
      { label: "Jarak KM", key: "jarak_km", width: 10 },
      { label: "Uang Jalan", key: "uang_jalan", width: 12 },
      { label: "Potongan", key: "potongan", width: 12 },
      { label: "Total", key: "total", width: 12 },
      { label: "Proyek", key: "proyek", width: 18 },
      { label: "Buangan", key: "buangan", width: 18 },
      { label: "Alihan", key: "alihan", width: 10 },
      { label: "Galian Alihan", key: "galian_alihan", width: 15 },
      { label: "Uang Alihan", key: "uang_alihan", width: 12 },
      { label: "Keterangan", key: "keterangan", width: 20 },
      { label: "Status", key: "status", width: 10 },
    ];

    const filterInfo = {
      title: `Hasil Import Ritasi - ${log.filename || log.batch_id}`,
      filename: `riwayat-ritasi-${log.id}`,
      filters: {
        "File asli": log.filename || "-",
        "Waktu import": new Date(log.created_at).toLocaleString("id-ID"),
      },
    };

    await generateExcel(`riwayat-ritasi-${log.id}`, headers, rows, filterInfo, res);
  } catch (err) {
    return error(res, 500, "Gagal membuat file unduhan", err);
  }
});

// ============================================================================
// GET /api/import/:entitas/template - download template Excel (.xlsx)
// Berisi sheet "Data" (header + contoh) dan "Petunjuk"; upload tetap .csv
// ============================================================================
router.get("/:entitas/template", async (req, res) => {
  const { entitas } = req.params;
  if (!CSV_TEMPLATES[entitas]) return error(res, 400, `Entitas '${entitas}' tidak dikenal`);

  try {
    const workbook = buildTemplateWorkbook(entitas);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="template-${entitas}.xlsx"`);
    await workbook.xlsx.write(res);
    return res.end();
  } catch (err) {
    return error(res, 500, "Gagal membuat template Excel", err);
  }
});

// ============================================================================
// POST /api/import/:entitas/preview - upload & validasi CSV
// ============================================================================
router.post("/:entitas/preview", singleFileUpload, async (req, res) => {
  const { entitas } = req.params;

  if (!ENTITY_SCHEMAS[entitas]) {
    return error(res, 400, `Entitas '${entitas}' tidak dikenal`);
  }
  if (!req.file) {
    return error(res, 400, "File CSV wajib diupload");
  }

  try {
    const records = parseCsvBuffer(req.file.buffer);
    const mapped = validateHeaderAndMapRows(entitas, records);
    if (mapped.error) return error(res, 400, mapped.error);

    if (mapped.dataRows.length > MAX_ROWS) {
      return error(res, 400, `Maksimal ${MAX_ROWS} baris data per upload (ditemukan ${mapped.dataRows.length} baris)`);
    }

    const masterCache = await loadMasterCache();
    const dbIndexes = {};

    if (entitas === "ritasi") {
      dbIndexes.orders = await loadOrderIndex();
      dbIndexes.buangan = await loadBuanganIndex();
      const batalOrderIds = dbIndexes.orders.filter((o) => o.status === "BATAL").map((o) => o.id);
      dbIndexes.batalKeterangan = await loadBatalKeteranganMap(batalOrderIds);
    }

    const batch = createBatch({
      entitas,
      filename: req.file.originalname,
      dataRows: mapped.dataRows,
      masterCache,
      dbIndexes,
      extraColumns: mapped.extraColumns,
    });

    revalidateBatch(batch);

    return success(res, "Preview berhasil", {
      batch_id: batch.batch_id,
      entitas,
      filename: batch.filename,
      extra_columns: batch.extraColumns,
      summary: computeSummary(batch.rows),
      rows: batch.rows.map(serializeRow),
    });
  } catch (err) {
    return error(res, 500, "Gagal memproses file CSV", err);
  }
});

// ============================================================================
// POST /api/import/:entitas/resolve - resolve referensi (gunakan existing / tandai baru)
// action='revalidate' dipakai setelah un-batal order agar status order di
// batal buangan ter-refresh tanpa upload ulang.
// ============================================================================
router.post("/:entitas/resolve", async (req, res) => {
  const { entitas } = req.params;
  const { batch_id, row_index, field, action, master_id, apply_to_all } = req.body;

  const batch = getBatch(batch_id);
  if (!batch) return error(res, 410, "Sesi preview kedaluwarsa, silakan upload ulang");
  if (batch.entitas !== entitas) return error(res, 400, "Entitas tidak sesuai dengan batch");

  if (action === "revalidate") {
    if (batch.entitas === "ritasi") {
      batch.dbIndexes.orders = await loadOrderIndex();
      batch.dbIndexes.buangan = await loadBuanganIndex();
      const batalOrderIds = batch.dbIndexes.orders.filter((o) => o.status === "BATAL").map((o) => o.id);
      batch.dbIndexes.batalKeterangan = await loadBatalKeteranganMap(batalOrderIds);
    }
    revalidateBatch(batch);
    return success(res, "Batch berhasil divalidasi ulang", {
      batch_id: batch.batch_id,
      summary: computeSummary(batch.rows),
      rows: batch.rows.map(serializeRow),
    });
  }

  if (row_index === undefined || row_index === null || !batch.dataRows[row_index]) {
    return error(res, 400, "row_index tidak valid");
  }
  if (!field) return error(res, 400, "Field 'field' wajib diisi");
  if (!["use_existing", "mark_new"].includes(action)) {
    return error(res, 400, "action harus 'use_existing' atau 'mark_new'");
  }
  if (action === "use_existing" && (master_id === undefined || master_id === null || master_id === "")) {
    return error(res, 400, "master_id wajib diisi untuk action use_existing");
  }

  const override = action === "use_existing"
    ? { action, master_id: parseInt(master_id, 10) }
    : { action };

  applyOverride(batch, parseInt(row_index, 10), field, override, !!apply_to_all);
  revalidateBatch(batch);

  return success(res, "Baris berhasil divalidasi ulang", {
    batch_id: batch.batch_id,
    summary: computeSummary(batch.rows),
    rows: batch.rows.map(serializeRow),
  });
});

// ============================================================================
// POST /api/import/:entitas/edit-field - koreksi nilai mentah satu field pada
// satu baris preview (mis. salah ketik nama), lalu revalidasi ulang. Hanya
// field referensi (lihat ADD_MASTER_FIELD_MAP) yang boleh diedit lewat sini.
// ============================================================================
router.post("/:entitas/edit-field", async (req, res) => {
  const { entitas } = req.params;
  const { batch_id, row_index, field, value } = req.body;

  const batch = getBatch(batch_id);
  if (!batch) return error(res, 410, "Sesi preview kedaluwarsa, silakan upload ulang");
  if (batch.entitas !== entitas) return error(res, 400, "Entitas tidak sesuai dengan batch");
  if (row_index === undefined || row_index === null || !batch.dataRows[row_index]) {
    return error(res, 400, "row_index tidak valid");
  }
  if (!ADD_MASTER_FIELD_MAP[field]) {
    return error(res, 400, `Field '${field}' tidak bisa diedit`);
  }
  if (value === undefined || value === null || !String(value).trim()) {
    return error(res, 400, "Nilai wajib diisi");
  }

  editRowField(batch, parseInt(row_index, 10), field, value);
  revalidateBatch(batch);

  return success(res, "Nilai berhasil diperbarui", {
    batch_id: batch.batch_id,
    summary: computeSummary(batch.rows),
    rows: batch.rows.map(serializeRow),
  });
});

// ============================================================================
// POST /api/import/:entitas/add-master - tambah entri master baru dari preview
// ============================================================================
router.post("/:entitas/add-master", async (req, res) => {
  const { entitas } = req.params;
  const { batch_id, row_index, field, data } = req.body;

  const batch = getBatch(batch_id);
  if (!batch) return error(res, 410, "Sesi preview kedaluwarsa, silakan upload ulang");
  if (batch.entitas !== entitas) return error(res, 400, "Entitas tidak sesuai dengan batch");
  if (row_index === undefined || row_index === null || !batch.dataRows[row_index]) {
    return error(res, 400, "row_index tidak valid");
  }

  const config = ADD_MASTER_FIELD_MAP[field];
  if (!config) return error(res, 400, `Field '${field}' tidak bisa ditambahkan ke master`);

  const namaValue = (data && data.nama && String(data.nama).trim())
    ? String(data.nama).trim()
    : String(batch.dataRows[row_index][field] || "").trim();

  if (!namaValue) return error(res, 400, "Nilai nama wajib diisi");

  let insertId;
  let hargaDefaultUsed = false;

  try {
    if (config.hargaCol) {
      const hargaProvided = data && data.harga !== undefined && data.harga !== null && data.harga !== "";
      const hargaValue = hargaProvided ? parseFloat(data.harga) : 0;
      hargaDefaultUsed = !hargaProvided;
      const [result] = await db.query(
        `INSERT INTO ${config.table} (${config.nameCol}, ${config.hargaCol}) VALUES (?, ?)`,
        [namaValue, hargaValue]
      );
      insertId = result.insertId;
    } else {
      const [result] = await db.query(
        `INSERT INTO ${config.table} (${config.nameCol}) VALUES (?)`,
        [namaValue]
      );
      insertId = result.insertId;
    }
  } catch (err) {
    return error(res, 500, "Gagal menambahkan ke master", err);
  }

  // Refresh cache master di batch supaya baris lain ikut ter-resolve
  batch.masterCache = await loadMasterCache();

  // Terapkan override ke semua baris dengan nilai field yang sama
  const targetNorm = normalizeForMatch(namaValue);
  batch.dataRows.forEach((d, idx) => {
    if (normalizeForMatch(d[field]) === targetNorm) {
      batch.overrides[idx] = batch.overrides[idx] || {};
      batch.overrides[idx][field] = { action: "use_existing", master_id: insertId };
    }
  });

  revalidateBatch(batch);

  return success(res, "Berhasil menambahkan ke master", {
    batch_id: batch.batch_id,
    master_id: insertId,
    harga_default_used: hargaDefaultUsed,
    summary: computeSummary(batch.rows),
    rows: batch.rows.map(serializeRow),
  });
});

// ============================================================================
// GET /api/import/:entitas/progress - progres real commit yang sedang berjalan
// (dipoll frontend selama modal progress commit tampil, lihat runCommit di import.js)
// ============================================================================
router.get("/:entitas/progress", (req, res) => {
  const { batch_id } = req.query;
  const batch = getBatch(batch_id);
  if (!batch) return error(res, 410, "Sesi preview kedaluwarsa, silakan upload ulang");

  return success(res, "Progres commit", batch.progress || { done: 0, total: batch.rows.length });
});

// ============================================================================
// POST /api/import/:entitas/commit - insert baris valid ke tabel target
// ============================================================================
router.post("/:entitas/commit", async (req, res) => {
  const { entitas } = req.params;
  const { batch_id } = req.body;

  const batch = getBatch(batch_id);
  if (!batch) return error(res, 410, "Sesi preview kedaluwarsa, silakan upload ulang");
  if (batch.entitas !== entitas) return error(res, 400, "Entitas tidak sesuai dengan batch");
  if (batch.committing) return error(res, 409, "Import sedang diproses, mohon tunggu");
  batch.committing = true;

  try {
    const result = await commitBatch(batch);

    // Insert log bersifat non-fatal: jika gagal, commit tetap dianggap sukses.
    // Jika error di sini dibiarkan menjalar, user akan retry commit dan data
    // yang sudah masuk bisa dobel (terutama mobil-luar yang tanpa cek duplikat).
    let logId = null;
    try {
      const [logResult] = await db.query(
        `INSERT INTO import_log (batch_id, entitas, filename, total_baris, berhasil, dilewati, detail_error)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [batch.batch_id, entitas, batch.filename, result.total, result.berhasil, result.dilewati, JSON.stringify(result.detail)]
      );
      logId = logResult.insertId;
    } catch (logErr) {
      console.warn("Gagal mencatat import_log (commit tetap sukses):", logErr.message);
    }

    deleteBatch(batch.batch_id);

    return success(res, "Import berhasil", { ...result, log_id: logId });
  } catch (err) {
    batch.committing = false;
    return error(res, 500, "Gagal melakukan commit import", err);
  }
});

// ============================================================================
// POST /api/import/:entitas/undo-last - hapus data hasil sesi import terakhir
// (saat ini hanya didukung untuk entitas 'ritasi')
// ============================================================================
router.post("/:entitas/undo-last", async (req, res) => {
  const { entitas } = req.params;

  if (entitas !== "ritasi") {
    return error(res, 400, "Undo hanya didukung untuk data ritasi saat ini");
  }

  try {
    const [logs] = await db.query(
      `SELECT * FROM import_log WHERE entitas = ? ORDER BY id DESC LIMIT 1`,
      [entitas]
    );
    if (logs.length === 0) {
      return error(res, 404, "Tidak ada import untuk di-undo");
    }
    const log = logs[0];
    const batchId = log.batch_id;

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // Order lama yang "ketiban" baris buangan tambahan dari batch ini
      // (APPEND) - order-nya sendiri BUKAN buatan batch ini.
      const [affectedOldOrders] = await conn.query(
        `SELECT DISTINCT b.order_id FROM buangan b
         JOIN orders o ON o.id = b.order_id
         WHERE b.import_batch_id = ? AND (o.import_batch_id IS NULL OR o.import_batch_id <> ?)`,
        [batchId, batchId]
      );

      // Hapus baris buangan bertanda batch ini yang menempel di order lama
      const [delOldBuangan] = await conn.query(
        `DELETE b FROM buangan b
         JOIN orders o ON o.id = b.order_id
         WHERE b.import_batch_id = ? AND (o.import_batch_id IS NULL OR o.import_batch_id <> ?)`,
        [batchId, batchId]
      );

      // Kembalikan status order lama ke ON PROCESS jika sudah tidak punya buangan tersisa
      for (const row of affectedOldOrders) {
        const [remaining] = await conn.query(
          `SELECT COUNT(*) AS cnt FROM buangan WHERE order_id = ?`,
          [row.order_id]
        );
        if (remaining[0].cnt === 0) {
          await conn.query(`UPDATE orders SET status = 'ON PROCESS' WHERE id = ?`, [row.order_id]);
        }
      }

      // Order yang dibuat baru oleh batch ini - hapus buangan miliknya dulu (FK), lalu order-nya
      const [delNewBuangan] = await conn.query(
        `DELETE b FROM buangan b
         JOIN orders o ON o.id = b.order_id
         WHERE o.import_batch_id = ?`,
        [batchId]
      );
      const [delNewOrders] = await conn.query(
        `DELETE FROM orders WHERE import_batch_id = ?`,
        [batchId]
      );

      await conn.query(`DELETE FROM import_log WHERE id = ?`, [log.id]);

      await conn.commit();

      return success(res, "Import berhasil di-undo", {
        orders_dihapus: delNewOrders.affectedRows,
        buangan_dihapus: delNewBuangan.affectedRows + delOldBuangan.affectedRows,
      });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    return error(res, 500, "Gagal melakukan undo import", err);
  }
});

export default router;
