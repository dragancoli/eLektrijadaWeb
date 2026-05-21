import express from "express";
import pool from "../db.js";

const router = express.Router();

// POST /subscribe
router.post("/subscribe", async (req, res) => {
  const { IdScienceCompetition, ExpoPushToken } = req.body;

  if (!IdScienceCompetition || !ExpoPushToken) {
    return res.status(400).json({ message: "Nedostaju podaci (IdScienceCompetition, ExpoPushToken)." });
  }

  try {
    const query = `
      INSERT INTO "COMPETITION_NOTIFICATIONS" ("IdScienceCompetition", "ExpoPushToken")
      VALUES ($1, $2)
      ON CONFLICT ("IdScienceCompetition", "ExpoPushToken") DO NOTHING;
    `;
    await pool.query(query, [IdScienceCompetition, ExpoPushToken]);
    res.status(200).json({ message: "Uspešno ste se pretplatili na notifikacije." });
  } catch (error) {
    console.error("Error subscribing to competition notifications:", error);
    res.status(500).json({ message: "Greška na serveru." });
  }
});

// POST /unsubscribe
router.post("/unsubscribe", async (req, res) => {
  const { IdScienceCompetition, ExpoPushToken } = req.body;

  if (!IdScienceCompetition || !ExpoPushToken) {
    return res.status(400).json({ message: "Nedostaju podaci (IdScienceCompetition, ExpoPushToken)." });
  }

  try {
    const query = `
      DELETE FROM "COMPETITION_NOTIFICATIONS"
      WHERE "IdScienceCompetition" = $1 AND "ExpoPushToken" = $2;
    `;
    await pool.query(query, [IdScienceCompetition, ExpoPushToken]);
    res.status(200).json({ message: "Uspešno ste otkazali pretplatu." });
  } catch (error) {
    console.error("Error unsubscribing from competition notifications:", error);
    res.status(500).json({ message: "Greška na serveru." });
  }
});

// GET /status/:idCompetition/:token
router.get("/status/:idCompetition/:token", async (req, res) => {
  const { idCompetition, token } = req.params;

  try {
    const query = `
      SELECT 1 FROM "COMPETITION_NOTIFICATIONS"
      WHERE "IdScienceCompetition" = $1 AND "ExpoPushToken" = $2;
    `;
    const result = await pool.query(query, [idCompetition, token]);
    res.status(200).json({ subscribed: result.rows.length > 0 });
  } catch (error) {
    console.error("Error checking subscription status:", error);
    res.status(500).json({ message: "Greška na serveru." });
  }
});

// GET /my-subscriptions/:token
router.get("/my-subscriptions/:token", async (req, res) => {
  const { token } = req.params;

  try {
    const query = `
      SELECT "IdScienceCompetition" FROM "COMPETITION_NOTIFICATIONS"
      WHERE "ExpoPushToken" = $1;
    `;
    const result = await pool.query(query, [token]);
    const subscribedCompetitionIds = result.rows.map(row => row.IdScienceCompetition);
    res.status(200).json(subscribedCompetitionIds);
  } catch (error) {
    console.error("Error fetching subscriptions:", error);
    res.status(500).json({ message: "Greška na serveru." });
  }
});

export default router;
