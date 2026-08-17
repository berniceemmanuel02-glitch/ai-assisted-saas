const db = require("../data/store");
const plans = require("../config/plans");
const { authMiddleware } = require("../middleware/auth");

const router = require("express").Router();

router.get("/", (req, res) => {
  res.json({
    plans: Object.values(plans).map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      currency: p.currency,
      interval: p.interval,
      features: p.features,
    })),
  });
});

router.get("/current", authMiddleware, (req, res) => {
  const sub = db.subscriptions.getByUserId(req.user.id);
  const planId = sub ? sub.planId : "free";
  const plan = plans[planId];
  res.json({ plan: plan ? { id: plan.id, name: plan.name, price: plan.price, features: plan.features } : null });
});

module.exports = router;
