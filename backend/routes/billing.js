const db = require("../data/store");
const plans = require("../config/plans");
const { authMiddleware } = require("../middleware/auth");

const router = require("express").Router();

function generateInvoiceNumber() {
  return "INV-" + Date.now().toString(36).toUpperCase();
}

router.post("/create", authMiddleware, (req, res) => {
  try {
    const { planId, amount, description } = req.body;
    const plan = plans[planId];
    const finalAmount = amount || (plan ? plan.price : 0);
    const finalDescription = description || (plan ? `Subscription: ${plan.name}` : "Payment");

    const invoice = {
      id: Date.now().toString(),
      userId: req.user.id,
      invoiceNumber: generateInvoiceNumber(),
      planId: planId || null,
      amount: finalAmount,
      currency: plan ? plan.currency : "USD",
      description: finalDescription,
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    const created = db.invoices.create(invoice);
    res.status(201).json({ message: "Invoice created", invoice: created });
  } catch (error) {
    res.status(500).json({ message: "Invoice creation failed", error: error.message });
  }
});

router.post("/pay/:invoiceId", authMiddleware, (req, res) => {
  const invoices = db.invoices.getAll();
  const invoice = invoices.find((i) => i.id === req.params.invoiceId && i.userId === req.user.id);

  if (!invoice) return res.status(404).json({ message: "Invoice not found" });
  if (invoice.status === "paid") return res.status(400).json({ message: "Invoice already paid" });

  const updated = db.invoices.getAll();
  const idx = updated.findIndex((i) => i.id === invoice.id);
  updated[idx].status = "paid";
  updated[idx].paidAt = new Date().toISOString();
  require("fs").writeFileSync(require("path").join(__dirname, "..", "data", "invoices.json"), JSON.stringify(updated, null, 2));

  res.json({ message: "Payment successful", invoice: updated[idx] });
});

router.get("/", authMiddleware, (req, res) => {
  const userInvoices = db.invoices.getByUserId(req.user.id);
  res.json({ invoices: userInvoices });
});

router.get("/receipt/:invoiceId", authMiddleware, (req, res) => {
  const invoices = db.invoices.getAll();
  const invoice = invoices.find((i) => i.id === req.params.invoiceId && i.userId === req.user.id && i.status === "paid");

  if (!invoice) return res.status(404).json({ message: "Receipt not found" });

  res.json({
    receiptNumber: "RCP-" + invoice.invoiceNumber,
    invoiceId: invoice.id,
    amount: invoice.amount,
    currency: invoice.currency,
    description: invoice.description,
    paidAt: invoice.paidAt,
    user: req.user,
  });
});

module.exports = router;
