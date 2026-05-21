import express from "express";
import pool from "../db.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import multer from "multer";

const router = express.Router();

// AWS S3 Configuration
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Multer Configuration
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// GET /science-competitions (pregled svih naučnih takmičenja)
router.get("/", authMiddleware, async (req, res) => {
    try {
        if (req.user.IdUserType !== 4) {
            return res.status(403).json({ message: "Pristup dozvoljen samo koordinatoru za nauku." });
        }

        const result = await pool.query(`
      SELECT
        sc."IdScienceCompetition",
        sc."IdScience",
        s."Name" AS "ScienceName",
        sc."Year",
        sc."IdMentor",
        sc."IdAppointment",
        a."StartDate" AS "StartDate",
        a."Duration" AS "Duration",
        a."Location" AS "Location",
        sc."NumberOfQuestions",
        sc."SolutionUrl"
      FROM "SCIENCE_COMPETITION" sc
      JOIN "SCIENCE" s ON sc."IdScience" = s."IdScience"
      LEFT JOIN "APPOINTMENT" a ON sc."IdAppointment" = a."IdAppointment"
      ORDER BY sc."Year" DESC, s."Name" ASC;
            `);

        res.status(200).json(result.rows);
    } catch (error) {
        res.status(500).json({ message: "Greška na serveru prilikom preuzimanja naučnih takmičenja." });
    }
});

// GET /science-competitions/:id (pregled detalja naučnog takmičenja)
router.get("/:id", authMiddleware, async (req, res) => {
    try {
        if (req.user.IdUserType !== 4) {
            return res.status(403).json({ message: "Pristup dozvoljen samo koordinatoru za nauku." });
        }

        const competitionId = req.params.id;
        const result = await pool.query(`
      SELECT
        sc."IdScienceCompetition",
        sc."IdScience",
        s."Name" AS "ScienceName",
        sc."Year",
        sc."IdMentor",
        sc."IdAppointment",
        a."StartDate" AS "StartDate",
        a."Duration" AS "Duration",
        a."Location" AS "Location",
        sc."NumberOfQuestions",
        sc."SolutionUrl"
      FROM "SCIENCE_COMPETITION" sc
      JOIN "SCIENCE" s ON sc."IdScience" = s."IdScience"
      LEFT JOIN "APPOINTMENT" a ON sc."IdAppointment" = a."IdAppointment"
      WHERE sc."IdScienceCompetition" = $1;
        `, [competitionId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Naučno takmičenje nije pronađeno." });
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ message: "Greška na serveru prilikom preuzimanja detalja naučnog takmičenja." });
    }
});

