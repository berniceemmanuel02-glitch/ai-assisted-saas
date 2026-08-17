const express = require("express");
const router = express.Router();
const db = require("../data/store");
const plans = require("../config/plans");
const { authMiddleware } = require("../middleware/auth");

router.post("/", authMiddleware, (req, res) => {
  try {
    const { name, email, phone, company } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Customer name is required" });
    }

    const trimmedEmail = email !== undefined ? email.trim() : "";
    const trimmedPhone = phone !== undefined ? phone.trim() : "";

    if (email !== undefined && !trimmedEmail) {
      return res.status(400).json({ message: "Email cannot be empty" });
    }
    if (phone !== undefined && !trimmedPhone) {
      return res.status(400).json({ message: "Phone cannot be empty" });
    }

    const sub = db.subscriptions.getByUserId(req.user.id);
    const planId = sub ? sub.planId : "free";
    const limits = plans[planId].limits;
    const currentCustomers = db.customers.getByUserId(req.user.id);

    if (limits.customers !== Infinity && currentCustomers.length >= limits.customers) {
      return res.status(403).json({
        message: "Customer limit exceeded",
        limit: limits.customers,
        current: currentCustomers.length,
        plan: planId,
      });
    }

    const customer = {
      id: Date.now().toString(),
      userId: req.user.id,
      name: name.trim(),
      email: trimmedEmail,
      phone: trimmedPhone,
      company: company ? company.trim() : "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.customers.create(customer);
    res.status(201).json({ message: "Customer created", customer });
  } catch (error) {
    res.status(500).json({ message: "Customer creation failed", error: error.message });
  }
});

router.get("/", authMiddleware, (req, res) => {
  const customers = db.customers.getByUserId(req.user.id);
  res.json({ customers });
});

router.get("/:id", authMiddleware, (req, res) => {
  const customer = db.customers.getById(req.params.id);
  if (!customer) {
    return res.status(404).json({ message: "Customer not found" });
  }
  if (customer.userId !== req.user.id) {
    return res.status(403).json({ message: "Access denied" });
  }
  res.json({ customer });
});

router.put("/:id", authMiddleware, (req, res) => {
  const { name, email, phone, company } = req.body;

  if (!name && !email && !phone && company === undefined) {
    return res.status(400).json({ message: "Provide at least one field to update" });
  }

  const customer = db.customers.getById(req.params.id);
  if (!customer) {
    return res.status(404).json({ message: "Customer not found" });
  }
  if (customer.userId !== req.user.id) {
    return res.status(403).json({ message: "Access denied" });
  }

  const updatedName = name !== undefined ? name.trim() : customer.name;
  const updatedEmail = email !== undefined ? email.trim() : customer.email;
  const updatedPhone = phone !== undefined ? phone.trim() : customer.phone;
  const updatedCompany = company !== undefined ? (company ? company.trim() : company) : customer.company;

  if (!updatedName) {
    return res.status(400).json({ message: "Customer name cannot be empty" });
  }

  const updated = db.customers.update(req.params.id, {
    name: updatedName,
    email: updatedEmail,
    phone: updatedPhone,
    company: updatedCompany,
    updatedAt: new Date().toISOString(),
  });

  res.json({ message: "Customer updated", customer: updated });
});

router.delete("/:id", authMiddleware, (req, res) => {
  const customer = db.customers.getById(req.params.id);
  if (!customer) {
    return res.status(404).json({ message: "Customer not found" });
  }
  if (customer.userId !== req.user.id) {
    return res.status(403).json({ message: "Access denied" });
  }

  db.customers.delete(req.params.id);
  res.json({ message: "Customer deleted" });
});

module.exports = router;
