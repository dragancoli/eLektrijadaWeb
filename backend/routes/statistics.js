import express from "express";
import pool from "../db.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// ─── GET /statistics/organizer ───────────────────────────────────────
router.get("/organizer", authMiddleware, async (req, res) => {
  try {
    if (req.user.IdUserType !== 6) {
      return res.status(403).json({ message: "Pristup dozvoljen samo organizatoru." });
    }

    const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();

    // KPI kartice
    const sportCompCount = await pool.query(
      `SELECT COUNT(*) AS count FROM "SPORT_COMPETITION" WHERE "Year" = $1`, [year]
    );
    const scienceCompCount = await pool.query(
      `SELECT COUNT(*) AS count FROM "SCIENCE_COMPETITION" WHERE "Year" = $1`, [year]
    );
    const totalUsers = await pool.query(
      `SELECT COUNT(*) AS count FROM "USER" WHERE "IsActive" = true`
    );
    const totalTeams = await pool.query(
      `SELECT COUNT(*) AS count FROM "TEAM" t
       LEFT JOIN "SPORT_COMPETITION" sc ON t."IdSportCompetition" = sc."IdSportCompetition"
       LEFT JOIN "SCIENCE_COMPETITION" snc ON t."IdScienceCompetition" = snc."IdScienceCompetition"
       WHERE sc."Year" = $1 OR snc."Year" = $1`, [year]
    );

    // Distribucija timova po fakultetima
    const teamsByFaculty = await pool.query(
      `SELECT f."Name" AS faculty_name, COUNT(t."IdTeam") AS team_count
       FROM "TEAM" t
       JOIN "FACULTY" f ON t."IdFaculty" = f."IdFaculty"
       LEFT JOIN "SPORT_COMPETITION" sc ON t."IdSportCompetition" = sc."IdSportCompetition"
       LEFT JOIN "SCIENCE_COMPETITION" snc ON t."IdScienceCompetition" = snc."IdScienceCompetition"
       WHERE sc."Year" = $1 OR snc."Year" = $1
       GROUP BY f."Name"
       ORDER BY team_count DESC`, [year]
    );

    // Status mečeva
    const matchStatuses = await pool.query(
      `SELECT m."Status", COUNT(*) AS count
       FROM "MATCH" m
       JOIN "SPORT_COMPETITION" sc ON m."IdSportCompetition" = sc."IdSportCompetition"
       WHERE sc."Year" = $1
       GROUP BY m."Status"`, [year]
    );

    // Rang lista fakulteta
    const facultyRanking = await pool.query(
      `SELECT f."Name" AS faculty_name, fr."Score" AS score, f."City" AS city
       FROM "FACULTY_RANKING" fr
       JOIN "FACULTY" f ON fr."IdFaculty" = f."IdFaculty"
       WHERE fr."Year" = $1
       ORDER BY fr."Score" DESC
       LIMIT 10`, [year]
    );

    // Trend takmičenja po godinama
    const competitionTrend = await pool.query(
      `SELECT year, SUM(sport_count) AS sport, SUM(science_count) AS science FROM (
         SELECT "Year" AS year, COUNT(*) AS sport_count, 0 AS science_count FROM "SPORT_COMPETITION" GROUP BY "Year"
         UNION ALL
         SELECT "Year" AS year, 0 AS sport_count, COUNT(*) AS science_count FROM "SCIENCE_COMPETITION" GROUP BY "Year"
       ) sub GROUP BY year ORDER BY year`
    );

    res.json({
      kpiCards: {
        sportCompetitions: Number(sportCompCount.rows[0].count),
        scienceCompetitions: Number(scienceCompCount.rows[0].count),
        totalUsers: Number(totalUsers.rows[0].count),
        totalTeams: Number(totalTeams.rows[0].count),
      },
      teamsByFaculty: teamsByFaculty.rows,
      matchStatuses: matchStatuses.rows,
      facultyRanking: facultyRanking.rows,
      competitionTrend: competitionTrend.rows,
    });
  } catch (error) {
    console.error("Organizer stats error:", error);
    res.status(500).json({ message: "Greška pri dohvatanju statistika." });
  }
});

