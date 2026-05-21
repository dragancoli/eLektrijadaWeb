import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "../db.js";
import authMiddleware from "../middleware/authMiddleware.js";
import sendEmail from "../utils/email.js";

const router = express.Router();

const generateToken = (id, idUserType) => {
  return jwt.sign({ id, idUserType }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
};

// POST /auth/register
router.post("/register", async (req, res) => {
  try {
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

    const studentUserType = await pool.query('SELECT "IdUserType", "Name" FROM "USER_TYPE" WHERE "Name" = $1', [
      "Student",
    ]);

    if (studentUserType.rows.length === 0) {
      return res.status(500).json({ message: "Nije pronađen tip korisnika 'Student'." });
    }

    // Generate 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    const newUserQuery = `
      INSERT INTO "USER" 
      ("Name", "Lastname", "Email", "Password", "IsActive", "IdUserType", "IdFaculty", "VerificationCode") 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
      RETURNING "IdUser", "Email", "Name", "Lastname", "IdUserType"
    `;
    const newUser = await pool.query(newUserQuery, [
      Name,
      Lastname,
      Email,
      hashedPassword,
      false, // IsActive is false initially
      studentUserType.rows[0].IdUserType,
      IdFaculty,
      verificationCode
    ]);

    const user = newUser.rows[0];

    // Send verification email
    try {
      await sendEmail({
        email: user.Email,
        subject: "Verifikacija naloga - eLektrijada",
        message: `Vaš kod za verifikaciju je: ${verificationCode}`,
      });
    } catch (emailError) {
      console.error("Greška prilikom slanja emaila:", emailError);
      // We don't fail registration if email fails, but user might need to resend code (not implemented yet)
      // Or we could fail it. For now let's log it.
    }

    res.status(201).json({
      message: "Registracija uspešna. Proverite email za verifikacioni kod.",
      email: user.Email
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: "Greška na serveru prilikom registracije." });
  }
});

// POST /auth/verify-email
router.post("/verify-email", async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ message: "Email i kod su obavezni." });
    }

    const userQuery = await pool.query('SELECT * FROM "USER" WHERE "Email" = $1', [email]);

    if (userQuery.rows.length === 0) {
      return res.status(400).json({ message: "Korisnik nije pronađen." });
    }

    const user = userQuery.rows[0];

    if (user.IsActive) {
      return res.status(400).json({ message: "Nalog je već verifikovan." });
    }

    if (user.VerificationCode !== code) {
      return res.status(400).json({ message: "Neispravan verifikacioni kod." });
    }

    // Activate user and clear code
    await pool.query('UPDATE "USER" SET "IsActive" = true, "VerificationCode" = NULL WHERE "IdUser" = $1', [user.IdUser]);

    const typeQuery = await pool.query('SELECT "Name" FROM "USER_TYPE" WHERE "IdUserType" = $1', [user.IdUserType]);
    const userTypeName = typeQuery.rows[0]?.Name || null;

    res.status(200).json({
      message: "Nalog uspešno verifikovan.",
      IdUser: user.IdUser,
      Name: user.Name,
      Lastname: user.Lastname,
      Email: user.Email,
      IdUserType: user.IdUserType,
      UserTypeName: userTypeName,
      token: generateToken(user.IdUser, user.IdUserType),
    });

  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: "Greška na serveru prilikom verifikacije." });
  }
});


// POST /auth/login
router.post("/login", async (req, res) => {
  try {
    const { Email, Password } = req.body;

    const userQuery = await pool.query('SELECT * FROM "USER" WHERE "Email" = $1', [Email]);

    if (userQuery.rows.length === 0) {
      return res.status(401).json({ message: "Pogrešan email ili lozinka." });
    }

    const user = userQuery.rows[0];

    if (user.IsActive === false) {
      return res.status(403).json({ message: "Nalog je deaktiviran." });
    }

    const isMatch = await bcrypt.compare(Password, user.Password);
    if (!isMatch) {
      return res.status(401).json({ message: "Pogrešan email ili lozinka." });
    }

    const typeQuery = await pool.query('SELECT "Name" FROM "USER_TYPE" WHERE "IdUserType" = $1', [user.IdUserType]);
    const userTypeName = typeQuery.rows[0]?.Name || null;

    res.json({
      IdUser: user.IdUser,
      Name: user.Name,
      Lastname: user.Lastname,
      Email: user.Email,
      IdUserType: user.IdUserType,
      UserTypeName: userTypeName,
      IdFaculty: user.IdFaculty,
      token: generateToken(user.IdUser, user.IdUserType),
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: "Greška na serveru prilikom prijave." });
  }
});

export default router;
