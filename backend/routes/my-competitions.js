import express from "express";
import pool from "../db.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// TODO da li treba provjera da je kod team_members kolona verified
// GET /my-competitions
router.get("/", authMiddleware, async (req, res) => {
  const { IdUser } = req.user;

  try {
    // Query for science competitions
    const scienceCompetitionsQuery = `
      SELECT 
        sc."IdScienceCompetition" AS "competitionId",
        s."Name" AS "competitionName",
        a."StartDate" AS "startDate",
        a."Location" AS "location",
        'Nauka' as "type"
      FROM "TEAM_MEMBERS" tm
      JOIN "TEAM" t ON tm."IdTeam" = t."IdTeam"
      JOIN "SCIENCE_COMPETITION" sc ON t."IdScienceCompetition" = sc."IdScienceCompetition"
      JOIN "SCIENCE" s ON sc."IdScience" = s."IdScience"
      JOIN "APPOINTMENT" a ON sc."IdAppointment" = a."IdAppointment"
      WHERE tm."IdUser" = $1 AND t."IdScienceCompetition" IS NOT NULL;
    `;
    const scienceCompetitionsResult = await pool.query(scienceCompetitionsQuery, [IdUser]);

    // Query for sport competitions
    const sportCompetitionsQuery = `
      SELECT DISTINCT
        sc."IdSportCompetition" AS "competitionId",
        sp."Name" AS "competitionName",
        a."StartDate" AS "startDate",
        a."Location" AS "location",
        'Sport' as "type"
      FROM "TEAM_MEMBERS" tm
      JOIN "TEAM" t ON tm."IdTeam" = t."IdTeam"
      JOIN "MATCH" m ON (m."IdTeam1" = t."IdTeam" OR m."IdTeam2" = t."IdTeam")
      JOIN "SPORT_COMPETITION" sc ON m."IdSportCompetition" = sc."IdSportCompetition"
      JOIN "SPORT" sp ON sc."IdSport" = sp."IdSport"
      JOIN "APPOINTMENT" a ON m."IdAppointment" = a."IdAppointment"
      WHERE tm."IdUser" = $1 AND t."IdSportCompetition" IS NOT NULL;
    `;
    const sportCompetitionsResult = await pool.query(sportCompetitionsQuery, [IdUser]);

    const allCompetitions = [...scienceCompetitionsResult.rows, ...sportCompetitionsResult.rows];

    // Sort competitions by start date
    allCompetitions.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

    res.status(200).json(allCompetitions);
  } catch (error) {
    console.error("Error fetching user competitions:", error);
    res.status(500).json({ message: "Greška na serveru prilikom preuzimanja takmičenja." });
  }
});

export default router;