// ─── GET /statistics/science-coordinator ─────────────────────────────
router.get("/science-coordinator", authMiddleware, async (req, res) => {
  try {
    if (req.user.IdUserType !== 4) {
      return res.status(403).json({ message: "Pristup dozvoljen samo koordinatoru za nauku." });
    }

    const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();

    // KPI kartice
    const scienceCompCount = await pool.query(
      `SELECT COUNT(*) AS count FROM "SCIENCE_COMPETITION" WHERE "Year" = $1`, [year]
    );
    const teamsCount = await pool.query(
      `SELECT COUNT(*) AS count FROM "TEAM" t
       JOIN "SCIENCE_COMPETITION" sc ON t."IdScienceCompetition" = sc."IdScienceCompetition"
       WHERE sc."Year" = $1`, [year]
    );
    const participantsCount = await pool.query(
      `SELECT COUNT(DISTINCT tm."IdUser") AS count
       FROM "TEAM_MEMBERS" tm
       JOIN "TEAM" t ON tm."IdTeam" = t."IdTeam"
       JOIN "SCIENCE_COMPETITION" sc ON t."IdScienceCompetition" = sc."IdScienceCompetition"
       WHERE sc."Year" = $1`, [year]
    );

    // Prosjek bodova po takmičenju
    const avgScoreByCompetition = await pool.query(
      `SELECT s."Name" AS competition_name, ROUND(AVG(ur."Score"), 2) AS avg_score
       FROM "USER_RESULTS" ur
       JOIN "SCIENCE_COMPETITION" sc ON ur."IdScienceCompetition" = sc."IdScienceCompetition"
       JOIN "SCIENCE" s ON sc."IdScience" = s."IdScience"
       WHERE sc."Year" = $1
       GROUP BY s."Name"
       ORDER BY avg_score DESC`, [year]
    );

    // Top 5 timova
    const topTeams = await pool.query(
      `SELECT t."Name" AS team_name, f."Name" AS faculty_name,
              COALESCE(SUM(ur."Score"), 0) AS total_score
       FROM "TEAM" t
       JOIN "FACULTY" f ON t."IdFaculty" = f."IdFaculty"
       JOIN "SCIENCE_COMPETITION" sc ON t."IdScienceCompetition" = sc."IdScienceCompetition"
       LEFT JOIN "TEAM_MEMBERS" tm ON t."IdTeam" = tm."IdTeam"
       LEFT JOIN "USER_RESULTS" ur ON tm."IdUser" = ur."IdUser"
         AND ur."IdScienceCompetition" = sc."IdScienceCompetition"
       WHERE sc."Year" = $1
       GROUP BY t."Name", f."Name"
       ORDER BY total_score DESC
       LIMIT 5`, [year]
    );

    // Mentor pregled
    const mentorOverview = await pool.query(
      `SELECT u."Name" || ' ' || u."Lastname" AS mentor_name, COUNT(sc."IdScienceCompetition") AS comp_count
       FROM "SCIENCE_COMPETITION" sc
       JOIN "USER" u ON sc."IdMentor" = u."IdUser"
       WHERE sc."Year" = $1
       GROUP BY u."Name", u."Lastname"
       ORDER BY comp_count DESC`, [year]
    );

    // Takmičenja sa/bez rješenja
    const solutionStatus = await pool.query(
      `SELECT
         SUM(CASE WHEN "SolutionUrl" IS NOT NULL AND "SolutionUrl" != '' THEN 1 ELSE 0 END) AS with_solution,
         SUM(CASE WHEN "SolutionUrl" IS NULL OR "SolutionUrl" = '' THEN 1 ELSE 0 END) AS without_solution
       FROM "SCIENCE_COMPETITION"
       WHERE "Year" = $1`, [year]
    );

    res.json({
      kpiCards: {
        scienceCompetitions: Number(scienceCompCount.rows[0].count),
        teams: Number(teamsCount.rows[0].count),
        participants: Number(participantsCount.rows[0].count),
      },
      avgScoreByCompetition: avgScoreByCompetition.rows,
      topTeams: topTeams.rows,
      mentorOverview: mentorOverview.rows,
      solutionStatus: solutionStatus.rows[0] || { with_solution: 0, without_solution: 0 },
    });
  } catch (error) {
    console.error("Science coordinator stats error:", error);
    res.status(500).json({ message: "Greška pri dohvatanju statistika." });
  }
});

