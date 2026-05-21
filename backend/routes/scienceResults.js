import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import pool from '../db.js';

const router = express.Router();

// GET /science-results/users?competitionId=123 (lista kandidata za odabir)
router.get("/users", authMiddleware, async (req, res) => {
  try {
    if (req.user.IdUserType !== 4) {
      return res.status(403).json({ message: "Pristup dozvoljen samo koordinatoru za nauku." });
    }

    const competitionId = Number(req.query.competitionId);
    if (!Number.isInteger(competitionId) || competitionId <= 0) {
      return res.status(400).json({ message: "Parametar competitionId mora biti pozitivan cijeli broj." });
    }

    const result = await pool.query(`
      SELECT 
        u."IdUser",
        u."Name",
        u."Lastname",
        u."Email",
        f."Name" AS "FacultyName",
        tm."IdTeam",
        tm."Verified"
      FROM "TEAM_MEMBERS" tm
      JOIN "USER" u ON tm."IdUser" = u."IdUser"
      JOIN "TEAM" t ON tm."IdTeam" = t."IdTeam"
      LEFT JOIN "FACULTY" f ON f."IdFaculty" = u."IdFaculty"
      WHERE t."IdScienceCompetition" = $1
      ORDER BY u."Lastname", u."Name";
    `, [competitionId]);

    res.status(200).json(result.rows);
  } catch (error) {
    res.status(500).json({ message: "Greška na serveru prilikom preuzimanja korisnika." });
  } 
});

// GET /science-results/:competitionId (rezultati za određeno takmičenje)
router.get("/:competitionId", authMiddleware, async (req, res) => {
  try {
    if (req.user.IdUserType !== 4) {
      return res.status(403).json({ message: "Pristup dozvoljen samo koordinatoru za nauku." });
    }

    const { competitionId } = req.params;

    const results = await pool.query(`
      SELECT ur."IdUser", u."Name", u."Lastname", f."Name" AS "FacultyName",
             ur."QuestionNumber", ur."Score"
      FROM "USER_RESULTS" ur
      JOIN "USER" u ON ur."IdUser" = u."IdUser"
      JOIN "FACULTY" f ON u."IdFaculty" = f."IdFaculty"
      WHERE ur."IdScienceCompetition" = $1
      ORDER BY u."Lastname", u."Name";
    `, [competitionId]);

    res.status(200).json(results.rows);
  } catch (err) {
    res.status(500).json({ message: "Greška pri dohvatanju rezultata." });
  }
});

// PUT /science-results/:competitionId/:userId/:question (ažuriranje rezultata za određeno takmičenje)
router.put("/:competitionId/:userId/:question", authMiddleware, async (req, res) => {
  try {
    if (req.user.IdUserType !== 4) {
      return res.status(403).json({ message: "Pristup dozvoljen samo koordinatoru za nauku." });
    }

    const { competitionId, userId, question } = req.params;
    const { Score } = req.body;

    if (Score === undefined || isNaN(Score)) {
      return res.status(400).json({ message: "Novi rezultat (Score) mora biti broj." });
    }

    const result = await pool.query(
      `UPDATE "USER_RESULTS"
       SET "Score" = $1
       WHERE "IdUser" = $2 AND "IdScienceCompetition" = $3 AND "QuestionNumber" = $4
       RETURNING *`,
      [Score, userId, competitionId, question]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Zapis nije pronađen." });
    }

    res.status(200).json({ message: "Rezultat uspešno izmenjen.", result: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: "Greška na serveru prilikom izmjene rezultata." });
  }
});

// POST /science-results/:competitionId (dodavanje rezultata za takmičenje)
router.post("/:competitionId", authMiddleware, async (req, res) => {
  try {
    if (req.user.IdUserType !== 4) {
      return res.status(403).json({ message: "Pristup dozvoljen samo koordinatoru za nauku." });
    }

    const { competitionId } = req.params;
    const { IdUser, QuestionNumber, Score } = req.body;

    if (!IdUser || !QuestionNumber || Score === undefined) {
      return res.status(400).json({ message: "Nedostaju podaci (IdUser, QuestionNumber, Score)." });
    }

    const insert = await pool.query(
      `INSERT INTO "USER_RESULTS" ("IdUser", "IdScienceCompetition", "QuestionNumber", "Score")
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [IdUser, competitionId, QuestionNumber, Score]
    );

    res.status(201).json({ message: "Rezultat uspešno dodat.", result: insert.rows[0] });
  } catch (err) {
    res.status(500).json({ message: "Greška prilikom dodavanja rezultata." });
  }
});

export default router;