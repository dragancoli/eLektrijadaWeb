import express from "express";
import pool from "../db.js";

const router = express.Router();

// GET /faculties
router.get("/", async (req, res) => {
  try {
    const allFaculties = await pool.query('SELECT "IdFaculty", "Name", "City" FROM "FACULTY" ORDER BY "Name" ASC');
    res.status(200).json(allFaculties.rows);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: "Greška na serveru prilikom preuzimanja fakulteta." });
  }
});

export default router;
