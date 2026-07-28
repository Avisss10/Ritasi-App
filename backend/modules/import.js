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
  revalidateBatch,
  commitBatch,
  normalizeForMatch,
} from "../utils/csvImport.js";
import { buildTemplateWorkbook } from "../utils/templateExcel.js";

const router = express.Router();

// Startup migration: buat tabel import_log jika belum ada (pola self-migration
// mengikuti buangan.js)
(async () => {
  try {
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
  } catch (err) {
    console.warn("Gagal membuat tabel import_log:", err.message);
  }
})();

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
    try {
      await db.query(
        `INSERT INTO import_log (batch_id, entitas, filename, total_baris, berhasil, dilewati, detail_error)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [batch.batch_id, entitas, batch.filename, result.total, result.berhasil, result.dilewati, JSON.stringify(result.detail)]
      );
    } catch (logErr) {
      console.warn("Gagal mencatat import_log (commit tetap sukses):", logErr.message);
    }

    deleteBatch(batch.batch_id);

    return success(res, "Import berhasil", result);
  } catch (err) {
    batch.committing = false;
    return error(res, 500, "Gagal melakukan commit import", err);
  }
});

export default router;
