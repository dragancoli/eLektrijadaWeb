import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import pool from "../db.js";
import bcrypt from "bcryptjs";

const router = express.Router();

// GET /stewards/science-competitions (spisak naučnih takmičenja za redare)
router.get("/science-competitions", authMiddleware, async (req, res) => {
    try {
        if (req.user.IdUserType !== 8 && req.user.IdUserType !== 4 && req.user.IdUserType !== 1) {
            return res.status(403).json({ message: "Pristup dozvoljen samo redarima/koordinatoru/adminu." });
        }

        const result = await pool.query(
            `SELECT sc."IdScienceCompetition",
                            s."Name"        AS "ScienceName",
                            sc."Year",
                            a."StartDate",
                            a."Location"
                 FROM "SCIENCE_COMPETITION" sc
                 JOIN "SCIENCE" s ON sc."IdScience" = s."IdScience"
                 JOIN "APPOINTMENT" a ON sc."IdAppointment" = a."IdAppointment"
                ORDER BY sc."Year" DESC, s."Name" ASC`
        );

        res.status(200).json(result.rows);
    } catch (error) {
        console.error("[stewards] Error fetching science competitions:", error);
        res.status(500).json({ message: "Greška na serveru prilikom dohvatanja naučnih takmičenja." });
    }
});

// POST /stewards/verify-student (provjera da li je student dio datog takmičenja na osnovu QR tajne)
router.post("/verify-student", authMiddleware, async (req, res) => {
    try {
        if (req.user.IdUserType !== 8 && req.user.IdUserType !== 4 && req.user.IdUserType !== 1) {
            return res.status(403).json({ message: "Pristup dozvoljen samo redarima/koordinatoru/adminu." });
        }

        const { qrSecret, competitionId } = req.body;

        if (!qrSecret || !competitionId) {
            return res.status(400).json({ message: "Nedostaju podaci: qrSecret i competitionId su obavezni." });
        }

        // Pronađi korisnika po QR tajni
        const userQuery = await pool.query(
            `SELECT u."IdUser", u."Name", u."Lastname", u."Email", u."IdFaculty", f."Name" AS "FacultyName", u."IdUserType"
                 FROM "USER" u
                 JOIN "FACULTY" f ON u."IdFaculty" = f."IdFaculty"
                WHERE u."QrSecret" = $1`,
            [qrSecret]
        );

        if (userQuery.rows.length === 0) {
            return res.status(404).json({ message: "Korisnik sa datim QR kodom nije pronađen." });
        }

        const student = userQuery.rows[0];

        // Provjeri pripadnost timu na datom naučnom takmičenju
        const membershipQuery = await pool.query(
            `SELECT tm."Verified", t."IdTeam", t."Name" AS "TeamName"
                 FROM "TEAM_MEMBERS" tm
                 JOIN "TEAM" t ON tm."IdTeam" = t."IdTeam"
                WHERE tm."IdUser" = $1 AND t."IdScienceCompetition" = $2`,
            [student.IdUser, competitionId]
        );

        const belongs = membershipQuery.rows.length > 0;
        const verified = belongs ? Boolean(membershipQuery.rows[0].Verified) : null;
        const team = belongs
            ? { IdTeam: membershipQuery.rows[0].IdTeam, Name: membershipQuery.rows[0].TeamName }
            : null;

        return res.status(200).json({
            belongs,
            verified,
            student: {
                IdUser: student.IdUser,
                Name: student.Name,
                Lastname: student.Lastname,
                Email: student.Email,
                IdFaculty: student.IdFaculty,
                FacultyName: student.FacultyName,
            },
            team,
        });
    } catch (error) {
        console.error("[stewards] Error verifying student:", error);
        res.status(500).json({ message: "Greška na serveru prilikom verifikacije studenta." });
    }
});