// ─── GET /statistics/sport-coordinator ──────────────────────────────
router.get("/sport-coordinator", authMiddleware, async (req, res) => {
  try {
    if (req.user.IdUserType !== 5) {
      return res.status(403).json({ message: "Pristup dozvoljen samo koordinatoru za sport." });
    }

    const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();

    // KPI kartice
    const activeSportsCount = await pool.query(
      `SELECT COUNT(DISTINCT "IdSport") AS count FROM "SPORT_COMPETITION" WHERE "Year" = $1`, [year]
    );
    const matchStats = await pool.query(
      `SELECT COUNT(*) AS total, SUM(CASE WHEN m."Status" = 'Završen' THEN 1 ELSE 0 END) AS finished
       FROM "MATCH" m
       JOIN "SPORT_COMPETITION" sc ON m."IdSportCompetition" = sc."IdSportCompetition"
       WHERE sc."Year" = $1`, [year]
    );
    const teamsCount = await pool.query(
      `SELECT COUNT(*) AS count FROM "TEAM" t
       JOIN "SPORT_COMPETITION" sc ON t."IdSportCompetition" = sc."IdSportCompetition"
       WHERE sc."Year" = $1`, [year]
    );

    const totalMatches = Number(matchStats.rows[0]?.total || 0);
    const finishedMatches = Number(matchStats.rows[0]?.finished || 0);
    const playedPercentage = totalMatches > 0 ? Math.round((finishedMatches / totalMatches) * 100) : 0;

    // Po sportovima (broj timova po sportu)
    const teamsBySport = await pool.query(
      `SELECT s."Name" AS sport_name, COUNT(t."IdTeam") AS team_count
       FROM "SPORT" s
       JOIN "SPORT_COMPETITION" sc ON s."IdSport" = sc."IdSport"
       LEFT JOIN "TEAM" t ON sc."IdSportCompetition" = t."IdSportCompetition"
       WHERE sc."Year" = $1
       GROUP BY s."Name"
       ORDER BY team_count DESC`, [year]
    );

    // Rezultati (posljednji odigrani mečevi)
    const recentResults = await pool.query(
      `SELECT m."IdMatch", t1."Name" AS team1, t2."Name" AS team2,
              m."ResultTeam1", m."ResultTeam2",
              s."Name" AS sport_name, a."StartDate", m."Stage"
       FROM "MATCH" m
       JOIN "TEAM" t1 ON m."IdTeam1" = t1."IdTeam"
       JOIN "TEAM" t2 ON m."IdTeam2" = t2."IdTeam"
       JOIN "SPORT_COMPETITION" sc ON m."IdSportCompetition" = sc."IdSportCompetition"
       JOIN "SPORT" s ON sc."IdSport" = s."IdSport"
       JOIN "APPOINTMENT" a ON m."IdAppointment" = a."IdAppointment"
       WHERE sc."Year" = $1 AND m."Status" = 'Završen'
       ORDER BY a."StartDate" DESC
       LIMIT 10`, [year]
    );

    // Fakulteti (angažman po sportovima)
    const facultyEngagement = await pool.query(
      `SELECT f."Name" AS faculty_name, COUNT(DISTINCT sc."IdSport") AS sport_count
       FROM "FACULTY" f
       JOIN "TEAM" t ON f."IdFaculty" = t."IdFaculty"
       JOIN "SPORT_COMPETITION" sc ON t."IdSportCompetition" = sc."IdSportCompetition"
       WHERE sc."Year" = $1
       GROUP BY f."Name"
       ORDER BY sport_count DESC`, [year]
    );

    // Nadolazeći mečevi
    const upcomingMatches = await pool.query(
      `SELECT m."IdMatch", t1."Name" AS team1, t2."Name" AS team2,
              s."Name" AS sport_name, a."StartDate", a."Location", m."Stage"
       FROM "MATCH" m
       JOIN "TEAM" t1 ON m."IdTeam1" = t1."IdTeam"
       JOIN "TEAM" t2 ON m."IdTeam2" = t2."IdTeam"
       JOIN "SPORT_COMPETITION" sc ON m."IdSportCompetition" = sc."IdSportCompetition"
       JOIN "SPORT" s ON sc."IdSport" = s."IdSport"
       JOIN "APPOINTMENT" a ON m."IdAppointment" = a."IdAppointment"
       WHERE sc."Year" = $1 AND a."StartDate" > NOW() AND m."Status" != 'Završen'
       ORDER BY a."StartDate" ASC
       LIMIT 10`, [year]
    );

    res.json({
      kpiCards: {
        activeSports: Number(activeSportsCount.rows[0]?.count || 0),
        totalMatches: totalMatches,
        playedPercentage: playedPercentage,
        totalTeams: Number(teamsCount.rows[0]?.count || 0),
      },
      teamsBySport: teamsBySport.rows,
      recentResults: recentResults.rows,
      facultyEngagement: facultyEngagement.rows,
      upcomingMatches: upcomingMatches.rows,
    });
  } catch (error) {
    console.error("Sport coordinator stats error:", error);
    res.status(500).json({ message: "Greška pri dohvatanju statistika." });
  }
});

