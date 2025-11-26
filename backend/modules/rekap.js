// ============================================================================
// REKAP MODULE (rekap order, rekap buangan, rekap gabungan)
// ============================================================================

import express from "express";
import db from "../config/db.js";
import { success, error } from "../utils/response.js";
import { generatePDF } from "../utils/exportPDF.js";
import { generateExcel } from "../utils/exportExcel.js";

const router = express.Router();

// Helper: Build WHERE clause based on filters for ORDER
function buildFilters(req, allowedFields) {
  const conditions = [];
  const values = [];

  for (const key of allowedFields) {
    const value = req.query[key];
    // Only add filter if value exists and is not empty string
    if (value && value !== '' && value !== 'null' && value !== 'undefined') {
      conditions.push(`o.${key} = ?`);
      values.push(value);
    }
  }

  // Handle date range filter for orders
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

  console.log('Build filters - Conditions:', conditions);
  console.log('Build filters - Values:', values);

  return {
    where: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    values
  };
}

// Helper: Build WHERE clause for buangan
function buildFiltersBuangan(req, allowedFields) {
  const conditions = [];
  const values = [];

  for (const key of allowedFields) {
    const value = req.query[key];
    // Only add filter if value exists and is not empty string
    if (value && value !== '' && value !== 'null' && value !== 'undefined') {
      conditions.push(`b.${key} = ?`);
      values.push(value);
    }
  }

  // Handle date range filter for buangan
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

  console.log('Build filters buangan - Conditions:', conditions);
  console.log('Build filters buangan - Values:', values);

  return {
    where: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    values
  };
}

