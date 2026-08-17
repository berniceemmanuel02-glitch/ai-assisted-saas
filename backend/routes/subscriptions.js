const db = require("../data/store");
const plans = require("../config/plans");
const { authMiddleware } = require("../middleware/auth");

const router = require("express").Router();

router.post("/subscribe", authMiddleware, (req, res) => {
  try {
    const { planId } = req.body;
    const plan = plans[planId];

    if (!plan) return res.status(400).json({ message: "Invalid plan" });

    const existing = db.subscriptions.getByUserId(req.user.id);
    if (existing && existing.status === "active" && existing.planId === planId) {
      return res.status(400).json({ message: "Already subscribed to this plan" });
    }

    const subscription = {
      id: Date.now().toString(),
      userId: req.user.id,
      planId,
      status: "active",
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };

    db.subscriptions.create(subscription);
    res.status(201).json({ message: "Subscribed successfully", subscription });
  } catch (error) {
    res.status(500).json({ message: "Subscription failed", error: error.message });
  }
});

router.post("/cancel", authMiddleware, (req, res) => {
  const sub = db.subscriptions.getByUserId(req.user.id);
  if (!sub) return res.status(404).json({ message: "No active subscription" });

  const updated = db.subscriptions.update(req.user.id, { status: "cancelled", endDate: new Date().toISOString() });
  res.json({ message: "Subscription cancelled", subscription: updated });
});

router.get("/", authMiddleware, (req, res) => {
  const sub = db.subscriptions.getByUserId(req.user.id);
  if (!sub) return res.json({ subscription: null });
  res.json({ subscription: sub });
});

module.exports = router;