// ─── GET /statistics/mentor ─────────────────────────────────────────
router.get("/mentor", authMiddleware, async (req, res) => {
  try {
    if (req.user.IdUserType !== 2) {
      return res.status(403).json({ message: "Pristup dozvoljen samo mentoru." });
    }

    const mentorId = req.user.IdUser;

    // KPI kartice
    const compCount = await pool.query(
      `SELECT COUNT(*) AS count FROM "SCIENCE_COMPETITION" WHERE "IdMentor" = $1`, [mentorId]
    );
    const participantsCount = await pool.query(
      `SELECT COUNT(DISTINCT tm."IdUser") AS count
       FROM "TEAM_MEMBERS" tm
       JOIN "TEAM" t ON tm."IdTeam" = t."IdTeam"
       JOIN "SCIENCE_COMPETITION" sc ON t."IdScienceCompetition" = sc."IdScienceCompetition"
       WHERE sc."IdMentor" = $1`, [mentorId]
    );

    // Rezultati po takmičenju
    const resultsByCompetition = await pool.query(
      `SELECT s."Name" AS competition_name, sc."Year" AS year,
              ROUND(AVG(ur."Score"), 2) AS avg_score,
              COUNT(DISTINCT ur."IdUser") AS num_participants
       FROM "SCIENCE_COMPETITION" sc
       JOIN "SCIENCE" s ON sc."IdScience" = s."IdScience"
       LEFT JOIN "USER_RESULTS" ur ON ur."IdScienceCompetition" = sc."IdScienceCompetition"
       WHERE sc."IdMentor" = $1
       GROUP BY s."Name", sc."Year", sc."IdScienceCompetition"
       ORDER BY sc."Year" DESC`, [mentorId]
    );

    // Top studenti
    const topStudents = await pool.query(
      `SELECT u."Name" || ' ' || u."Lastname" AS student_name,
              f."Name" AS faculty_name,
              SUM(ur."Score") AS total_score
       FROM "USER_RESULTS" ur
       JOIN "USER" u ON ur."IdUser" = u."IdUser"
       JOIN "FACULTY" f ON u."IdFaculty" = f."IdFaculty"
       JOIN "SCIENCE_COMPETITION" sc ON ur."IdScienceCompetition" = sc."IdScienceCompetition"
       WHERE sc."IdMentor" = $1
       GROUP BY u."Name", u."Lastname", f."Name"
       ORDER BY total_score DESC
       LIMIT 5`, [mentorId]
    );

    // Pozicija timova
    const teamPositions = await pool.query(
      `SELECT t."Name" AS team_name, f."Name" AS faculty_name, t."Position" AS position,
              s."Name" AS competition_name, sc."Year" AS year
       FROM "TEAM" t
       JOIN "FACULTY" f ON t."IdFaculty" = f."IdFaculty"
       JOIN "SCIENCE_COMPETITION" sc ON t."IdScienceCompetition" = sc."IdScienceCompetition"
       JOIN "SCIENCE" s ON sc."IdScience" = s."IdScience"
       WHERE sc."IdMentor" = $1 AND t."Position" IS NOT NULL
       ORDER BY sc."Year" DESC, t."Position" ASC`, [mentorId]
    );

    // Status takmičenja (rješenja/termin uvida)
    const competitionStatuses = await pool.query(
      `SELECT s."Name" AS competition_name, sc."Year" AS year,
              CASE WHEN sc."SolutionUrl" IS NOT NULL AND sc."SolutionUrl" != '' THEN true ELSE false END AS has_solution,
              CASE WHEN sc."ReviewAppointment" IS NOT NULL THEN true ELSE false END AS has_review
       FROM "SCIENCE_COMPETITION" sc
       JOIN "SCIENCE" s ON sc."IdScience" = s."IdScience"
       WHERE sc."IdMentor" = $1
       ORDER BY sc."Year" DESC`, [mentorId]
    );

    res.json({
      kpiCards: {
        competitions: Number(compCount.rows[0].count),
        participants: Number(participantsCount.rows[0].count),
      },
      resultsByCompetition: resultsByCompetition.rows,
      topStudents: topStudents.rows,
      teamPositions: teamPositions.rows,
      competitionStatuses: competitionStatuses.rows,
    });
  } catch (error) {
    console.error("Mentor stats error:", error);
    res.status(500).json({ message: "Greška pri dohvatanju statistika." });
  }
});

