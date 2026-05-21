import express from "express";
import pool from "../db.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// Dozvola: KoordinatorSport (5) ili Admin (1)
const canAccess = (req) => req.user?.IdUserType === 5 || req.user?.IdUserType === 1;

// GET /team-leader-verification?userType=3|7&search=...
router.get("/", authMiddleware, async (req, res) => {
  try {
    if (!canAccess(req)) {
      return res.status(403).json({ message: "Pristup dozvoljen samo koordinatoru za sport ili administratoru." });
    }

    const { userType, search } = req.query;

    // Default: Student (3)
    const typeId = userType ? parseInt(userType) : 3;

    // Valid types: Student (3) or VodjaTima (7)
    if (![3, 7].includes(typeId)) {
      return res.status(400).json({ message: "Nevažeći tip naloga." });
    }

    let query = `
      SELECT 
        u."IdUser",
        u."Name",
        u."Lastname",
        u."Email",
        u."IdFaculty",
        u."IdUserType",
        f."Name" AS "FacultyName"
      FROM "USER" u
      JOIN "FACULTY" f ON f."IdFaculty" = u."IdFaculty"
      WHERE u."IdUserType" = $1
    `;

    const params = [typeId];

    if (search && search.trim()) {
      query += ` AND (LOWER(u."Name") LIKE $2 OR LOWER(u."Lastname") LIKE $2)`;
      params.push(`%${search.toLowerCase()}%`);
    }

    query += ` ORDER BY u."IdUser"`;

    const result = await pool.query(query, params);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching team leader verification users:", error);
    res.status(500).json({ message: "Greška na serveru prilikom preuzimanja korisnika." });
  }
});

// PUT /team-leader-verification/:id  body: { newUserTypeId: 3|7 }
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    if (!canAccess(req)) {
      return res.status(403).json({ message: "Pristup dozvoljen samo koordinatoru za sport ili administratoru." });
    }

    const userId = req.params.id;
    const { newUserTypeId } = req.body;

    if (![3, 7].includes(newUserTypeId)) {
      return res.status(400).json({ message: "Nevažeći tip naloga." });
    }

    const userCheck = await pool.query(
      `SELECT "IdUser", "IdUserType" FROM "USER" WHERE "IdUser" = $1;`,
      [userId]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({ message: "Korisnik nije pronađen." });
    }

    const currentUserType = userCheck.rows[0].IdUserType;

    // Dozvoljene tranzicije: 3 <-> 7
    if (currentUserType === 3 && newUserTypeId !== 7) {
      return res.status(400).json({ message: "Student može biti samo unapređen u Vođu tima." });
    }
    if (currentUserType === 7 && newUserTypeId !== 3) {
      return res.status(400).json({ message: "Vođa tima može biti samo degradiran u Studenta." });
    }
    if (currentUserType === newUserTypeId) {
      return res.status(400).json({ message: "Korisnik već ima traženi tip naloga." });
    }

    const result = await pool.query(
      `
      UPDATE "USER"
      SET "IdUserType" = $1, "UpdatedAt" = CURRENT_TIMESTAMP
      WHERE "IdUser" = $2
      RETURNING "IdUser", "Name", "Lastname", "Email", "IdUserType";
      `,
      [newUserTypeId, userId]
    );

    const actionMessage = newUserTypeId === 3
      ? "Korisniku su uklonjene permisije za Vođu tima (degradiran u Studenta)."
      : "Korisnik je uspješno postavljen kao Vođa tima.";

    res.status(200).json({ message: actionMessage, user: result.rows[0] });
  } catch (error) {
    console.error("Error updating team leader user type:", error);
    res.status(500).json({ message: "Greška na serveru prilikom promjene tipa naloga." });
  }
});

export default router;