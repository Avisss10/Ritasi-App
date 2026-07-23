// ============================================================================
// CSV IMPORT UTILS
// Parsing CSV, validasi per baris, fuzzy match referensi master, dan
// manajemen staging batch (preview -> commit). Dipakai oleh modules/import.js.
// ============================================================================

import { parse } from "csv-parse/sync";
import { distance as levenshteinDistance } from "fastest-levenshtein";
import { randomUUID } from "crypto";
import db from "../config/db.js";
import {
  isExactOdoVariant,
  parseKmFromDb,
  normalizeKmForStorage,
  normalizeNumberForStorage,
  parseTanggalCSV,
  parseJamCSV,
  parseBooleanCSV,
} from "./normalize.js";

export const MAX_ROWS = 2000;
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const BATCH_TTL_MS = 30 * 60 * 1000; // 30 menit
const FUZZY_THRESHOLD = 0.8;

// ============================================================================
// SKEMA HEADER PER ENTITAS
// `columns`  = seluruh kolom header yang wajib ada persis (case-insensitive)
// `required` = subset kolom yang NILAI-nya wajib diisi per baris
// ============================================================================
export const ENTITY_SCHEMAS = {
  kendaraan: {
    table: "master_kendaraan",
    columns: ["no_pintu"],
    required: ["no_pintu"],
  },
  supir: {
    table: "master_supir",
    columns: ["nama"],
    required: ["nama"],
  },
  galian: {
    table: "master_galian",
    columns: ["nama_galian", "harga_galian"],
    required: ["nama_galian"],
  },
  proyek: {
    table: "master_proyek",
    columns: ["nama_proyek", "harga"],
    required: ["nama_proyek"],
  },
  order: {
    columns: [
      "tanggal_order", "no_order", "petugas_order", "no_pintu", "nama_supir",
      "nama_galian", "nama_proyek", "no_do", "jam_order", "km_awal",
      "uang_jalan", "potongan",
    ],
    required: [
      "tanggal_order", "no_order", "petugas_order", "no_pintu", "nama_supir",
      "nama_galian", "no_do", "jam_order", "km_awal", "uang_jalan",
    ],
  },
  buangan: {
    columns: [
      "tanggal_order", "no_order", "tanggal_bongkar", "jam_bongkar", "km_akhir",
      "jarak_km", "lokasi_bongkar", "alihan", "nama_galian_alihan",
      "keterangan", "uang_alihan", "no_urut",
    ],
    required: [
      "tanggal_order", "no_order", "tanggal_bongkar", "jam_bongkar",
      "km_akhir", "lokasi_bongkar", "no_urut",
    ],
  },
  "mobil-luar": {
    columns: [
      "no_urut", "pengirim", "galian", "no_plat", "supir",
      "tanggal_bongkar", "jam_bongkar", "proyek", "lokasi_buang",
    ],
    required: [],
  },
};

// ============================================================================
// TEMPLATE CSV (header + 1 baris contoh)
// ============================================================================
export const CSV_TEMPLATES = {
  kendaraan: { filename: "master-kendaraan.csv", header: ["no_pintu"], example: ["B9999XYZ"] },
  supir: { filename: "master-supir.csv", header: ["nama"], example: ["Budi Santoso"] },
  galian: { filename: "master-galian.csv", header: ["nama_galian", "harga_galian"], example: ["Galian A", "150000"] },
  proyek: { filename: "master-proyek.csv", header: ["nama_proyek", "harga"], example: ["Proyek Jalan Tol", "500000"] },
  order: {
    filename: "order.csv",
    header: ENTITY_SCHEMAS.order.columns,
    example: ["2026-07-23", "1", "Andi", "B9999XYZ", "Budi Santoso", "Galian A", "Proyek Jalan Tol", "DO-001", "08:00", "10000", "150000", "0"],
  },
  buangan: {
    filename: "buangan.csv",
    header: ENTITY_SCHEMAS.buangan.columns,
    example: ["2026-07-23", "1", "2026-07-23", "10:30", "10050", "", "Lokasi Bongkar A", "tidak", "", "", "", "1"],
  },
  "mobil-luar": {
    filename: "mobil-luar.csv",
    header: ENTITY_SCHEMAS["mobil-luar"].columns,
    example: ["1", "PT Pengirim", "Galian Luar", "B1234AB", "Supir Luar", "2026-07-23", "09:00", "Proyek X", "Lokasi Y"],
  },
};

