import express from "express";
import pool from "../db.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// GET sports/teams
router.get("/teams", authMiddleware, async (req, res) => {
  try {
    const IdUserType = req.user.IdUserType;
    const UserTypeName = await pool.query(`SELECT "Name" FROM "USER_TYPE" WHERE "IdUserType" = $1`, [IdUserType]);

    if (UserTypeName.rows[0].Name !== "KoordinatorSport") {
      return res.status(403).json({ message: "Nemate dozvolu za pristup sportskim timovima." });
    }

    const query = `
      SELECT 
        t."IdTeam",
        t."Name" AS "TeamName",
        t."Category",
        f."Name" AS "FacultyName",
        u."Name" AS "LeaderName",
        u."Lastname" AS "LeaderLastname",
        s."Name" AS "SportName",
        sc."Year"
      FROM 
        "TEAM" AS t
      JOIN 
        "FACULTY" AS f ON t."IdFaculty" = f."IdFaculty"
      JOIN 
        "USER" AS u ON t."IdLeader" = u."IdUser"
      JOIN 
        "SPORT_COMPETITION" AS sc ON t."IdSportCompetition" = sc."IdSportCompetition"
      JOIN 
        "SPORT" AS s ON sc."IdSport" = s."IdSport"
      WHERE 
        t."IdSportCompetition" IS NOT NULL
      ORDER BY
        "SportName", "TeamName";
    `;

    const allSportTeams = await pool.query(query);
    res.status(200).json(allSportTeams.rows);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: "Greška na serveru prilikom preuzimanja sportskih timova." });
  }
});

// PUT /sports/teams/:id
router.put("/teams/:id", authMiddleware, async (req, res) => {
  try {
    const IdUserType = req.user.IdUserType;
    const UserTypeName = await pool.query(`SELECT "Name" FROM "USER_TYPE" WHERE "IdUserType" = $1`, [IdUserType]);

    if (UserTypeName.rows[0].Name !== "KoordinatorSport") {
      return res.status(403).json({ message: "Nemate dozvolu za pristup sportskim timovima." });
    }

    const { id } = req.params;
    const { Position } = req.body;

    if (Position === undefined || Position === null) {
      return res.status(400).json({ message: "Polje 'Position' je obavezno. " });
    }

    const updateQuery = `
      UPDATE "TEAM"
      SET "Position" = $1
      WHERE "IdTeam" = $2 AND "IdSportCompetition" IS NOT NULL
      RETURNING *;
    `;

    const updatedTeam = await pool.query(updateQuery, [Position, id]);
    if (updatedTeam.rows.length === 0) {
      return res.status(404).json({ message: "Sportski tim nije pronađen ili ne može da se ažurira." });
    }

    res.status(200).json(updatedTeam.rows[0]);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: "Greška na serveru prilikom unosa pozicije sportskog tima." });
  }
});

// GET /sports/competitions
router.get("/competitions", authMiddleware, async (req, res) => {
  try {
    const IdUserType = req.user.IdUserType;
    const UserTypeName = await pool.query(`SELECT "Name" FROM "USER_TYPE" WHERE "IdUserType" = $1`, [IdUserType]);

    if (UserTypeName.rows[0].Name !== "KoordinatorSport") {
      return res.status(403).json({ message: "Nemate dozvolu za pristup sportskim takmičenjima." });
    }

    const query = `
      SELECT 
        sc."IdSportCompetition",
        sc."Year",
        s."Name" AS "SportName",
        s."IdSport"
      FROM 
        "SPORT_COMPETITION" AS sc
      JOIN 
        "SPORT" AS s ON sc."IdSport" = s."IdSport"
      ORDER BY
        "SportName" ASC, "Year" DESC;
    `;

    const allCompetitions = await pool.query(query);

    res.status(200).json(allCompetitions.rows);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: "Greška na serveru prilikom preuzimanja sportskih takmičenja." });
  }
});


// GET /sports/competitions
router.get("/competitions/teamLeader", async (req, res) => {
  try {

    const query = `
      SELECT 
        sc."IdSportCompetition",
        sc."Year",
        s."Name" AS "SportName",
        s."IdSport"
      FROM 
        "SPORT_COMPETITION" AS sc
      JOIN 
        "SPORT" AS s ON sc."IdSport" = s."IdSport"
      ORDER BY
        "SportName" ASC, "Year" DESC;
    `;

    const allCompetitions = await pool.query(query);

    res.status(200).json(allCompetitions.rows);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: "Greška na serveru prilikom preuzimanja sportskih takmičenja." });
  }
});

