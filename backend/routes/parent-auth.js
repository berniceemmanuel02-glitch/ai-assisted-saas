const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../data/store");
const { getJwtSecret } = require("../middleware/auth");
const { OAuth2Client } = require("google-auth-library");

const router = require("express").Router();

router.get("/config", (req, res) => {
  res.json({
    googleClientId: process.env.GOOGLE_CLIENT_ID,
  });
});

const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required" });
    }

    if (db.users.getByEmail(email)) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = {
      id: Date.now().toString(),
      name,
      email,
      password: hashedPassword,
      role: "parent",
      schoolId: null,
      createdAt: new Date().toISOString(),
    };

    const createdUser = db.users.create(user);

    const token = jwt.sign({ id: createdUser.id, email: createdUser.email, role: createdUser.role }, getJwtSecret(), { expiresIn: "7d" });

    res.status(201).json({
      token,
      user: { id: createdUser.id, name: createdUser.name, email: createdUser.email, role: createdUser.role, schoolId: createdUser.schoolId },
    });
  } catch (error) {
    res.status(500).json({ message: "Registration failed", error: error.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = db.users.getByEmail(email);
    if (!user || user.role !== "parent") {
      return res.status(400).json({ message: "Invalid parent credentials" });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ message: "Invalid parent credentials" });

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, getJwtSecret(), { expiresIn: "7d" });

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, schoolId: user.schoolId },
    });
  } catch (error) {
    res.status(500).json({ message: "Login failed", error: error.message });
  }
});

router.get("/me", require("../middleware/auth").authMiddleware, (req, res) => {
  if (req.user.role !== "parent") {
    return res.status(403).json({ message: "Parent access required" });
  }
  res.json({ user: req.user });
});
router.get("/google", (req, res) => {
  const url = googleClient.generateAuthUrl({
    access_type: "offline",
    scope: ["openid", "email", "profile"],
    prompt: "select_account",
  });

  res.redirect(url);
});

router.post("/google/verify", async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ message: "Google credential is required" });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload || !payload.email || !payload.email_verified) {
      return res.status(400).json({ message: "Google account email could not be verified." });
    }

    const email = payload.email.toLowerCase();
    const name = payload.name || email.split("@")[0];

    let user = db.users.getByEmail(email);

    if (!user) {
      user = {
        id: Date.now().toString(),
        name,
        email,
        password: null,
        role: "parent",
        schoolId: null,
        createdAt: new Date().toISOString(),
      };

      user = db.users.create(user);
    }

    if (user.role !== "parent") {
      return res.status(403).json({ message: "This Google account is not registered as a parent." });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      getJwtSecret(),
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, schoolId: user.schoolId },
    });
  } catch (error) {
    console.error("Google verify error:", error);
    res.status(500).json({ message: "Google login failed.", error: error.message });
  }
});

router.get("/google/callback", async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).send("Google login was cancelled or failed.");
    }

    const { tokens } = await googleClient.getToken(code);
    googleClient.setCredentials(tokens);

    const ticket = await googleClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload || !payload.email || !payload.email_verified) {
      return res.status(400).send("Google account email could not be verified.");
    }

    const email = payload.email.toLowerCase();
    const name = payload.name || email.split("@")[0];

    let user = db.users.getByEmail(email);

    if (!user) {
      user = {
        id: Date.now().toString(),
        name,
        email,
        password: null,
        role: "parent",
        schoolId: null,
        createdAt: new Date().toISOString(),
      };

      user = db.users.create(user);
    }

    if (user.role !== "parent") {
      return res.status(403).send("This Google account is not registered as a parent.");
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      getJwtSecret(),
      { expiresIn: "7d" }
    );

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5000";

    res.redirect(
      `${frontendUrl}/?google_token=${encodeURIComponent(token)}`
    );
  } catch (error) {
    console.error("Google login error:", error);
    res.status(500).send("Google login failed.");
  }
});

module.exports = router;