// ============================================================================
// PARSING FILE CSV: strip BOM, deteksi delimiter, parse jadi array-of-arrays
// ============================================================================
export function parseCsvBuffer(buffer) {
  let text = buffer.toString("utf8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const firstLineEnd = text.indexOf("\n");
  const headerLine = firstLineEnd === -1 ? text : text.slice(0, firstLineEnd);
  const commaCount = (headerLine.match(/,/g) || []).length;
  const semicolonCount = (headerLine.match(/;/g) || []).length;
  const delimiter = semicolonCount > commaCount ? ";" : ",";

  return parse(text, {
    delimiter,
    columns: false,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });
}

// ============================================================================
// VALIDASI HEADER (STRICT) + MAPPING BARIS DATA
// ============================================================================
export function validateHeaderAndMapRows(entitas, records) {
  const schema = ENTITY_SCHEMAS[entitas];
  if (!schema) return { error: `Entitas '${entitas}' tidak dikenal` };
  if (!records || records.length === 0) return { error: "File CSV kosong" };

  const headerRow = records[0].map((h) => String(h ?? "").trim());
  const normalizedHeader = headerRow.map((h) => h.toLowerCase());

  const missing = schema.columns.filter((col) => !normalizedHeader.includes(col.toLowerCase()));
  if (missing.length > 0) {
    return { error: `Kolom wajib hilang: ${missing.join(", ")}` };
  }

  const colIndex = {};
  schema.columns.forEach((col) => {
    colIndex[col] = normalizedHeader.indexOf(col.toLowerCase());
  });

  const matchedIndices = new Set(Object.values(colIndex).filter((i) => i >= 0));
  const extraColumns = headerRow.filter((_, idx) => !matchedIndices.has(idx));

  const dataRows = [];
  for (let i = 1; i < records.length; i++) {
    const rec = records[i];
    const isBlank = rec.every((cell) => String(cell ?? "").trim() === "");
    if (isBlank) continue;

    const rowData = {};
    schema.columns.forEach((col) => {
      const idx = colIndex[col];
      rowData[col] = idx >= 0 && idx < rec.length ? String(rec[idx] ?? "").trim() : "";
    });
    dataRows.push(rowData);
  }

  return { dataRows, extraColumns };
}

// ============================================================================
// FUZZY MATCH REFERENSI MASTER
// ============================================================================
export function normalizeForMatch(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim().toLowerCase().replace(/\s+/g, " ");
}

export function resolveReference(inputValue, masterList, keyField) {
  if (!inputValue || !String(inputValue).trim()) return { status: "empty" };
  const norm = normalizeForMatch(inputValue);

  const exact = masterList.find((m) => normalizeForMatch(m[keyField]) === norm);
  if (exact) return { status: "ok", id: exact.id, matched: exact };

  let best = null;
  for (const m of masterList) {
    const candNorm = normalizeForMatch(m[keyField]);
    if (!candNorm) continue;
    const dist = levenshteinDistance(norm, candNorm);
    const maxLen = Math.max(norm.length, candNorm.length) || 1;
    const similarity = 1 - dist / maxLen;
    if (!best || similarity > best.similarity) best = { similarity, item: m };
  }

  if (best && best.similarity >= FUZZY_THRESHOLD) {
    return {
      status: "fuzzy",
      suggestion: {
        master_id: best.item.id,
        nama: best.item[keyField],
        similarity: Math.round(best.similarity * 100) / 100,
      },
    };
  }

  return { status: "notfound" };
}

// Terapkan override manual (dari endpoint /resolve atau /add-master) sebelum fuzzy-match
function resolveFieldWithOverrides(row, field, rawValue, masterList, keyField) {
  const override = row.overrides && row.overrides[field];
  if (override && override.action === "use_existing") {
    const item = masterList.find((m) => m.id === override.master_id);
    return { status: "ok", id: override.master_id, matched: item };
  }
  if (override && override.action === "mark_new") {
    return { status: "notfound", forcedNew: true };
  }
  return resolveReference(rawValue, masterList, keyField);
}

// ============================================================================
// LOAD DATA MASTER & INDEX DB (SEKALI PER PREVIEW, TIDAK PER BARIS)
// ============================================================================
export async function loadMasterCache() {
  const [kendaraan] = await db.query(`SELECT id, no_pintu FROM master_kendaraan`);
  const [supir] = await db.query(`SELECT id, nama FROM master_supir`);
  const [galian] = await db.query(`SELECT id, nama_galian, harga_galian FROM master_galian`);
  const [proyek] = await db.query(`SELECT id, nama_proyek, harga FROM master_proyek`);
  return { kendaraan, supir, galian, proyek };
}

export async function loadOrderIndex() {
  const [rows] = await db.query(`
    SELECT id, DATE_FORMAT(tanggal_order, '%Y-%m-%d') as tanggal_order, no_order, status, km_awal
    FROM orders
  `);
  return rows;
}

export async function loadBuanganIndex() {
  const [rows] = await db.query(`SELECT order_id, no_urut FROM buangan`);
  return rows;
}

// Ambil keterangan pembatalan untuk order-order berstatus BATAL (1 query batched,
// bukan per-baris) agar pesan error di preview bisa informatif.
export async function loadBatalKeteranganMap(orderIds) {
  const map = new Map();
  if (!orderIds || orderIds.length === 0) return map;
  const [rows] = await db.query(
    `SELECT order_id, keterangan FROM buangan WHERE order_id IN (?) AND keterangan IS NOT NULL ORDER BY id DESC`,
    [orderIds]
  );
  for (const r of rows) {
    if (!map.has(r.order_id)) map.set(r.order_id, r.keterangan);
  }
  return map;
}

// ============================================================================
// HELPER BARIS
// ============================================================================
function makeRowBase(idx, data) {
  return {
    row_index: idx,
    data,
    status: "ok",
    messages: [],
    resolved: {},
    can_add_master: {},
    can_unbatal: null,
    skip_insert: false,
    computed: {},
    overrides: {},
  };
}

function markError(row, message) {
  row.status = "error";
  row.messages.push(message);
}

function markWarningIfOk(row, message) {
  if (row.status === "ok") row.status = "warning";
  row.messages.push(message);
}

// ============================================================================
// VALIDATOR: MASTER (kendaraan / supir / galian / proyek)
// ============================================================================
const MASTER_FIELD_CONFIG = {
  kendaraan: { field: "no_pintu", key: "no_pintu", cacheKey: "kendaraan" },
  supir: { field: "nama", key: "nama", cacheKey: "supir" },
  galian: { field: "nama_galian", key: "nama_galian", cacheKey: "galian", hargaField: "harga_galian" },
  proyek: { field: "nama_proyek", key: "nama_proyek", cacheKey: "proyek", hargaField: "harga" },
};

function validateMasterRows(entitas, dataRows, masterCache, overridesByIndex) {
  const config = MASTER_FIELD_CONFIG[entitas];
  const dbSeen = new Set(masterCache[config.cacheKey].map((m) => normalizeForMatch(m[config.key])));
  const csvSeen = new Set();

  return dataRows.map((data, idx) => {
    const row = makeRowBase(idx, data);
    row.overrides = overridesByIndex[idx] || {};
    const rn = idx + 1;
    const value = data[config.field];

    if (!value || !value.trim()) {
      markError(row, `Baris ${rn}: field '${config.field}' wajib diisi`);
      return row;
    }

    const norm = normalizeForMatch(value);
    if (dbSeen.has(norm) || csvSeen.has(norm)) {
      row.skip_insert = true;
      markWarningIfOk(row, `Baris ${rn}: '${value}' sudah ada, akan dilewati`);
    } else {
      csvSeen.add(norm);
    }

    if (config.hargaField) {
      const rawHarga = data[config.hargaField];
      if (rawHarga && rawHarga.trim()) {
        const n = normalizeNumberForStorage(rawHarga);
        if (typeof n !== "number" || isNaN(n)) {
          markError(row, `Baris ${rn}: ${config.hargaField} '${rawHarga}' bukan angka valid`);
          row.computed.harga = 0;
        } else {
          row.computed.harga = n;
        }
      } else {
        row.computed.harga = 0;
      }
    }

    return row;
  });
}

// ============================================================================
// VALIDATOR: ORDER
// ============================================================================
function validateOrderRows(dataRows, masterCache, dbIndexes, overridesByIndex) {
  const existingKeys = new Set(
    dbIndexes.orders.map((o) => `${o.tanggal_order}|${String(o.no_order).trim()}`)
  );

  const keyCount = new Map();
  const prelim = dataRows.map((data) => {
    const tanggalNorm = parseTanggalCSV(data.tanggal_order);
    const key = tanggalNorm && data.no_order ? `${tanggalNorm}|${String(data.no_order).trim()}` : null;
    if (key) keyCount.set(key, (keyCount.get(key) || 0) + 1);
    return { data, tanggalNorm, key };
  });

  return prelim.map(({ data, tanggalNorm, key }, idx) => {
    const row = makeRowBase(idx, data);
    row.overrides = overridesByIndex[idx] || {};
    const rn = idx + 1;

    const requiredFields = ENTITY_SCHEMAS.order.required;
    const missing = requiredFields.filter((f) => !data[f] || !String(data[f]).trim());
    missing.forEach((f) => markError(row, `Baris ${rn}: field '${f}' wajib diisi`));

    if (data.tanggal_order && data.tanggal_order.trim() && !tanggalNorm) {
      markError(row, `Baris ${rn}: format tanggal_order '${data.tanggal_order}' tidak valid (gunakan YYYY-MM-DD atau DD/MM/YYYY)`);
    }

    const jamNorm = data.jam_order ? parseJamCSV(data.jam_order) : null;
    if (data.jam_order && data.jam_order.trim() && !jamNorm) {
      markError(row, `Baris ${rn}: format jam_order '${data.jam_order}' tidak valid (gunakan HH:MM atau HH:MM:SS)`);
    }

    let uangJalanVal = null;
    if (data.uang_jalan && data.uang_jalan.trim()) {
      const n = normalizeNumberForStorage(data.uang_jalan);
      if (typeof n !== "number" || isNaN(n)) {
        markError(row, `Baris ${rn}: uang_jalan '${data.uang_jalan}' bukan angka valid`);
      } else {
        uangJalanVal = n;
      }
    }

    let potonganVal = 0;
    if (data.potongan && data.potongan.trim()) {
      const n = normalizeNumberForStorage(data.potongan);
      if (typeof n !== "number" || isNaN(n)) {
        markError(row, `Baris ${rn}: potongan '${data.potongan}' bukan angka valid`);
      } else {
        potonganVal = n;
      }
    }

    const kmVal = data.km_awal && data.km_awal.trim() ? normalizeKmForStorage(data.km_awal) : null;

    const refFields = [
      { field: "no_pintu", list: masterCache.kendaraan, key: "no_pintu" },
      { field: "nama_supir", list: masterCache.supir, key: "nama" },
      { field: "nama_galian", list: masterCache.galian, key: "nama_galian" },
    ];
    refFields.forEach((rf) => {
      if (!data[rf.field] || !data[rf.field].trim()) return;
      const result = resolveFieldWithOverrides(row, rf.field, data[rf.field], rf.list, rf.key);
      row.resolved[rf.field] = result;
      if (result.status === "fuzzy") {
        markError(row, `Baris ${rn}: '${data[rf.field]}' tidak ditemukan — mirip dengan '${result.suggestion.nama}'?`);
      } else if (result.status === "notfound") {
        row.can_add_master[rf.field] = true;
        markError(row, `Baris ${rn}: '${data[rf.field]}' tidak ditemukan, tidak ada yang mirip`);
      }
    });

    if (data.nama_proyek && data.nama_proyek.trim()) {
      const result = resolveFieldWithOverrides(row, "nama_proyek", data.nama_proyek, masterCache.proyek, "nama_proyek");
      row.resolved.nama_proyek = result;
      if (result.status === "fuzzy") {
        markError(row, `Baris ${rn}: nama_proyek '${data.nama_proyek}' tidak ditemukan — mirip dengan '${result.suggestion.nama}'?`);
      } else if (result.status === "notfound") {
        row.can_add_master.nama_proyek = true;
        markError(row, `Baris ${rn}: nama_proyek '${data.nama_proyek}' tidak ditemukan, tidak ada yang mirip`);
      }
    } else {
      row.resolved.nama_proyek = { status: "empty" };
    }

    if (key) {
      if (existingKeys.has(key)) {
        markError(row, `Baris ${rn}: order tanggal ${tanggalNorm} no_order '${data.no_order}' sudah ada di database`);
      } else if (keyCount.get(key) > 1) {
        markError(row, `Baris ${rn}: duplikat no_order '${data.no_order}' tanggal ${tanggalNorm} dalam file CSV`);
      }
    }

    row.computed = { tanggalNorm, jamNorm, uangJalanVal, potonganVal, kmVal };
    return row;
  });
}

// ============================================================================
// VALIDATOR: BUANGAN
// ============================================================================
function validateBuanganRows(dataRows, masterCache, dbIndexes, overridesByIndex) {
  const orderMap = new Map(
    dbIndexes.orders.map((o) => [`${o.tanggal_order}|${String(o.no_order).trim()}`, o])
  );
  const dbBuanganKeys = new Set(dbIndexes.buangan.map((b) => `${b.order_id}|${String(b.no_urut).trim()}`));

  const csvKeyCount = new Map();
  const prelim = dataRows.map((data) => {
    const tanggalNorm = parseTanggalCSV(data.tanggal_order);
    const orderKey = tanggalNorm && data.no_order ? `${tanggalNorm}|${String(data.no_order).trim()}` : null;
    const order = orderKey ? orderMap.get(orderKey) : null;
    const noUrutTrim = data.no_urut ? String(data.no_urut).trim() : null;
    const buanganKey = order && noUrutTrim ? `${order.id}|${noUrutTrim}` : null;
    if (buanganKey) csvKeyCount.set(buanganKey, (csvKeyCount.get(buanganKey) || 0) + 1);
    return { data, tanggalNorm, order, noUrutTrim, buanganKey };
  });

  return prelim.map(({ data, tanggalNorm, order, noUrutTrim, buanganKey }, idx) => {
    const row = makeRowBase(idx, data);
    row.overrides = overridesByIndex[idx] || {};
    const rn = idx + 1;

    const requiredFields = ENTITY_SCHEMAS.buangan.required;
    const missing = requiredFields.filter((f) => !data[f] || !String(data[f]).trim());
    missing.forEach((f) => markError(row, `Baris ${rn}: field '${f}' wajib diisi`));

    if (data.tanggal_order && data.tanggal_order.trim() && !tanggalNorm) {
      markError(row, `Baris ${rn}: format tanggal_order '${data.tanggal_order}' tidak valid`);
    }

    const tanggalBongkarNorm = data.tanggal_bongkar && data.tanggal_bongkar.trim()
      ? parseTanggalCSV(data.tanggal_bongkar) : null;
    if (data.tanggal_bongkar && data.tanggal_bongkar.trim() && !tanggalBongkarNorm) {
      markError(row, `Baris ${rn}: format tanggal_bongkar '${data.tanggal_bongkar}' tidak valid`);
    }

    const jamBongkarNorm = data.jam_bongkar && data.jam_bongkar.trim() ? parseJamCSV(data.jam_bongkar) : null;
    if (data.jam_bongkar && data.jam_bongkar.trim() && !jamBongkarNorm) {
      markError(row, `Baris ${rn}: format jam_bongkar '${data.jam_bongkar}' tidak valid`);
    }

    if (!order && data.tanggal_order && data.no_order && tanggalNorm) {
      markError(row, `Baris ${rn}: order tanggal ${tanggalNorm} no. ${data.no_order} tidak ditemukan`);
    }

    if (order && order.status === "BATAL") {
      row.can_unbatal = order.id;
      const keterangan = dbIndexes.batalKeterangan ? dbIndexes.batalKeterangan.get(order.id) : null;
      const keteranganPart = keterangan ? ` (keterangan: '${keterangan}')` : "";
      markError(
        row,
        `Baris ${rn}: Order no. ${order.no_order} tanggal ${order.tanggal_order} berstatus BATAL${keteranganPart} — ritasi tidak bisa ditambahkan ke order yang dibatalkan.`
      );
    }

    const kmAkhirVal = data.km_akhir && data.km_akhir.trim() ? normalizeKmForStorage(data.km_akhir) : null;

    let jarakVal = null;
    const jarakKosong = !data.jarak_km || !String(data.jarak_km).trim();
    if (jarakKosong) {
      markWarningIfOk(row, `Baris ${rn}: jarak_km kosong, akan dihitung otomatis`);
      const kmAwalRaw = order ? order.km_awal : null;
      if (isExactOdoVariant(kmAwalRaw)) {
        jarakVal = "ODO ERROR";
      } else if (typeof kmAkhirVal === "number") {
        const kmAwalNum = parseKmFromDb(kmAwalRaw);
        jarakVal = !isNaN(kmAwalNum) ? kmAkhirVal - kmAwalNum : null;
      }
    } else {
      const n = normalizeNumberForStorage(data.jarak_km);
      if (typeof n !== "number" || isNaN(n)) {
        markError(row, `Baris ${rn}: jarak_km '${data.jarak_km}' bukan angka valid`);
      } else {
        jarakVal = n;
      }
    }
    if (typeof jarakVal === "number" && jarakVal < 0) {
      markWarningIfOk(row, `Baris ${rn}: jarak_km negatif (${jarakVal}), diperbolehkan namun periksa kembali`);
    }

    const alihanVal = parseBooleanCSV(data.alihan);
    if (alihanVal === null) {
      markError(row, `Baris ${rn}: nilai alihan '${data.alihan}' tidak valid (gunakan ya/tidak, 1/0, true/false)`);
    }

    let galianAlihanId = null;
    let uangAlihanVal = null;
    if (alihanVal === true) {
      if (!data.nama_galian_alihan || !data.nama_galian_alihan.trim()) {
        markError(row, `Baris ${rn}: nama_galian_alihan wajib diisi karena alihan=ya`);
      } else {
        const result = resolveFieldWithOverrides(row, "nama_galian_alihan", data.nama_galian_alihan, masterCache.galian, "nama_galian");
        row.resolved.nama_galian_alihan = result;
        if (result.status === "fuzzy") {
          markError(row, `Baris ${rn}: nama_galian_alihan '${data.nama_galian_alihan}' tidak ditemukan — mirip dengan '${result.suggestion.nama}'?`);
        } else if (result.status === "notfound") {
          row.can_add_master.nama_galian_alihan = true;
          markError(row, `Baris ${rn}: nama_galian_alihan '${data.nama_galian_alihan}' tidak ditemukan, tidak ada yang mirip`);
        } else if (result.status === "ok") {
          galianAlihanId = result.id;
        }
      }
      if (data.uang_alihan && data.uang_alihan.trim()) {
        const n = normalizeNumberForStorage(data.uang_alihan);
        uangAlihanVal = (typeof n === "number" && !isNaN(n)) ? n : null;
      }
    } else if (alihanVal === false) {
      if ((data.nama_galian_alihan && data.nama_galian_alihan.trim()) || (data.uang_alihan && data.uang_alihan.trim())) {
        markWarningIfOk(row, `Baris ${rn}: nama_galian_alihan/uang_alihan diabaikan karena alihan=tidak`);
      }
    }

    if (buanganKey) {
      if (dbBuanganKeys.has(buanganKey)) {
        markError(row, `Baris ${rn}: No Urut ${noUrutTrim} sudah dipakai untuk order ini`);
      } else if (csvKeyCount.get(buanganKey) > 1) {
        markError(row, `Baris ${rn}: No Urut ${noUrutTrim} duplikat dalam file CSV untuk order ini`);
      }
    }

    row.computed = {
      tanggalBongkarNorm,
      jamBongkarNorm,
      kmAkhirVal,
      jarakVal,
      alihanVal: alihanVal === true,
      galianAlihanId,
      uangAlihanVal,
      orderId: order ? order.id : null,
      noUrut: noUrutTrim,
      keterangan: data.keterangan && data.keterangan.trim() ? data.keterangan.trim() : null,
      lokasiBongkar: data.lokasi_bongkar || null,
    };
    return row;
  });
}

// ============================================================================
// VALIDATOR: MOBIL LUAR
// ============================================================================
function validateMobilLuarRows(dataRows) {
  return dataRows.map((data, idx) => {
    const row = makeRowBase(idx, data);
    const rn = idx + 1;

    let tanggalNorm = null;
    if (data.tanggal_bongkar && data.tanggal_bongkar.trim()) {
      tanggalNorm = parseTanggalCSV(data.tanggal_bongkar);
      if (!tanggalNorm) markError(row, `Baris ${rn}: format tanggal_bongkar '${data.tanggal_bongkar}' tidak valid`);
    }

    let jamNorm = null;
    if (data.jam_bongkar && data.jam_bongkar.trim()) {
      jamNorm = parseJamCSV(data.jam_bongkar);
      if (!jamNorm) markError(row, `Baris ${rn}: format jam_bongkar '${data.jam_bongkar}' tidak valid`);
    }

    let noUrutVal = null;
    if (data.no_urut && data.no_urut.trim()) {
      const n = parseInt(String(data.no_urut).replace(/\./g, ""), 10);
      if (isNaN(n)) markError(row, `Baris ${rn}: no_urut '${data.no_urut}' bukan angka valid`);
      else noUrutVal = n;
    }

    row.computed = { tanggalNorm, jamNorm, noUrutVal };
    return row;
  });
}

// ============================================================================
// DISPATCHER VALIDASI
// ============================================================================
export function runValidation(entitas, dataRows, masterCache, dbIndexes, overridesByIndex) {
  if (MASTER_FIELD_CONFIG[entitas]) {
    return validateMasterRows(entitas, dataRows, masterCache, overridesByIndex);
  }
  if (entitas === "order") return validateOrderRows(dataRows, masterCache, dbIndexes, overridesByIndex);
  if (entitas === "buangan") return validateBuanganRows(dataRows, masterCache, dbIndexes, overridesByIndex);
  if (entitas === "mobil-luar") return validateMobilLuarRows(dataRows);
  throw new Error(`Entitas tidak dikenal: ${entitas}`);
}

// ============================================================================
// RINGKASAN
// ============================================================================
export function computeSummary(rows) {
  const summary = { total: rows.length, valid: 0, error: 0, warning: 0 };
  rows.forEach((row) => {
    if (row.status === "error") summary.error++;
    else if (row.status === "warning") summary.warning++;
    else summary.valid++;
  });
  return summary;
}

export function serializeRow(row) {
  return {
    row_index: row.row_index,
    data: row.data,
    status: row.status,
    messages: row.messages,
    resolved: row.resolved,
    can_add_master: row.can_add_master,
    can_unbatal: row.can_unbatal,
    skip_insert: row.skip_insert,
    computed: row.computed,
  };
}

// ============================================================================
// STAGING BATCH (in-memory, TTL 30 menit)
// ============================================================================
const stagingStore = new Map();

export function createBatch({ entitas, filename, dataRows, masterCache, dbIndexes, extraColumns }) {
  const batch_id = randomUUID();
  const batch = {
    batch_id,
    entitas,
    filename,
    dataRows,
    masterCache,
    dbIndexes,
    extraColumns,
    overrides: {},
    rows: [],
    expiresAt: Date.now() + BATCH_TTL_MS,
  };
  stagingStore.set(batch_id, batch);
  return batch;
}

export function getBatch(batch_id) {
  const batch = stagingStore.get(batch_id);
  if (!batch) return null;
  if (batch.expiresAt < Date.now()) {
    stagingStore.delete(batch_id);
    return null;
  }
  return batch;
}

export function touchBatch(batch) {
  batch.expiresAt = Date.now() + BATCH_TTL_MS;
}

export function deleteBatch(batch_id) {
  stagingStore.delete(batch_id);
}

// Cleanup interval - buang batch yang sudah kedaluwarsa
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [id, batch] of stagingStore) {
    if (batch.expiresAt < now) stagingStore.delete(id);
  }
}, 5 * 60 * 1000);
cleanupInterval.unref();

