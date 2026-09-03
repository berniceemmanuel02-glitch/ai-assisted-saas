const db = require("../data/store");
const plans = require("../config/plans");

function getPlanLimits(planId) {
  const plan = plans[planId];
  if (!plan) return null;
  return plan.limits;
}

function getEffectivePlanId(userId) {
  const sub = db.subscriptions.getByUserId(userId);
  if (!sub) return "free";
  if (sub.status === "cancelled") return "free";
  if (sub.endDate && new Date(sub.endDate) < new Date()) return "free";
  return sub.planId;
}

function checkLimit(req, res, next) {
  const userId = req.user.id;
  const feature = req.feature || req.body.feature || req.params.feature;
  const amount = req.body.amount || 1;

  const planId = getEffectivePlanId(userId);
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

function enforceLimit(feature) {
  return (req, res, next) => {
    const userId = req.user.id;
    const planId = getEffectivePlanId(userId);
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

    if (currentCount + 1 > limit) {
      return res.status(403).json({
        message: `Feature limit exceeded for ${feature}`,
        limit,
        current: currentCount,
        requested: 1,
        plan: planId,
      });
    }

    req.feature = feature;
    next();
  };
}

function trackUsage(feature) {
  return (req, res, next) => {
    const originalJson = res.json.bind(res);
    let tracked = false;
    res.json = (body) => {
      if (!tracked && res.statusCode >= 200 && res.statusCode < 300) {
        try {
          db.usage.increment(req.user.id, feature, 1);
        } catch (e) {
          console.error(`Failed to track usage for ${feature}:`, e.message);
        }
        tracked = true;
      }
      return originalJson(body);
    };
    next();
  };
}

module.exports = { checkLimit, enforceLimit, trackUsage, getEffectivePlanId };
