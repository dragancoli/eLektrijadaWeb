import express from "express";
import pool from "../db.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import multer from "multer";
import path from "path";

const router = express.Router();

// --- KONFIGURACIJA AWS S3 ---
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// --- KONFIGURACIJA MULTER-a ---
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// ----------------------
// GET /news/latest
// Get latest 5 news articles
// ----------------------
router.get("/latest", async (req, res) => {
    try {
        const query = `
            SELECT 
                n."IdNews",
                n."Title",
                n."Content",
                n."Category",
                n."PictureUrl",
                n."Important",
                n."IdUser",
                u."Name" AS "AuthorName",
                u."Lastname" AS "AuthorLastname",
                n."CreatedAt"
            FROM "NEWS" n
            JOIN "USER" u ON u."IdUser" = n."IdUser"
            ORDER BY n."CreatedAt" DESC
            LIMIT 5;
        `;
        const result = await pool.query(query);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error("Error fetching latest news:", error);
        res.status(500).json({ message: "Greška na serveru prilikom preuzimanja najnovijih vesti." });
    }
});

// ----------------------
// GET /news/filter
// Get news articles with filtering
// ----------------------
router.get("/filter", async (req, res) => {
    const { kategorija, search } = req.query;
    try {
        let queryText = `
            SELECT 
                n."IdNews",
                n."Title",
                n."Content",
                n."Category",
                n."PictureUrl",
                n."Important",
                n."IdUser",
                u."Name" AS "AuthorName",
                u."Lastname" AS "AuthorLastname",
                n."CreatedAt"
            FROM "NEWS" n
            JOIN "USER" u ON u."IdUser" = n."IdUser"
        `;

        const params = [];
        const conditions = [];

        if (kategorija && kategorija !== "Sve") {
            if (kategorija === "Vazno") {
                conditions.push(`n."Important" = true`);
            } else {
                conditions.push(`n."Category" = $${params.length + 1}`);
                params.push(kategorija);
            }
        }

        if (search) {
            conditions.push(`(n."Title" ILIKE $${params.length + 1} OR n."Content" ILIKE $${params.length + 1})`);
            params.push(`%${search}%`);
        }

        if (conditions.length > 0) {
            queryText += " WHERE " + conditions.join(" AND ");
        }

        queryText += ' ORDER BY n."CreatedAt" DESC;';

        const result = await pool.query(queryText, params);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error("Error fetching filtered news:", error);
        res.status(500).json({ message: "Greška na serveru prilikom pretrage vesti." });
    }
});

// ----------------------
// GET /news (Sve vijesti)
// ----------------------
router.get("/", async (req, res) => {
    try {
        const query = `
            SELECT 
                n."IdNews",
                n."Title",
                n."Content",
                n."Category",
                n."PictureUrl",
                n."Important",
                n."IdUser",
                u."Name" AS "AuthorName",
                u."Lastname" AS "AuthorLastname",
                n."CreatedAt"
            FROM "NEWS" n
            JOIN "USER" u ON u."IdUser" = n."IdUser"
            ORDER BY n."CreatedAt" DESC;
        `;
        const result = await pool.query(query);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error("Error fetching news:", error);
        res.status(500).json({ message: "Greška na serveru." });
    }
});

// ----------------------
// POST /news
// Kreiranje vijesti (SAMO TEKST)
// ----------------------
router.post("/", authMiddleware, async (req, res) => {
    // Nema više upload.single middleware-a ovdje
    const { Title, Content, Category, Important = false, IdUser } = req.body;

    if (!Title || !Content || !Category || !IdUser) {
        return res.status(400).json({ message: "Nedostaju obavezna polja." });
    }

    try {
        const query = `
            INSERT INTO "NEWS" 
                ("Title", "Content", "Category", "Important", "IdUser")
            VALUES ($1, $2, $3, $4, $5)
            RETURNING "IdNews", "Title", "Content";
        `;
        
        const result = await pool.query(query, [Title, Content, Category, Important, IdUser]);
        
        // Vraćamo kreiranu vijest (sa ID-jem koji nam treba za sliku)
        res.status(201).json(result.rows[0]);

    } catch (error) {
        console.error("Error creating news:", error);
        res.status(500).json({ message: "Greška pri kreiranju vijesti." });
    }
});
// ----------------------
// PUT /news/:id
// Ažuriranje vijesti
// ----------------------
router.put("/:id", authMiddleware, async (req, res) => {
    const { id } = req.params;
    // DODALI SMO PictureUrl U DESTRUKTURIRANJE
    const { Title, Content, Category, Important, PictureUrl } = req.body;

    try {
        const fields = [];
        const values = [];
        let index = 1;

        if (Title !== undefined) { fields.push(`"Title" = $${index++}`); values.push(Title); }
        if (Content !== undefined) { fields.push(`"Content" = $${index++}`); values.push(Content); }
        if (Category !== undefined) { fields.push(`"Category" = $${index++}`); values.push(Category); }
        if (Important !== undefined) { fields.push(`"Important" = $${index++}`); values.push(Important); }
        
        // --- KLJUČNA IZMJENA ---
        // Dozvoljavamo ažuriranje PictureUrl-a kroz JSON (za brisanje slike)
        // Provjeravamo undefined jer PictureUrl može biti null (što znači brisanje)
        if (PictureUrl !== undefined) { 
            fields.push(`"PictureUrl" = $${index++}`); 
            values.push(PictureUrl); 
        }
        // -----------------------

        if (fields.length === 0) {
            return res.status(200).json({ message: "Nema izmjena." });
        }

        values.push(id);

        const query = `
            UPDATE "NEWS"
            SET ${fields.join(", ")}
            WHERE "IdNews" = $${index}
            RETURNING *;
        `;
        const result = await pool.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Vijest nije pronađena." });
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error("Error updating news:", error);
        res.status(500).json({ message: "Greška pri ažuriranju." });
    }
});

// ----------------------
// POST /news/:id/image
// Upload slike za vijest (SAMO SLIKA)
// ----------------------
router.post("/:id/image", authMiddleware, upload.single("image"), async (req, res) => {
    const { id } = req.params;

    if (!req.file) {
        return res.status(400).json({ message: "Slika nije poslata." });
    }

    try {
        // 1. Upload na S3
        const ext = path.extname(req.file.originalname);
        const fileName = `news/${id}/${Date.now()}${ext}`; // Organizujemo po ID-u vijesti
        
        const params = {
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: fileName,
            Body: req.file.buffer,
            ContentType: req.file.mimetype,
        };

        await s3Client.send(new PutObjectCommand(params));
        const pictureUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;

        // 2. Ažuriranje baze
        const query = `
            UPDATE "NEWS"
            SET "PictureUrl" = $1
            WHERE "IdNews" = $2
            RETURNING "PictureUrl";
        `;
        
        await pool.query(query, [pictureUrl, id]);

        res.status(200).json({ message: "Slika uspješno postavljena.", PictureUrl: pictureUrl });

    } catch (error) {
        console.error("Error uploading image:", error);
        res.status(500).json({ message: "Greška pri uploadu slike." });
    }
});

// ----------------------
// DELETE /news/:id
// ----------------------
router.delete("/:id", authMiddleware, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM "NEWS" WHERE "IdNews" = $1 RETURNING *;', [id]);
        if (result.rows.length === 0) return res.status(404).json({ message: "Vijest nije pronađena." });
        res.status(200).json({ message: "Vijest obrisana." });
    } catch (error) {
        res.status(500).json({ message: "Greška pri brisanju." });
    }
});

export default router;