export function revalidateBatch(batch) {
  batch.rows = runValidation(batch.entitas, batch.dataRows, batch.masterCache, batch.dbIndexes, batch.overrides);
  touchBatch(batch);
}

// Terapkan override manual (use_existing / mark_new) ke satu baris, atau ke
// semua baris dengan nilai field yang sama jika apply_to_all=true
export function applyOverride(batch, rowIndex, field, override, applyToAll) {
  batch.overrides[rowIndex] = batch.overrides[rowIndex] || {};
  batch.overrides[rowIndex][field] = override;

  if (applyToAll) {
    const targetNorm = normalizeForMatch(batch.dataRows[rowIndex][field]);
    batch.dataRows.forEach((d, idx) => {
      if (idx === rowIndex) return;
      if (normalizeForMatch(d[field]) === targetNorm) {
        batch.overrides[idx] = batch.overrides[idx] || {};
        batch.overrides[idx][field] = override;
      }
    });
  }
}

// ============================================================================
// COMMIT: INSERT HANYA BARIS VALID (ok + warning), DALAM 1 TRANSACTION
// ============================================================================
async function insertMasterRow(conn, entitas, row) {
  const config = MASTER_FIELD_CONFIG[entitas];
  const value = String(row.data[config.field]).trim();

  const [existing] = await conn.query(
    `SELECT id FROM ${ENTITY_SCHEMAS[entitas].table} WHERE LOWER(TRIM(${config.key})) = LOWER(?) LIMIT 1`,
    [value]
  );
  if (existing.length > 0) {
    return { skipped: true, reason: `'${value}' sudah ada di database (dibuat oleh proses lain)` };
  }

  if (config.hargaField) {
    await conn.query(
      `INSERT INTO ${ENTITY_SCHEMAS[entitas].table} (${config.key}, ${config.hargaField}) VALUES (?, ?)`,
      [value, row.computed.harga ?? 0]
    );
  } else {
    await conn.query(
      `INSERT INTO ${ENTITY_SCHEMAS[entitas].table} (${config.key}) VALUES (?)`,
      [value]
    );
  }
}

