const jwt = require("jsonwebtoken");
const db = require("../data/store");

const JWT_SECRET = process.env.JWT_SECRET || "salesbook-secret-key";

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ message: "No token provided" });

  const token = header.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.users.getById(decoded.id);
    if (!user) return res.status(401).json({ message: "User not found" });
    req.user = { id: user.id, email: user.email, role: user.role, name: user.name };

    if (process.env.ADMIN_EMAILS) {
      const adminEmails = process.env.ADMIN_EMAILS.split(",").map((e) => e.trim().toLowerCase());
      if (adminEmails.includes(user.email.toLowerCase())) {
        req.user.role = "admin";
      }
    }

    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== "admin") return res.status(403).json({ message: "Admin access required" });
  next();
}

module.exports = { authMiddleware, adminOnly, JWT_SECRET };
