import express from "express";
import pool from "../db.js";

import { isTeamModifiable } from "../services/teamService.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();


// Get teams by leader ID// GET /teams/:IdLeader
// Returns only team info for a given leader
// GET /teams/:IdLeader
router.get("/:IdLeader", authMiddleware, async (req, res) => {
    const { IdLeader } = req.params;

    try {
        // Ažurirani upit koji spaja tabele za sport i nauku
        const query = `
            SELECT
                t."IdTeam",
                t."Name" AS "TeamName",
                t."Category",
                t."Position",
                f."IdFaculty" AS "FacultyId",
                f."Name" AS "FacultyName",
                t."IdSportCompetition",
                sp."Name" AS "SportName",     
                t."IdScienceCompetition",
                sc."Name" AS "ScienceName"     
            FROM "TEAM" t
            JOIN "FACULTY" f ON f."IdFaculty" = t."IdFaculty"
            LEFT JOIN "SPORT_COMPETITION" spc ON t."IdSportCompetition" = spc."IdSportCompetition"
            LEFT JOIN "SPORT" sp ON spc."IdSport" = sp."IdSport"
            LEFT JOIN "SCIENCE_COMPETITION" scc ON t."IdScienceCompetition" = scc."IdScienceCompetition"
            LEFT JOIN "SCIENCE" sc ON scc."IdScience" = sc."IdScience"
            WHERE t."IdLeader" = $1
            ORDER BY t."Name";
        `;

        const result = await pool.query(query, [IdLeader]);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: "Greška na serveru prilikom preuzimanja timova po vođi." });
    }
});


//Create a team
// POST /teams
router.post("/", authMiddleware, async (req, res) => {

    if (!req.body || Object.keys(req.body).length === 0) {
        return res.status(400).json({ message: "Request body is empty." });
    }

    const {
        Name,
        Category,
        IdLeader,
        IdFaculty,
        IdSportCompetition,    // optional
        IdScienceCompetition,  // optional
        Position               // optional
    } = req.body;

    if (!Name || !Category || !IdLeader || !IdFaculty) {
        return res.status(400).json({ message: "Obavezna polja nedostaju" });
    }

    try {

        //Check if IdLeader belongs to IdFaculty
        const leaderCheck = await pool.query(
            `SELECT "IdFaculty" FROM "USER" WHERE "IdUser" = $1`,
            [IdLeader]
        );
        if (leaderCheck.rows.length === 0 || leaderCheck.rows[0].IdFaculty !== IdFaculty) {
            //return res.status(400).json({ message: "IdLeader does not belong to the specified IdFaculty." });
            return res.status(400).json({ message: "Vođa tima ne pripada navedenom fakultetu." });
        }


        const query = `
        INSERT INTO "TEAM" 
        ("Name", "Category", "IdLeader", "IdFaculty", "IdSportCompetition", "IdScienceCompetition", "Position")
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *;
      `;

        const values = [
            Name,
            Category,
            IdLeader,
            IdFaculty,
            IdSportCompetition || null,
            IdScienceCompetition || null,
            Position || null
        ];

        const result = await pool.query(query, values);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({
            message: "Greška na serveru prilikom kreiranja tima.",
        });
    }
});

// PUT /teams/:teamId
router.put("/:teamId", authMiddleware, async (req, res) => {
    const { teamId } = req.params;
    if (!req.body || Object.keys(req.body).length === 0) {
        //return res.status(400).json({ message: "Request body is empty." });
        return res.status(400).json({ message: "Tijelo zahtjeva je prazno." });
    }

    const {
        Name,
        Category,
        IdLeader,
        IdFaculty,
        IdSportCompetition,
        IdScienceCompetition,
        Position
    } = req.body;

    try {
        // Check if the team can be modified
        const modifiable = await isTeamModifiable(teamId);
        if (!modifiable) {
           // return res.status(400).json({ message: "Team cannot be modified due to upcoming matches or competitions." });
            return res.status(400).json({ message: "Tim ne može biti izmijenjen zbog predstojećih utakmica ili takmičenja." });
        }

        // Collect only provided fields
        const fields = [];
        const values = [];
        let index = 1;

        if (Name !== undefined) {
            fields.push(`"Name" = $${index++}`);
            values.push(Name);
        }
        if (Category !== undefined) {
            fields.push(`"Category" = $${index++}`);
            values.push(Category);
        }
        if (IdLeader !== undefined) {
            fields.push(`"IdLeader" = $${index++}`);
            values.push(IdLeader);
        }
        if (IdFaculty !== undefined) {
            fields.push(`"IdFaculty" = $${index++}`);
            values.push(IdFaculty);
        }
        if (IdSportCompetition !== undefined) {
            fields.push(`"IdSportCompetition" = $${index++}`);
            values.push(IdSportCompetition);
        }
        if (IdScienceCompetition !== undefined) {
            fields.push(`"IdScienceCompetition" = $${index++}`);
            values.push(IdScienceCompetition);
        }
        if (Position !== undefined) {
            fields.push(`"Position" = $${index++}`);
            values.push(Position);
        }

        if (fields.length === 0) {
            //return res.status(400).json({ message: "No fields provided to update." });
            return res.status(400).json({ message: "Nema polja za ažuriranje." });
        }

        // Add teamId as the final parameter
        values.push(teamId);

        const query = `
        UPDATE "TEAM"
        SET ${fields.join(", ")}
        WHERE "IdTeam" = $${index}
        RETURNING *;
      `;

        const result = await pool.query(query, values);

        if (result.rows.length === 0) {
            //return res.status(404).json({ message: "Team not found." });
            return res.status(404).json({ message: "Tim nije pronađen." });
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: "Greška na serveru prilikom ažuriranja tima." });
    }
});