// GET /sports/competitions/:id
router.get("/competitions/:id", authMiddleware, async (req, res) => {
  try {
    const IdUserType = req.user.IdUserType;
    const UserTypeName = await pool.query(`SELECT "Name" FROM "USER_TYPE" WHERE "IdUserType" = $1`, [IdUserType]);

    if (UserTypeName.rows[0].Name !== "KoordinatorSport") {
      return res.status(403).json({ message: "Nemate dozvolu za pristup sportskim takmičenjima." });
    }

    const { id } = req.params;
    const query = ` SELECT 
        sc."IdSportCompetition",
        sc."Year",
        s."Name" AS "SportName",
        s."IdSport"
      FROM 
        "SPORT_COMPETITION" AS sc
      JOIN 
        "SPORT" AS s ON sc."IdSport" = s."IdSport"
      WHERE
        sc."IdSportCompetition" = $1
      ORDER BY
        "SportName" ASC, "Year" DESC;`;

    const competitionResult = await pool.query(query, [id]);
    if (competitionResult.rows.length === 0) {
      return res.status(404).json({ message: "Sportsko takmičenje nije pronađeno." });
    }
    res.status(200).json(competitionResult.rows[0]);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: "Greška na serveru prilikom preuzimanja sportskog takmičenja." });
  }
});

// POST /sports/competitions
router.post("/competitions", authMiddleware, async (req, res) => {
  try {
    const IdUserType = req.user.IdUserType;
    const UserTypeName = await pool.query(`SELECT "Name" FROM "USER_TYPE" WHERE "IdUserType" = $1`, [IdUserType]);

    if (UserTypeName.rows[0].Name !== "KoordinatorSport") {
      return res.status(403).json({ message: "Nemate dozvolu za pristup sportskim takmičenjima." });
    }

    const { IdSport, Year } = req.body;
    const insertQuery = `INSERT INTO "SPORT_COMPETITION" ("IdSport", "Year") VALUES ($1, $2) RETURNING *;`;
    const newCompetition = await pool.query(insertQuery, [IdSport, Year]);
    res.status(201).json(newCompetition.rows[0]);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: "Greška na serveru prilikom dodavanja sportskog takmičenja." });
  }
});

// PUT /sports/competitions/:id
router.put("/competitions/:id", authMiddleware, async (req, res) => {
  try {
    const IdUserType = req.user.IdUserType;
    const UserTypeName = await pool.query(`SELECT "Name" FROM "USER_TYPE" WHERE "IdUserType" = $1`, [IdUserType]);

    if (UserTypeName.rows[0].Name !== "KoordinatorSport") {
      return res.status(403).json({ message: "Nemate dozvolu za pristup sportskim takmičenjima." });
    }

    const { id } = req.params;
    const { IdSport, Year } = req.body;
    const updateQuery = `UPDATE "SPORT_COMPETITION" SET "IdSport" = $1, "Year" = $2 WHERE "IdSportCompetition" = $3 RETURNING *;`;
    const updatedCompetition = await pool.query(updateQuery, [IdSport, Year, id]);

    if (updatedCompetition.rows.length === 0) {
      return res.status(404).json({ message: "Sportsko takmičenje nije pronađeno." });
    }

    res.status(200).json(updatedCompetition.rows[0]);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: "Greška na serveru prilikom ažuriranja sportskog takmičenja." });
  }
});

// DELETE /sports/competitions/:id
router.delete("/competitions/:id", authMiddleware, async (req, res) => {
  try {
    const IdUserType = req.user.IdUserType;
    const UserTypeName = await pool.query(`SELECT "Name" FROM "USER_TYPE" WHERE "IdUserType" = $1`, [IdUserType]);

    if (UserTypeName.rows[0].Name !== "KoordinatorSport") {
      return res.status(403).json({ message: "Nemate dozvolu za pristup sportskim takmičenjima." });
    }

    const { id } = req.params;
    const deleteQuery = `DELETE FROM "SPORT_COMPETITION" WHERE "IdSportCompetition" = $1 RETURNING *;`;
    const deletedCompetition = await pool.query(deleteQuery, [id]);

    if (deletedCompetition.rows.length === 0) {
      return res.status(404).json({ message: "Sportsko takmičenje nije pronađeno." });
    }
    res.status(200).json({ message: "Sportsko takmičenje je uspešno obrisano." });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: "Greška na serveru prilikom brisanja sportskog takmičenja." });
  }
});

