import express from 'express';
import pool from '../db.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/', authMiddleware, async (req, res) => {
    const { title, description } = req.body;
    const userId = req.user.IdUser;

    if (!title || !description) {
        return res.status(400).json({ error: 'Title and description are required' });
    }

    try {
        const result = await pool.query(
            'INSERT INTO "PROBLEM" ("Title", "Description", "Status", "USER_IdUser") VALUES ($1, $2, $3, $4) RETURNING *',
            [title, description, 'Otvoren', userId]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error adding problem:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;