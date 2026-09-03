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
    const schoolId = Date.now().toString();
    const school = {
      id: schoolId,
      name: name + "'s School",
      address: "",
      city: "",
      state: "",
      email: email,
      phone: "",
      logo: null,
      subscriptionId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.schools.create(school);

    const user = {
      id: Date.now().toString(),
      name,
      email,
      password: hashedPassword,
      role: "user",
      schoolId,
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
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ message: "Invalid credentials" });

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
  const user = db.users.getById(req.user.id);
  if (!user) return res.status(404).json({ message: "User not found" });

  let schools = db.schools.getByUserId(req.user.id);
  if (!schools.length && !user.schoolId) {
    const schoolId = Date.now().toString();
    const school = {
      id: schoolId,
      name: user.name + "'s School",
      address: "",
      city: "",
      state: "",
      email: user.email,
      phone: "",
      logo: null,
      subscriptionId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.schools.create(school);
    db.users.update(user.id, { schoolId });
    req.user.schoolId = schoolId;
    schools = db.schools.getByUserId(req.user.id);
  }

  res.json({ user: req.user, school: schools[0] || null });
});

module.exports = router;
