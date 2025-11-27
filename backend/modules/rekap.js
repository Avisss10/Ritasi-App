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
    if (value && value !== '' && value !== 'null' && value !== 'undefined') {
      if (key === 'proyek_input') {
        conditions.push(`LOWER(o.${key}) LIKE LOWER(?)`);
        values.push(`${value}%`);
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

// Helper: Build WHERE clause for buangan
function buildFiltersBuangan(req, allowedFields) {
  const conditions = [];
  const values = [];

  for (const key of allowedFields) {
    const value = req.query[key];
    if (value && value !== '' && value !== 'null' && value !== 'undefined') {
      if (key === 'no_order') {
        conditions.push(`o.${key} = ?`);
      } else {
        conditions.push(`b.${key} = ?`);
      }
      values.push(value);
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

// Helper: Generate filter info for exports
function generateFilterInfo(req, type) {
  const filters = {};
  
  if (type === "order") {
    if (req.query.tanggal_dari && req.query.tanggal_sampai) {
      filters["Periode"] = `${formatDateDisplay(req.query.tanggal_dari)} s/d ${formatDateDisplay(req.query.tanggal_sampai)}`;
    } else if (req.query.tanggal_dari) {
      filters["Tanggal Mulai"] = formatDateDisplay(req.query.tanggal_dari);
    } else if (req.query.tanggal_sampai) {
      filters["Tanggal Akhir"] = formatDateDisplay(req.query.tanggal_sampai);
    } else {
      filters["Periode"] = "Semua Data";
    }

    if (req.query.proyek_input) {
      filters["Proyek"] = req.query.proyek_input;
    }
    
    if (req.query.status) {
      filters["Status"] = req.query.status.toUpperCase();
    }
    
    if (req.query.kendaraan_id) {
      filters["Filter Kendaraan"] = "Ya";
    }
    
    if (req.query.supir_id) {
      filters["Filter Supir"] = "Ya";
    }
    
    if (req.query.galian_id) {
      filters["Filter Galian"] = "Ya";
    }
  } else if (type === "buangan") {
    if (req.query.tanggal_dari && req.query.tanggal_sampai) {
      filters["Periode Bongkar"] = `${formatDateDisplay(req.query.tanggal_dari)} s/d ${formatDateDisplay(req.query.tanggal_sampai)}`;
    } else if (req.query.tanggal_dari) {
      filters["Tanggal Bongkar Mulai"] = formatDateDisplay(req.query.tanggal_dari);
    } else if (req.query.tanggal_sampai) {
      filters["Tanggal Bongkar Akhir"] = formatDateDisplay(req.query.tanggal_sampai);
    } else {
      filters["Periode"] = "Semua Data";
    }

    if (req.query.no_order) {
      filters["No Order"] = req.query.no_order;
    }
    
    if (req.query.alihan !== undefined && req.query.alihan !== '') {
      filters["Alihan"] = req.query.alihan === '1' || req.query.alihan === 'true' ? "Ya" : "Tidak";
    }
  } else if (type === "gabungan") {
    if (req.query.tanggal_dari && req.query.tanggal_sampai) {
      filters["Periode"] = `${formatDateDisplay(req.query.tanggal_dari)} s/d ${formatDateDisplay(req.query.tanggal_sampai)}`;
    } else if (req.query.tanggal_dari) {
      filters["Tanggal Mulai"] = formatDateDisplay(req.query.tanggal_dari);
    } else if (req.query.tanggal_sampai) {
      filters["Tanggal Akhir"] = formatDateDisplay(req.query.tanggal_sampai);
    } else {
      filters["Periode"] = "Semua Data";
    }

    if (req.query.proyek_input) {
      filters["Proyek"] = req.query.proyek_input;
    }
    
    if (req.query.kendaraan_id) {
      filters["Filter Kendaraan"] = "Ya";
    }
    
    if (req.query.supir_id) {
      filters["Filter Supir"] = "Ya";
    }
    
    if (req.query.galian_id) {
      filters["Filter Galian"] = "Ya";
    }
  }

  // Generate filename yang lebih deskriptif
  const timestamp = new Date();
  const dateStr = `${timestamp.getDate().toString().padStart(2, '0')}${(timestamp.getMonth() + 1).toString().padStart(2, '0')}${timestamp.getFullYear()}`;
  const timeStr = `${timestamp.getHours().toString().padStart(2, '0')}${timestamp.getMinutes().toString().padStart(2, '0')}`;
  
  let filename = `Rekap_${type.charAt(0).toUpperCase() + type.slice(1)}`;
  
  // Tambahkan info periode ke filename
  if (req.query.tanggal_dari && req.query.tanggal_sampai) {
    filename += `_${req.query.tanggal_dari.replace(/-/g, '')}_sd_${req.query.tanggal_sampai.replace(/-/g, '')}`;
  } else if (req.query.tanggal_dari) {
    filename += `_dari_${req.query.tanggal_dari.replace(/-/g, '')}`;
  } else if (req.query.tanggal_sampai) {
    filename += `_sampai_${req.query.tanggal_sampai.replace(/-/g, '')}`;
  } else {
    filename += `_Semua_Data`;
  }
  
  // Tambahkan info proyek jika ada
  if (req.query.proyek_input) {
    const proyekClean = req.query.proyek_input
      .replace(/[^a-zA-Z0-9]/g, '_')
      .substring(0, 20);
    filename += `_${proyekClean}`;
  }
  
  // Tambahkan info status jika ada
  if (req.query.status) {
    filename += `_${req.query.status}`;
  }
  
  // Tambahkan info no_order untuk buangan jika ada
  if (type === "buangan" && req.query.no_order) {
    filename += `_${req.query.no_order}`;
  }
  
  // Tambahkan timestamp
  filename += `_${dateStr}_${timeStr}`;

  return {
    title: `LAPORAN REKAP ${type.toUpperCase()}`,
    filters: Object.keys(filters).length > 0 ? filters : null,
    filename
  };
}

// Helper: Format date for display
function formatDateDisplay(dateString) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
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
      "galian_id",
      "status"
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
// REKAP ORDER - EXPORT EXCEL (WITH NAMES & FILTER INFO)
// ============================================================================
router.get("/order/export/excel", async (req, res) => {
  try {
    const { where, values } = buildFilters(req, [
      "proyek_input",
      "petugas_order",
      "kendaraan_id",
      "supir_id",
      "galian_id",
      "status"
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

    const filterInfo = generateFilterInfo(req, "order");
    await generateExcel("Rekap_Order", headers, rows[0], filterInfo, res);
  } catch (err) {
    console.error("Error in /rekap/order/export/excel:", err);
    return error(res, 500, "Gagal export Excel", err);
  }
});

// ============================================================================
// REKAP ORDER - EXPORT PDF (WITH NAMES & FILTER INFO)
// ============================================================================
router.get("/order/export/pdf", async (req, res) => {
  try {
    const { where, values } = buildFilters(req, [
      "proyek_input",
      "petugas_order",
      "kendaraan_id",
      "supir_id",
      "galian_id",
      "status"
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
    const filterInfo = generateFilterInfo(req, "order");
    generatePDF("Rekap Order", rows[0], filterInfo, res);
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
      "no_order",
      "alihan"
    ]);

    const sql = `
      SELECT
        b.id,
        o.tanggal_order AS tanggal_order,
        o.no_order AS no_order,
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
      LEFT JOIN orders o ON b.order_id = o.id
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
// REKAP BUANGAN - EXPORT EXCEL (WITH GALIAN NAME & FILTER INFO)
// ============================================================================
router.get("/buangan/export/excel", async (req, res) => {
  try {
    const { where, values } = buildFiltersBuangan(req, [
      "no_order",
      "alihan"
    ]);

    const sql = `
      SELECT
        b.id,
        o.tanggal_order AS tanggal_order,
        o.no_order AS no_order,
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
      LEFT JOIN orders o ON b.order_id = o.id
      LEFT JOIN master_galian g ON b.galian_alihan_id = g.id
      ${where}
      ORDER BY b.id DESC
    `;

    const rows = await db.query(sql, values);

    const headers = [
      { label: "ID", key: "id", width: 10 },
      { label: "Tanggal Order", key: "tanggal_order", width: 15 },
      { label: "No Order", key: "no_order", width: 20 },
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

    const filterInfo = generateFilterInfo(req, "buangan");
    await generateExcel("Rekap_Buangan", headers, rows[0], filterInfo, res);
  } catch (err) {
    console.error("Error in /rekap/buangan/export/excel:", err);
    return error(res, 500, "Gagal export Excel", err);
  }
});

// ============================================================================
// REKAP BUANGAN - EXPORT PDF (WITH GALIAN NAME & FILTER INFO)
// ============================================================================
router.get("/buangan/export/pdf", async (req, res) => {
  try {
    const { where, values } = buildFiltersBuangan(req, [
      "no_order",
      "alihan"
    ]);

    const sql = `
      SELECT
        b.id,
        b.order_id,
        o.tanggal_order AS tanggal_order,
        o.no_order AS no_order,
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
      LEFT JOIN orders o ON b.order_id = o.id
      LEFT JOIN master_galian g ON b.galian_alihan_id = g.id
      ${where}
      ORDER BY b.id DESC
    `;

    const rows = await db.query(sql, values);
    const filterInfo = generateFilterInfo(req, "buangan");
    generatePDF("Rekap Buangan", rows[0], filterInfo, res);
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
        COALESCE(SUM(b.jarak_km), 0) AS total_tonase,
        o.hasil_akhir AS nilai_bayaran
      FROM orders o
      LEFT JOIN buangan b ON o.id = b.order_id
      LEFT JOIN master_kendaraan k ON o.kendaraan_id = k.id
      LEFT JOIN master_supir s ON o.supir_id = s.id
      LEFT JOIN master_galian g ON o.galian_id = g.id
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
// REKAP GABUNGAN - EXPORT EXCEL (WITH FILTER INFO)
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
        COALESCE(SUM(b.jarak_km), 0) AS total_tonase,
        o.hasil_akhir AS nilai_bayaran
      FROM orders o
      LEFT JOIN buangan b ON o.id = b.order_id
      LEFT JOIN master_kendaraan k ON o.kendaraan_id = k.id
      LEFT JOIN master_supir s ON o.supir_id = s.id
      LEFT JOIN master_galian g ON o.galian_id = g.id
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

    const filterInfo = generateFilterInfo(req, "gabungan");
    await generateExcel("Rekap_Gabungan", headers, rows[0], filterInfo, res);
  } catch (err) {
    console.error("Error in /rekap/gabungan/export/excel:", err);
    return error(res, 500, "Gagal export Excel", err);
  }
});

// ============================================================================
// REKAP GABUNGAN - EXPORT PDF (WITH FILTER INFO)
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
        COALESCE(SUM(b.jarak_km), 0) AS total_tonase,
        o.hasil_akhir AS nilai_bayaran
      FROM orders o
      LEFT JOIN buangan b ON o.id = b.order_id
      LEFT JOIN master_kendaraan k ON o.kendaraan_id = k.id
      LEFT JOIN master_supir s ON o.supir_id = s.id
      LEFT JOIN master_galian g ON o.galian_id = g.id
      ${where}
      GROUP BY o.id
      ORDER BY o.id DESC
    `;

    const rows = await db.query(sql, values);
    const filterInfo = generateFilterInfo(req, "gabungan");
    generatePDF("Rekap Gabungan", rows[0], filterInfo, res);
  } catch (err) {
    console.error("Error in /rekap/gabungan/export/pdf:", err);
    return error(res, 500, "Gagal export PDF", err);
  }
});

export default router;