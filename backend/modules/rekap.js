// ============================================================================
// REKAP MODULE (rekap order, rekap buangan, rekap gabungan)
// ============================================================================

import express from "express";
import db from "../config/db.js";
import { success, error } from "../utils/response.js";
import { generatePDF } from "../utils/exportPDF.js";
import { generateExcel } from "../utils/exportExcel.js";

const router = express.Router();

// Helper: Format nilai KM - format biasa, 0 tetap 0
function formatKM(value) {
  if (value === null || value === undefined || value === "") {
    return "0";
  }

  if (typeof value === 'string' && (value.indexOf('.') !== -1 || value.indexOf(',') !== -1)) {
    const sep = value.indexOf('.') !== -1 ? '.' : ',';
    const parts = value.split(sep);
    const intPart = parts[0] || '0';
    const decPart = parts[1] || '';
    const intNum = Number(intPart.replace(/\s+/g, ''));
    const formattedInt = isNaN(intNum) ? intPart : intNum.toLocaleString('id-ID');
    return decPart ? `${formattedInt},${decPart}` : formattedInt;
  }

  const numValue = Number(value);
  if (isNaN(numValue)) return value;
  if (Number.isInteger(numValue)) return numValue.toLocaleString('id-ID');

  const parts = numValue.toString().split('.');
  const formattedInt = Number(parts[0]).toLocaleString('id-ID');
  const dec = parts[1] || '';
  return dec ? `${formattedInt},${dec}` : formattedInt;
}

// Helper: Build IN clause for comma-separated IDs
function buildInClause(value, column) {
  const ids = value.split(',').map(id => id.trim()).filter(id => id && id !== 'null' && id !== 'undefined');
  if (ids.length === 0) return null;
  if (ids.length === 1) return { sql: `${column} = ?`, values: [ids[0]] };
  return { sql: `${column} IN (${ids.map(() => '?').join(',')})`, values: ids };
}

// Helper: Build WHERE clause based on filters for ORDER
function buildFilters(req, allowedFields) {
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
      } else if (key === 'status') {
        conditions.push(`LOWER(REPLACE(o.status, ' ', '_')) = LOWER(REPLACE(?, ' ', '_'))`);
        values.push(value);
      } else {
        conditions.push(`o.${key} = ?`);
        values.push(value);
      }
    }
  }

  if (req.query.tanggal_dari && req.query.tanggal_sampai) {
    conditions.push(`o.tanggal_order BETWEEN ? AND ?`);
    values.push(req.query.tanggal_dari, req.query.tanggal_sampai);
  } else if (req.query.tanggal_dari) {
    conditions.push(`o.tanggal_order >= ?`);
    values.push(req.query.tanggal_dari);
  } else if (req.query.tanggal_sampai) {
    conditions.push(`o.tanggal_order <= ?`);
    values.push(req.query.tanggal_sampai);
  }

  return {
    where: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    values
  };
}