// ============================================================================
// REKAP ORDER + FILTER (WITH JOIN TO GET NAMES)
// ============================================================================
router.get("/order", async (req, res) => {
  try {
    const { where, values } = buildFilters(req, [
      "proyek_input",
      "petugas_order",
      "kendaraan_id",
      "supir_id",
      "galian_id"
    ]);

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
        o.proyek_input,
        o.status
      FROM orders o
      LEFT JOIN master_kendaraan k ON o.kendaraan_id = k.id
      LEFT JOIN master_supir s ON o.supir_id = s.id
      LEFT JOIN master_galian g ON o.galian_id = g.id
      ${where}
      ORDER BY o.id DESC
    `;

    const rows = await db.query(sql, values);
    return success(res, "Berhasil mengambil rekap order", rows[0]);
  } catch (err) {
    console.error("Error in /rekap/order:", err);
    return error(res, 500, "Gagal mengambil rekap order", err);
  }
});

// ============================================================================
// REKAP ORDER - EXPORT EXCEL (WITH NAMES)
// ============================================================================
router.get("/order/export/excel", async (req, res) => {
  try {
    const { where, values } = buildFilters(req, [
      "proyek_input",
      "petugas_order",
      "kendaraan_id",
      "supir_id",
      "galian_id"
    ]);

    const sql = `
      SELECT
        o.id,
        o.tanggal_order,
        o.no_order,
        o.petugas_order,
        k.no_pintu AS kendaraan,
        s.nama AS supir,
        g.nama_galian AS galian,
        o.no_do,
        o.jam_order,
        o.km_awal,
        o.uang_jalan,
        o.potongan,
        o.hasil_akhir,
        o.proyek_input,
        o.status
      FROM orders o
      LEFT JOIN master_kendaraan k ON o.kendaraan_id = k.id
      LEFT JOIN master_supir s ON o.supir_id = s.id
      LEFT JOIN master_galian g ON o.galian_id = g.id
      ${where}
      ORDER BY o.id DESC
    `;

    const rows = await db.query(sql, values);

    const headers = [
      { label: "ID", key: "id", width: 10 },
      { label: "Tanggal Order", key: "tanggal_order", width: 15 },
      { label: "No Order", key: "no_order", width: 20 },
      { label: "Petugas", key: "petugas_order", width: 20 },
      { label: "Kendaraan", key: "kendaraan", width: 15 },
      { label: "Supir", key: "supir", width: 20 },
      { label: "Galian", key: "galian", width: 20 },
      { label: "No DO", key: "no_do", width: 20 },
      { label: "Jam Order", key: "jam_order", width: 12 },
      { label: "KM Awal", key: "km_awal", width: 12 },
      { label: "Uang Jalan", key: "uang_jalan", width: 15 },
      { label: "Potongan", key: "potongan", width: 15 },
      { label: "Hasil Akhir", key: "hasil_akhir", width: 15 },
      { label: "Proyek", key: "proyek_input", width: 25 },
      { label: "Status", key: "status", width: 15 }
    ];

    await generateExcel("Rekap_Order", headers, rows[0], res);
  } catch (err) {
    console.error("Error in /rekap/order/export/excel:", err);
    return error(res, 500, "Gagal export Excel", err);
  }
});

// ============================================================================
// REKAP ORDER - EXPORT PDF (WITH NAMES)
// ============================================================================
router.get("/order/export/pdf", async (req, res) => {
  try {
    const { where, values } = buildFilters(req, [
      "proyek_input",
      "petugas_order",
      "kendaraan_id",
      "supir_id",
      "galian_id"
    ]);

    const sql = `
      SELECT
        o.id,
        o.tanggal_order,
        o.no_order,
        o.petugas_order,
        k.no_pintu AS kendaraan,
        s.nama AS supir,
        g.nama_galian AS galian,
        o.no_do,
        o.jam_order,
        o.km_awal,
        o.uang_jalan,
        o.potongan,
        o.hasil_akhir,
        o.proyek_input,
        o.status
      FROM orders o
      LEFT JOIN master_kendaraan k ON o.kendaraan_id = k.id
      LEFT JOIN master_supir s ON o.supir_id = s.id
      LEFT JOIN master_galian g ON o.galian_id = g.id
      ${where}
      ORDER BY o.id DESC
    `;

    const rows = await db.query(sql, values);
    generatePDF("Rekap Order", rows[0], res);
  } catch (err) {
    console.error("Error in /rekap/order/export/pdf:", err);
    return error(res, 500, "Gagal export PDF", err);
  }
});

// ============================================================================
// REKAP BUANGAN + FILTER (WITH JOIN FOR GALIAN ALIHAN)
// ============================================================================
router.get("/buangan", async (req, res) => {
  try {
    const { where, values } = buildFiltersBuangan(req, [
      "order_id"
    ]);

    const sql = `
      SELECT
        b.id,
        b.order_id,
        b.tanggal_bongkar,
        b.jam_bongkar,
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
      ${where}
      ORDER BY b.id DESC
    `;

    const rows = await db.query(sql, values);
    return success(res, "Berhasil mengambil rekap buangan", rows[0]);
  } catch (err) {
    console.error("Error in /rekap/buangan:", err);
    return error(res, 500, "Gagal mengambil rekap buangan", err);
  }
});

// ============================================================================
// REKAP BUANGAN - EXPORT EXCEL (WITH GALIAN NAME)
// ============================================================================
router.get("/buangan/export/excel", async (req, res) => {
  try {
    const { where, values } = buildFiltersBuangan(req, [
      "order_id"
    ]);

    const sql = `
      SELECT
        b.id,
        b.order_id,
        b.tanggal_bongkar,
        b.jam_bongkar,
        b.km_akhir,
        b.jarak_km,
        b.alihan,
        g.nama_galian AS galian_alihan,
        b.keterangan,
        b.uang_alihan,
        b.no_urut
      FROM buangan b
      LEFT JOIN master_galian g ON b.galian_alihan_id = g.id
      ${where}
      ORDER BY b.id DESC
    `;

    const rows = await db.query(sql, values);

    const headers = [
      { label: "ID", key: "id", width: 10 },
      { label: "Order ID", key: "order_id", width: 12 },
      { label: "Tgl Bongkar", key: "tanggal_bongkar", width: 15 },
      { label: "Jam Bongkar", key: "jam_bongkar", width: 12 },
      { label: "KM Akhir", key: "km_akhir", width: 12 },
      { label: "Jarak KM", key: "jarak_km", width: 12 },
      { label: "Alihan", key: "alihan", width: 10 },
      { label: "Galian Alihan", key: "galian_alihan", width: 20 },
      { label: "Keterangan", key: "keterangan", width: 25 },
      { label: "Uang Alihan", key: "uang_alihan", width: 15 },
      { label: "No Urut", key: "no_urut", width: 12 }
    ];

    await generateExcel("Rekap_Buangan", headers, rows[0], res);
  } catch (err) {
    console.error("Error in /rekap/buangan/export/excel:", err);
    return error(res, 500, "Gagal export Excel", err);
  }
});

// ============================================================================
// REKAP BUANGAN - EXPORT PDF (WITH GALIAN NAME)
// ============================================================================
router.get("/buangan/export/pdf", async (req, res) => {
  try {
    const { where, values } = buildFiltersBuangan(req, [
      "order_id"
    ]);

    const sql = `
      SELECT
        b.id,
        b.order_id,
        b.tanggal_bongkar,
        b.jam_bongkar,
        b.km_akhir,
        b.jarak_km,
        b.alihan,
        g.nama_galian AS galian_alihan,
        b.keterangan,
        b.uang_alihan,
        b.no_urut
      FROM buangan b
      LEFT JOIN galian g ON b.galian_alihan_id = g.id
      ${where}
      ORDER BY b.id DESC
    `;

    const rows = await db.query(sql, values);
    generatePDF("Rekap Buangan", rows[0], res);
  } catch (err) {
    console.error("Error in /rekap/buangan/export/pdf:", err);
    return error(res, 500, "Gagal export PDF", err);
  }
});

// ============================================================================
// REKAP GABUNGAN + FILTER (WITH JOINS)
// ============================================================================
router.get("/gabungan", async (req, res) => {
  try {
    const { where, values } = buildFilters(req, [
      "proyek_input",
      "kendaraan_id",
      "supir_id",
      "galian_id"
    ]);

    const sql = `
      SELECT
        o.id AS order_id,
        o.proyek_input,
        o.tanggal_order,
        o.no_order,
        o.petugas_order,
        k.no_pintu AS kendaraan,
        s.nama AS supir,
        g.nama_galian AS galian,
        o.hasil_akhir,
        COUNT(b.id) AS total_ritasi,
        COALESCE(SUM(b.km_akhir), 0) AS total_tonase,
        o.hasil_akhir AS nilai_bayaran
      FROM orders o
      LEFT JOIN buangan b ON o.id = b.order_id
      LEFT JOIN kendaraan k ON o.kendaraan_id = k.id
      LEFT JOIN supir s ON o.supir_id = s.id
      LEFT JOIN galian g ON o.galian_id = g.id
      ${where}
      GROUP BY o.id
      ORDER BY o.id DESC
    `;

    const rows = await db.query(sql, values);
    return success(res, "Berhasil mengambil rekap gabungan", rows[0]);
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
    const { where, values } = buildFilters(req, [
      "proyek_input",
      "kendaraan_id",
      "supir_id",
      "galian_id"
    ]);

    const sql = `
      SELECT
        o.id AS order_id,
        o.proyek_input,
        o.tanggal_order,
        o.no_order,
        o.petugas_order,
        k.no_pintu AS kendaraan,
        s.nama AS supir,
        g.nama_galian AS galian,
        o.hasil_akhir,
        COUNT(b.id) AS total_ritasi,
        COALESCE(SUM(b.km_akhir), 0) AS total_tonase,
        o.hasil_akhir AS nilai_bayaran
      FROM orders o
      LEFT JOIN buangan b ON o.id = b.order_id
      LEFT JOIN kendaraan k ON o.kendaraan_id = k.id
      LEFT JOIN supir s ON o.supir_id = s.id
      LEFT JOIN galian g ON o.galian_id = g.id
      ${where}
      GROUP BY o.id
      ORDER BY o.id DESC
    `;

    const rows = await db.query(sql, values);

    const headers = [
      { label: "Order ID", key: "order_id", width: 12 },
      { label: "Proyek", key: "proyek_input", width: 25 },
      { label: "Tanggal", key: "tanggal_order", width: 15 },
      { label: "No Order", key: "no_order", width: 20 },
      { label: "Petugas", key: "petugas_order", width: 20 },
      { label: "Kendaraan", key: "kendaraan", width: 15 },
      { label: "Supir", key: "supir", width: 20 },
      { label: "Galian", key: "galian", width: 20 },
      { label: "Total Ritasi", key: "total_ritasi", width: 15 },
      { label: "Total Tonase", key: "total_tonase", width: 15 },
      { label: "Nilai Bayaran", key: "nilai_bayaran", width: 18 }
    ];

    await generateExcel("Rekap_Gabungan", headers, rows[0], res);
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
    const { where, values } = buildFilters(req, [
      "proyek_input",
      "kendaraan_id",
      "supir_id",
      "galian_id"
    ]);

    const sql = `
      SELECT
        o.id AS order_id,
        o.proyek_input,
        o.tanggal_order,
        o.no_order,
        o.petugas_order,
        k.no_pintu AS kendaraan,
        s.nama AS supir,
        g.nama_galian AS galian,
        o.hasil_akhir,
        COUNT(b.id) AS total_ritasi,
        COALESCE(SUM(b.km_akhir), 0) AS total_tonase,
        o.hasil_akhir AS nilai_bayaran
      FROM orders o
      LEFT JOIN buangan b ON o.id = b.order_id
      LEFT JOIN kendaraan k ON o.kendaraan_id = k.id
      LEFT JOIN supir s ON o.supir_id = s.id
      LEFT JOIN galian g ON o.galian_id = g.id
      ${where}
      GROUP BY o.id
      ORDER BY o.id DESC
    `;

    const rows = await db.query(sql, values);
    generatePDF("Rekap Gabungan", rows[0], res);
  } catch (err) {
    console.error("Error in /rekap/gabungan/export/pdf:", err);
    return error(res, 500, "Gagal export PDF", err);
  }
});

export default router;