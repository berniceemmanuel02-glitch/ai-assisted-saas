const db = require("../data/store");
const { authMiddleware } = require("../middleware/auth");
const { enforceLimit, trackUsage } = require("../middleware/featureLimit");

const router = require("express").Router();

function getFeeSummary(fee, payments) {
  const feePayments = payments.filter(p => p.feeStructureId === fee.id && p.status === "paid");
  const totalPaid = feePayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  const totalAmount = parseFloat(fee.amount) || 0;
  const outstanding = totalAmount - totalPaid;

  const now = new Date();
  const dueDate = fee.dueDate ? new Date(fee.dueDate) : null;
  const isOverdue = dueDate && dueDate < now && outstanding > 0;
  const daysRemaining = dueDate ? Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24)) : null;
  const daysOverdue = isOverdue ? Math.abs(daysRemaining) : 0;
  const suggestedNextPayment = outstanding > 0 ? Math.min(outstanding, totalAmount * 0.5) : 0;
  const status = outstanding <= 0 ? "paid" : isOverdue ? "overdue" : "pending";

  const assignedStudents = db.students.getBySchoolId(fee.schoolId).filter(s => {
    if (!fee.className) return true;
    return s.className === fee.className;
  });

  return {
    fee,
    totalAmount,
    totalPaid,
    outstanding,
    status,
    dueDate: fee.dueDate || null,
    assignedStudentsCount: assignedStudents.length,
    payments: feePayments,
    isOverdue,
    daysRemaining,
    daysOverdue,
    suggestedNextPayment,
  };
}

router.get("/", authMiddleware, (req, res) => {
  const userSchools = db.schools.getByUserId(req.user.id);
  if (!userSchools.length) return res.status(404).json({ message: "No school found for user" });
  const schoolId = userSchools[0].id;
  const fees = db.feeStructures.getBySchoolId(schoolId);
  res.json({ fees });
});

router.get("/:id", authMiddleware, (req, res) => {
  const fee = db.feeStructures.getById(req.params.id);
  if (!fee) return res.status(404).json({ message: "Fee structure not found" });

  const userSchools = db.schools.getByUserId(req.user.id);
  const hasAccess = userSchools.some((s) => s.id === fee.schoolId);
  if (!hasAccess) return res.status(403).json({ message: "Access denied to this fee" });

  res.json({ fee });
});

router.get("/:id/summary", authMiddleware, (req, res) => {
  const fee = db.feeStructures.getById(req.params.id);
  if (!fee) return res.status(404).json({ message: "Fee structure not found" });

  const userSchools = db.schools.getByUserId(req.user.id);
  const hasAccess = userSchools.some((s) => s.id === fee.schoolId);
  if (!hasAccess) return res.status(403).json({ message: "Access denied to this fee" });

  const payments = db.payments.getBySchoolId(fee.schoolId);
  const summary = getFeeSummary(fee, payments);
  res.json(summary);
});

router.post("/", authMiddleware, enforceLimit("feeStructures"), trackUsage("feeStructures"), (req, res) => {
  try {
    const { name, amount, frequency, term, className, dueDate, status, academicSession } = req.body;
    if (!name || !amount || !frequency) {
      return res.status(400).json({ message: "Required fields missing" });
    }
    const userSchools = db.schools.getByUserId(req.user.id);
    if (!userSchools.length) return res.status(403).json({ message: "No school associated with user" });
    const schoolId = userSchools[0].id;

    const fee = {
      id: Date.now().toString(),
      schoolId,
      name,
      amount: parseFloat(amount),
      frequency,
      term: term || null,
      className: className || null,
      dueDate: dueDate || null,
      status: status || "active",
      academicSession: academicSession || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const created = db.feeStructures.create(fee);
    res.status(201).json({ message: "Fee structure created", fee: created });
  } catch (error) {
    res.status(500).json({ message: "Failed to create fee structure", error: error.message });
  }
});

router.put("/:id", authMiddleware, (req, res) => {
  try {
    const fee = db.feeStructures.getById(req.params.id);
    if (!fee) return res.status(404).json({ message: "Fee structure not found" });

    const userSchools = db.schools.getByUserId(req.user.id);
    const hasAccess = userSchools.some((s) => s.id === fee.schoolId);
    if (!hasAccess) return res.status(403).json({ message: "Access denied to this fee" });

    const allowed = ["name", "amount", "frequency", "term", "className", "dueDate", "status", "academicSession"];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }
    updates.updatedAt = new Date().toISOString();

    const updated = db.feeStructures.update(req.params.id, updates);
    res.json({ message: "Fee structure updated", fee: updated });
  } catch (error) {
    res.status(500).json({ message: "Failed to update fee structure", error: error.message });
  }
});

router.delete("/:id", authMiddleware, (req, res) => {
  const fee = db.feeStructures.getById(req.params.id);
  if (!fee) return res.status(404).json({ message: "Fee structure not found" });

  const userSchools = db.schools.getByUserId(req.user.id);
  const hasAccess = userSchools.some((s) => s.id === fee.schoolId);
  if (!hasAccess) return res.status(403).json({ message: "Access denied to this fee" });

  const deleted = db.feeStructures.delete(req.params.id);
  if (!deleted) return res.status(404).json({ message: "Fee structure not found" });

  try {
    db.usage.decrement(req.user.id, "feeStructures", 1);
  } catch (e) {
    console.error("Failed to decrement usage for feeStructures:", e.message);
  }

  res.json({ message: "Fee structure removed" });
});

module.exports = router;