// Helper: Build WHERE clause for buangan (DENGAN LOKASI_BONGKAR)
function buildFiltersBuangan(req, allowedFields) {
  const conditions = [];
  const values = [];

  for (const key of allowedFields) {
    const value = req.query[key];
    if (value && value !== '' && value !== 'null' && value !== 'undefined') {
      if (key === 'no_order') {
        conditions.push(`o.no_order = ?`);
        values.push(value);
      } else if (key === 'proyek_id') {
        const clause = buildInClause(value, 'o.proyek_id');
        if (clause) { conditions.push(clause.sql); values.push(...clause.values); }
      } else if (key === 'galian_id') {
        const clause = buildInClause(value, 'o.galian_id');
        if (clause) { conditions.push(clause.sql); values.push(...clause.values); }
      } else if (key === 'no_do') {
        conditions.push(`o.no_do LIKE ?`);
        values.push(`%${value}%`);
      } else {
        conditions.push(`b.${key} = ?`);
        values.push(value);
      }
    }
  }

  if (req.query.tanggal_dari && req.query.tanggal_sampai) {
    conditions.push(`b.tanggal_bongkar BETWEEN ? AND ?`);
    values.push(req.query.tanggal_dari, req.query.tanggal_sampai);
  } else if (req.query.tanggal_dari) {
    conditions.push(`b.tanggal_bongkar >= ?`);
    values.push(req.query.tanggal_dari);
  } else if (req.query.tanggal_sampai) {
    conditions.push(`b.tanggal_bongkar <= ?`);
    values.push(req.query.tanggal_sampai);
  }

  return {
    where: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    values
  };
}

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
// HELPER: Generate Filter Information for Export (ALL TYPES)
// ============================================================================
async function generateFilterInfo(req, type) {
  const filters = {};
  let title = "";
  let filename = "";

  if (type === "order") {
    title = "LAPORAN REKAP ORDER";
    filename = "Rekap_Order";
  } else if (type === "buangan") {
    title = "LAPORAN REKAP BUANGAN";
    filename = "Rekap_Buangan";
  } else if (type === "gabungan") {
    title = "LAPORAN REKAP GABUNGAN";
    filename = "Rekap_Gabungan";
  }

  // Proyek (untuk order dan gabungan) - handle comma-separated IDs
  if (req.query.proyek_id && req.query.proyek_id !== '' && req.query.proyek_id !== '0') {
    const ids = req.query.proyek_id.split(',').map(id => id.trim()).filter(id => id);
    if (ids.length > 0) {
      try {
        const names = [];
        for (const id of ids) {
          const [rows] = await db.query("SELECT nama_proyek FROM master_proyek WHERE id = ?", [id]);
          names.push(rows.length > 0 ? rows[0].nama_proyek : id);
        }
        filters["Proyek"] = names.join(', ');
      } catch (err) {
        filters["Proyek"] = req.query.proyek_id;
      }
    }
  }

  // Galian - handle comma-separated IDs
  if (req.query.galian_id && req.query.galian_id !== '' && req.query.galian_id !== '0') {
    const ids = req.query.galian_id.split(',').map(id => id.trim()).filter(id => id);
    if (ids.length > 0) {
      try {
        const names = [];
        for (const id of ids) {
          const [rows] = await db.query("SELECT nama_galian FROM master_galian WHERE id = ?", [id]);
          names.push(rows.length > 0 ? rows[0].nama_galian : id);
        }
        filters["Galian"] = names.join(', ');
      } catch (err) {
        filters["Galian"] = req.query.galian_id;
      }
    }
  }

  // No DO
  if (req.query.no_do && req.query.no_do.trim() !== '') {
    filters["No DO"] = req.query.no_do;
  }

  // Petugas (untuk order dan gabungan)
  if (req.query.petugas_order && req.query.petugas_order.trim() !== '') {
    filters["Petugas"] = req.query.petugas_order;
  }

  // Lokasi Bongkar (untuk gabungan)
  if (req.query.lokasi_bongkar && req.query.lokasi_bongkar.trim() !== '') {
    filters["Lokasi Bongkar"] = req.query.lokasi_bongkar;
  }

  // Kendaraan (untuk semua)
  if (req.query.kendaraan_id && req.query.kendaraan_id !== '' && req.query.kendaraan_id !== '0') {
    try {
      const [rows] = await db.query("SELECT no_pintu FROM master_kendaraan WHERE id = ?", [req.query.kendaraan_id]);
      filters["Kendaraan"] = rows.length > 0 ? rows[0].no_pintu : req.query.kendaraan_id;
    } catch (err) {
      filters["Kendaraan"] = req.query.kendaraan_id;
    }
  }

  // Supir (untuk order dan gabungan)
  if (req.query.supir_id && req.query.supir_id !== '' && req.query.supir_id !== '0') {
    try {
      const [rows] = await db.query("SELECT nama FROM master_supir WHERE id = ?", [req.query.supir_id]);
      filters["Supir"] = rows.length > 0 ? rows[0].nama : req.query.supir_id;
    } catch (err) {
      filters["Supir"] = req.query.supir_id;
    }
  }

  // Galian Alihan (untuk gabungan)
  if (req.query.galian_alihan_id && req.query.galian_alihan_id !== '' && req.query.galian_alihan_id !== '0') {
    try {
      const [rows] = await db.query("SELECT nama_galian FROM master_galian WHERE id = ?", [req.query.galian_alihan_id]);
      filters["Galian Alihan"] = rows.length > 0 ? rows[0].nama_galian : req.query.galian_alihan_id;
    } catch (err) {
      filters["Galian Alihan"] = req.query.galian_alihan_id;
    }
  }

  // Status (untuk semua)
  if (req.query.status && req.query.status !== '') {
    filters["Status"] = req.query.status.toUpperCase();
  }

  // Alihan (untuk buangan dan gabungan)
  if (req.query.alihan !== undefined && req.query.alihan !== null && req.query.alihan !== '') {
    filters["Alihan"] = req.query.alihan === "1" || req.query.alihan === "true" ? "Ya" : "Tidak";
  }

  // No Order (untuk buangan dan gabungan)
  if (req.query.no_order && req.query.no_order.trim() !== '') {
    filters["No Order"] = req.query.no_order;
  }

  const getTodayDate = () => new Date().toISOString().split('T')[0];
  const get2DaysAgoDate = () => {
    const today = new Date();
    today.setDate(today.getDate() - 2);
    return today.toISOString().split('T')[0];
  };

  if (req.query.tanggal_dari && req.query.tanggal_sampai) {
    const dari = formatDate(req.query.tanggal_dari);
    const sampai = formatDate(req.query.tanggal_sampai);
    const twoDaysAgo = get2DaysAgoDate();
    const today = getTodayDate();
    if (req.query.tanggal_dari === twoDaysAgo && req.query.tanggal_sampai === today) {
      filters["Periode"] = "2 Hari Terakhir";
    } else if (req.query.tanggal_dari === today && req.query.tanggal_sampai === today) {
      filters["Periode"] = "Hari Ini";
    } else {
      filters["Periode"] = `${dari} s/d ${sampai}`;
    }
  } else if (req.query.tanggal_dari) {
    filters["Tanggal Dari"] = formatDate(req.query.tanggal_dari);
  } else if (req.query.tanggal_sampai) {
    filters["Tanggal Sampai"] = formatDate(req.query.tanggal_sampai);
  }

  if (req.query.tanggal_order_dari && req.query.tanggal_order_sampai) {
    const dari = formatDate(req.query.tanggal_order_dari);
    const sampai = formatDate(req.query.tanggal_order_sampai);
    const twoDaysAgo = get2DaysAgoDate();
    const today = getTodayDate();
    if (req.query.tanggal_order_dari === twoDaysAgo && req.query.tanggal_order_sampai === today) {
      filters["Periode Order"] = "2 Hari Terakhir";
    } else if (req.query.tanggal_order_dari === today && req.query.tanggal_order_sampai === today) {
      filters["Periode Order"] = "Hari Ini";
    } else {
      filters["Periode Order"] = `${dari} s/d ${sampai}`;
    }
  } else if (req.query.tanggal_order_dari) {
    filters["Tanggal Order Dari"] = formatDate(req.query.tanggal_order_dari);
  } else if (req.query.tanggal_order_sampai) {
    filters["Tanggal Order Sampai"] = formatDate(req.query.tanggal_order_sampai);
  }

  if (req.query.tanggal_bongkar_dari && req.query.tanggal_bongkar_sampai) {
    const dari = formatDate(req.query.tanggal_bongkar_dari);
    const sampai = formatDate(req.query.tanggal_bongkar_sampai);
    const twoDaysAgo = get2DaysAgoDate();
    const today = getTodayDate();
    if (req.query.tanggal_bongkar_dari === twoDaysAgo && req.query.tanggal_bongkar_sampai === today) {
      filters["Periode Bongkar"] = "2 Hari Terakhir";
    } else if (req.query.tanggal_bongkar_dari === today && req.query.tanggal_bongkar_sampai === today) {
      filters["Periode Bongkar"] = "Hari Ini";
    } else {
      filters["Periode Bongkar"] = `${dari} s/d ${sampai}`;
    }
  } else if (req.query.tanggal_bongkar_dari) {
    filters["Tanggal Bongkar Dari"] = formatDate(req.query.tanggal_bongkar_dari);
  } else if (req.query.tanggal_bongkar_sampai) {
    filters["Tanggal Bongkar Sampai"] = formatDate(req.query.tanggal_bongkar_sampai);
  }

  if (Object.keys(filters).length === 0) {
    filters["Periode"] = "2 Hari Terakhir (Default)";
  }

  return { title, filename, filters };
}

