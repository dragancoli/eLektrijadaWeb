// routes/competitions.js
import express from "express";
import pool from "../db.js";

import authMiddleware from "../middleware/authMiddleware.js";

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import multer from "multer";
import { Expo } from "expo-server-sdk";

const router = express.Router();
const expo = new Expo();

const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
// GET /sciences - lista nauka
router.get("/", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s."IdScience", s."Name"
       FROM "SCIENCE" s
       ORDER BY s."Name" ASC;`
    );

    res.status(200).json(result.rows || []);
  } catch (error) {
    res.status(500).json({ message: "Greška na serveru prilikom preuzimanja nauka." });
  }
});

// GET /sciences/mentors - lista mentora (za combo)
// Query parametri (opcionalno):
//  - q: string pretrage po imenu, prezimenu ili emailu (case-insensitive)
//  - limit, offset: paginacija
router.get("/mentors", authMiddleware, async (req, res) => {
  try {
    const canAccess = req.user?.IdUserType === 4;
    if (!canAccess) {
      return res.status(403).json({ message: "Pristup dozvoljen samo koordinatoru nauke." });
    }

    const { q = "", limit = 100, offset = 0 } = req.query;

    const whereSearch = q
      ? `AND (u."Name" || ' ' || u."Lastname" || ' ' || COALESCE(u."Email", '')) ILIKE '%' || $1 || '%'`
      : "";

    const values = [];
    if (q) values.push(String(q));

    // Napomena: IdUserType = 2 je Mentor
    const baseSQL = `
      SELECT 
        u."IdUser",
        u."Name",
        u."Lastname",
        u."Email",
        f."Name" AS "FacultyName"
      FROM "USER" u
      LEFT JOIN "FACULTY" f ON f."IdFaculty" = u."IdFaculty"
      WHERE u."IdUserType" = 2
      ${whereSearch}
      ORDER BY u."Lastname" ASC, u."Name" ASC
      LIMIT $${values.length + 1} OFFSET $${values.length + 2};
    `;

    values.push(Number(limit));
    values.push(Number(offset));

    const result = await pool.query(baseSQL, values);

    // Dodatno polje FullName za jednostavno prikazivanje u kombo boksu
    const rows = (result.rows || []).map((r) => ({
      ...r,
      FullName: [r.Name, r.Lastname].filter(Boolean).join(" "),
    }));

    res.status(200).json(rows);
  } catch (error) {
    res.status(500).json({ message: "Greška na serveru prilikom preuzimanja mentora." });
  }
});

//GET /sciences/competitions
router.get("/competitions", async (req, res) => {
    try {
        const query = `
      SELECT
        sc.*,
        s."IdScience"            AS "Science_Id",
        s."Name"                 AS "Science_Name"
      FROM "SCIENCE_COMPETITION" sc
      LEFT JOIN "SCIENCE" s
        ON sc."IdScience" = s."IdScience"
      ORDER BY sc."IdScienceCompetition" DESC
    `;

        const result = await pool.query(query);
        return res.json(result.rows);
    } catch (error) {
        console.error("Error fetching competitions with science:", error);
        return res.status(500).json({ message: "Greška pri dohvatanju takmičenja." });
    }
});


//GET /sciences/mentors/:mentorId
router.get("/mentors/:mentorId", async (req, res) => {
    const { mentorId } = req.params;
    try {
        const query = `
        SELECT
            sc.*,
            s."Name"                 AS "Science_Name",
            a."StartDate"                 AS "Review_Appointment_Date",
            a."Duration"             AS "Review_Appointment_Duration",
            a."Location"             AS "Review_Appointment_Location"
        FROM "SCIENCE_COMPETITION" sc
        LEFT JOIN "SCIENCE" s
            ON sc."IdScience" = s."IdScience"
        LEFT JOIN "APPOINTMENT" a
            on sc."ReviewAppointment" = a."IdAppointment"
        WHERE sc."IdMentor" = $1
        ORDER BY sc."IdScienceCompetition" DESC
        `;

        const result = await pool.query(query, [mentorId]);

        return res.json(result.rows);
    } catch (error) {
        console.error("Error fetching competitions for mentor:", error);
        return res.status(500).json({ message: "Greška pri dohvatanju takmičenja za mentora." });
    }
});
// PUT: Ažuriranje detalja takmičenja (BEZ fajla)
router.put(
    "/mentors/:mentorId/competitions/:competitionId",
    authMiddleware,
    // NEMA upload middleware-a ovdje jer šaljemo JSON
    async (req, res) => {
      const { mentorId, competitionId } = req.params;
      const { NumberOfQuestions, Duration, StartDate, Location } = req.body;
  
      try {
          // 1. Provjera dozvola
          const checkQuery = `SELECT 1 FROM "SCIENCE_COMPETITION" WHERE "IdScienceCompetition" = $1 AND "IdMentor" = $2`;
          const checkResult = await pool.query(checkQuery, [competitionId, mentorId]);
  
          if (checkResult.rows.length === 0) {
              return res.status(403).json({ message: "Nemate dozvolu za ovo takmičenje." });
          }
  
          // 2. Ažuriranje Termina (APPOINTMENT) ako ima podataka
          let appointmentId = null;
          
          // Prvo dohvati trenutni appointment ID
          const getApptQuery = `SELECT "ReviewAppointment" FROM "SCIENCE_COMPETITION" WHERE "IdScienceCompetition" = $1`;
          const apptRes = await pool.query(getApptQuery, [competitionId]);
          appointmentId = apptRes.rows[0]?.ReviewAppointment;
  
          if (Duration !== undefined || StartDate !== undefined || Location !== undefined) {
              if (appointmentId) {
                  // Update postojećeg
                  const updateApptParts = [];
                  const updateApptVals = [];
                  let idx = 1;
  
                  if (StartDate) { updateApptParts.push(`"StartDate" = $${idx++}`); updateApptVals.push(StartDate); }
                  if (Duration) { updateApptParts.push(`"Duration" = $${idx++}`); updateApptVals.push(Duration); }
                  if (Location) { updateApptParts.push(`"Location" = $${idx++}`); updateApptVals.push(Location); }
  
                  if (updateApptParts.length > 0) {
                      updateApptVals.push(appointmentId);
                      await pool.query(`UPDATE "APPOINTMENT" SET ${updateApptParts.join(", ")} WHERE "IdAppointment" = $${idx}`, updateApptVals);
                  }
              } else {
                  // Insert novog (ako ga nije bilo)
                  const insCols = []; const insVals = []; const insPh = []; let idx = 1;
                  if (StartDate) { insCols.push('"StartDate"'); insVals.push(StartDate); insPh.push(`$${idx++}`); }
                  if (Duration) { insCols.push('"Duration"'); insVals.push(Duration); insPh.push(`$${idx++}`); }
                  if (Location) { insCols.push('"Location"'); insVals.push(Location); insPh.push(`$${idx++}`); }
  
                  if (insCols.length > 0) {
                      const newAppt = await pool.query(`INSERT INTO "APPOINTMENT" (${insCols.join(", ")}) VALUES (${insPh.join(", ")}) RETURNING "IdAppointment"`, insVals);
                      appointmentId = newAppt.rows[0].IdAppointment;
                  }
              }
          }
  
          // 3. Ažuriranje Takmičenja (SCIENCE_COMPETITION)
          const fields = [];
          const values = [];
          let index = 1;
  
          if (NumberOfQuestions !== undefined) {
              fields.push(`"NumberOfQuestions" = $${index++}`);
              values.push(NumberOfQuestions);
          }
          
          // Ako smo kreirali novi appointment, moramo povezati ID
          if (appointmentId && !apptRes.rows[0]?.ReviewAppointment) {
               fields.push(`"ReviewAppointment" = $${index++}`);
               values.push(appointmentId);
          }
  
          if (fields.length > 0) {
              values.push(competitionId);
              await pool.query(`UPDATE "SCIENCE_COMPETITION" SET ${fields.join(", ")} WHERE "IdScienceCompetition" = $${index}`, values);
          }
  
          res.status(200).json({ message: "Podaci uspješno ažurirani." });
  
          // Slanje notifikacija (nakon uspješnog ažuriranja)
          // Šalji notifikacije samo ako je promijenjen termin uvida
          const reviewAppointmentChanged = Duration !== undefined || StartDate !== undefined || Location !== undefined;
          
          if (reviewAppointmentChanged) {
              try {
                  // Dohvati naziv nauke za notifikaciju
                  const scienceQuery = `
                      SELECT s."Name" AS "ScienceName"
                      FROM "SCIENCE_COMPETITION" sc
                      JOIN "SCIENCE" s ON sc."IdScience" = s."IdScience"
                      WHERE sc."IdScienceCompetition" = $1
                  `;
                  const scienceResult = await pool.query(scienceQuery, [competitionId]);
                  const scienceName = scienceResult.rows[0]?.ScienceName || "Takmičenje";

                  // Dohvati sve tokene pretplaćenih korisnika
                  const tokensQuery = `SELECT "ExpoPushToken" FROM "COMPETITION_NOTIFICATIONS" WHERE "IdScienceCompetition" = $1`;
                  const tokensResult = await pool.query(tokensQuery, [competitionId]);
                  const pushTokens = tokensResult.rows.map(row => row.ExpoPushToken);

                  if (pushTokens.length > 0) {
                      const messages = [];
                      for (const pushToken of pushTokens) {
                          if (!Expo.isExpoPushToken(pushToken)) {
                              console.error(`Push token ${pushToken} is not a valid Expo push token`);
                              continue;
                          }

                          messages.push({
                              to: pushToken,
                              sound: 'default',
                              title: 'Termin uvida postavljen!',
                              body: `${scienceName} - Postavljen termin uvida`,
                              data: { competitionId: competitionId },
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
          }
  
      } catch (error) {
          console.error(error);
          res.status(500).json({ message: "Greška na serveru." });
      }
    }
  );
  
  router.post(
    "/mentors/:mentorId/competitions/:competitionId/solution",
    authMiddleware,
    upload.single("document"),
    async (req, res) => {
      const { mentorId, competitionId } = req.params;
  
      if (!req.file) {
          return res.status(400).json({ message: "Fajl nije poslan." });
      }
  
      try {
          // 1. Provjera dozvola
          const checkQuery = `SELECT 1 FROM "SCIENCE_COMPETITION" WHERE "IdScienceCompetition" = $1 AND "IdMentor" = $2`;
          const checkResult = await pool.query(checkQuery, [competitionId, mentorId]);
          if (checkResult.rows.length === 0) return res.status(403).json({ message: "Nemate dozvolu." });
  
          // 2. Upload na S3
          const fileName = `competitions/${competitionId}/${Date.now()}_${req.file.originalname}`;
          const params = {
              Bucket: process.env.AWS_BUCKET_NAME,
              Key: fileName,
              Body: req.file.buffer,
              ContentType: req.file.mimetype,
          };
          
          await s3Client.send(new PutObjectCommand(params));
          const solutionUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
  
          // 3. Update baze (samo SolutionUrl)
          const updateQuery = `
              UPDATE "SCIENCE_COMPETITION" 
              SET "SolutionUrl" = $1 
              WHERE "IdScienceCompetition" = $2
          `;
          await pool.query(updateQuery, [solutionUrl, competitionId]);
  
          res.status(200).json({ message: "Rješenje uploadovano.", url: solutionUrl });
  
          // Slanje notifikacija (nakon uspješnog uploada rješenja)
          try {
              // Dohvati naziv nauke za notifikaciju
              const scienceQuery = `
                  SELECT s."Name" AS "ScienceName"
                  FROM "SCIENCE_COMPETITION" sc
                  JOIN "SCIENCE" s ON sc."IdScience" = s."IdScience"
                  WHERE sc."IdScienceCompetition" = $1
              `;
              const scienceResult = await pool.query(scienceQuery, [competitionId]);
              const scienceName = scienceResult.rows[0]?.ScienceName || "Takmičenje";

              // Dohvati sve tokene pretplaćenih korisnika
              const tokensQuery = `SELECT "ExpoPushToken" FROM "COMPETITION_NOTIFICATIONS" WHERE "IdScienceCompetition" = $1`;
              const tokensResult = await pool.query(tokensQuery, [competitionId]);
              const pushTokens = tokensResult.rows.map(row => row.ExpoPushToken);

              if (pushTokens.length > 0) {
                  const messages = [];
                  for (const pushToken of pushTokens) {
                      if (!Expo.isExpoPushToken(pushToken)) {
                          console.error(`Push token ${pushToken} is not a valid Expo push token`);
                          continue;
                      }

                      messages.push({
                          to: pushToken,
                          sound: 'default',
                          title: 'Rješenja objavljena!',
                          body: `${scienceName} - Rješenja su dostupna`,
                          data: { competitionId: competitionId },
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
              // Ne vraćamo grešku klijentu jer je upload uspeo
          }
  
      } catch (error) {
          console.error(error);
          res.status(500).json({ message: "Greška pri uploadu." });
      }
    }
  );

//GET /sciences/mentors/:mentorId/competitions/:competitionId/users
router.get("/mentors/:mentorId/competitions/:competitionId/users", authMiddleware, async (req, res) => {
    const { mentorId, competitionId } = req.params;

    try {
        // Check if mentor has permission
        const checkQuery = `
            SELECT 1 FROM "SCIENCE_COMPETITION"
            WHERE "IdScienceCompetition" = $1 AND "IdMentor" = $2
        `;
        const checkResult = await pool.query(checkQuery, [competitionId, mentorId]);

        if (checkResult.rows.length === 0) {
            //return res.status(403).json({ message: "Mentor doesn't have permission to get the members of this competition"});
            return res.status(403).json({ message: "Mentor nema dozvolu za dobijanje članova ovog takmičenja" });
        }

        // Fetch all users in the competition
        const query = `
            SELECT 
                u."IdUser",
                u."Name",
                u."Lastname",
                u."Email",
                tm."IdTeam",
                tm."Verified"
            FROM "TEAM_MEMBERS" tm
            JOIN "USER" u ON tm."IdUser" = u."IdUser"
            JOIN "TEAM" t ON tm."IdTeam" = t."IdTeam"
            WHERE t."IdScienceCompetition" = $1
            ORDER BY u."Lastname", u."Name";
        `;

        const result = await pool.query(query, [competitionId]);

        if (result.rows.length === 0) {
            // return res.status(404).json({ message: "No users found for this science competition." });
            return res.status(404).json({ message: "Nema korisnika za ovo naučno takmičenje." });
        }

        res.status(200).json(result.rows);

    } catch (error) {
        console.error("Error fetching users:", error);
        //res.status(500).json({ message: "Server error while fetching users." });
        res.status(500).json({ message: "Greška servera pri dohvatanju korisnika." });
    }
});

// PUT /sciences/steward/:stewardId/
router.put("/steward/:stewardId/", authMiddleware, async (req, res) => {
    const { mentorId, } = req.params;
    const { competitionId, userId, verified } = req.body;

    if (verified === undefined) {
        //return res.status(400).json({ message: "Missing 'verified' in request body." });
        return res.status(400).json({ message: "Nedostaje 'verified' u tijelu zahtjeva." });
    }

    try {
        //Check if stewardId belongs to account type steward
        const stewardCheckQuery = `
            SELECT 1
            FROM "USER" u
            JOIN "ACCOUNT_TYPE" at ON u."IdAccountType" = at."IdAccountType"
            WHERE u."IdUser" = $1 AND at."TypeName" = 'Steward'
        `;
        const stewardCheckResult = await pool.query(stewardCheckQuery, [mentorId]);
        if (stewardCheckResult.rows.length === 0) {
            //return res.status(403).json({ message: "User is not authorized as a steward." });
            return res.status(403).json({ message: "Korisnik nije ovlašten kao redar." });
        }

        // 2️⃣ Update the verified status
        const updateQuery = `
            UPDATE "TEAM_MEMBERS"
            SET "Verified" = $1
            WHERE "IdUser" = $2
              AND "IdTeam" IN (
                  SELECT "IdTeam" FROM "TEAM" WHERE "IdScienceCompetition" = $3
              )
            RETURNING *;
        `;
        const updateResult = await pool.query(updateQuery, [verified, userId, competitionId]);

        if (updateResult.rows.length === 0) {
            // return res.status(404).json({ message: "User not found in this competition." });
            return res.status(404).json({ message: "Korisnik nije pronađen u ovom takmičenju." });
        }

        //res.status(200).json({ message: "Verified status updated successfully.", data: updateResult.rows[0] });
        res.status(200).json({ message: "Status verifikacije je uspješno ažuriran.", data: updateResult.rows[0] });
    } catch (error) {
        console.error("Error updating verified status:", error);
        //res.status(500).json({ message: "Server error while updating verified status." });
        res.status(500).json({ message: "Greška servera pri ažuriranju statusa verifikacije." });
    }
});

// GET /science/competitions/:competitionId/results
router.get("/mentors/:mentorId/competitions/:competitionId/results", async (req, res) => {
    const { mentorId, competitionId } = req.params;

    try {
        // Provjera da li je mentor zadužen za to takmičenje
        const mentorCheckQuery = `
            SELECT 1 
            FROM "SCIENCE_COMPETITION" sc
            WHERE sc."IdScienceCompetition" = $1
              AND sc."IdMentor" = $2
        `;
        const mentorCheckResult = await pool.query(mentorCheckQuery, [competitionId, mentorId]);

        if (mentorCheckResult.rows.length === 0) {
            return res.status(403).json({ message: "Mentor nema dozvolu čitanja ovih rezultata." });
        }

        // ISPRAVLJEN UPIT
        const query = `
            SELECT
                u."IdUser",
                u."Name",
                u."Lastname",
                u."Email",
                ur."QuestionNumber",
                ur."Score",
                t."IdTeam"
            FROM "TEAM" t
            JOIN "TEAM_MEMBERS" tm ON t."IdTeam" = tm."IdTeam"
            JOIN "USER" u ON tm."IdUser" = u."IdUser"
            -- LEFT JOIN ključan: uzima rezultate ako postoje, ako ne, vraća NULL
            LEFT JOIN "USER_RESULTS" ur ON u."IdUser" = ur."IdUser" AND ur."IdScienceCompetition" = t."IdScienceCompetition"
            WHERE t."IdScienceCompetition" = $1
            ORDER BY u."Lastname", u."Name", ur."QuestionNumber";
        `;

        const result = await pool.query(query, [competitionId]);

        // Ovdje više ne vraćamo 404 ako nema rezultata u USER_RESULTS, 
        // već vraćamo listu studenata (čak i ako su ocjene null).
        // 404 vraćamo samo ako NEMA TIMOVA prijavljenih na takmičenje.
        if (result.rows.length === 0) {
            return res.status(200).json([]); // Vrati prazan niz umjesto greške ako niko nije prijavljen
        }

        res.status(200).json(result.rows);

    } catch (error) {
        console.error("Error fetching competition results:", error);
        res.status(500).json({ message: "Greška servera pri dohvatanju rezultata takmičenja." });
    }
});


// POST /science/mentors/:mentorId/competitions/:competitionId/results
router.post("/mentors/:mentorId/competitions/:competitionId/results", authMiddleware, async (req, res) => {
    const { mentorId, competitionId } = req.params;
    const { userId, questionNumber, score } = req.body;

    if (!userId || questionNumber === undefined || score === undefined) {
        //return res.status(400).json({ message: "Missing required fields: userId, questionNumber, score." });
        return res.status(400).json({ message: "Nedostaju obavezna polja: userId, questionNumber, score." });
    }

    try {
        const mentorCheckQuery = `
            SELECT 1 
            FROM "SCIENCE_COMPETITION" sc
            WHERE sc."IdScienceCompetition" = $1
              AND sc."IdMentor" = $2
        `;
        const mentorCheckResult = await pool.query(mentorCheckQuery, [competitionId, mentorId]);
        if (mentorCheckResult.rows.length === 0) {
            //return res.status(403).json({ message: "Mentor doesn't have permission to add results for this competition." });
            return res.status(403).json({ message: "Mentor nema dozvolu za dodavanje rezultata za ovo takmičenje." });
        }
        // Check if the user exists
        const userCheck = await pool.query(
            'SELECT 1 FROM "USER" WHERE "IdUser" = $1',
            [userId]
        );
        if (userCheck.rows.length === 0) {
            //return res.status(404).json({ message: "User not found." });
            return res.status(404).json({ message: "Korisnik nije pronađen." });
        }

        // Check if the competition exists
        const competitionCheck = await pool.query(
            'SELECT 1 FROM "SCIENCE_COMPETITION" WHERE "IdScienceCompetition" = $1',
            [competitionId]
        );
        if (competitionCheck.rows.length === 0) {
            //return res.status(404).json({ message: "Competition not found." });
            return res.status(404).json({ message: "Takmičenje nije pronađeno." });
        }

        // Check for existing entry (primary key constraint)
        const existingCheck = await pool.query(
            `SELECT 1 FROM "USER_RESULTS" 
             WHERE "IdUser" = $1 AND "IdScienceCompetition" = $2 AND "QuestionNumber" = $3`,
            [userId, competitionId, questionNumber]
        );
        if (existingCheck.rows.length > 0) {
            //return res.status(400).json({ message: "This user's score for this question already exists." });
            return res.status(400).json({ message: "Rezultat ovog korisnika za ovo pitanje već postoji." });
        }

        // Insert the new result
        const insertQuery = `
            INSERT INTO "USER_RESULTS" ("IdUser", "IdScienceCompetition", "QuestionNumber", "Score")
            VALUES ($1, $2, $3, $4)
            RETURNING *;
        `;
        const result = await pool.query(insertQuery, [userId, competitionId, questionNumber, score]);

        //res.status(201).json({ message: "User result added successfully.", data: result.rows[0] });
        res.status(201).json({ message: "Rezultat korisnika je uspješno dodat.", data: result.rows[0] });

    } catch (error) {
        console.error("Error adding user result:", error);
        //res.status(500).json({ message: "Server error while adding user result." });
        res.status(500).json({ message: "Greška servera pri dodavanju rezultata korisnika." });
    }
});

// PUT /science/competitions/:competitionId/results/:userId/:questionNumber
router.put("/mentors/:mentorId/competitions/:competitionId/results", authMiddleware, async (req, res) => {
    const { mentorId, competitionId } = req.params;
    const { score, userId, questionNumber } = req.body;

    if (score === undefined) {
        //return res.status(400).json({ message: "Missing 'score' in request body." });
        return res.status(400).json({ message: "Nedostaje 'score' u tijelu zahtjeva." });
    }

    try {
        const mentorCheckQuery = `
        SELECT 1 
        FROM "SCIENCE_COMPETITION" sc
        WHERE sc."IdScienceCompetition" = $1
          AND sc."IdMentor" = $2
        `;
        const mentorCheckResult = await pool.query(mentorCheckQuery, [competitionId, mentorId]);
        if (mentorCheckResult.rows.length === 0) {
            //return res.status(403).json({ message: "Mentor doesn't have permission to add results for this competition." });

        }

        // Check if the result exists
        const existingCheck = await pool.query(
            `SELECT * FROM "USER_RESULTS"
             WHERE "IdUser" = $1 AND "IdScienceCompetition" = $2 AND "QuestionNumber" = $3`,
            [userId, competitionId, questionNumber]
        );
        if (existingCheck.rows.length === 0) {
            return res.status(404).json({ message: "User result not found." });
        }

        // Update the score
        const updateQuery = `
            UPDATE "USER_RESULTS"
            SET "Score" = $1
            WHERE "IdUser" = $2 AND "IdScienceCompetition" = $3 AND "QuestionNumber" = $4
            RETURNING *;
        `;
        const result = await pool.query(updateQuery, [score, userId, competitionId, questionNumber]);

        res.status(200).json({ message: "User result updated successfully.", data: result.rows[0] });

    } catch (error) {
        console.error("Error updating user result:", error);
        res.status(500).json({ message: "Server error while updating user result." });
    }
});


//DELETE /science/competitions/:competitionId/results/:userId/:questionNumber
router.delete("/mentors/:mentorId/competitions/:competitionId/results/:userId/:questionNumber", authMiddleware, async (req, res) => {
    const { mentorId, competitionId, userId, questionNumber } = req.params;

    try {
        const mentorCheckQuery = `
        SELECT 1 
        FROM "SCIENCE_COMPETITION" sc
        WHERE sc."IdScienceCompetition" = $1
          AND sc."IdMentor" = $2
        `;
        const mentorCheckResult = await pool.query(mentorCheckQuery, [competitionId, mentorId]);
        if (mentorCheckResult.rows.length === 0) {
            return res.status(403).json({ message: "Mentor doesn't have permission to add results for this competition." });
        }
        // Check if the result exists
        const existingCheck = await pool.query(
            `SELECT * FROM "USER_RESULTS"
             WHERE "IdUser" = $1 AND "IdScienceCompetition" = $2 AND "QuestionNumber" = $3`,
            [userId, competitionId, questionNumber]
        );
        if (existingCheck.rows.length === 0) {
            return res.status(404).json({ message: "User result not found." });
        }

        // Delete the result
        const deleteQuery = `
            DELETE FROM "USER_RESULTS"
            WHERE "IdUser" = $1 AND "IdScienceCompetition" = $2 AND "QuestionNumber" = $3
        `;
        await pool.query(deleteQuery, [userId, competitionId, questionNumber]);

        res.status(200).json({ message: "User result deleted successfully." });

    } catch (error) {
        console.error("Error deleting user result:", error);
        res.status(500).json({ message: "Server error while deleting user result." });
    }
});




export default router;


