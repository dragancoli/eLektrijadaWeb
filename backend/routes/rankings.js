import express from "express";
import pool from "../db.js";

const router = express.Router();

// GET /rankings/years
// Vraća sve dostupne godine iz FACULTY_RANKING, SPORT_COMPETITION i SCIENCE_COMPETITION
router.get("/years", async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT year 
      FROM (
        SELECT "Year" as year FROM "FACULTY_RANKING"
        UNION
        SELECT "Year" as year FROM "SPORT_COMPETITION"
        UNION
        SELECT "Year" as year FROM "SCIENCE_COMPETITION"
      ) all_years
      ORDER BY year DESC;
    `;

    const result = await pool.query(query);
    res.status(200).json(result.rows.map(row => row.year));
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: "Greška na serveru prilikom preuzimanja godina." });
  }
});

// GET /rankings/faculty-ranking?year=YYYY
// Vraća generalni plasman fakulteta za određenu godinu
router.get("/faculty-ranking", async (req, res) => {
  try {
    const { year } = req.query;

    if (!year) {
      return res.status(400).json({ message: "Parametar 'year' je obavezan." });
    }

    const query = `
      SELECT 
        ROW_NUMBER() OVER (ORDER BY fr."Score" DESC) as position,
        f."Name" as faculty_name,
        fr."Score" as score,
        f."City" as city
      FROM "FACULTY_RANKING" fr
      JOIN "FACULTY" f ON fr."IdFaculty" = f."IdFaculty"
      WHERE fr."Year" = $1
      ORDER BY fr."Score" DESC;
    `;

    const result = await pool.query(query, [year]);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: "Greška na serveru prilikom preuzimanja plasmana." });
  }
});

// GET /rankings/sport-competitions?year=YYYY
// Vraća listu sportskih takmičenja za određenu godinu
router.get("/sport-competitions", async (req, res) => {
  try {
    const { year } = req.query;

    if (!year) {
      return res.status(400).json({ message: "Parametar 'year' je obavezan." });
    }

    const query = `
      SELECT 
        sc."IdSportCompetition" as id,
        s."Name" as name,
        sc."Year" as year
      FROM "SPORT_COMPETITION" sc
      JOIN "SPORT" s ON sc."IdSport" = s."IdSport"
      WHERE sc."Year" = $1
      ORDER BY s."Name" ASC;
    `;

    const result = await pool.query(query, [year]);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: "Greška na serveru prilikom preuzimanja sportskih takmičenja." });
  }
});

// GET /rankings/science-competitions?year=YYYY
// Vraća listu naučnih takmičenja za određenu godinu
router.get("/science-competitions", async (req, res) => {
  try {
    const { year } = req.query;

    if (!year) {
      return res.status(400).json({ message: "Parametar 'year' je obavezan." });
    }

    const query = `
      SELECT 
        sc."IdScienceCompetition" as id,
        s."Name" as name,
        sc."Year" as year
      FROM "SCIENCE_COMPETITION" sc
      JOIN "SCIENCE" s ON sc."IdScience" = s."IdScience"
      WHERE sc."Year" = $1
      ORDER BY s."Name" ASC;
    `;

    const result = await pool.query(query, [year]);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: "Greška na serveru prilikom preuzimanja naučnih takmičenja." });
  }
});

// GET /rankings/sport-competition/:competitionId
// Vraća plasman timova za određeno sportsko takmičenje
router.get("/sport-competition/:competitionId", async (req, res) => {
  try {
    const { competitionId } = req.params;

    const query = `
      SELECT 
        t."Position" as position,
        t."Name" as team_name,
        f."Name" as faculty_name,
        f."City" as city
      FROM "TEAM" t
      JOIN "FACULTY" f ON t."IdFaculty" = f."IdFaculty"
      WHERE t."IdSportCompetition" = $1 AND t."Position" IS NOT NULL
      ORDER BY t."Position" ASC;
    `;

    const result = await pool.query(query, [competitionId]);
    
    // Dohvati i informacije o takmičenju
    const competitionQuery = `
      SELECT 
        sc."IdSportCompetition" as id,
        s."Name" as name,
        sc."Year" as year
      FROM "SPORT_COMPETITION" sc
      JOIN "SPORT" s ON sc."IdSport" = s."IdSport"
      WHERE sc."IdSportCompetition" = $1;
    `;
    
    const competition = await pool.query(competitionQuery, [competitionId]);

    if (competition.rows.length === 0) {
      return res.status(404).json({ message: "Takmičenje nije pronađeno." });
    }

    res.status(200).json({
      competition: competition.rows[0],
      rankings: result.rows
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: "Greška na serveru prilikom preuzimanja plasmana." });
  }
});

// GET /rankings/science-competition/:competitionId
// Vraća plasman timova za određeno naučno takmičenje sa ukupnim brojem bodova
router.get("/science-competition/:competitionId", async (req, res) => {
  try {
    const { competitionId } = req.params;

    const query = `
      SELECT 
        t."Position" as position,
        t."Name" as team_name,
        f."Name" as faculty_name,
        f."City" as city,
        COALESCE(
          (
            SELECT SUM(ur."Score")
            FROM "USER_RESULTS" ur
            JOIN "TEAM_MEMBERS" tm ON ur."IdUser" = tm."IdUser"
            WHERE tm."IdTeam" = t."IdTeam" 
              AND ur."IdScienceCompetition" = $1
          ),
          0
        ) as total_score
      FROM "TEAM" t
      JOIN "FACULTY" f ON t."IdFaculty" = f."IdFaculty"
      WHERE t."IdScienceCompetition" = $1 AND t."Position" IS NOT NULL
      ORDER BY t."Position" ASC;
    `;

    const result = await pool.query(query, [competitionId]);
    
    // Dohvati i informacije o takmičenju
    const competitionQuery = `
      SELECT 
        sc."IdScienceCompetition" as id,
        s."Name" as name,
        sc."Year" as year
      FROM "SCIENCE_COMPETITION" sc
      JOIN "SCIENCE" s ON sc."IdScience" = s."IdScience"
      WHERE sc."IdScienceCompetition" = $1;
    `;
    
    const competition = await pool.query(competitionQuery, [competitionId]);

    if (competition.rows.length === 0) {
      return res.status(404).json({ message: "Takmičenje nije pronađeno." });
    }

    res.status(200).json({
      competition: competition.rows[0],
      rankings: result.rows
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: "Greška na serveru prilikom preuzimanja plasmana." });
  }
});

export default router;