// GET /sports
router.get("/", authMiddleware, async (req, res) => {
  try {
    const IdUserType = req.user.IdUserType;
    const UserTypeName = await pool.query(`SELECT "Name" FROM "USER_TYPE" WHERE "IdUserType" = $1`, [IdUserType]);

    if (UserTypeName.rows[0].Name !== "KoordinatorSport") {
      return res.status(403).json({ message: "Nemate dozvolu za pristup sportskim kategorijama." });
    }

    const query = `SELECT "IdSport", "Name" FROM "SPORT" ORDER BY "Name" ASC;`;
    const allSports = await pool.query(query);
    res.status(200).json(allSports.rows);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: "Greška na serveru prilikom preuzimanja sportova." });
  }
});

// GET /sports/:id
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const IdUserType = req.user.IdUserType;
    const UserTypeName = await pool.query(`SELECT "Name" FROM "USER_TYPE" WHERE "IdUserType" = $1`, [IdUserType]);

    if (UserTypeName.rows[0].Name !== "KoordinatorSport") {
      return res.status(403).json({ message: "Nemate dozvolu za pristup sportskim kategorijama." });
    }

    const { id } = req.params;
    const query = `SELECT "IdSport", "Name" FROM "SPORT" WHERE "IdSport" = $1;`;
    const sportResult = await pool.query(query, [id]);

    if (sportResult.rows.length === 0) {
      return res.status(404).json({ message: "Sport nije pronađen." });
    }

    res.status(200).json(sportResult.rows[0]);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: "Greška na serveru prilikom preuzimanja sporta." });
  }
});

//POST /sports
router.post("/", authMiddleware, async (req, res) => {
  try {
    const IdUserType = req.user.IdUserType;
    const UserTypeName = await pool.query(`SELECT "Name" FROM "USER_TYPE" WHERE "IdUserType" = $1`, [IdUserType]);

    if (UserTypeName.rows[0].Name !== "KoordinatorSport") {
      return res.status(403).json({ message: "Nemate dozvolu za pristup sportskim kategorijama." });
    }

    const { Name } = req.body;
    const insertQuery = `INSERT INTO "SPORT" ("Name") VALUES ($1) RETURNING *;`;
    const newSport = await pool.query(insertQuery, [Name]);

    res.status(201).json(newSport.rows[0]);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: "Greška na serveru prilikom dodavanja sporta." });
  }
});

//PUT /sports/:id
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const IdUserType = req.user.IdUserType;
    const UserTypeName = await pool.query(`SELECT "Name" FROM "USER_TYPE" WHERE "IdUserType" = $1`, [IdUserType]);

    if (UserTypeName.rows[0].Name !== "KoordinatorSport") {
      return res.status(403).json({ message: "Nemate dozvolu za pristup sportskim kategorijama." });
    }

    const { id } = req.params;
    const { Name } = req.body;
    const updateQuery = `UPDATE "SPORT" SET "Name" = $1 WHERE "IdSport" = $2 RETURNING *;`;
    const updatedSport = await pool.query(updateQuery, [Name, id]);

    if (updatedSport.rows.length === 0) {
      return res.status(404).json({ message: "Sport nije pronađen." });
    }
    res.status(200).json(updatedSport.rows[0]);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: "Greška na serveru prilikom ažuriranja sporta." });
  }
});

// DELETE /sports/:id
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const IdUserType = req.user.IdUserType;
    const UserTypeName = await pool.query(`SELECT "Name" FROM "USER_TYPE" WHERE "IdUserType" = $1`, [IdUserType]);

    if (UserTypeName.rows[0].Name !== "KoordinatorSport") {
      return res.status(403).json({ message: "Nemate dozvolu za pristup sportskim kategorijama." });
    }

    const { id } = req.params;
    const deleteQuery = `DELETE FROM "SPORT" WHERE "IdSport" = $1 RETURNING *;`;
    const deletedSport = await pool.query(deleteQuery, [id]);
    if (deletedSport.rows.length === 0) {
      return res.status(404).json({ message: "Sport nije pronađen." });
    }
    res.status(200).json({ message: "Sport je uspešno obrisan." });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: "Greška na serveru prilikom brisanja sporta." });
  }
});

export default router;
