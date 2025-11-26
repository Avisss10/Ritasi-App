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
router.post("/galian", create("master_galian", ["nama_galian"]));
router.put("/galian/:id", update("master_galian", ["nama_galian"]));
router.delete("/galian/:id", remove("master_galian"));

// MASTER PROYEK --------------------------------------------------------------
router.get("/proyek", getAll("master_proyek"));
router.get("/proyek/:id", getById("master_proyek"));
router.post("/proyek", create("master_proyek", ["nama_proyek"]));
router.put("/proyek/:id", update("master_proyek", ["nama_proyek"]));
router.delete("/proyek/:id", remove("master_proyek"));

// ============================================================================

export default router;
