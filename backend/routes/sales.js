const express = require("express");
const router = express.Router();
const db = require("../data/store");
const plans = require("../config/plans");
const { authMiddleware } = require("../middleware/auth");

router.post("/", authMiddleware, (req, res) => {
  try {
    const { customerId, items, paymentMethod } = req.body;

    if (!customerId) {
      return res.status(400).json({ message: "Customer ID is required" });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Sale items are required" });
    }

    if (!paymentMethod) {
      return res.status(400).json({ message: "Payment method is required" });
    }

    const customer = db.customers.getById(customerId);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }
    if (customer.userId !== req.user.id) {
      return res.status(403).json({ message: "Access denied" });
    }

    const processedItems = [];
    let total = 0;

    for (const item of items) {
      if (!item.productId || item.quantity === undefined || item.quantity === null) {
        return res.status(400).json({ message: "Each item must have productId and quantity" });
      }

      const product = db.products.getById(item.productId);
      if (!product) {
        return res.status(404).json({ message: `Product ${item.productId} not found` });
      }
      if (product.userId !== req.user.id) {
        return res.status(403).json({ message: "Access denied for product" });
      }

      const quantity = parseInt(item.quantity, 10);
      if (isNaN(quantity) || quantity <= 0) {
        return res.status(400).json({ message: "Quantity must be a positive number" });
      }

      const price = product.price;
      const itemTotal = price * quantity;
      total += itemTotal;

      processedItems.push({
        productId: item.productId,
        quantity,
        price,
        total: itemTotal,
      });
    }

    const sub = db.subscriptions.getByUserId(req.user.id);
    const planId = sub ? sub.planId : "free";
    const limits = plans[planId].limits;
    const currentSales = db.sales.getByUserId(req.user.id);

    if (limits.sales !== Infinity && currentSales.length >= limits.sales) {
      return res.status(403).json({
        message: "Sales limit exceeded",
        limit: limits.sales,
        current: currentSales.length,
        plan: planId,
      });
    }

    const currentInvoices = db.salesInvoices.getByUserId(req.user.id);
    if (limits.invoices !== Infinity && currentInvoices.length >= limits.invoices) {
      return res.status(403).json({
        message: "Invoice limit exceeded",
        limit: limits.invoices,
        current: currentInvoices.length,
        plan: planId,
      });
    }

    const sale = {
      id: Date.now().toString(),
      userId: req.user.id,
      customerId,
      items: processedItems,
      total,
      paymentMethod,
      date: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.sales.create(sale);
    db.usage.increment(req.user.id, "sales", 1);

    const existingInvoice = db.salesInvoices.getBySaleId(sale.id);
    if (!existingInvoice) {
      const salesInvoice = {
        id: Date.now().toString(),
        invoiceNumber: "SINV-" + Date.now().toString(36).toUpperCase(),
        userId: req.user.id,
        saleId: sale.id,
        customerId,
        items: processedItems,
        subtotal: total,
        total: total,
        paymentStatus: "pending",
        issueDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      db.salesInvoices.create(salesInvoice);
      db.usage.increment(req.user.id, "invoices", 1);
    }

    res.status(201).json({ message: "Sale created", sale });
  } catch (error) {
    res.status(500).json({ message: "Sale creation failed", error: error.message });
  }
});

router.get("/", authMiddleware, (req, res) => {
  const sales = db.sales.getByUserId(req.user.id);
  res.json({ sales });
});

router.get("/:id", authMiddleware, (req, res) => {
  const sale = db.sales.getById(req.params.id);
  if (!sale) {
    return res.status(404).json({ message: "Sale not found" });
  }
  if (sale.userId !== req.user.id) {
    return res.status(403).json({ message: "Access denied" });
  }
  res.json({ sale });
});

module.exports = router;