// DELETE /teams/:teamId
router.delete("/:teamId", authMiddleware, async (req, res) => {
    const { teamId } = req.params;
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // Delete related team members
        await client.query(
            `DELETE FROM "TEAM_MEMBERS" WHERE "IdTeam" = $1;`,
            [teamId]
        );

        // Delete matches where the team is involved
        await client.query(
            `DELETE FROM "MATCH" WHERE "IdTeam1" = $1 OR "IdTeam2" = $1;`,
            [teamId]
        );

        // Delete the team itself
        const deleteTeam = await client.query(
            `DELETE FROM "TEAM" WHERE "IdTeam" = $1 RETURNING *;`,
            [teamId]
        );

        if (deleteTeam.rows.length === 0) {
            await client.query("ROLLBACK");
            //return res.status(404).json({ message: "Team not found." });
            return res.status(404).json({ message: "Tim nije pronađen." });
        }

        await client.query("COMMIT");

        res.status(200).json({
            //message: "Team and related records successfully deleted.",
            message: "Tim i povezani zapisi su uspješno obrisani.",
            deletedTeam: deleteTeam.rows[0],
        });
    } catch (error) {
        await client.query("ROLLBACK");
        console.error(error.message);

        res.status(500).json({
            message: "Greška na serveru prilikom brisanja tima.",
        });
    } finally {
        client.release();
    }
});

//Get users from a faculty
// GET /teams/faculties/:facultyId/users
router.get("/faculties/:facultyId/users", authMiddleware, async (req, res) => {
    const { facultyId } = req.params;
    try {
        //returns iduser, name, lastname, email, faculty name and faculty id
        const query = `
            SELECT
                u."IdUser" AS "UserId",
                u."Name" AS "UserName",
                u."Lastname" AS "UserLastname",
                u."Email" AS "UserEmail",
                f."Name" AS "FacultyName",
                u."IdFaculty" AS "FacultyId"
            FROM "USER" u
            JOIN "FACULTY" f ON f."IdFaculty" = u."IdFaculty"
            WHERE u."IdFaculty" = $1
            ORDER BY u."Lastname", u."Name";
        `; 

        const result = await pool.query(query, [facultyId]);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: "Greška na serveru prilikom preuzimanja korisnika fakulteta." });
    }
});



// GET /teams/:teamId/members
// Returns member info for a specific team
router.get("/:teamId/members", async (req, res) => {
    const { teamId } = req.params;

    try {
        const query = `
            SELECT
                u."IdUser" AS "MemberId",
                u."Name" AS "MemberName",
                u."Lastname" AS "MemberLastname",
                u."Email" AS "MemberEmail",
                f."Name" AS "FacultyName",
                u."IdFaculty" AS "FacultyId",
                tm."Verified" AS "IsVerified"
            FROM "TEAM_MEMBERS" tm
            JOIN "USER" u ON u."IdUser" = tm."IdUser"
            JOIN "FACULTY" f ON f."IdFaculty" = u."IdFaculty"
            WHERE tm."IdTeam" = $1
            ORDER BY u."Lastname", u."Name";
        `;

        const result = await pool.query(query, [teamId]);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: "Greška na serveru prilikom preuzimanja članova tima." });
    }
});


