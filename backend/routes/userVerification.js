import express from "express";
import pool from "../db.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// GET /user-verification (dohvata korisnike po tipu naloga sa opcionalnim pretraživanjem)
router.get("/", authMiddleware, async (req, res) => {
    try {
        if (req.user.IdUserType !== 4) {
            return res.status(403).json({ message: "Pristup dozvoljen samo koordinatoru za nauku." });
        }

        const { userType, search } = req.query;
        
        // Default to Student (3) if no userType provided
        const typeId = userType ? parseInt(userType) : 3;
        
        // Validate userType is one of: Student (3), Mentor (2), or VodjaTima (7)
        if (![2, 3, 7].includes(typeId)) {
            return res.status(400).json({ message: "Nevažeći tip naloga." });
        }

        let query = `
            SELECT u."IdUser", u."Name", u."Lastname", u."Email", u."IdFaculty", u."IdUserType", f."Name" AS "FacultyName"
            FROM "USER" u
            JOIN "FACULTY" f ON f."IdFaculty" = u."IdFaculty"
            WHERE u."IdUserType" = $1
        `;
        
        const params = [typeId];
        
        // Add search filter if provided
        if (search && search.trim()) {
            query += ` AND (LOWER(u."Name") LIKE $2 OR LOWER(u."Lastname") LIKE $2)`;
            params.push(`%${search.toLowerCase()}%`);
        }
        
        query += ` ORDER BY u."IdUser"`;

        const result = await pool.query(query, params);

        res.status(200).json(result.rows);
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ message: "Greška na serveru prilikom preuzimanja korisnika." });
    }
});

// PUT /user-verification/:id (promjena tipa naloga - promocija ili degradacija)
router.put("/:id", authMiddleware, async (req, res) => {
    try {
        if (req.user.IdUserType !== 4) {
            return res.status(403).json({ message: "Pristup dozvoljen samo koordinatoru za nauku." });
        }

        const userId = req.params.id;
        const { newUserTypeId } = req.body;

        // Validate newUserTypeId is one of: Student (3), Mentor (2), or VodjaTima (7)
        if (![2, 3, 7].includes(newUserTypeId)) {
            return res.status(400).json({ message: "Nevažeći tip naloga." });
        }

        // Check if user exists and get their current type
        const userCheck = await pool.query(`
            SELECT "IdUser", "IdUserType" FROM "USER" WHERE "IdUser" = $1;
        `, [userId]);
        
        if (userCheck.rows.length === 0) {
            return res.status(404).json({ message: "Korisnik nije pronađen." });
        }

        const currentUserType = userCheck.rows[0].IdUserType;

        // Validate the transition is allowed
        // Student (3) can be promoted to Mentor (2) or VodjaTima (7)
        // Mentor (2) or VodjaTima (7) can be demoted to Student (3)
        if (currentUserType === 3 && ![2, 7].includes(newUserTypeId)) {
            return res.status(400).json({ message: "Student može biti samo unapređen u Mentora ili Vođu tima." });
        }
        if ([2, 7].includes(currentUserType) && newUserTypeId !== 3) {
            return res.status(400).json({ message: "Mentor ili Vođa tima može biti samo degradiran u Studenta." });
        }
        if (currentUserType === newUserTypeId) {
            return res.status(400).json({ message: "Korisnik već ima traženi tip naloga." });
        }

        const result = await pool.query(`
            UPDATE "USER"
            SET "IdUserType" = $1, "UpdatedAt" = CURRENT_TIMESTAMP
            WHERE "IdUser" = $2
            RETURNING "IdUser", "Name", "Lastname", "Email", "IdUserType";`,
            [newUserTypeId, userId]);

        const actionMessage = newUserTypeId === 3 
            ? "Korisnik uspješno degradiran u Studenta." 
            : "Korisnik uspješno unapređen.";

        res.status(200).json({ message: actionMessage, user: result.rows[0] });

    } catch (error) {
        console.error("Error updating user type:", error);
        res.status(500).json({ message: "Greška na serveru prilikom promjene tipa naloga." });
    }
});

export default router;