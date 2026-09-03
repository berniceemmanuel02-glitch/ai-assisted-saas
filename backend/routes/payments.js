const db = require("../data/store");
const { authMiddleware } = require("../middleware/auth");
const { paymentRateLimiter } = require("../middleware/rateLimit");

const router = require("express").Router();

function buildReceipt(payment, student, fee, school) {
  const feePayments = db.payments
    .getByStudentId(student.id)
    .filter(p => p.feeStructureId === fee.id && p.status === "paid")
    .sort((a, b) => new Date(a.paidAt || a.createdAt) - new Date(b.paidAt || b.createdAt));

  const previousPayments = feePayments.filter(p => p.id !== payment.id);
  const previousPaid = previousPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  const remainingBalance = Math.max(0, parseFloat(fee.amount) - (previousPaid + parseFloat(payment.amount)));

  return {
    receiptNumber: `RCP-${payment.id}`,
    school: {
      name: school.name,
      id: school.id,
    },
    student: {
      name: `${student.firstName} ${student.lastName}`,
      id: student.id,
      admissionNumber: student.admissionNumber,
    },
    fee: {
      name: fee.name,
      originalAmount: parseFloat(fee.amount),
      previousPaid,
      currentPayment: parseFloat(payment.amount),
      remainingBalance,
    },
    payment: {
      date: payment.paidAt || payment.createdAt,
      method: payment.method,
      reference: payment.reference,
      notes: payment.notes || "",
    },
    printedAt: new Date().toISOString(),
  };
}

router.get("/", authMiddleware, (req, res) => {
  const userSchools = db.schools.getByUserId(req.user.id);
  if (!userSchools.length) return res.status(404).json({ message: "No school found for user" });
  const schoolId = userSchools[0].id;
  const payments = db.payments.getBySchoolId(schoolId);
  res.json({ payments });
});

router.get("/student/:studentId", authMiddleware, (req, res) => {
  const student = db.students.getById(req.params.studentId);
  if (!student) return res.status(404).json({ message: "Student not found" });

  const userSchools = db.schools.getByUserId(req.user.id);
  const hasAccess = userSchools.some((s) => s.id === student.schoolId);
  if (!hasAccess) return res.status(403).json({ message: "Access denied to this student" });

  const payments = db.payments.getByStudentId(req.params.studentId);
  res.json({ payments });
});

router.get("/:id", authMiddleware, (req, res) => {
  const payment = db.payments.getById(req.params.id);
  if (!payment) return res.status(404).json({ message: "Payment not found" });

  const userSchools = db.schools.getByUserId(req.user.id);
  const hasAccess = userSchools.some((s) => s.id === payment.schoolId);
  if (!hasAccess) return res.status(403).json({ message: "Access denied to this payment" });

  res.json({ payment });
});

router.get("/:id/receipt", authMiddleware, (req, res) => {
  const payment = db.payments.getById(req.params.id);
  if (!payment) return res.status(404).json({ message: "Payment not found" });

  const userSchools = db.schools.getByUserId(req.user.id);
  const hasAccess = userSchools.some((s) => s.id === payment.schoolId);
  if (!hasAccess) return res.status(403).json({ message: "Access denied to this payment" });

  const student = db.students.getById(payment.studentId);
  if (!student) return res.status(404).json({ message: "Student not found" });

  const fee = db.feeStructures.getById(payment.feeStructureId);
  if (!fee) return res.status(404).json({ message: "Fee structure not found" });

  const school = db.schools.getById(payment.schoolId);
  if (!school) return res.status(404).json({ message: "School not found" });

  const receipt = buildReceipt(payment, student, fee, school);
  res.json({ receipt });
});

router.post("/record", authMiddleware, paymentRateLimiter, (req, res) => {
  try {
    const { studentId, feeStructureId, amount, method, reference, paymentDate, notes } = req.body;
    if (!studentId || !feeStructureId || !amount) {
      return res.status(400).json({ message: "Required fields missing" });
    }
    const userSchools = db.schools.getByUserId(req.user.id);
    if (!userSchools.length) return res.status(403).json({ message: "No school associated with user" });
    const schoolId = userSchools[0].id;

    const student = db.students.getById(studentId);
    if (!student || student.schoolId !== schoolId) {
      return res.status(404).json({ message: "Student not found in this school" });
    }

    const fee = db.feeStructures.getById(feeStructureId);
    if (!fee || fee.schoolId !== schoolId) {
      return res.status(404).json({ message: "Fee structure not found in this school" });
    }

    const payment = {
      id: Date.now().toString(),
      schoolId,
      studentId,
      feeStructureId,
      amount: parseFloat(amount),
      method: method || "cash",
      status: "paid",
      reference: reference || `MANUAL-${Date.now().toString(36).toUpperCase()}`,
      paidAt: paymentDate || new Date().toISOString(),
      notes: notes || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const created = db.payments.create(payment);
    const school = db.schools.getById(schoolId);
    const receipt = buildReceipt(created, student, fee, school);

    res.status(201).json({ message: "Payment recorded successfully", payment: created, receipt });
  } catch (error) {
    res.status(500).json({ message: "Failed to record payment", error: error.message });
  }
});

router.post("/initialize", authMiddleware, paymentRateLimiter, (req, res) => {
  try {
    const { studentId, feeStructureId, amount, method } = req.body;
    if (!studentId || !feeStructureId || !amount) {
      return res.status(400).json({ message: "Required fields missing" });
    }
    const userSchools = db.schools.getByUserId(req.user.id);
    if (!userSchools.length) return res.status(403).json({ message: "No school associated with user" });
    const schoolId = userSchools[0].id;

    const reference = "SP-" + Date.now().toString(36).toUpperCase();
    const payment = {
      id: Date.now().toString(),
      schoolId,
      studentId,
      feeStructureId,
      amount: parseFloat(amount),
      method: method || "paystack",
      status: "pending",
      reference,
      paidAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const created = db.payments.create(payment);

    res.status(201).json({
      message: "Payment initialized. Ready for Paystack integration.",
      payment: created,
      paystackReady: true,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to initialize payment", error: error.message });
  }
});

router.post("/:id/confirm", authMiddleware, (req, res) => {
  try {
    const payment = db.payments.getById(req.params.id);
    if (!payment) return res.status(404).json({ message: "Payment not found" });

    const userSchools = db.schools.getByUserId(req.user.id);
    const hasAccess = userSchools.some((s) => s.id === payment.schoolId);
    if (!hasAccess) return res.status(403).json({ message: "Access denied to this payment" });

    const updated = db.payments.update(req.params.id, {
      status: "paid",
      paidAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    res.json({ message: "Payment confirmed", payment: updated });
  } catch (error) {
    res.status(500).json({ message: "Failed to confirm payment", error: error.message });
  }
});

module.exports = { router, buildReceipt };