// Helper: Format date to Indonesian format
function formatDate(dateString) {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch (e) {
    return dateString;
  }
}

// ============================================================================
// REKAP ORDER + FILTER (WITH JOIN TO GET NAMES)
// ============================================================================
router.get("/order", async (req, res) => {
  try {
    const { where, values } = buildFilters(req, [
      "proyek_id", "petugas_order", "kendaraan_id", "supir_id", "galian_id", "no_do", "status"
    ]);

    const sql = `
      SELECT
        ROW_NUMBER() OVER (ORDER BY o.tanggal_order DESC, o.id DESC) AS no_urut,
        o.id,
        o.tanggal_order,
        o.no_order,
        o.petugas_order,
        k.no_pintu AS kendaraan_nama,
        s.nama AS supir_nama,
        g.nama_galian AS galian_nama,
        o.no_do,
        o.jam_order,
        o.km_awal,
        o.uang_jalan,
        o.potongan,
        o.hasil_akhir,
        COALESCE(p.nama_proyek, o.proyek_input) AS proyek_display,
        o.proyek_id,
        o.proyek_harga,
        o.status,
        b.keterangan AS keterangan_buangan
      FROM orders o
      LEFT JOIN master_kendaraan k ON o.kendaraan_id = k.id
      LEFT JOIN master_supir s ON o.supir_id = s.id
      LEFT JOIN master_galian g ON o.galian_id = g.id
      LEFT JOIN master_proyek p ON o.proyek_id = p.id
      LEFT JOIN buangan b ON o.id = b.order_id
      ${where}
      ORDER BY o.tanggal_order DESC, o.id DESC
    `;

    const rows = await db.query(sql, values);
    const formattedRows = rows[0].map(row => ({ ...row, km_awal: formatKM(row.km_awal) }));
    return success(res, "Berhasil mengambil rekap order", formattedRows);
  } catch (err) {
    console.error("Error in /rekap/order:", err);
    return error(res, 500, "Gagal mengambil rekap order", err);
  }
});

