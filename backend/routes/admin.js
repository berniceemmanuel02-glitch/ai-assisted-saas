const db = require("../data/store");
const { authMiddleware, adminOnly } = require("../middleware/auth");

const router = require("express").Router();

router.get("/stats", authMiddleware, adminOnly, (req, res) => {
  const users = db.users.getAll();
  const subscriptions = db.subscriptions.getAll();
  const invoices = db.invoices.getAll();

  const activeUsers = subscriptions.filter((s) => s.status === "active").length;

  const paidInvoices = invoices.filter((i) => i.status === "paid");
  const revenue = paidInvoices.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
  const pendingPayments = invoices.filter((i) => i.status === "pending").length;

  res.json({
    totalUsers: users.length,
    activeUsers,
    paidUsers: paidInvoices.length,
    revenue: Math.round(revenue * 100) / 100,
    pendingPayments,
  });
});

router.get("/users", authMiddleware, adminOnly, (req, res) => {
  const users = db.users.getAll();
  const subscriptions = db.subscriptions.getAll();

  const subMap = {};
  subscriptions.forEach((s) => {
    subMap[s.userId] = s;
  });

  const data = users.map((u) => {
    const sub = subMap[u.id];
    let plan = "free";
    let status = "pending";

    if (sub) {
      plan = sub.planId || "free";
      status = sub.status === "active" ? "active" : "pending";
    }

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      createdAt: u.createdAt,
      plan,
      status,
    };
  });

  res.json({ users: data });
});

module.exports = router;
