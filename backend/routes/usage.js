const db = require("../data/store");
const { authMiddleware } = require("../middleware/auth");
const { checkLimit } = require("../middleware/featureLimit");

const router = require("express").Router();

router.post("/track", authMiddleware, checkLimit, (req, res) => {
  const { feature, amount } = req.body;
  const finalAmount = amount || req.amount || 1;

  const record = db.usage.increment(req.user.id, feature, finalAmount);

  res.json({
    message: "Usage tracked",
    feature,
    count: record.count,
    userId: req.user.id,
  });
});

router.get("/me", authMiddleware, (req, res) => {
  const usage = db.usage.getAll().filter((u) => u.userId === req.user.id);
  const sub = db.subscriptions.getByUserId(req.user.id);
  const planId = sub ? sub.planId : "free";
  const planLimits = require("../config/plans")[planId].limits;

  const breakdown = usage.map((u) => ({
    feature: u.feature,
    used: u.count,
    limit: planLimits[u.feature] || "unlimited",
  }));

  res.json({ usage: breakdown });
});

module.exports = router;
