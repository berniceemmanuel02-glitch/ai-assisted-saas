const express = require("express");
const router = express.Router();
const db = require("../data/store");
const { authMiddleware } = require("../middleware/auth");

router.get("/", authMiddleware, (req, res) => {
  const invoices = db.salesInvoices.getByUserId(req.user.id);
  res.json({ invoices });
});

router.get("/:id", authMiddleware, (req, res) => {
  const invoice = db.salesInvoices.getById(req.params.id);
  if (!invoice) {
    return res.status(404).json({ message: "Invoice not found" });
  }
  if (invoice.userId !== req.user.id) {
    return res.status(403).json({ message: "Access denied" });
  }
  res.json({ invoice });
});

router.post("/:id/pay", authMiddleware, (req, res) => {
  const invoice = db.salesInvoices.getById(req.params.id);
  if (!invoice) {
    return res.status(404).json({ message: "Invoice not found" });
  }
  if (invoice.userId !== req.user.id) {
    return res.status(403).json({ message: "Access denied" });
  }
  if (invoice.paymentStatus === "paid") {
    return res.status(400).json({ message: "Invoice already paid" });
  }

  const updated = db.salesInvoices.update(req.params.id, {
    paymentStatus: "paid",
    paidAt: new Date().toISOString(),
  });

  res.json({ message: "Payment successful", invoice: updated });
});

router.get("/:id/receipt", authMiddleware, (req, res) => {
  const invoice = db.salesInvoices.getById(req.params.id);
  if (!invoice) {
    return res.status(404).json({ message: "Receipt not found" });
  }
  if (invoice.userId !== req.user.id) {
    return res.status(403).json({ message: "Access denied" });
  }
  if (invoice.paymentStatus !== "paid") {
    return res.status(404).json({ message: "Receipt not found" });
  }

  res.json({
    receiptNumber: "RCP-" + invoice.invoiceNumber,
    invoiceId: invoice.id,
    saleId: invoice.saleId,
    customerId: invoice.customerId,
    items: invoice.items,
    subtotal: invoice.subtotal,
    total: invoice.total,
    paymentStatus: invoice.paymentStatus,
    paidAt: invoice.paidAt,
    user: req.user,
  });
});

module.exports = router;