// POST /science-competitions (dodavanje novog naučnog takmičenja)
router.post("/", authMiddleware, async (req, res) => {
  try {
    if (req.user.IdUserType !== 4) {
      return res.status(403).json({ message: "Pristup dozvoljen samo koordinatoru za nauku." });
    }

    const { IdScience, Year, IdMentor, NumberOfQuestions, SolutionUrl, StartDate, Duration, Location } = req.body;

    if (!IdScience || !Year || !IdMentor || !StartDate || !Duration || !Location) {
      return res.status(400).json({ message: "Nedostaju obavezni podaci (IdScience, Year, IdMentor, StartDate, Duration, Location)." });
    }

    const mentorCheck = await pool.query(
      `SELECT u."IdUser", ut."Name" AS "UserTypeName"
       FROM "USER" u
       JOIN "USER_TYPE" ut ON u."IdUserType" = ut."IdUserType"
       WHERE u."IdUser" = $1`,
      [IdMentor]
    );

    if (mentorCheck.rows.length === 0) {
      return res.status(404).json({ message: "Mentor sa datim ID-em ne postoji." });
    }

    if (mentorCheck.rows[0].UserTypeName !== "Mentor") {
      return res.status(400).json({ message: "Odabrani korisnik nije mentorskog tipa naloga." });
    }

    const newAppointment = await pool.query(
      `INSERT INTO "APPOINTMENT" ("StartDate", "Duration", "Location")
       VALUES ($1, $2, $3)
       RETURNING "IdAppointment"`,
      [StartDate, Duration, Location]
    );

    const newAppointmentId = newAppointment.rows[0].IdAppointment;

    const insertCompetition = await pool.query(
      `INSERT INTO "SCIENCE_COMPETITION" 
       ("IdScience", "Year", "IdMentor", "IdAppointment", "NumberOfQuestions", "SolutionUrl")
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [IdScience, Year, IdMentor, newAppointmentId, NumberOfQuestions ?? null, SolutionUrl ?? null]
    );

    res.status(201).json({
      message: "Naučno takmičenje uspješno kreirano.",
      competition: insertCompetition.rows[0],
      appointment: newAppointment.rows[0]
    });
  } catch (error) {
    res.status(500).json({ message: "Greška na serveru prilikom dodavanja novog naučnog takmičenja." });
  }
});


// PUT /science-competitions/:id (izmena postojećeg naučnog takmičenja)
router.put("/:id", authMiddleware, async (req, res) => {
    const client = await pool.connect();
    try {
        if (req.user.IdUserType !== 4) {
            client.release();
            return res.status(403).json({ message: "Pristup dozvoljen samo koordinatoru za nauku." });
        }

        const competitionId = req.params.id;
        const { IdScience, Year, IdMentor, NumberOfQuestions, SolutionUrl, ReviewAppointment, StartDate, Duration, Location } = req.body;

        await client.query("BEGIN");

        const compRes = await client.query(
          `SELECT "IdAppointment" FROM "SCIENCE_COMPETITION" WHERE "IdScienceCompetition" = $1 FOR UPDATE`,
          [competitionId]
        );

        if (compRes.rows.length === 0) {
          await client.query("ROLLBACK");
          client.release();
          return res.status(404).json({ message: "Naučno takmičenje nije pronađeno." });
        }

        let appointmentId = compRes.rows[0].IdAppointment;

        // Ako je bilo koje appointment polje poslano, ažuriraj termin.
        const wantsAppointmentUpdate =
          StartDate !== undefined || Duration !== undefined || Location !== undefined;

        if (wantsAppointmentUpdate) {
          if (!appointmentId) {
            const created = await client.query(
              `INSERT INTO "APPOINTMENT" ("StartDate", "Duration", "Location") VALUES ($1, $2, $3) RETURNING "IdAppointment"`,
              [StartDate ?? null, Duration ?? null, Location ?? null]
            );
            appointmentId = created.rows[0].IdAppointment;
          } else {
            await client.query(
              `UPDATE "APPOINTMENT"
               SET "StartDate" = COALESCE($1, "StartDate"),
                   "Duration" = COALESCE($2, "Duration"),
                   "Location" = COALESCE($3, "Location")
               WHERE "IdAppointment" = $4`,
              [StartDate ?? null, Duration ?? null, Location ?? null, appointmentId]
            );
          }
        }

        const safe = (v) => (v === undefined ? null : v);
        const result = await client.query(
          `UPDATE "SCIENCE_COMPETITION"
           SET "IdScience" = COALESCE($1, "IdScience"),
               "Year" = COALESCE($2, "Year"),
               "IdMentor" = COALESCE($3, "IdMentor"),
               "IdAppointment" = COALESCE($4, "IdAppointment"),
               "NumberOfQuestions" = COALESCE($5, "NumberOfQuestions"),
               "SolutionUrl" = COALESCE($6, "SolutionUrl"),
               "ReviewAppointment" = COALESCE($7, "ReviewAppointment")
           WHERE "IdScienceCompetition" = $8
           RETURNING *;`,
          [
            safe(IdScience),
            safe(Year),
            safe(IdMentor),
            safe(appointmentId),
            safe(NumberOfQuestions),
            safe(SolutionUrl),
            safe(ReviewAppointment),
            competitionId,
          ]
        );

        await client.query("COMMIT");
        client.release();

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        try { await client.query("ROLLBACK"); } catch (e) { /* ignore */ }
        client.release();
        return res.status(500).json({ message: "Greška na serveru prilikom izmjene naučnog takmičenja." });
    }
});

// DELETE /science-competitions/:id (brisanje naučnog takmičenja + njegov termin)
router.delete("/:id", authMiddleware, async (req, res) => {
    const client = await pool.connect();
    try {
        if (req.user.IdUserType !== 4) {
            client.release();
            return res.status(403).json({ message: "Pristup dozvoljen samo koordinatoru za nauku." });
        }

        const competitionId = req.params.id;

        await client.query("BEGIN");

        // Uzmi IdAppointment vezan za takmičenje (ako postoji)
        const compRes = await client.query(
          `SELECT "IdAppointment" FROM "SCIENCE_COMPETITION" WHERE "IdScienceCompetition" = $1 FOR UPDATE`,
          [competitionId]
        );

        if (compRes.rows.length === 0) {
            await client.query("ROLLBACK");
            client.release();
            return res.status(404).json({ message: "Naučno takmičenje nije pronađeno." });
        }

        const appointmentId = compRes.rows[0].IdAppointment;

        // Obriši takmičenje
        const deleteCompRes = await client.query(
          `DELETE FROM "SCIENCE_COMPETITION" WHERE "IdScienceCompetition" = $1 RETURNING *;`,
          [competitionId]
        );

        // Ako postoji vezani appointment, pokušaj obrisati i njega
        if (appointmentId) {
          await client.query(
            `DELETE FROM "APPOINTMENT" WHERE "IdAppointment" = $1;`,
            [appointmentId]
          );
        }

        await client.query("COMMIT");
        client.release();

        return res.status(200).json({ message: "Naučno takmičenje i vezani termin su uspješno obrisani." });
    } catch (error) {
        try { await client.query("ROLLBACK"); } catch (e) { /* ignore */ }
        client.release();
        return res.status(500).json({ message: "Greška na serveru prilikom brisanja naučnog takmičenja." });
    }
});

// POST /science-competitions/:id/solution (upload dokumenta za rješenje)
router.post(
  "/:id/solution",
  authMiddleware,
  upload.single("document"),
  async (req, res) => {
    try {
      if (req.user.IdUserType !== 4) {
        return res.status(403).json({ message: "Pristup dozvoljen samo koordinatoru za nauku." });
      }

      const competitionId = req.params.id;

      if (!req.file) {
        return res.status(400).json({ message: "Fajl nije poslan." });
      }

      // 1. Provjera da li takmičenje postoji
      const checkQuery = `SELECT 1 FROM "SCIENCE_COMPETITION" WHERE "IdScienceCompetition" = $1`;
      const checkResult = await pool.query(checkQuery, [competitionId]);
      
      if (checkResult.rows.length === 0) {
        return res.status(404).json({ message: "Takmičenje nije pronađeno." });
      }

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

      // 3. Ažuriranje baze podataka
      const updateQuery = `
        UPDATE "SCIENCE_COMPETITION"
        SET "SolutionUrl" = $1
        WHERE "IdScienceCompetition" = $2
        RETURNING "SolutionUrl";
      `;

      await pool.query(updateQuery, [solutionUrl, competitionId]);

      res.status(200).json({ message: "Rješenje uspješno uploadovano.", url: solutionUrl });
    } catch (error) {
      console.error("Error uploading solution:", error);
      res.status(500).json({ message: "Greška pri uploadu rješenja." });
    }
  }
);

export default router;