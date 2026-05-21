// routes/schedule.js
import express from "express";
import pool from "../db.js";

const router = express.Router();

// Dohvati sve termine za određeni datum
router.get("/by-date", async (req, res) => {
  try {
    const { date } = req.query; // Format: YYYY-MM-DD

    if (!date) {
      return res.status(400).json({ error: "Datum je obavezan" });
    }

    // Dohvati sportske mečeve za taj datum
    const matchesQuery = `
      SELECT 
        m."IdMatch" as id,
        m."Status" as status,
        m."Stage" as stage,
        t1."Name" as tim1,
        t2."Name" as tim2,
        s."Name" as vrsta_sporta,
        a."StartDate"::date as datum,
        a."StartDate"::time as vrijeme,
        a."Duration" as trajanje,
        a."Location" as lokacija,
        m."ResultTeam1" as rezultat_tim1,
        m."ResultTeam2" as rezultat_tim2
      FROM "MATCH" m
      JOIN "TEAM" t1 ON m."IdTeam1" = t1."IdTeam"
      JOIN "TEAM" t2 ON m."IdTeam2" = t2."IdTeam"
      JOIN "SPORT_COMPETITION" sc ON m."IdSportCompetition" = sc."IdSportCompetition"
      JOIN "SPORT" s ON sc."IdSport" = s."IdSport"
      JOIN "APPOINTMENT" a ON m."IdAppointment" = a."IdAppointment"
      WHERE a."StartDate"::date = $1
      ORDER BY a."StartDate"
    `;

    // Dohvati naučna takmičenja za taj datum
    const competitionsQuery = `
      SELECT 
        scomp."IdScienceCompetition" as id,
        sci."Name" as naziv_predmeta,
        a."StartDate"::date as datum,
        a."StartDate"::time as vrijeme,
        a."Duration" as trajanje,
        a."Location" as lokacija,
        u."Name" || ' ' || u."Lastname" as mentor,
        scomp."NumberOfQuestions" as broj_pitanja
      FROM "SCIENCE_COMPETITION" scomp
      JOIN "SCIENCE" sci ON scomp."IdScience" = sci."IdScience"
      JOIN "APPOINTMENT" a ON scomp."IdAppointment" = a."IdAppointment"
      JOIN "USER" u ON scomp."IdMentor" = u."IdUser"
      WHERE a."StartDate"::date = $1
      ORDER BY a."StartDate"
    `;

    //Dohvati sve termine uvida
    const reviewsQuery = `
        SELECT
          scomp."IdScienceCompetition" as id,
          sci."Name" as naziv_predmeta,
          a."StartDate"::date as datum,
          a."StartDate"::time as vrijeme,
          a."Duration" as trajanje,
      a."Location" as lokacija,
      u."Name" || ' ' || u."Lastname" as mentor
    FROM "SCIENCE_COMPETITION" scomp
    JOIN "SCIENCE" sci ON scomp."IdScience" = sci."IdScience"
    JOIN "APPOINTMENT" a ON scomp."ReviewAppointment" = a."IdAppointment"
    JOIN "USER" u ON scomp."IdMentor" = u."IdUser"
    WHERE a."StartDate"::date = $1
    ORDER BY a."StartDate"
    `;

    const [matchesResult, competitionsResult, reviewsResult] = await Promise.all([
      pool.query(matchesQuery, [date]),
      pool.query(competitionsQuery, [date]),
      pool.query(reviewsQuery, [date]),
    ]);

    res.json({
      matches: matchesResult.rows,
      competitions: competitionsResult.rows,
      reviews: reviewsResult.rows,
    });
  } catch (error) {
    console.error("Error fetching schedule:", error);
    res.status(500).json({ error: "Greška pri dohvaćanju rasporeda" });
  }
});

// Dohvati sve termine između dva datuma (za week view)
router.get("/by-range", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: "Start i end datum su obavezni" });
    }

    // Sportski mečevi
    const matchesQuery = `
      SELECT 
        m."IdMatch" as id,
        m."Status" as status,
        m."Stage" as stage,
        t1."Name" as tim1,
        t2."Name" as tim2,
        s."Name" as vrsta_sporta,
        a."StartDate"::date as datum,
        a."StartDate"::time as vrijeme,
        a."Duration" as trajanje,
        a."Location" as lokacija,
        m."ResultTeam1" as rezultat_tim1,
        m."ResultTeam2" as rezultat_tim2
      FROM "MATCH" m
      JOIN "TEAM" t1 ON m."IdTeam1" = t1."IdTeam"
      JOIN "TEAM" t2 ON m."IdTeam2" = t2."IdTeam"
      JOIN "SPORT_COMPETITION" sc ON m."IdSportCompetition" = sc."IdSportCompetition"
      JOIN "SPORT" s ON sc."IdSport" = s."IdSport"
      JOIN "APPOINTMENT" a ON m."IdAppointment" = a."IdAppointment"
      WHERE a."StartDate"::date BETWEEN $1 AND $2
      ORDER BY a."StartDate"
    `;

    // Naučna takmičenja
    const competitionsQuery = `
      SELECT 
        scomp."IdScienceCompetition" as id,
        sci."Name" as naziv_predmeta,
        a."StartDate"::date as datum,
        a."StartDate"::time as vrijeme,
        a."Duration" as trajanje,
        a."Location" as lokacija,
        u."Name" || ' ' || u."Lastname" as mentor,
        scomp."NumberOfQuestions" as broj_pitanja
      FROM "SCIENCE_COMPETITION" scomp
      JOIN "SCIENCE" sci ON scomp."IdScience" = sci."IdScience"
      JOIN "APPOINTMENT" a ON scomp."IdAppointment" = a."IdAppointment"
      JOIN "USER" u ON scomp."IdMentor" = u."IdUser"
      WHERE a."StartDate"::date BETWEEN $1 AND $2
      ORDER BY a."StartDate"
    `;

    const reviewsQuery = `
  SELECT
    scomp."IdScienceCompetition" as id,
    sci."Name" as naziv_predmeta,
    a."StartDate"::date as datum,
    a."StartDate"::time as vrijeme,
    a."Duration" as trajanje,
    a."Location" as lokacija,
    u."Name" || ' ' || u."Lastname" as mentor
  FROM "SCIENCE_COMPETITION" scomp
  JOIN "SCIENCE" sci ON scomp."IdScience" = sci."IdScience"
  JOIN "APPOINTMENT" a ON scomp."ReviewAppointment" = a."IdAppointment"
  JOIN "USER" u ON scomp."IdMentor" = u."IdUser"
  WHERE a."StartDate"::date BETWEEN $1 AND $2
  ORDER BY a."StartDate"
`;

    const [matchesResult, competitionsResult, reviewsResult] = await Promise.all([
      pool.query(matchesQuery, [startDate, endDate]),
      pool.query(competitionsQuery, [startDate, endDate]),
      pool.query(reviewsQuery, [startDate, endDate]),
    ]);

    res.json({
      matches: matchesResult.rows,
      competitions: competitionsResult.rows,
      reviews: reviewsResult.rows,
    });
  } catch (error) {
    console.error("Error fetching schedule range:", error);
    res.status(500).json({ error: "Greška pri dohvaćanju rasporeda" });
  }
});

export default router;
