import express from "express";
import pool from "../db.js";

const router = express.Router();

// GET /public-competitions/by-date?date=YYYY-MM-DD
// Vraća naučna takmičenja za određeni datum sa top rezultatima (javno dostupno)
router.get("/by-date", async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ message: "Parametar 'date' je obavezan (format: YYYY-MM-DD)." });
    }

    const query = `
      SELECT 
        sc."IdScienceCompetition" as id,
        s."Name" as naziv_predmeta,
        CAST(NULL AS TEXT) as opis,
        sc."SolutionUrl" as link_rjesenja,
        (
          SELECT COALESCE(json_agg(ranked_results), '[]'::json)
          FROM (
            SELECT 
              ROW_NUMBER() OVER (ORDER BY total_score DESC) as rang,
              result_data."IdUser" as id,
              result_data."Name" as ime_studenta,
              result_data."Lastname" as prezime_studenta,
              result_data.total_score as broj_bodova
            FROM (
              SELECT 
                ur."IdUser",
                u."Name",
                u."Lastname",
                SUM(ur."Score") as total_score
              FROM "USER_RESULTS" ur
              JOIN "USER" u ON ur."IdUser" = u."IdUser"
              WHERE ur."IdScienceCompetition" = sc."IdScienceCompetition"
              GROUP BY ur."IdUser", u."Name", u."Lastname"
            ) result_data
            ORDER BY total_score DESC
            LIMIT 3
          ) ranked_results
        ) as top_rezultati
      FROM "SCIENCE_COMPETITION" sc
      JOIN "APPOINTMENT" a ON sc."IdAppointment" = a."IdAppointment"
      JOIN "SCIENCE" s ON sc."IdScience" = s."IdScience"
      WHERE DATE(a."StartDate") = $1
      ORDER BY s."Name" ASC;
    `;

    const competitions = await pool.query(query, [date]);
    res.status(200).json(competitions.rows);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: "Greška na serveru prilikom preuzimanja takmičenja." });
  }
});

// GET /public-competitions/:id/all-results
// Vraća sve rezultate za određeno takmičenje (javno dostupno)
router.get("/:id/all-results", async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        ROW_NUMBER() OVER (ORDER BY total_score DESC) as rang,
        result_data."IdUser" as id,
        result_data."Name" as ime_studenta,
        result_data."Lastname" as prezime_studenta,
        result_data.total_score as broj_bodova,
        result_data."FacultyName" as fakultet
      FROM (
        SELECT 
          ur."IdUser",
          u."Name",
          u."Lastname",
          f."Name" AS "FacultyName",
          SUM(ur."Score") as total_score
        FROM "USER_RESULTS" ur
        JOIN "USER" u ON ur."IdUser" = u."IdUser"
        JOIN "FACULTY" f ON u."IdFaculty" = f."IdFaculty"
        WHERE ur."IdScienceCompetition" = $1
        GROUP BY ur."IdUser", u."Name", u."Lastname", f."Name"
      ) result_data
      ORDER BY total_score DESC;
    `;

    const results = await pool.query(query, [id]);
    
    // Dohvati i informacije o takmičenju
    const competitionQuery = `
      SELECT 
        sc."IdScienceCompetition" as id,
        s."Name" as naziv_predmeta,
        sc."Year" as godina
      FROM "SCIENCE_COMPETITION" sc
      JOIN "SCIENCE" s ON sc."IdScience" = s."IdScience"
      WHERE sc."IdScienceCompetition" = $1;
    `;
    
    const competition = await pool.query(competitionQuery, [id]);

    if (competition.rows.length === 0) {
      return res.status(404).json({ message: "Takmičenje nije pronađeno." });
    }

    res.status(200).json({
      competition: competition.rows[0],
      results: results.rows
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: "Greška na serveru prilikom preuzimanja rezultata." });
  }
});

export default router;
