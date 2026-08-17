const db = require("../data/store");
const plans = require("../config/plans");

function getPlanLimits(planId) {
  const plan = plans[planId];
  if (!plan) return null;
  return plan.limits;
}

function checkLimit(req, res, next) {
  const userId = req.user.id;
  const feature = req.body.feature || req.params.feature;
  const amount = req.body.amount || 1;

  const sub = db.subscriptions.getByUserId(userId);
  const planId = sub ? sub.planId : "free";
  const limits = getPlanLimits(planId);

  if (!limits) {
    return res.status(400).json({ message: "Invalid subscription plan" });
  }

  const currentUsage = db.usage.getByUserIdAndFeature(userId, feature);
  const currentCount = currentUsage ? currentUsage.count : 0;
  const limit = limits[feature];

  if (limit === Infinity) {
    return next();
  }

  if (currentCount + amount > limit) {
    return res.status(403).json({
      message: `Feature limit exceeded for ${feature}`,
      limit,
      current: currentCount,
      requested: amount,
      plan: planId,
    });
  }

  req.feature = feature;
  req.amount = amount;
  next();
}

module.exports = { checkLimit };
