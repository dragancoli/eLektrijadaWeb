import express from "express";
import pool from "../db.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { Expo } from "expo-server-sdk";

const expo = new Expo();

const router = express.Router();

// GET /matches
router.get("/", authMiddleware, async (req, res) => {
  try {
    const IdUserType = req.user.IdUserType;
    const UserTypeName = await pool.query(`SELECT "Name" FROM "USER_TYPE" WHERE "IdUserType" = $1`, [IdUserType]);

    if (UserTypeName.rows[0].Name !== "KoordinatorSport") {
      return res.status(403).json({ message: "Nemate dozvolu za pristup sportskim mecevima." });
    }

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

// GET /matches/:id
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const IdUserType = req.user.IdUserType;
    const UserTypeName = await pool.query(`SELECT "Name" FROM "USER_TYPE" WHERE "IdUserType" = $1`, [IdUserType]);

    if (UserTypeName.rows[0].Name !== "KoordinatorSport") {
      return res.status(403).json({ message: "Nemate dozvolu za pristup sportskim mecevima." });
    }

    const { id } = req.params;
    const query = `
      SELECT 
        m."IdMatch", m."IdTeam1", m."IdTeam2", m."IdSportCompetition", 
        m."ResultTeam1", m."ResultTeam2", m."Status", m."Stage",
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
      WHERE m."IdMatch" = $1;
    `;
    const match = await pool.query(query, [id]);

    if (match.rows.length === 0) {
      return res.status(404).json({ message: "Meč nije pronađen." });
    }
    res.status(200).json(match.rows[0]);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: "Greška na serveru prilikom preuzimanja meča." });
  }
});