// POST /stewards/confirm-attendance (potvrda prisustva studenta na takmičenju)
router.post("/confirm-attendance", authMiddleware, async (req, res) => {
    try {
        if (req.user.IdUserType !== 8 && req.user.IdUserType !== 4 && req.user.IdUserType !== 1) {
            return res.status(403).json({ message: "Pristup dozvoljen samo redarima/koordinatoru/adminu." });
        }

        const { userId, competitionId } = req.body;

        if (!userId || !competitionId) {
            return res.status(400).json({ message: "UserId i competitionId su obavezni." });
        }

        // Ažuriraj status verifikacije u TEAM_MEMBERS
        // Spajamo sa TEAM da bismo osigurali da je to tim za dato takmičenje
        const updateQuery = await pool.query(
            `UPDATE "TEAM_MEMBERS" tm
             SET "Verified" = TRUE
             FROM "TEAM" t
             WHERE tm."IdTeam" = t."IdTeam"
               AND tm."IdUser" = $1
               AND t."IdScienceCompetition" = $2
             RETURNING tm."Verified"`,
            [userId, competitionId]
        );

        if (updateQuery.rowCount === 0) {
            return res.status(404).json({ message: "Student nije pronađen u timu za ovo takmičenje ili je već verifikovan (ako se ništa nije promijenilo)." });
        }

        res.status(200).json({ message: "Uspješno potvrđeno prisustvo.", verified: true });
    } catch (error) {
        console.error("[stewards] Error confirming attendance:", error);
        res.status(500).json({ message: "Greška na serveru prilikom potvrde prisustva." });
    }
});

// GET /stewards (pregled svih redara)
router.get("/", authMiddleware, async (req, res) => {
    try {
        if (req.user.IdUserType !== 4) {
            return res.status(403).json({ message: "Pristup dozvoljen samo koordinatoru za nauku." });
        }

        const result = await pool.query(`
            SELECT u."IdUser", u."Name", u."Lastname", u."Email", u."IsActive", u."IdFaculty",
                ut."Name" AS "UserTypeName", f."Name" AS "FacultyName"
            FROM "USER" u
            JOIN "USER_TYPE" ut ON u."IdUserType" = ut."IdUserType"
            JOIN "FACULTY" f ON u."IdFaculty" = f."IdFaculty"
            WHERE ut."Name" = 'Redar'
            ORDER BY u."Lastname", u."Name";
            `);

        res.status(200).json(result.rows);
    } catch (error) {
        res.status(500).json({ message: "Greška na serveru prilikom dohvatanja redara." });
    }
});

// POST /stewards (dodavanje novog redara)
router.post("/", authMiddleware, async (req, res) => {
    try {
        if (req.user.IdUserType !== 4) {
            return res.status(403).json({ message: "Pristup dozvoljen samo koordinatoru za nauku." });
        }

        const { Name, Lastname, Email, Password, IdFaculty } = req.body;

        if (!Name || !Lastname || !Email || !Password || !IdFaculty) {
            return res.status(400).json({ message: "Sva polja su obavezna." });
        }

        const userExists = await pool.query('SELECT "Email" FROM "USER" WHERE "Email" = $1', [Email]);

        if (userExists.rows.length > 0) {
            return res.status(400).json({ message: "Korisnik sa ovim emailom već postoji." });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(Password, salt);

        const redarUserType = await pool.query('SELECT "IdUserType" FROM "USER_TYPE" WHERE "Name" = $1', ["Redar"]);

        const newUser = await pool.query(`
            INSERT INTO "USER" ("Name", "Lastname", "Email", "Password", "IsActive", "IdFaculty", "IdUserType")
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING "IdUser", "Email", "Name", "IdUserType";
        `, [Name, Lastname, Email, hashedPassword, true, IdFaculty, redarUserType.rows[0].IdUserType]);

        res.status(201).json({ message: "Redar je uspešno dodat.",
            IdUser: newUser.rows[0].IdUser,
            Name: newUser.rows[0].Name,
            Email: newUser.rows[0].Email,
            IdUserType: newUser.rows[0].IdUserType
        });
    } catch (error) {
        res.status(500).json({ message: "Greška na serveru prilikom dodavanja redara." });
    }
});


// PUT /stewards/:id (izmjena postojećeg redarskog naloga)
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    if (req.user.IdUserType !== 4) {
      return res.status(403).json({ message: "Pristup dozvoljen samo koordinatoru za nauku." });
    }

    const stewardId = req.params.id;
    const { Name, Lastname, IsActive, IdFaculty } = req.body;

    const safe = v => v === undefined ? null : v;

    const result = await pool.query(
      `UPDATE "USER"
       SET "Name" = COALESCE($1, "Name"),
           "Lastname" = COALESCE($2, "Lastname"),
           "IsActive" = COALESCE($3, "IsActive"),
           "IdFaculty" = COALESCE($4, "IdFaculty"),
           "UpdatedAt" = CURRENT_TIMESTAMP
       WHERE "IdUser" = $5 
         AND "IdUserType" = (SELECT "IdUserType" FROM "USER_TYPE" WHERE "Name" = 'Redar')
       RETURNING "IdUser", "Name", "Lastname", "Email", "IsActive", "IdFaculty";`,
      [safe(Name), safe(Lastname), safe(IsActive), safe(IdFaculty), stewardId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Redar nije pronađen." });
    }

    res.status(200).json({
      message: "Redarski nalog je uspješno izmijenjen.",
      ...result.rows[0]
    });
  } catch (error) {
    console.error("Greška u PUT /stewards/:id:", error);
    res.status(500).json({ message: "Greška na serveru prilikom izmjene redara." });
  }
});

