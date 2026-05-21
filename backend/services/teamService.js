// services/teamUtils.js
import pool from "../db.js";

export async function isTeamModifiable(teamId) {
    const now = new Date();
    const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    // Get the team's current science competition
    const teamResult = await pool.query(
        'SELECT "IdScienceCompetition" FROM "TEAM" WHERE "IdTeam" = $1',
        [teamId]
    );
    if (teamResult.rows.length === 0) {
        throw new Error("Team not found");
    }
    const scienceCompId = teamResult.rows[0].IdScienceCompetition;

    // Check for upcoming matches
    const matchCheck = await pool.query(
        `
        SELECT a."StartDate"
        FROM "MATCH" m
        JOIN "APPOINTMENT" a ON a."IdAppointment" = m."IdAppointment"
        WHERE (m."IdTeam1" = $1 OR m."IdTeam2" = $1)
        AND a."StartDate" BETWEEN $2 AND $3
        LIMIT 1
        `,
        [teamId, now, twoHoursLater]
    );
    if (matchCheck.rows.length > 0) {
        return false;
    }

    // Check for upcoming science competitions
    const scienceCheck = await pool.query(
        `
        SELECT a."StartDate"
        FROM "SCIENCE_COMPETITION" sc
        JOIN "APPOINTMENT" a ON a."IdAppointment" = sc."IdAppointment"
        WHERE (sc."IdMentor" IN (SELECT "IdLeader" FROM "TEAM" WHERE "IdTeam" = $1)
               OR sc."IdScienceCompetition" = $2)
        AND a."StartDate" BETWEEN $3 AND $4
        LIMIT 1
        `,
        [teamId, scienceCompId, now, twoHoursLater]
    );

    return scienceCheck.rows.length === 0;
}