// ============================================================================
// REKAP ORDER - GET SINGLE ORDER BY ID
// ============================================================================
router.get("/order/:id", async (req, res) => {
  try {
    const orderId = req.params.id;

    const sql = `
      SELECT
        o.id,
        o.tanggal_order,
        o.no_order,
        o.petugas_order,
        o.kendaraan_id,
        k.no_pintu AS kendaraan_nama,
        o.supir_id,
        s.nama AS supir_nama,
        o.galian_id,
        g.nama_galian AS galian_nama,
        o.no_do,
        o.jam_order,
        o.km_awal,
        o.uang_jalan,
        o.potongan,
        o.hasil_akhir,
        COALESCE(p.nama_proyek, o.proyek_input) AS proyek_display,
        o.proyek_id,
        o.proyek_harga,
        o.status
      FROM orders o
      LEFT JOIN master_kendaraan k ON o.kendaraan_id = k.id
      LEFT JOIN master_supir s ON o.supir_id = s.id
      LEFT JOIN master_galian g ON o.galian_id = g.id
      LEFT JOIN master_proyek p ON o.proyek_id = p.id
      WHERE o.id = ?
    `;

    const rows = await db.query(sql, [orderId]);
    if (!rows[0] || rows[0].length === 0) return error(res, 404, "Order tidak ditemukan");

    const formattedRow = { ...rows[0][0], km_awal: formatKM(rows[0][0].km_awal) };
    return success(res, "Berhasil mengambil detail order", formattedRow);
  } catch (err) {
    console.error("Error in /rekap/order/:id:", err);
    return error(res, 500, "Gagal mengambil detail order", err);
  }
});

// ============================================================================
// REKAP ORDER - GET BUANGAN BY ORDER ID
// ============================================================================
router.get("/buangan/by-order/:orderId", async (req, res) => {
  try {
    const orderId = req.params.orderId;

    const sql = `
      SELECT
        b.id,
        b.order_id,
        b.tanggal_bongkar,
        b.jam_bongkar,
        b.lokasi_bongkar,
        b.km_akhir,
        b.jarak_km,
        b.alihan,
        b.galian_alihan_id,
        g.nama_galian AS galian_alihan_nama,
        b.keterangan,
        b.uang_alihan,
        b.no_urut
      FROM buangan b
      LEFT JOIN master_galian g ON b.galian_alihan_id = g.id
      WHERE b.order_id = ?
      ORDER BY b.no_urut ASC
    `;

    const rows = await db.query(sql, [orderId]);
    const formattedRows = rows[0].map(row => ({
      ...row,
      km_akhir: formatKM(row.km_akhir),
      jarak_km: formatKM(row.jarak_km)
    }));
    return success(res, "Berhasil mengambil data buangan", formattedRows);
  } catch (err) {
    console.error("Error in /rekap/buangan/by-order/:orderId:", err);
    return error(res, 500, "Gagal mengambil data buangan", err);
  }
});