async function insertOrderRow(conn, row, masterCache) {
  const c = row.computed;
  const noOrderTrim = String(row.data.no_order).trim();

  const [existing] = await conn.query(
    `SELECT id FROM orders WHERE tanggal_order = ? AND no_order = ? LIMIT 1`,
    [c.tanggalNorm, noOrderTrim]
  );
  if (existing.length > 0) {
    return { skipped: true, reason: `Order tanggal ${c.tanggalNorm} no_order '${noOrderTrim}' sudah ada di database (dibuat oleh proses lain)` };
  }

  const kendaraanId = row.resolved.no_pintu?.id;
  const supirId = row.resolved.nama_supir?.id;
  const galianId = row.resolved.nama_galian?.id;
  const proyekId = row.resolved.nama_proyek && row.resolved.nama_proyek.status === "ok"
    ? row.resolved.nama_proyek.id : null;

  let proyekHarga = null;
  if (proyekId) {
    const proyekItem = masterCache.proyek.find((p) => p.id === proyekId);
    proyekHarga = proyekItem ? proyekItem.harga : null;
  }

  const hasilAkhir = c.uangJalanVal - c.potonganVal;

  await conn.query(
    `INSERT INTO orders (
      tanggal_order, no_order, petugas_order,
      kendaraan_id, supir_id, galian_id,
      no_do, jam_order, km_awal,
      uang_jalan, potongan, hasil_akhir,
      proyek_id, proyek_harga, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ON PROCESS')`,
    [
      c.tanggalNorm, String(row.data.no_order).trim(), row.data.petugas_order.trim(),
      kendaraanId, supirId, galianId,
      row.data.no_do.trim(), c.jamNorm, c.kmVal,
      c.uangJalanVal, c.potonganVal, hasilAkhir,
      proyekId, proyekHarga,
    ]
  );
}

