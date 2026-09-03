const db = require("../data/store");
const { authMiddleware } = require("../middleware/auth");

const router = require("express").Router();

router.get("/:id", authMiddleware, (req, res) => {
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

  const feePayments = db.payments
    .getByStudentId(student.id)
    .filter(p => p.feeStructureId === fee.id && p.status === "paid")
    .sort((a, b) => new Date(a.paidAt || a.createdAt) - new Date(b.paidAt || b.createdAt));

  const previousPayments = feePayments.filter(p => p.id !== payment.id);
  const previousPaid = previousPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  const remainingBalance = Math.max(0, parseFloat(fee.amount) - (previousPaid + parseFloat(payment.amount)));

  const receipt = {
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

  res.json({ receipt });
});

module.exports = router;