// ============================================================================
// REKAP ORDER - EXPORT EXCEL
// ============================================================================
router.get("/order/export/excel", async (req, res) => {
  try {
    const { where, values } = buildFilters(req, [
      "proyek_id", "petugas_order", "kendaraan_id", "supir_id", "galian_id", "no_do", "status"
    ]);

    const sql = `
      SELECT
        ROW_NUMBER() OVER (ORDER BY o.tanggal_order DESC, o.id DESC) AS no,
        o.tanggal_order,
        o.no_order,
        o.petugas_order,
        k.no_pintu AS kendaraan_nama,
        s.nama AS supir_nama,
        g.nama_galian AS galian_nama,
        o.no_do,
        o.jam_order,
        o.km_awal,
        o.uang_jalan,
        o.potongan,
        o.hasil_akhir,
        COALESCE(p.nama_proyek, o.proyek_input) AS proyek_display,
        o.proyek_harga,
        b.keterangan AS keterangan_buangan,
        o.status
      FROM orders o
      LEFT JOIN master_kendaraan k ON o.kendaraan_id = k.id
      LEFT JOIN master_supir s ON o.supir_id = s.id
      LEFT JOIN master_galian g ON o.galian_id = g.id
      LEFT JOIN master_proyek p ON o.proyek_id = p.id
      LEFT JOIN buangan b ON o.id = b.order_id
      ${where}
      ORDER BY o.tanggal_order DESC, o.id DESC
    `;

    const rows = await db.query(sql, values);
    const formattedRows = rows[0].map(row => ({ ...row, km_awal: formatKM(row.km_awal) }));

    const headers = [
      { label: "No", key: "no", width: 8 },
      { label: "Tanggal Order", key: "tanggal_order", width: 15 },
      { label: "No Order", key: "no_order", width: 18 },
      { label: "Petugas", key: "petugas_order", width: 20 },
      { label: "Kendaraan", key: "kendaraan_nama", width: 15 },
      { label: "Supir", key: "supir_nama", width: 20 },
      { label: "Galian", key: "galian_nama", width: 20 },
      { label: "No DO", key: "no_do", width: 15 },
      { label: "Jam Order", key: "jam_order", width: 12 },
      { label: "KM Awal", key: "km_awal", width: 12 },
      { label: "Uang Jalan", key: "uang_jalan", width: 15 },
      { label: "Potongan", key: "potongan", width: 15 },
      { label: "Hasil Akhir", key: "hasil_akhir", width: 15 },
      { label: "Proyek", key: "proyek_display", width: 25 },
      { label: "Harga Proyek", key: "proyek_harga", width: 18 },
      { label: "Keterangan", key: "keterangan_buangan", width: 25 },
      { label: "Status", key: "status", width: 15 }
    ];

    const filterInfo = await generateFilterInfo(req, "order");
    await generateExcel("Rekap_Order", headers, formattedRows, filterInfo, res);
  } catch (err) {
    console.error("Error in /rekap/order/export/excel:", err);
    return error(res, 500, "Gagal export Excel", err);
  }
});

// ============================================================================
// REKAP ORDER - EXPORT PDF
// ============================================================================
router.get("/order/export/pdf", async (req, res) => {
  try {
    const { where, values } = buildFilters(req, [
      "proyek_id", "petugas_order", "kendaraan_id", "supir_id", "galian_id", "no_do", "status"
    ]);

    const sql = `
      SELECT
        ROW_NUMBER() OVER (ORDER BY o.tanggal_order DESC, o.id DESC) AS no,
        o.tanggal_order,
        o.no_order,
        o.petugas_order,
        k.no_pintu AS kendaraan_nama,
        s.nama AS supir_nama,
        g.nama_galian AS galian_nama,
        o.no_do,
        o.jam_order,
        o.km_awal,
        o.uang_jalan,
        o.potongan,
        o.hasil_akhir,
        COALESCE(p.nama_proyek, o.proyek_input) AS proyek_display,
        b.keterangan AS keterangan_buangan,
        o.status
      FROM orders o
      LEFT JOIN master_kendaraan k ON o.kendaraan_id = k.id
      LEFT JOIN master_supir s ON o.supir_id = s.id
      LEFT JOIN master_galian g ON o.galian_id = g.id
      LEFT JOIN master_proyek p ON o.proyek_id = p.id
      LEFT JOIN buangan b ON o.id = b.order_id
      ${where}
      ORDER BY o.tanggal_order DESC, o.id DESC
    `;

    const rows = await db.query(sql, values);
    const formattedRows = rows[0].map(row => ({ ...row, km_awal: formatKM(row.km_awal) }));

    const filterInfo = await generateFilterInfo(req, "order");
    generatePDF("LAPORAN REKAP ORDER", formattedRows, filterInfo, res);
  } catch (err) {
    console.error("Error in /rekap/order/export/pdf:", err);
    return error(res, 500, "Gagal export PDF", err);
  }
});

