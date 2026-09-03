const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../data/store");
const { getJwtSecret } = require("../middleware/auth");

const router = require("express").Router();

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

module.exports = router;
