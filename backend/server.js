// server.js
import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import auth from "./routes/auth.js";
import faculty from "./routes/faculty.js";
import sports from "./routes/sports.js";
import teams from "./routes/teams.js";
import science from "./routes/sciences.js";
import account from "./routes/account.js";
import problem from "./routes/problem.js";
import myCompetitions from "./routes/my-competitions.js";
import matches from "./routes/matches.js";
import news from "./routes/news.js";
import pool from "./db.js";
import scienceCompetitions from "./routes/scienceCompetitions.js";
import userVerification from "./routes/userVerification.js";
import stewardManagement from "./routes/stewardManagement.js";
import scienceResults from "./routes/scienceResults.js";
import schedule from "./routes/schedule.js";
import publicSports from "./routes/public-sports.js";
import publicCompetitions from "./routes/public-competitions.js";
import matchNotifications from "./routes/match-notifications.js";
import competitionNotifications from "./routes/competition-notifications.js";
import rankings from "./routes/rankings.js";
import teamLeaderVerification from "./routes/teamLeaderVerification.js";
import statistics from "./routes/statistics.js";

dotenv.config();
const app = express();

// Rate limiting - 100 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10000, // Limit each IP to 100 requests per windowMs
  message: { error: "Too many requests from this IP, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limit for auth routes - 10 requests per 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50000,
  message: { error: "Too many login attempts, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply general rate limiting to all requests
app.use(limiter);

// Security headers
app.use(helmet());

// Middleware za logovanje svakog zahtjeva
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Rute
app.use("/auth", authLimiter, auth);
app.use("/faculties", faculty);
app.use("/sports", sports);
app.use("/teams", teams);
app.use("/sciences", science);
app.use("/account", account);
app.use("/problems", problem);
app.use("/my-competitions", myCompetitions);
app.use("/matches", matches);
app.use("/news", news);
app.use("/science-competitions", scienceCompetitions);
app.use("/user-verification", userVerification);
app.use("/stewards", stewardManagement);
app.use("/science-results", scienceResults);
app.use("/schedule", schedule);
app.use("/public-sports", publicSports);
app.use("/public-competitions", publicCompetitions);
app.use("/match-notifications", matchNotifications);
app.use("/competition-notifications", competitionNotifications);
app.use("/rankings", rankings);
app.use("/team-leader-verification", teamLeaderVerification);
app.use("/statistics", statistics);

// Health check endpoint
app.get("/health", (req, res) => {
    res.status(200).send("OK");
});

// 404 handler za nepostojeće rute
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Globalni error handler - hvata sve greške i sprečava pad servera
app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] Server Error:`, err.stack || err);
  res.status(err.status || 500).json({ 
    error: err.message || "Internal server error" 
  });
});

// Process error handlers - sprečavaju pad servera kod neobrađenih grešaka
process.on("uncaughtException", (err) => {
  console.error(`[${new Date().toISOString()}] Uncaught Exception:`, err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error(`[${new Date().toISOString()}] Unhandled Rejection:`, reason);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
