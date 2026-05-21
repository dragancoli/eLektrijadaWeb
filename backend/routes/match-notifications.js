import express from "express";
import pool from "../db.js";

const router = express.Router();

// POST /subscribe
router.post("/subscribe", async (req, res) => {
  const { IdMatch, ExpoPushToken } = req.body;

  if (!IdMatch || !ExpoPushToken) {
    return res.status(400).json({ message: "Nedostaju podaci (IdMatch, ExpoPushToken)." });
  }

  try {
    const query = `
      INSERT INTO "MATCH_NOTIFICATIONS" ("IdMatch", "ExpoPushToken")
      VALUES ($1, $2)
      ON CONFLICT ("IdMatch", "ExpoPushToken") DO NOTHING;
    `;
    await pool.query(query, [IdMatch, ExpoPushToken]);
    res.status(200).json({ message: "Uspešno ste se pretplatili na notifikacije." });
  } catch (error) {
    console.error("Error subscribing to notifications:", error);
    res.status(500).json({ message: "Greška na serveru." });
  }
});

// POST /unsubscribe
router.post("/unsubscribe", async (req, res) => {
  const { IdMatch, ExpoPushToken } = req.body;

  if (!IdMatch || !ExpoPushToken) {
    return res.status(400).json({ message: "Nedostaju podaci (IdMatch, ExpoPushToken)." });
  }

  try {
    const query = `
      DELETE FROM "MATCH_NOTIFICATIONS"
      WHERE "IdMatch" = $1 AND "ExpoPushToken" = $2;
    `;
    await pool.query(query, [IdMatch, ExpoPushToken]);
    res.status(200).json({ message: "Uspešno ste otkazali pretplatu." });
  } catch (error) {
    console.error("Error unsubscribing from notifications:", error);
    res.status(500).json({ message: "Greška na serveru." });
  }
});

// GET /status/:idMatch/:token
router.get("/status/:idMatch/:token", async (req, res) => {
  const { idMatch, token } = req.params;

  try {
    const query = `
      SELECT 1 FROM "MATCH_NOTIFICATIONS"
      WHERE "IdMatch" = $1 AND "ExpoPushToken" = $2;
    `;
    const result = await pool.query(query, [idMatch, token]);
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
      SELECT "IdMatch" FROM "MATCH_NOTIFICATIONS"
      WHERE "ExpoPushToken" = $1;
    `;
    const result = await pool.query(query, [token]);
    const subscribedMatchIds = result.rows.map(row => row.IdMatch);
    res.status(200).json(subscribedMatchIds);
  } catch (error) {
    console.error("Error fetching subscriptions:", error);
    res.status(500).json({ message: "Greška na serveru." });
  }
});

export default router;
