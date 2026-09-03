const db = require("../data/store");
const { authMiddleware } = require("../middleware/auth");

const router = require("express").Router();

router.get("/", authMiddleware, (req, res) => {
  const schools = db.schools.getByUserId(req.user.id);
  res.json({ schools });
});

router.get("/:id", authMiddleware, (req, res) => {
  const school = db.schools.getById(req.params.id);
  if (!school) return res.status(404).json({ message: "School not found" });
  res.json({ school });
});

router.post("/", authMiddleware, (req, res) => {
  try {
    const { name, address, city, state, email, phone } = req.body;
    if (!name || !address || !city || !state || !email || !phone) {
      return res.status(400).json({ message: "All school fields are required" });
    }

    const school = {
      id: Date.now().toString(),
      name,
      address,
      city,
      state,
      email,
      phone,
      logo: null,
      subscriptionId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const created = db.schools.create(school);
    res.status(201).json({ message: "School created", school: created });
  } catch (error) {
    res.status(500).json({ message: "Failed to create school", error: error.message });
  }
});

router.put("/:id", authMiddleware, (req, res) => {
  try {
    const school = db.schools.getById(req.params.id);
    if (!school) return res.status(404).json({ message: "School not found" });

    const allowed = ["name", "address", "city", "state", "email", "phone", "logo"];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }
    updates.updatedAt = new Date().toISOString();

    const updated = db.schools.update(req.params.id, updates);
    res.json({ message: "School updated", school: updated });
  } catch (error) {
    res.status(500).json({ message: "Failed to update school", error: error.message });
  }
});

module.exports = router;