// PUT /stewards/:id/password (promjena lozinke redara)
router.put("/:id/password", authMiddleware, async (req, res) => {
  try {
    if (req.user.IdUserType !== 4) {
      return res.status(403).json({ message: "Pristup dozvoljen samo koordinatoru za nauku." });
    }

    const stewardId = req.params.id;
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({ message: "Nova lozinka je obavezna." });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: "Lozinka mora imati najmanje 8 karaktera." });
    }

    // Provjeri da li redar postoji
    const stewardCheck = await pool.query(
      `SELECT u."IdUser" FROM "USER" u
       WHERE u."IdUser" = $1 
       AND u."IdUserType" = (SELECT "IdUserType" FROM "USER_TYPE" WHERE "Name" = 'Redar')`,
      [stewardId]
    );

    if (stewardCheck.rows.length === 0) {
      return res.status(404).json({ message: "Redar nije pronađen." });
    }

    // Hešuj novu lozinku (konzistentno sa registracijom)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Ažuriraj samo lozinku
    const result = await pool.query(
      `UPDATE "USER"
       SET "Password" = $1,
           "UpdatedAt" = CURRENT_TIMESTAMP
       WHERE "IdUser" = $2
       RETURNING "IdUser", "Name", "Lastname", "Email";`,
      [hashedPassword, stewardId]
    );

    res.status(200).json({
      message: "Lozinka je uspješno promijenjena.",
      ...result.rows[0]
    });
  } catch (error) {
    console.error("Greška u PUT /stewards/:id/password:", error);
    res.status(500).json({ message: "Greška na serveru prilikom promjene lozinke." });
  }
});

// DELETE /stewards/:id (brisanje redarskog naloga)
router.delete("/:id", authMiddleware, async (req, res) => {
    try {
        if (req.user.IdUserType !== 4) {
            return res.status(403).json({ message: "Pristup dozvoljen samo koordinatoru za nauku." });
        }

        const stewardId = req.params.id;

        const deleteQuery = `
            DELETE FROM "USER"
            WHERE "IdUser" = $1 AND "IdUserType" = (
                SELECT "IdUserType" FROM "USER_TYPE" WHERE "Name" = 'Redar'
            );`;

        const result = await pool.query(deleteQuery, [stewardId]);

        if (result.rowCount === 0) {
            return res.status(404).json({ message: "Redar nije pronađen." });
        }

        res.status(200).json({ message: "Redarski nalog je uspješno obrisan." });
    } catch (error) {
        res.status(500).json({ message: "Greška na serveru prilikom brisanja redara." });
    }
});

// PUT /stewards/convert/:id (konvertovanje postojećeg korisnika u redara)
router.put("/convert/:id", authMiddleware, async (req, res) => {
    try {
        if (req.user.IdUserType !== 4) {
            return res.status(403).json({ message: "Pristup dozvoljen samo koordinatoru za nauku." });
        }

        const userId = req.params.id;

        const userCheck = await pool.query('SELECT "IdUserType" FROM "USER" WHERE "IdUser" = $1', [userId]);
        if (userCheck.rows.length === 0) {
            return res.status(404).json({ message: "Korisnik nije pronađen." });
        }

        const redarUserType = await pool.query('SELECT "IdUserType" FROM "USER_TYPE" WHERE "Name" = $1', ["Redar"]);

        const updateQuery = `
            UPDATE "USER"
            SET "IdUserType" = $1, "UpdatedAt" = CURRENT_TIMESTAMP
            WHERE "IdUser" = $2
            RETURNING "IdUser", "Name", "Lastname", "Email", "IdUserType";
        `;

        const result = await pool.query(updateQuery, [redarUserType.rows[0].IdUserType, userId]);
        res.status(200).json({ message: "Korisnik je uspješno konvertovan u redara.",
            IdUser: result.rows[0].IdUser,
            Name: result.rows[0].Name,
            Lastname: result.rows[0].Lastname,
            Email: result.rows[0].Email,
            IdUserType: result.rows[0].IdUserType
        });
    } catch (error) {
        res.status(500).json({ message: "Greška na serveru prilikom konvertovanja korisnika." });
    }
});

export default router;