// ============================================================================
// REKAP BUANGAN + FILTER (DENGAN LOKASI_BONGKAR)
// ============================================================================
router.get("/buangan", async (req, res) => {
  try {
    const { where, values } = buildFiltersBuangan(req, [
      "no_order", "alihan", "proyek_id", "galian_id", "no_do"
    ]);

    const sql = `
      SELECT
        ROW_NUMBER() OVER (ORDER BY b.tanggal_bongkar DESC, b.id DESC) AS no_urut,
        o.tanggal_order,
        o.no_order,
        b.tanggal_bongkar,
        b.jam_bongkar,
        b.km_akhir,
        b.jarak_km,
        b.lokasi_bongkar,
        b.alihan,
        b.galian_alihan_id,
        g.nama_galian AS galian_alihan_nama,
        b.keterangan,
        b.uang_alihan,
        b.no_urut AS urut_buangan
      FROM buangan b
      LEFT JOIN orders o ON b.order_id = o.id
      LEFT JOIN master_galian g ON b.galian_alihan_id = g.id
      ${where}
      ORDER BY b.tanggal_bongkar DESC, b.id DESC
    `;

    const rows = await db.query(sql, values);
    const formattedRows = rows[0].map(row => ({
      ...row,
      km_akhir: formatKM(row.km_akhir),
      jarak_km: formatKM(row.jarak_km)
    }));
    return success(res, "Berhasil mengambil rekap buangan", formattedRows);
  } catch (err) {
    console.error("Error in /rekap/buangan:", err);
    return error(res, 500, "Gagal mengambil rekap buangan", err);
  }
});

// ============================================================================
// REKAP BUANGAN - EXPORT EXCEL
// ============================================================================
router.get("/buangan/export/excel", async (req, res) => {
  try {
    const { where, values } = buildFiltersBuangan(req, [
      "no_order", "alihan", "proyek_id", "galian_id", "no_do"
    ]);

    const sql = `
      SELECT
        ROW_NUMBER() OVER (ORDER BY b.tanggal_bongkar DESC, b.id DESC) AS no,
        o.tanggal_order,
        o.no_order,
        b.tanggal_bongkar,
        b.jam_bongkar,
        b.km_akhir,
        b.jarak_km,
        b.lokasi_bongkar,
        b.alihan,
        g.nama_galian AS galian_alihan_nama,
        b.keterangan,
        b.uang_alihan,
        b.no_urut
      FROM buangan b
      LEFT JOIN orders o ON b.order_id = o.id
      LEFT JOIN master_galian g ON b.galian_alihan_id = g.id
      ${where}
      ORDER BY b.tanggal_bongkar DESC, b.id DESC
    `;

    const rows = await db.query(sql, values);
    const formattedRows = rows[0].map(row => ({
      ...row,
      km_akhir: formatKM(row.km_akhir),
      jarak_km: formatKM(row.jarak_km)
    }));

    const headers = [
      { label: "No", key: "no", width: 8 },
      { label: "Tanggal Order", key: "tanggal_order", width: 15 },
      { label: "No Order", key: "no_order", width: 18 },
      { label: "Tgl Bongkar", key: "tanggal_bongkar", width: 15 },
      { label: "Jam Bongkar", key: "jam_bongkar", width: 12 },
      { label: "KM Akhir", key: "km_akhir", width: 12 },
      { label: "Jarak KM", key: "jarak_km", width: 12 },
      { label: "Buangan (Lokasi)", key: "lokasi_bongkar", width: 22 },
      { label: "Alihan", key: "alihan", width: 10 },
      { label: "Galian Alihan", key: "galian_alihan_nama", width: 20 },
      { label: "Keterangan", key: "keterangan", width: 30 },
      { label: "Uang Alihan", key: "uang_alihan", width: 15 },
      { label: "No Urut", key: "no_urut", width: 10 }
    ];

    const filterInfo = await generateFilterInfo(req, "buangan");
    await generateExcel("Rekap_Buangan", headers, formattedRows, filterInfo, res);
  } catch (err) {
    console.error("Error in /rekap/buangan/export/excel:", err);
    return error(res, 500, "Gagal export Excel", err);
  }
});

// ============================================================================
// REKAP BUANGAN - EXPORT PDF
// ============================================================================
router.get("/buangan/export/pdf", async (req, res) => {
  try {
    const { where, values } = buildFiltersBuangan(req, [
      "no_order", "alihan", "proyek_id", "galian_id", "no_do"
    ]);

    const sql = `
      SELECT
        ROW_NUMBER() OVER (ORDER BY b.tanggal_bongkar DESC, b.id DESC) AS no,
        o.tanggal_order,
        o.no_order,
        b.tanggal_bongkar,
        b.jam_bongkar,
        b.km_akhir,
        b.jarak_km,
        b.lokasi_bongkar,
        b.alihan,
        g.nama_galian AS galian_alihan_nama,
        b.keterangan,
        b.uang_alihan,
        b.no_urut
      FROM buangan b
      LEFT JOIN orders o ON b.order_id = o.id
      LEFT JOIN master_galian g ON b.galian_alihan_id = g.id
      ${where}
      ORDER BY b.tanggal_bongkar DESC, b.id DESC
    `;

    const rows = await db.query(sql, values);
    const formattedRows = rows[0].map(row => ({
      ...row,
      km_akhir: formatKM(row.km_akhir),
      jarak_km: formatKM(row.jarak_km)
    }));

    const filterInfo = await generateFilterInfo(req, "buangan");
    generatePDF("LAPORAN REKAP BUANGAN", formattedRows, filterInfo, res);
  } catch (err) {
    console.error("Error in /rekap/buangan/export/pdf:", err);
    return error(res, 500, "Gagal export PDF", err);
  }
});

