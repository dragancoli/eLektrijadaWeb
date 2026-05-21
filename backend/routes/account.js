// routes/account.js
import express from "express";
import pool from "../db.js";
import authMiddleware from "../middleware/authMiddleware.js";
import bcrypt from "bcryptjs";
import QRCode from "qrcode";
import sendEmail from "../utils/email.js";

const router = express.Router();

// Get QR Code
router.get("/qr-code", authMiddleware, async (req, res) => {
  const { IdUser } = req.user;

  try {
    const result = await pool.query(
      'SELECT "QrSecret" FROM "USER" WHERE "IdUser" = $1',
      [IdUser]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Korisnik nije pronađen" });
    }

    const user = result.rows[0];
    const qrSecret = user.QrSecret;

    if (!qrSecret) {
      return res
        .status(404)
        .json({ error: "QR secret nije pronađen za korisnika." });
    }

    QRCode.toDataURL(qrSecret, (err, url) => {
      if (err) {
        console.error("[account] Error generating QR code:", err);
        return res
          .status(500)
          .json({ error: "Greška prilikom generisanja QR koda." });
      }
      res.json({ qrCodeUrl: url });
    });
  } catch (err) {
    console.error("[account] Error fetching QR code:", err);
    res
      .status(500)
      .json({ error: "Greška na serveru prilikom preuzimanja QR koda." });
  }
});

// Change Password
router.patch("/password", authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const { IdUser } = req.user;

  // Validacija ulaznih podataka
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Sva polja su obavezna" });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: "Nova lozinka mora imati najmanje 8 karaktera" });
  }

  if (newPassword === currentPassword) {
    return res.status(400).json({ error: "Nova lozinka ne može biti ista kao trenutna" });
  }

  try {
    // Pronađi korisnika po id-u
    const result = await pool.query(
      'SELECT "IdUser", "Email", "Password" FROM "USER" WHERE "IdUser" = $1',
      [IdUser]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Korisnik nije pronađen" });
    }

    const user = result.rows[0];

    // Provjeri trenutnu lozinku
    const validPassword = await bcrypt.compare(currentPassword, user.Password);
    if (!validPassword) {
      return res.status(401).json({ error: "Trenutna lozinka nije ispravna" });
    }

    // Hash-uj novu lozinku
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Ažuriraj lozinku u bazi
    await pool.query(
      'UPDATE "USER" SET "Password" = $1, "UpdatedAt" = NOW() WHERE "IdUser" = $2',
      [hashedPassword, user.IdUser]
    );

    res.json({ message: "Lozinka je uspješno promijenjena" });
  } catch (err) {
    console.error("[account] Error changing password:", err);
    res.status(500).json({ error: "Greška na serveru prilikom promjene lozinke" });
  }
});

// Deactivate Account
router.patch("/deactivate", authMiddleware, async (req, res) => {
  const { reason } = req.body;
  const { IdUser } = req.user;

  if (!reason) {
    return res.status(400).json({ error: "Razlog deaktivacije je obavezan." });
  }

  try {
    const result = await pool.query(
      'UPDATE "USER" SET "IsActive" = false, "DeactivatedAt" = NOW(), "DeactivatedReason" = $1, "UpdatedAt" = NOW() WHERE "IdUser" = $2 RETURNING "IdUser"',
      [reason, IdUser]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Korisnik nije pronađen." });
    }

    res.json({ message: "Nalog je uspješno deaktiviran." });
  } catch (err) {
    console.error("[account] Error deactivating account:", err);
    res.status(500).json({ error: "Greška na serveru prilikom deaktivacije naloga." });
  }
});

// Update User Details
router.patch("/details", authMiddleware, async (req, res) => {
  const { Name, Lastname, IdFaculty } = req.body;
  const { IdUser } = req.user;

  const fieldsToUpdate = {};
  if (Name) fieldsToUpdate.Name = Name;
  if (Lastname) fieldsToUpdate.Lastname = Lastname;
  if (IdFaculty) fieldsToUpdate.IdFaculty = IdFaculty;

  if (Object.keys(fieldsToUpdate).length === 0) {
    return res.status(400).json({ error: "Nema podataka za ažuriranje." });
  }

  try {
    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(fieldsToUpdate)) {
      setClauses.push(`"${key}" = $${paramIndex++}`);
      values.push(value);
    }

    values.push(IdUser);

    const query = `
      UPDATE "USER" 
      SET ${setClauses.join(', ')}, "UpdatedAt" = NOW() 
      WHERE "IdUser" = $${paramIndex}
      RETURNING "IdUser", "Name", "Lastname", "Email", "IdFaculty"
    `;

    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Korisnik nije pronađen." });
    }

    res.json({
      message: "Podaci su uspješno ažurirani.",
      user: result.rows[0],
    });
  } catch (err) {
    console.error("[account] Error updating user details:", err);
    res.status(500).json({ error: "Greška na serveru prilikom ažuriranja podataka." });
  }
});

// POST /account/forgot-password
router.post("/forgot-password", async (req, res) => {
  const { Email } = req.body;

  try {
    const userQuery = await pool.query('SELECT * FROM "USER" WHERE "Email" = $1', [Email]);

    if (userQuery.rows.length === 0) {
      return res.status(200).json({ message: "Ako korisnik sa ovim emailom postoji, poslat je email za resetovanje lozinke." });
    }

    const user = userQuery.rows[0];

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const resetExpires = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      'UPDATE "USER" SET "PasswordResetCode" = $1, "PasswordResetExpires" = $2 WHERE "IdUser" = $3',
      [resetCode, resetExpires, user.IdUser]
    );

    try {
      await sendEmail({
        email: user.Email,
        subject: "Zahtjev za resetovanje lozinke",
        message: `Dobili ste ovaj email jer ste vi (ili neko drugi) zatražili resetovanje lozinke za vaš nalog.\n\nVaš kod za resetovanje lozinke je: ${resetCode}\n\nAko niste zatražili ovo, molimo vas ignorišite ovaj email i vaša lozinka će ostati nepromijenjena.\n`,
      });

      res.status(200).json({ message: "Email za resetovanje lozinke je poslat." });
    } catch (err) {
      console.error("There was an error sending the email. ", err);
      await pool.query(
        'UPDATE "USER" SET "PasswordResetCode" = NULL, "PasswordResetExpires" = NULL WHERE "IdUser" = $1',
        [user.IdUser]
      );
      return res.status(500).json({ message: "Greška prilikom slanja emaila." });
    }
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: "Greška na serveru." });
  }
});

// POST /account/reset-password
router.post("/reset-password", async (req, res) => {
  const { Email, code, newPassword, confirmPassword } = req.body;

  if (!Email || !code || !newPassword || !confirmPassword) {
    return res.status(400).json({ message: "Sva polja su obavezna." });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: "Lozinke se ne poklapaju." });
  }

  try {
    const userQuery = await pool.query(
      'SELECT * FROM "USER" WHERE "Email" = $1 AND "PasswordResetCode" = $2 AND "PasswordResetExpires" > NOW()',
      [Email, code]
    );

    if (userQuery.rows.length === 0) {
      return res.status(400).json({ message: "Kod za resetovanje je nevažeći ili je istekao." });
    }

    const user = userQuery.rows[0];

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await pool.query(
      'UPDATE "USER" SET "Password" = $1, "PasswordResetCode" = NULL, "PasswordResetExpires" = NULL, "UpdatedAt" = NOW() WHERE "IdUser" = $2',
      [hashedPassword, user.IdUser]
    );

    res.status(200).json({ message: "Lozinka je uspješno resetovana." });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: "Greška na serveru." });
  }
});

export default router;