async function insertBuanganRow(conn, row) {
  const c = row.computed;

  const [orderRows] = await conn.query(`SELECT status FROM orders WHERE id = ? LIMIT 1`, [c.orderId]);
  if (orderRows.length === 0) {
    return { skipped: true, reason: `Order ID ${c.orderId} tidak ditemukan (mungkin sudah dihapus)` };
  }
  if (orderRows[0].status === "BATAL") {
    return { skipped: true, reason: `Order ID ${c.orderId} berstatus BATAL (dibatalkan oleh proses lain)` };
  }

  const [existing] = await conn.query(
    `SELECT id FROM buangan WHERE order_id = ? AND no_urut = ? LIMIT 1`,
    [c.orderId, c.noUrut]
  );
  if (existing.length > 0) {
    return { skipped: true, reason: `No Urut ${c.noUrut} sudah dipakai untuk order ini (dibuat oleh proses lain)` };
  }

  await conn.query(
    `INSERT INTO buangan (
      order_id, tanggal_bongkar, jam_bongkar,
      km_akhir, jarak_km, lokasi_bongkar, alihan, galian_alihan_id,
      keterangan, uang_alihan, no_urut
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      c.orderId, c.tanggalBongkarNorm, c.jamBongkarNorm,
      c.kmAkhirVal, c.jarakVal, c.lokasiBongkar, c.alihanVal, c.galianAlihanId,
      c.keterangan, c.uangAlihanVal, c.noUrut,
    ]
  );

  await conn.query(`UPDATE orders SET status = 'COMPLETE' WHERE id = ?`, [c.orderId]);
}

async function insertMobilLuarRow(conn, row) {
  const c = row.computed;
  const d = row.data;
  const val = (v) => (v && String(v).trim() !== "" ? String(v).trim() : null);

  await conn.query(
    `INSERT INTO mobil_luar (no_urut, pengirim, galian, no_plat, supir, tanggal_bongkar, jam_bongkar, proyek, lokasi_buang)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      c.noUrutVal, val(d.pengirim), val(d.galian), val(d.no_plat), val(d.supir),
      c.tanggalNorm, c.jamNorm, val(d.proyek), val(d.lokasi_buang),
    ]
  );
}

export async function commitBatch(batch) {
  const conn = await db.getConnection();
  const detail = [];
  let berhasil = 0;
  let dilewati = 0;

  try {
    await conn.beginTransaction();

    for (const row of batch.rows) {
      if (row.status === "error" || row.skip_insert) {
        dilewati++;
        detail.push({ row_index: row.row_index, status: row.status, messages: row.messages });
        continue;
      }

      let insertResult;
      if (MASTER_FIELD_CONFIG[batch.entitas]) {
        insertResult = await insertMasterRow(conn, batch.entitas, row);
      } else if (batch.entitas === "order") {
        insertResult = await insertOrderRow(conn, row, batch.masterCache);
      } else if (batch.entitas === "buangan") {
        insertResult = await insertBuanganRow(conn, row);
      } else if (batch.entitas === "mobil-luar") {
        insertResult = await insertMobilLuarRow(conn, row);
      }

      if (insertResult && insertResult.skipped) {
        dilewati++;
        detail.push({ row_index: row.row_index, status: "error", messages: [insertResult.reason] });
      } else {
        berhasil++;
      }
    }

    await conn.commit();
    return { total: batch.rows.length, berhasil, dilewati, detail };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
