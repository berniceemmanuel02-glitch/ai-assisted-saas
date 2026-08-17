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
  const sub = db.subscriptions.getByUserId(req.user.id);
  const planId = sub ? sub.planId : "free";
  const planLimits = require("../config/plans")[planId].limits;

  const actualCounts = {
    products: db.products.getByUserId(req.user.id).length,
    customers: db.customers.getByUserId(req.user.id).length,
    sales: db.sales.getByUserId(req.user.id).length,
    invoices: db.salesInvoices.getByUserId(req.user.id).length,
  };

  const usage = db.usage.getAll().filter((u) => u.userId === req.user.id);
  const usageMap = {};
  usage.forEach((u) => {
    usageMap[u.feature] = u.count;
  });

  const features = ["products", "customers", "sales", "invoices"];
  const breakdown = features.map((feature) => ({
    feature,
    used: actualCounts[feature] || 0,
    limit: planLimits[feature] || "unlimited",
  }));

  res.json({ usage: breakdown });
});

module.exports = router;
