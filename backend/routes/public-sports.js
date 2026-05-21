import express from "express";
import pool from "../db.js";

const router = express.Router();

// GET /public-sports/list - Vraća listu svih sportova (javno dostupno)
router.get("/list", async (req, res) => {
  try {
    const query = `SELECT "IdSport", "Name" FROM "SPORT" ORDER BY "Name" ASC;`;
    const allSports = await pool.query(query);
    res.status(200).json(allSports.rows);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: "Greška na serveru prilikom preuzimanja sportova." });
  }
});

// GET /public-sports/matches - Vraća sve mečeve sa detaljima (javno dostupno)
router.get("/matches", async (req, res) => {
  try {
    const query = `
      SELECT 
        m."IdMatch", m."ResultTeam1", m."ResultTeam2", m."Status", m."Stage",
        a."StartDate", a."Duration", a."Location",
        s."Name" AS "SportName",
        sc."Year",
        t1."Name" AS "Team1Name",
        t2."Name" AS "Team2Name"
      FROM "MATCH" AS m
      JOIN "APPOINTMENT" AS a ON m."IdAppointment" = a."IdAppointment"
      JOIN "TEAM" AS t1 ON m."IdTeam1" = t1."IdTeam"
      JOIN "TEAM" AS t2 ON m."IdTeam2" = t2."IdTeam"
      JOIN "SPORT_COMPETITION" AS sc ON m."IdSportCompetition" = sc."IdSportCompetition"
      JOIN "SPORT" AS s ON sc."IdSport" = s."IdSport"
      ORDER BY a."StartDate" DESC;
    `;
    const allMatches = await pool.query(query);
    res.status(200).json(allMatches.rows);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: "Greška na serveru prilikom preuzimanja mečeva." });
  }
});

export default router;