// ============================================================================
// REKAP GABUNGAN + FILTER (DENGAN LOKASI_BONGKAR sebagai "buangan")
// ============================================================================
router.get("/gabungan", async (req, res) => {
  try {
    const { where, values } = buildFiltersGabungan(req, [
      "proyek_id", "lokasi_bongkar", "no_do", "kendaraan_id", "galian_id",
      "galian_alihan_id", "alihan", "status"
    ]);

    const sql = `
      SELECT
        ROW_NUMBER() OVER (ORDER BY o.tanggal_order DESC, o.id DESC, b.id DESC) AS no_urut,
        o.no_order,
        o.tanggal_order,
        o.petugas_order AS petugas,
        g.nama_galian AS galian,
        g2.nama_galian AS galian_alihan,
        o.no_do,
        k.no_pintu AS kendaraan,
        s.nama AS supir,
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
        b.uang_alihan,
        b.keterangan,
        o.status
      FROM orders o
      LEFT JOIN buangan b ON o.id = b.order_id
      LEFT JOIN master_kendaraan k ON o.kendaraan_id = k.id
      LEFT JOIN master_supir s ON o.supir_id = s.id
      LEFT JOIN master_galian g ON o.galian_id = g.id
      LEFT JOIN master_galian g2 ON b.galian_alihan_id = g2.id
      LEFT JOIN master_proyek p ON o.proyek_id = p.id
      ${where}
      ORDER BY o.tanggal_order DESC, o.id DESC, b.id DESC
    `;

    const rows = await db.query(sql, values);
    const formattedRows = rows[0].map(row => ({
      ...row,
      km_awal: formatKM(row.km_awal),
      km_akhir: formatKM(row.km_akhir),
      jarak_km: formatKM(row.jarak_km)
    }));
    return success(res, "Berhasil mengambil rekap gabungan", formattedRows);
  } catch (err) {
    console.error("Error in /rekap/gabungan:", err);
    return error(res, 500, "Gagal mengambil rekap gabungan", err);
  }
});

// ============================================================================
// REKAP GABUNGAN - EXPORT EXCEL
// ============================================================================
router.get("/gabungan/export/excel", async (req, res) => {
  try {
    const { where, values } = buildFiltersGabungan(req, [
      "proyek_id", "lokasi_bongkar", "no_do", "kendaraan_id", "galian_id",
      "galian_alihan_id", "alihan", "status"
    ]);

    const sql = `
      SELECT
        ROW_NUMBER() OVER (ORDER BY o.tanggal_order DESC, o.id DESC, b.id DESC) AS no,
        o.no_order,
        o.tanggal_order,
        o.petugas_order AS petugas,
        g.nama_galian AS galian,
        g2.nama_galian AS galian_alihan,
        o.no_do,
        k.no_pintu AS kendaraan,
        s.nama AS supir,
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
        b.uang_alihan,
        b.keterangan,
        o.status
      FROM orders o
      LEFT JOIN buangan b ON o.id = b.order_id
      LEFT JOIN master_kendaraan k ON o.kendaraan_id = k.id
      LEFT JOIN master_supir s ON o.supir_id = s.id
      LEFT JOIN master_galian g ON o.galian_id = g.id
      LEFT JOIN master_galian g2 ON b.galian_alihan_id = g2.id
      LEFT JOIN master_proyek p ON o.proyek_id = p.id
      ${where}
      ORDER BY o.tanggal_order DESC, o.id DESC, b.id DESC
    `;

    const rows = await db.query(sql, values);
    const formattedRows = rows[0].map(row => ({
      ...row,
      km_awal: formatKM(row.km_awal),
      km_akhir: formatKM(row.km_akhir),
      jarak_km: formatKM(row.jarak_km)
    }));

    const stats = {
      total: parseInt(req.query.stats_total) || 0,
      complete: parseInt(req.query.stats_complete) || 0,
      process: parseInt(req.query.stats_process) || 0,
      batal: parseInt(req.query.stats_batal) || 0
    };

    const headers = [
      { label: "No", key: "no", width: 8 },
      { label: "No Order", key: "no_order", width: 15 },
      { label: "Tgl Order", key: "tanggal_order", width: 12 },
      { label: "Petugas", key: "petugas", width: 15 },
      { label: "Galian", key: "galian", width: 15 },
      { label: "Galian Alihan", key: "galian_alihan", width: 15 },
      { label: "No DO", key: "no_do", width: 12 },
      { label: "Kendaraan", key: "kendaraan", width: 15 },
      { label: "Supir", key: "supir", width: 15 },
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
      { label: "Uang Alihan", key: "uang_alihan", width: 12 },
      { label: "Keterangan", key: "keterangan", width: 20 },
      { label: "Status", key: "status", width: 10 }
    ];

    const filterInfo = await generateFilterInfo(req, "gabungan");
    filterInfo.stats = stats;
    await generateExcel("Rekap_Gabungan", headers, formattedRows, filterInfo, res);
  } catch (err) {
    console.error("Error in /rekap/gabungan/export/excel:", err);
    return error(res, 500, "Gagal export Excel", err);
  }
});