// ─── GET /statistics/team-leader ────────────────────────────────────
router.get("/team-leader", authMiddleware, async (req, res) => {
  try {
    if (req.user.IdUserType !== 7) {
      return res.status(403).json({ message: "Pristup dozvoljen samo vođi tima." });
    }

    const leaderId = req.user.IdUser;

    // KPI kartice
    const teamsCount = await pool.query(
      `SELECT COUNT(*) AS count FROM "TEAM" WHERE "IdLeader" = $1`, [leaderId]
    );
    const membersCount = await pool.query(
      `SELECT COUNT(DISTINCT tm."IdUser") AS count
       FROM "TEAM_MEMBERS" tm
       JOIN "TEAM" t ON tm."IdTeam" = t."IdTeam"
       WHERE t."IdLeader" = $1`, [leaderId]
    );

    // Pozicije timova
    const teamPositions = await pool.query(
      `SELECT t."Name" AS team_name, t."Category", t."Position",
              f."Name" AS faculty_name,
              COALESCE(s."Name", sci."Name") AS competition_name,
              CASE WHEN t."IdSportCompetition" IS NOT NULL THEN 'Sport' ELSE 'Nauka' END AS type
       FROM "TEAM" t
       JOIN "FACULTY" f ON t."IdFaculty" = f."IdFaculty"
       LEFT JOIN "SPORT_COMPETITION" sc ON t."IdSportCompetition" = sc."IdSportCompetition"
       LEFT JOIN "SPORT" s ON sc."IdSport" = s."IdSport"
       LEFT JOIN "SCIENCE_COMPETITION" snc ON t."IdScienceCompetition" = snc."IdScienceCompetition"
       LEFT JOIN "SCIENCE" sci ON snc."IdScience" = sci."IdScience"
       WHERE t."IdLeader" = $1
       ORDER BY t."Position" ASC NULLS LAST`, [leaderId]
    );

    // Verifikovani vs neverifikovani
    const verificationStatus = await pool.query(
      `SELECT
         SUM(CASE WHEN tm."Verified" = true THEN 1 ELSE 0 END) AS verified,
         SUM(CASE WHEN tm."Verified" = false OR tm."Verified" IS NULL THEN 1 ELSE 0 END) AS unverified
       FROM "TEAM_MEMBERS" tm
       JOIN "TEAM" t ON tm."IdTeam" = t."IdTeam"
       WHERE t."IdLeader" = $1`, [leaderId]
    );

    // Bodovi po timu (naučna takmičenja)
    const teamScores = await pool.query(
      `SELECT t."Name" AS team_name, COALESCE(SUM(ur."Score"), 0) AS total_score
       FROM "TEAM" t
       LEFT JOIN "TEAM_MEMBERS" tm ON t."IdTeam" = tm."IdTeam"
       LEFT JOIN "USER_RESULTS" ur ON tm."IdUser" = ur."IdUser"
         AND ur."IdScienceCompetition" = t."IdScienceCompetition"
       WHERE t."IdLeader" = $1 AND t."IdScienceCompetition" IS NOT NULL
       GROUP BY t."Name"
       ORDER BY total_score DESC`, [leaderId]
    );

    // Nadolazeći mečevi
    const upcomingMatches = await pool.query(
      `SELECT m."IdMatch", t1."Name" AS team1, t2."Name" AS team2,
              s."Name" AS sport_name, a."StartDate", a."Location", m."Stage"
       FROM "MATCH" m
       JOIN "TEAM" t1 ON m."IdTeam1" = t1."IdTeam"
       JOIN "TEAM" t2 ON m."IdTeam2" = t2."IdTeam"
       JOIN "SPORT_COMPETITION" sc ON m."IdSportCompetition" = sc."IdSportCompetition"
       JOIN "SPORT" s ON sc."IdSport" = s."IdSport"
       JOIN "APPOINTMENT" a ON m."IdAppointment" = a."IdAppointment"
       WHERE (t1."IdLeader" = $1 OR t2."IdLeader" = $1) AND a."StartDate" > NOW()
       ORDER BY a."StartDate" ASC
       LIMIT 10`, [leaderId]
    );

    res.json({
      kpiCards: {
        teams: Number(teamsCount.rows[0].count),
        members: Number(membersCount.rows[0].count),
      },
      teamPositions: teamPositions.rows,
      verificationStatus: verificationStatus.rows[0] || { verified: 0, unverified: 0 },
      teamScores: teamScores.rows,
      upcomingMatches: upcomingMatches.rows,
    });
  } catch (error) {
    console.error("Team leader stats error:", error);
    res.status(500).json({ message: "Greška pri dohvatanju statistika." });
  }
});

// Dostupne godine
router.get("/years", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT year FROM (
         SELECT "Year" AS year FROM "SPORT_COMPETITION"
         UNION
         SELECT "Year" AS year FROM "SCIENCE_COMPETITION"
       ) sub ORDER BY year DESC`
    );
    res.json(result.rows.map(r => r.year));
  } catch (error) {
    console.error("Years error:", error);
    res.status(500).json({ message: "Greška pri dohvatanju godina." });
  }
});

export default router;