// POST /matches
router.post("/", authMiddleware, async (req, res) => {
  const { IdTeam1, IdTeam2, IdSportCompetition, Status, Stage, StartDate, Duration, Location } = req.body;
  if (!IdTeam1 || !IdTeam2 || !IdSportCompetition || !Status || !StartDate || !Duration || !Location) {
    return res.status(400).json({ message: "Sva obavezna polja nisu popunjena." });
  }

  const client = await pool.connect();

  try {
    const IdUserType = req.user.IdUserType;
    const UserTypeName = await client.query(`SELECT "Name" FROM "USER_TYPE" WHERE "IdUserType" = $1`, [IdUserType]);

    if (UserTypeName.rows[0].Name !== "KoordinatorSport") {
      return res.status(403).json({ message: "Nemate dozvolu za pristup sportskim mecevima." });
    }

    await client.query("BEGIN");

    const appointmentQuery = `
      INSERT INTO "APPOINTMENT" ("StartDate", "Duration", "Location")
      VALUES ($1, $2, $3)
      RETURNING "IdAppointment";
    `;
    const newAppointment = await client.query(appointmentQuery, [StartDate, Duration, Location]);
    const idAppointment = newAppointment.rows[0].IdAppointment;

    const matchQuery = `
      INSERT INTO "MATCH" 
      ("IdTeam1", "IdTeam2", "IdSportCompetition", "Status", "Stage", "IdAppointment")
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    const newMatch = await client.query(matchQuery, [
      IdTeam1,
      IdTeam2,
      IdSportCompetition,
      Status,
      Stage,
      idAppointment,
    ]);

    await client.query("COMMIT");
    res.status(201).json(newMatch.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error.message);
    res.status(500).json({ message: "Greška na serveru prilikom kreiranja meča." });
  } finally {
    client.release();
  }
});

// PUT /matches/:id (verzija sa parcijalnim ažuriranjem)
router.put("/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const {
    IdTeam1,
    IdTeam2,
    IdSportCompetition,
    Status,
    Stage,
    ResultTeam1,
    ResultTeam2,
    StartDate,
    Duration,
    Location,
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const IdUserType = req.user.IdUserType;
    const UserTypeName = await client.query(`SELECT "Name" FROM "USER_TYPE" WHERE "IdUserType" = $1`, [IdUserType]);

    if (UserTypeName.rows[0].Name !== "KoordinatorSport") {
      await client.query("ROLLBACK");
      return res.status(403).json({ message: "Nemate dozvolu za pristup sportskim mečevima." });
    }

    const matchInfo = await client.query('SELECT "IdAppointment" FROM "MATCH" WHERE "IdMatch" = $1', [id]);
    if (matchInfo.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Meč nije pronađen." });
    }
    const idAppointment = matchInfo.rows[0].IdAppointment;

    const appFields = {
      StartDate,
      Duration,
      Location,
    };
    const appSetClauses = [];
    const appValues = [];
    let appParamIndex = 1;

    for (const [key, value] of Object.entries(appFields)) {
      if (value !== undefined) {
        appSetClauses.push(`"${key}" = $${appParamIndex}`);
        appValues.push(value);
        appParamIndex++;
      }
    }

    if (appSetClauses.length > 0) {
      const appQuery = `
        UPDATE "APPOINTMENT" 
        SET ${appSetClauses.join(", ")} 
        WHERE "IdAppointment" = $${appParamIndex};
      `;
      appValues.push(idAppointment);
      await client.query(appQuery, appValues);
    }

    const matchFields = {
      IdTeam1,
      IdTeam2,
      IdSportCompetition,
      Status,
      Stage,
      ResultTeam1,
      ResultTeam2,
    };
    const matchSetClauses = [];
    const matchValues = [];
    let matchParamIndex = 1;

    for (const [key, value] of Object.entries(matchFields)) {
      if (value !== undefined) {
        matchSetClauses.push(`"${key}" = $${matchParamIndex}`);
        matchValues.push(value);
        matchParamIndex++;
      }
    }

    if (matchSetClauses.length > 0) {
      const matchQuery = `
        UPDATE "MATCH" 
        SET ${matchSetClauses.join(", ")} 
        WHERE "IdMatch" = $${matchParamIndex};
      `;
      matchValues.push(id);
      await client.query(matchQuery, matchValues);
    }

    if (appSetClauses.length === 0 && matchSetClauses.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Niste poslali nijedno polje za ažuriranje." });
    }

    const getUpdatedQuery = `
      SELECT 
        m."IdMatch", m."IdTeam1", m."IdTeam2", m."IdSportCompetition", 
        m."ResultTeam1", m."ResultTeam2", m."Status", m."Stage",
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
      WHERE m."IdMatch" = $1;
    `;
    const updatedMatch = await client.query(getUpdatedQuery, [id]);

    await client.query("COMMIT");
    res.status(200).json(updatedMatch.rows[0]);

    // Slanje notifikacija (nakon uspešnog commita)
    const matchData = updatedMatch.rows[0];
    try {
      const tokensQuery = `SELECT "ExpoPushToken" FROM "MATCH_NOTIFICATIONS" WHERE "IdMatch" = $1`;
      const tokensResult = await pool.query(tokensQuery, [id]);
      const pushTokens = tokensResult.rows.map(row => row.ExpoPushToken);

      if (pushTokens.length > 0) {
        const messages = [];
        for (const pushToken of pushTokens) {
          if (!Expo.isExpoPushToken(pushToken)) {
            console.error(`Push token ${pushToken} is not a valid Expo push token`);
            continue;
          }

          let body = `${matchData.Team1Name} ${matchData.ResultTeam1 || 0} - ${matchData.ResultTeam2 || 0} ${matchData.Team2Name}`;
          if (matchData.Status === 'U toku') body += " (U toku)";
          else if (matchData.Status === 'Završeno') body += " (Kraj)";

          messages.push({
            to: pushToken,
            sound: 'default',
            title: 'Promjena na meču!',
            body: body,
            data: { matchId: id },
          });
        }

        const chunks = expo.chunkPushNotifications(messages);
        for (const chunk of chunks) {
          try {
            await expo.sendPushNotificationsAsync(chunk);
          } catch (error) {
            console.error("Error sending push notifications chunk:", error);
          }
        }
      }
    } catch (notificationError) {
      console.error("Error processing notifications:", notificationError);
      // Ne vraćamo grešku klijentu jer je update uspeo
    }
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error.message);
    res.status(500).json({ message: "Greška na serveru prilikom ažuriranja meča." });
  } finally {
    client.release();
  }
});

// DELETE /matches/:id
router.delete("/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const IdUserType = req.user.IdUserType;
    const UserTypeName = await client.query(`SELECT "Name" FROM "USER_TYPE" WHERE "IdUserType" = $1`, [IdUserType]);

    if (UserTypeName.rows[0].Name !== "KoordinatorSport") {
      return res.status(403).json({ message: "Nemate dozvolu za pristup sportskim mecevima." });
    }

    const deleteMatchQuery = `
      DELETE FROM "MATCH" 
      WHERE "IdMatch" = $1 
      RETURNING "IdAppointment";
    `;
    const deletedMatch = await client.query(deleteMatchQuery, [id]);

    if (deletedMatch.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Meč nije pronađen." });
    }
    const idAppointment = deletedMatch.rows[0].IdAppointment;

    const deleteAppointmentQuery = `
      DELETE FROM "APPOINTMENT" 
      WHERE "IdAppointment" = $1;
    `;
    await client.query(deleteAppointmentQuery, [idAppointment]);

    await client.query("COMMIT");
    res.status(200).json({ message: "Meč i povezani termin su uspešno obrisani." });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error.message);
    res.status(500).json({ message: "Greška na serveru prilikom brisanja meča." });
  } finally {
    client.release();
  }
});

export default router;