// ============================================================================
// REKAP GABUNGAN - EXPORT PDF
// ============================================================================
router.get("/gabungan/export/pdf", async (req, res) => {
  try {
    const { where, values } = buildFiltersGabungan(req, [
      "proyek_id", "lokasi_bongkar", "no_do", "kendaraan_id", "galian_id",
      "galian_alihan_id", "alihan", "status"
    ]);

    const sql = `
      SELECT
        ROW_NUMBER() OVER (ORDER BY o.tanggal_order DESC, o.id DESC, b.id DESC) AS no,
        o.no_order,
        o.tanggal_order,
        o.petugas_order AS petugas,
        g.nama_galian AS galian,
        g2.nama_galian AS galian_alihan,
        o.no_do,
        k.no_pintu AS kendaraan,
        s.nama AS supir,
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
        b.uang_alihan,
        b.keterangan,
        o.status
      FROM orders o
      LEFT JOIN buangan b ON o.id = b.order_id
      LEFT JOIN master_kendaraan k ON o.kendaraan_id = k.id
      LEFT JOIN master_supir s ON o.supir_id = s.id
      LEFT JOIN master_galian g ON o.galian_id = g.id
      LEFT JOIN master_galian g2 ON b.galian_alihan_id = g2.id
      LEFT JOIN master_proyek p ON o.proyek_id = p.id
      ${where}
      ORDER BY o.tanggal_order DESC, o.id DESC, b.id DESC
    `;

    const rows = await db.query(sql, values);
    const formattedRows = rows[0].map(row => ({
      ...row,
      km_awal: formatKM(row.km_awal),
      km_akhir: formatKM(row.km_akhir),
      jarak_km: formatKM(row.jarak_km)
    }));

    const stats = {
      total: parseInt(req.query.stats_total) || 0,
      complete: parseInt(req.query.stats_complete) || 0,
      process: parseInt(req.query.stats_process) || 0,
      batal: parseInt(req.query.stats_batal) || 0
    };

    const filterInfo = await generateFilterInfo(req, "gabungan");
    filterInfo.stats = stats;
    generatePDF("LAPORAN REKAP GABUNGAN", formattedRows, filterInfo, res);
  } catch (err) {
    console.error("Error in /rekap/gabungan/export/pdf:", err);
    return error(res, 500, "Gagal export PDF", err);
  }
});

// ============================================================================
// GET USED GALIAN ALIHAN
// ============================================================================
router.get("/galian-alihan-used", async (req, res) => {
  try {
    const sql = `
      SELECT DISTINCT g.id, g.nama_galian
      FROM buangan b
      INNER JOIN master_galian g ON b.galian_alihan_id = g.id
      WHERE b.alihan = 1 AND b.galian_alihan_id IS NOT NULL
      ORDER BY g.nama_galian ASC
    `;
    const rows = await db.query(sql);
    return success(res, "Berhasil mengambil galian alihan yang digunakan", rows[0]);
  } catch (err) {
    console.error("Error in /rekap/galian-alihan-used:", err);
    return error(res, 500, "Gagal mengambil galian alihan yang digunakan", err);
  }
});

// ============================================================================
// GET DISTINCT NO_DO LIST (for datalist autocomplete)
// ============================================================================
router.get("/no-do-list", async (req, res) => {
  try {
    const sql = `SELECT DISTINCT no_do FROM orders WHERE no_do IS NOT NULL AND no_do != '' ORDER BY no_do LIMIT 200`;
    const [rows] = await db.query(sql);
    return success(res, "Berhasil", rows.map(r => r.no_do));
  } catch (err) {
    console.error("Error in /rekap/no-do-list:", err);
    return error(res, 500, "Gagal", err);
  }
});

export default router;
