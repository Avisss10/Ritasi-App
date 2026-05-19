// ============================================================================
// MASTER DATA MODULE (kendaraan, supir, galian, proyek)
// ============================================================================

import express from "express";
import db from "../config/db.js";
import { success, error } from "../utils/response.js";

const router = express.Router();

// ============================================================================
// GENERIC FUNCTIONS FOR CRUD
// ============================================================================

// GET ALL
const getAll = (table) => async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT * FROM ${table} ORDER BY id DESC`);
    return success(res, `Data ${table}`, rows);
  } catch (err) {
    return error(res, 500, `Gagal mengambil data ${table}`, err);
  }
};

// GET BY ID
const getById = (table) => async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await db.query(
      `SELECT * FROM ${table} WHERE id = ? LIMIT 1`,
      [id]
    );

    if (rows.length === 0) {
      return error(res, 404, `${table} dengan ID ${id} tidak ditemukan`);
    }

    return success(res, `Detail ${table}`, rows[0]);
  } catch (err) {
    return error(res, 500, `Gagal mengambil detail ${table}`, err);
  }
};

// CREATE
const create = (table, fields) => async (req, res) => {
  try {
    const data = {};

    for (const f of fields) {
      if (!req.body[f]) {
        return error(res, 400, `Field '${f}' wajib diisi`);
      }
      data[f] = req.body[f];
    }

    const [result] = await db.query(
      `INSERT INTO ${table} (${fields.join(",")}) VALUES (${fields
        .map(() => "?")
        .join(",")})`,
      fields.map((f) => data[f])
    );

    return success(res, `Berhasil menambahkan ${table}`, {
      id: result.insertId,
      ...data,
    });
  } catch (err) {
    return error(res, 500, `Gagal menambahkan ${table}`, err);
  }
};

// UPDATE
const update = (table, fields) => async (req, res) => {
  const { id } = req.params;

  try {
    const data = {};

    for (const f of fields) {
      if (req.body[f] !== undefined) data[f] = req.body[f];
    }

    if (Object.keys(data).length === 0) {
      return error(res, 400, "Tidak ada field yang dikirim");
    }

    const setQuery = Object.keys(data)
      .map((f) => `${f} = ?`)
      .join(",");

    const values = [...Object.values(data), id];

    const [result] = await db.query(
      `UPDATE ${table} SET ${setQuery} WHERE id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return error(res, 404, `${table} dengan ID ${id} tidak ditemukan`);
    }

    return success(res, `Berhasil update ${table}`, { id, ...data });
  } catch (err) {
    return error(res, 500, `Gagal update ${table}`, err);
  }
};

// DELETE
const remove = (table) => async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await db.query(`DELETE FROM ${table} WHERE id = ?`, [id]);

    if (result.affectedRows === 0) {
      return error(res, 404, `${table} dengan ID ${id} tidak ditemukan`);
    }

    return success(res, `Berhasil menghapus ${table} ID ${id}`);
  } catch (err) {
    return error(res, 500, `Gagal menghapus ${table}`, err);
  }
};

// ============================================================================
// ROUTES REGISTER
// ============================================================================

// MASTER KENDARAAN -----------------------------------------------------------
router.get("/kendaraan", getAll("master_kendaraan"));
router.get("/kendaraan/:id", getById("master_kendaraan"));
router.post("/kendaraan", create("master_kendaraan", ["no_pintu"]));
router.put("/kendaraan/:id", update("master_kendaraan", ["no_pintu"]));
router.delete("/kendaraan/:id", remove("master_kendaraan"));

// MASTER SUPIR ---------------------------------------------------------------
router.get("/supir", getAll("master_supir"));
router.get("/supir/:id", getById("master_supir"));
router.post("/supir", create("master_supir", ["nama"]));
router.put("/supir/:id", update("master_supir", ["nama"]));
router.delete("/supir/:id", remove("master_supir"));

// MASTER GALIAN --------------------------------------------------------------
router.get("/galian", getAll("master_galian"));
router.get("/galian/:id", getById("master_galian"));

