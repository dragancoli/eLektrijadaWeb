import jwt from "jsonwebtoken";
import pool from "../db.js";

const authMiddleware = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    try {
      token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const userQuery = await pool.query(
        'SELECT "IdUser", "Name", "Lastname", "Email", "IdUserType", "IdFaculty" FROM "USER" WHERE "IdUser" = $1',
        [decoded.id]
      );

      if (userQuery.rows.length === 0) {
        return res.status(401).json({ message: "Korisnik nije pronađen." });
      }

      req.user = userQuery.rows[0];

      next();
    } catch (error) {
      console.error(error);
      res.status(401).json({ message: "Token nije validan ili je istekao." });
    }
  }

  if (!token) {
    res.status(401).json({ message: "Niste autorizovani, token nije priložen." });
  }
};

export default authMiddleware;