// Add a user to a team
// POST /teams/:teamId/members
router.post('/:teamId/members', authMiddleware, async (req, res) => {
    const { teamId } = req.params;
    const { userId } = req.body;

    if (!userId) {
        //return res.status(400).json({ error: 'Missing userId in request body' });
        return res.status(400).json({ error: 'Nedostaje userId u tijelu zahtjeva' });
    }

    try {
        // Check if the team exists
        const teamResult = await pool.query(
            'SELECT "IdFaculty" FROM "TEAM" WHERE "IdTeam" = $1',
            [teamId]
        );
        if (teamResult.rows.length === 0) {
            //return res.status(404).json({ error: 'Team not found' });
            return res.status(404).json({ message: "Tim nije pronađen." });
        }

        //Check if the team can be modified
        const modifiable = await isTeamModifiable(teamId);
        if (!modifiable) {
            //return res.status(400).json({ message: "Team cannot be modified due to upcoming matches or competitions." });
            return res.status(400).json({ message: "Tim ne može biti izmijenjen zbog predstojećih utakmica ili takmičenja." });
        }

        // Check if the user exists
        const userResult = await pool.query(
            'SELECT "IdFaculty" FROM "USER" WHERE "IdUser" = $1',
            [userId]
        );
        if (userResult.rows.length === 0) {
            //return res.status(404).json({ error: 'User not found' });
            return res.status(404).json({ message: "Korisnik nije pronađen." });
        }

        // Compare faculty IDs
        const teamFacultyId = teamResult.rows[0].IdFaculty;
        const userFacultyId = userResult.rows[0].IdFaculty;
        if (teamFacultyId !== userFacultyId) {
            //return res.status(400).json({ error: 'User and team belong to different faculties' });
            return res.status(400).json({ error: 'Korisnik i tim pripadaju različitim fakultetima' });
        }

        // Check if the user is already in the team
        const existing = await pool.query(
            'SELECT * FROM "TEAM_MEMBERS" WHERE "IdTeam" = $1 AND "IdUser" = $2',
            [teamId, userId]
        );
        if (existing.rows.length > 0) {
            //return res.status(400).json({ error: 'User is already a member of this team' });
            return res.status(400).json({ message: "Korisnik je već član ovog tima." });
        }

        // Insert new team member
        await pool.query(
            'INSERT INTO "TEAM_MEMBERS" ("IdTeam", "IdUser") VALUES ($1, $2)',
            [teamId, userId]
        );

        //res.status(201).json({ message: 'User added to team successfully' });
        res.status(201).json({ message: 'Korisnik je uspješno dodat u tim' });
    } catch (error) {
        console.error('Error adding user to team:', error);
        //res.status(500).json({ error: 'Internal server error' });
        res.status(500).json({ message: "Greška na serveru prilikom dodavanja korisnika u tim." });
    }
});


// DELETE /teams/:teamId/members/:userId
router.delete("/:teamId/members/:userId", authMiddleware, async (req, res) => {
    const { teamId, userId } = req.params;

    try {
        //Check if the team exists
        const teamResult = await pool.query(
            'SELECT "IdTeam" FROM "TEAM" WHERE "IdTeam" = $1',
            [teamId]
        );
        if (teamResult.rows.length === 0) {
            //return res.status(404).json({ message: "Team not found." });
            return res.status(404).json({ message: "Tim nije pronađen." });
        }

        //Check if the team can be modified
        const modifiable = await isTeamModifiable(teamId);
        if (!modifiable) {
            //return res.status(400).json({ message: "Team cannot be modified due to upcoming matches or competitions." });
            return res.status(400).json({ message: "Tim ne može biti izmijenjen zbog predstojećih utakmica ili takmičenja." });
        }

        // Check if the member exists in the team
        const existing = await pool.query(
            'SELECT * FROM "TEAM_MEMBERS" WHERE "IdTeam" = $1 AND "IdUser" = $2',
            [teamId, userId]
        );

        if (existing.rows.length === 0) {
            //return res.status(404).json({ message: "User is not a member of this team." });
            return res.status(404).json({ message: "Korisnik nije član ovog tima." });
        }

        // Delete the member from the team
        await pool.query(
            'DELETE FROM "TEAM_MEMBERS" WHERE "IdTeam" = $1 AND "IdUser" = $2',
            [teamId, userId]
        );

        //res.status(200).json({ message: "User successfully removed from the team." });
        res.status(200).json({ message: "Korisnik je uspješno uklonjen iz tima." });
    } catch (error) {
        console.error("Error removing user from team:", error);
        //res.status(500).json({ message: "Greška na serveru prilikom uklanjanja korisnika iz tima." });
        res.status(500).json({ message: "Greška na serveru prilikom uklanjanja korisnika iz tima." });
    }
});



export default router;