router.post("/galian", async (req, res) => {
  const { nama_galian, harga_galian } = req.body;
  if (!nama_galian || !String(nama_galian).trim()) {
    return error(res, 400, "Field 'nama_galian' wajib diisi");
  }
  const hargaValue = (harga_galian !== undefined && harga_galian !== null && harga_galian !== '') ? parseFloat(harga_galian) : 0;
  try {
    const [result] = await db.query(
      `INSERT INTO master_galian (nama_galian, harga_galian) VALUES (?, ?)`,
      [String(nama_galian).trim(), hargaValue]
    );
    return success(res, "Berhasil menambahkan galian", {
      id: result.insertId,
      nama_galian: String(nama_galian).trim(),
      harga_galian: hargaValue,
    });
  } catch (err) {
    return error(res, 500, "Gagal menambahkan galian", err);
  }
});

router.put("/galian/:id", async (req, res) => {
  const { id } = req.params;
  const { nama_galian, harga_galian } = req.body;
  const fields = [];
  const values = [];
  if (nama_galian !== undefined) { fields.push("nama_galian = ?"); values.push(String(nama_galian).trim()); }
  if (harga_galian !== undefined && harga_galian !== null && harga_galian !== '') { fields.push("harga_galian = ?"); values.push(parseFloat(harga_galian)); }
  if (fields.length === 0) return error(res, 400, "Tidak ada field yang dikirim");
  values.push(id);
  try {
    const [result] = await db.query(`UPDATE master_galian SET ${fields.join(", ")} WHERE id = ?`, values);
    if (result.affectedRows === 0) return error(res, 404, `master_galian dengan ID ${id} tidak ditemukan`);
    return success(res, "Berhasil update galian", { id: parseInt(id), nama_galian, harga_galian });
  } catch (err) {
    return error(res, 500, "Gagal update galian", err);
  }
});

router.delete("/galian/:id", remove("master_galian"));

// MASTER PROYEK (custom handlers - harga bisa bernilai 0 sehingga tidak bisa pakai generic create/update)
router.get("/proyek", async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT * FROM master_proyek ORDER BY id DESC`);
    return success(res, "Data master_proyek", rows);
  } catch (err) {
    return error(res, 500, "Gagal mengambil data master_proyek", err);
  }
});

router.get("/proyek/:id", getById("master_proyek"));

router.post("/proyek", async (req, res) => {
  const { nama_proyek, harga } = req.body;
  if (!nama_proyek || !String(nama_proyek).trim()) {
    return error(res, 400, "Field 'nama_proyek' wajib diisi");
  }
  const hargaValue = (harga !== undefined && harga !== null && harga !== '') ? parseFloat(harga) : 0;
  try {
    const [result] = await db.query(
      `INSERT INTO master_proyek (nama_proyek, harga) VALUES (?, ?)`,
      [String(nama_proyek).trim(), hargaValue]
    );
    return success(res, "Berhasil menambahkan proyek", {
      id: result.insertId,
      nama_proyek: String(nama_proyek).trim(),
      harga: hargaValue
    });
  } catch (err) {
    return error(res, 500, "Gagal menambahkan proyek", err);
  }
});

router.put("/proyek/:id", async (req, res) => {
  const { id } = req.params;
  const { nama_proyek, harga } = req.body;
  const fields = [];
  const values = [];
  if (nama_proyek !== undefined) { fields.push("nama_proyek = ?"); values.push(String(nama_proyek).trim()); }
  if (harga !== undefined && harga !== null && harga !== '') { fields.push("harga = ?"); values.push(parseFloat(harga)); }
  if (fields.length === 0) return error(res, 400, "Tidak ada field yang dikirim");
  values.push(id);
  try {
    const [result] = await db.query(`UPDATE master_proyek SET ${fields.join(", ")} WHERE id = ?`, values);
    if (result.affectedRows === 0) return error(res, 404, `master_proyek dengan ID ${id} tidak ditemukan`);
    return success(res, "Berhasil update proyek", { id: parseInt(id), nama_proyek, harga });
  } catch (err) {
    return error(res, 500, "Gagal update proyek", err);
  }
});

router.delete("/proyek/:id", remove("master_proyek"));

// ============================================================================

export default router;
