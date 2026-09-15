const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../data/store");
const { getJwtSecret } = require("../middleware/auth");
const { authMiddleware, adminOnly } = require("../middleware/auth");

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isValidEmail(email) {
  const trimmed = normalizeEmail(email);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

const router = require("express").Router();

router.get("/accept-invite/:token", (req, res) => {
  res.redirect(`${req.protocol}://${req.get("host")}/admin/accept-invite?token=${encodeURIComponent(req.params.token)}`);
});

router.post("/", authMiddleware, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ message: "A valid email address is required." });
    }

    const normalizedEmail = normalizeEmail(email);

    const userSchools = db.schools.getByUserId ? db.schools.getByUserId(req.user.id) : db.schools.getByUserId(req.user.id);
    if (!userSchools || userSchools.length === 0) {
      return res.status(403).json({ message: "You do not belong to any school." });
    }

    let schoolId;
    if (req.user.schoolId) {
      schoolId = req.user.schoolId;
      const school = db.schools.getById(schoolId);
      if (!school) {
        return res.status(403).json({ message: "Your school could not be found." });
      }
    } else {
      schoolId = userSchools[0].id;
    }

    if (userSchools.some((s) => s.id !== schoolId)) {
      return res.status(403).json({ message: "You can only invite admins to your own school." });
    }

    const existingUser = await db.users.getByEmail(normalizedEmail);
    if (existingUser && existingUser.schoolId === schoolId) {
      return res.status(409).json({ message: "This email is already an admin for your school." });
    }

    const token = generateToken();
    const tokenHash = hashToken(token);

    const existing = db.invitations.getByEmail(normalizedEmail).filter(
      (i) => i.schoolId === schoolId && !i.used && i.expiresAt > new Date().toISOString()
    );
    if (existing.length > 0) {
      return res.status(409).json({ message: "A valid invitation already exists for this email." });
    }

    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS).toISOString();

    const invitation = {
      id: Date.now().toString() + crypto.randomBytes(4).toString("hex"),
      email: normalizedEmail,
      schoolId,
      inviterId: req.user.id,
      tokenHash,
      expiresAt,
      used: false,
      createdAt: now,
      updatedAt: now,
    };

    db.invitations.create(invitation);

    const baseUrl = process.env.FRONTEND_URL || `${req.protocol}://${req.get("host")}`;
    const inviteLink = `${baseUrl}/admin/accept-invite?token=${token}`;

    return res.status(201).json({
      message: "Invitation created.",
      inviteLink,
      email: normalizedEmail,
      schoolId,
      expiresAt,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to create invitation", error: error.message });
  }
});

router.post("/:token/accept", async (req, res) => {
  try {
    const { token } = req.params;
    const { name, password, confirmPassword } = req.body;

    if (!token) {
      return res.status(400).json({ message: "Invitation token is required." });
    }

    const tokenHash = hashToken(token);
    const invitation = db.invitations.getByTokenHash(tokenHash);

    if (!invitation) {
      return res.status(404).json({ message: "Invitation not found, expired, or already used." });
    }

    const existingUser = await db.users.getByEmail(invitation.email);
    if (existingUser) {
      return res.status(409).json({
        message: "An account with this email already exists. Please log in instead.",
        emailExists: true,
      });
    }

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return res.status(400).json({ message: "A valid name is required." });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters." });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const now = new Date().toISOString();

    const user = {
      id: Date.now().toString() + crypto.randomBytes(4).toString("hex"),
      name: name.trim(),
      email: invitation.email,
      password: hashedPassword,
      role: "admin",
      schoolId: invitation.schoolId,
      createdAt: now,
    };

    db.invitations.update(invitation.id, {
      used: true,
      updatedAt: now,
    });

    const createdUser = db.users.create(user);

    const authToken = jwt.sign(
      { id: createdUser.id, email: createdUser.email, role: createdUser.role },
      getJwtSecret(),
      { expiresIn: "7d" }
    );

    res.status(201).json({
      message: "Account created successfully.",
      token: authToken,
      user: {
        id: createdUser.id,
        name: createdUser.name,
        email: createdUser.email,
        role: createdUser.role,
        schoolId: createdUser.schoolId,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to accept invitation", error: error.message });
  }
});

router.get("/:token", async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ message: "Invitation token is required." });
    }

    const tokenHash = hashToken(token);
    const invitation = db.invitations.getByTokenHash(tokenHash);

    if (!invitation) {
      return res.status(404).json({ message: "Invitation not found, expired, or already used." });
    }

    const existingUser = await db.users.getByEmail(invitation.email);
    if (existingUser) {
      return res.status(200).json({
        emailExists: true,
        message: "An account with this email already exists.",
      });
    }

    return res.status(200).json({
      email: invitation.email,
      schoolId: invitation.schoolId,
      expiresAt: invitation.expiresAt,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to verify invitation", error: error.message });
  }
});

module.exports = router;
