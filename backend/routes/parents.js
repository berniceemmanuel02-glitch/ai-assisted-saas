const db = require("../data/store");
const { authMiddleware } = require("../middleware/auth");
const { getFeeBreakdown, getStudentSummary } = require("../utils/feeCalculations");
const { buildReceipt } = require("../routes/payments");
const { initializePaystackTransaction, verifyPaystackTransaction, getPaystackConfig } = require("../services/paystack");
const { enforceLimit, trackUsage } = require("../middleware/featureLimit");
const { paymentInitRateLimiter, paymentRateLimiter } = require("../middleware/rateLimit");

const router = require("express").Router();

router.post("/link", authMiddleware, enforceLimit("parentStudents"), trackUsage("parentStudents"), (req, res) => {
  try {
    const { parentId, studentId, parentName, parentPhone, parentEmail } = req.body;

    if (!parentId || !studentId) {
      return res.status(400).json({ message: "parentId and studentId are required" });
    }

    const userSchools = db.schools.getByUserId(req.user.id);
    if (!userSchools.length) return res.status(403).json({ message: "No school associated with user" });
    const schoolId = userSchools[0].id;

    const student = db.students.getById(studentId);
    if (!student || student.schoolId !== schoolId) {
      return res.status(404).json({ message: "Student not found in this school" });
    }

    const existing = db.parentStudents.getByParentId(parentId).find(p => p.studentId === studentId);
    if (existing) {
      return res.status(409).json({ message: "Parent already linked to this student" });
    }

    const link = {
      id: Date.now().toString(),
      parentId,
      studentId,
      schoolId,
      parentName: parentName || "",
      parentPhone: parentPhone || "",
      parentEmail: parentEmail || "",
      createdAt: new Date().toISOString(),
    };

    const created = db.parentStudents.create(link);
    res.status(201).json({ message: "Parent linked successfully", link: created });
  } catch (error) {
    res.status(500).json({ message: "Failed to link parent", error: error.message });
  }
});

router.get("/", authMiddleware, (req, res) => {
  const userSchools = db.schools.getByUserId(req.user.id);
  if (!userSchools.length) return res.json({ parents: [] });
  const schoolId = userSchools[0].id;

  const links = db.parentStudents.getBySchoolId(schoolId);
  const parentsMap = {};

  for (const link of links) {
    if (!parentsMap[link.parentId]) {
      const user = db.users.getById(link.parentId);
      parentsMap[link.parentId] = {
        parentId: link.parentId,
        parentName: link.parentName || (user ? user.name : ""),
        parentPhone: link.parentPhone || "",
        parentEmail: link.parentEmail || "",
        children: [],
      };
    }
    const student = db.students.getById(link.studentId);
    if (student) {
      parentsMap[link.parentId].children.push({
        studentId: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        className: student.className,
        admissionNumber: student.admissionNumber,
        linkId: link.id,
      });
    }
  }

  res.json({ parents: Object.values(parentsMap) });
});

router.get("/:parentId/students", authMiddleware, (req, res) => {
  const userSchools = db.schools.getByUserId(req.user.id);
  if (!userSchools.length) return res.status(404).json({ message: "No school found for user" });
  const schoolId = userSchools[0].id;

  const links = db.parentStudents.getByParentId(req.params.parentId).filter(l => l.schoolId === schoolId);
  const students = links.map(link => {
    const student = db.students.getById(link.studentId);
    return student ? { ...student, linkId: link.id } : null;
  }).filter(Boolean);

  res.json({ students });
});

router.delete("/link/:linkId", authMiddleware, (req, res) => {
  const link = db.parentStudents.getById(req.params.linkId);
  if (!link) return res.status(404).json({ message: "Link not found" });

  const userSchools = db.schools.getByUserId(req.user.id);
  if (!userSchools.some(s => s.id === link.schoolId)) {
    return res.status(403).json({ message: "Access denied" });
  }

  db.parentStudents.delete(req.params.linkId);

  try {
    db.usage.decrement(req.user.id, "parentStudents", 1);
  } catch (e) {
    console.error("Failed to decrement usage for parentStudents:", e.message);
  }

  res.json({ message: "Link removed" });
});

router.put("/link/:linkId", authMiddleware, (req, res) => {
  const link = db.parentStudents.getById(req.params.linkId);
  if (!link) return res.status(404).json({ message: "Link not found" });

  const userSchools = db.schools.getByUserId(req.user.id);
  if (!userSchools.some(s => s.id === link.schoolId)) {
    return res.status(403).json({ message: "Access denied" });
  }

  const allowed = ["parentName", "parentPhone", "parentEmail"];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      updates[key] = req.body[key];
    }
  }
  updates.updatedAt = new Date().toISOString();

  const updated = db.parentStudents.update(req.params.linkId, updates);
  res.json({ message: "Link updated", link: updated });
});

router.get("/me/children", authMiddleware, (req, res) => {
  if (req.user.role !== "parent") {
    return res.status(403).json({ message: "Parent access required" });
  }

  const links = db.parentStudents.getByParentId(req.user.id);
  const children = links.map(link => {
    const student = db.students.getById(link.studentId);
    return student ? { ...student, linkId: link.id } : null;
  }).filter(Boolean);

  res.json({ children });
});

router.get("/me/children-summary", authMiddleware, (req, res) => {
  if (req.user.role !== "parent") {
    return res.status(403).json({ message: "Parent access required" });
  }

  const links = db.parentStudents.getByParentId(req.user.id);
  const children = links.map(link => {
    const student = db.students.getById(link.studentId);
    if (!student) return null;

    const fees = db.feeStructures.getBySchoolId(student.schoolId);
    const payments = db.payments.getByStudentId(student.id);
    const summary = getStudentSummary(student, payments, fees);

    return {
      studentId: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      className: student.className,
      admissionNumber: student.admissionNumber,
      linkId: link.id,
      totalFees: summary.totalFees,
      totalPaid: summary.totalPaid,
      outstanding: summary.outstanding,
      paymentStatus: summary.paymentStatus,
      overdueCount: summary.overdueCount,
    };
  }).filter(Boolean);

  res.json({ children });
});

router.get("/me/children/:studentId/fees", authMiddleware, (req, res) => {
  if (req.user.role !== "parent") {
    return res.status(403).json({ message: "Parent access required" });
  }

  const link = db.parentStudents.getByParentId(req.user.id).find(l => l.studentId === req.params.studentId);
  if (!link) {
    return res.status(403).json({ message: "Student not linked to this parent" });
  }

  const student = db.students.getById(req.params.studentId);
  if (!student || student.schoolId !== link.schoolId) {
    return res.status(404).json({ message: "Student not found" });
  }

  const fees = db.feeStructures.getBySchoolId(student.schoolId);
  const payments = db.payments.getByStudentId(student.id);
  const breakdown = getFeeBreakdown(student, fees, payments);

  const totalFees = breakdown.reduce((sum, b) => sum + b.totalAmount, 0);
  const totalPaid = breakdown.reduce((sum, b) => sum + b.totalPaid, 0);
  const outstanding = totalFees - totalPaid;
  const overdueCount = breakdown.filter(b => b.isOverdue).length;
  const paymentStatus = outstanding <= 0 ? "paid" : totalPaid > 0 ? "partial" : "unpaid";

  res.json({
    student: {
      id: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      className: student.className,
      admissionNumber: student.admissionNumber,
    },
    summary: {
      totalFees,
      totalPaid,
      outstanding,
      paymentStatus,
      overdueCount,
    },
    fees: breakdown,
  });
});

router.get("/me/payments", authMiddleware, (req, res) => {
  if (req.user.role !== "parent") {
    return res.status(403).json({ message: "Parent access required" });
  }

  const links = db.parentStudents.getByParentId(req.user.id);
  const validStudentIds = [];
  const studentSchoolMap = {};

  for (const link of links) {
    const student = db.students.getById(link.studentId);
    if (!student || student.schoolId !== link.schoolId) {
      continue;
    }
    validStudentIds.push(student.id);
    studentSchoolMap[student.id] = {
      student,
      schoolId: link.schoolId,
    };
  }

  if (!validStudentIds.length) {
    return res.json({ payments: [], children: [] });
  }

  const allPayments = db.payments.getAll();
  const studentIdsSet = new Set(validStudentIds);
  const linkedPayments = allPayments.filter(p => studentIdsSet.has(p.studentId));

  const fees = db.feeStructures.getAll();
  const students = db.students.getAll();
  const studentMap = new Map(students.map(s => [s.id, s]));
  const feeMap = new Map(fees.map(f => [f.id, f]));

  const enriched = linkedPayments
    .sort((a, b) => new Date(b.paidAt || b.createdAt) - new Date(a.paidAt || a.createdAt))
    .map(p => {
      const student = studentMap.get(p.studentId);
      const fee = feeMap.get(p.feeStructureId);
      return {
        id: p.id,
        studentId: p.studentId,
        studentName: student ? `${student.firstName} ${student.lastName}` : "Unknown",
        feeName: fee ? fee.name : "Unknown",
        amount: p.amount,
        paidAt: p.paidAt,
        createdAt: p.createdAt,
        method: p.method,
        reference: p.reference,
        notes: p.notes || "",
        receiptNumber: `RCP-${p.id}`,
      };
    });

  const children = links
    .map(link => {
      const student = studentMap.get(link.studentId);
      if (!student) return null;
      return {
        studentId: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        className: student.className,
        admissionNumber: student.admissionNumber,
      };
    })
    .filter(Boolean);

  res.json({ payments: enriched, children });
});

router.get("/me/children/:studentId/payments/:paymentId/receipt", authMiddleware, (req, res) => {
  if (req.user.role !== "parent") {
    return res.status(403).json({ message: "Parent access required" });
  }

  const link = db.parentStudents.getByParentId(req.user.id).find(l => l.studentId === req.params.studentId);
  if (!link) {
    return res.status(403).json({ message: "Student not linked to this parent" });
  }

  const payment = db.payments.getById(req.params.paymentId);
  if (!payment) {
    return res.status(404).json({ message: "Payment not found" });
  }

  if (payment.studentId !== req.params.studentId || payment.schoolId !== link.schoolId) {
    return res.status(403).json({ message: "Access denied to this payment" });
  }

  const student = db.students.getById(req.params.studentId);
  if (!student) {
    return res.status(404).json({ message: "Student not found" });
  }

  const fee = db.feeStructures.getById(payment.feeStructureId);
  if (!fee) {
    return res.status(404).json({ message: "Fee structure not found" });
  }

  const school = db.schools.getById(payment.schoolId);
  if (!school) {
    return res.status(404).json({ message: "School not found" });
  }

  const receipt = buildReceipt(payment, student, fee, school);
  res.json({ receipt });
});

router.get("/me/children/:studentId/fees/:feeId/pay-now", authMiddleware, (req, res) => {
  if (req.user.role !== "parent") {
    return res.status(403).json({ message: "Parent access required" });
  }

  const link = db.parentStudents.getByParentId(req.user.id).find(l => l.studentId === req.params.studentId);
  if (!link) {
    return res.status(403).json({ message: "Student not linked to this parent" });
  }

  const student = db.students.getById(req.params.studentId);
  if (!student || student.schoolId !== link.schoolId) {
    return res.status(404).json({ message: "Student not found" });
  }

  const fee = db.feeStructures.getById(req.params.feeId);
  if (!fee || fee.schoolId !== student.schoolId) {
    return res.status(404).json({ message: "Fee not found for this student" });
  }

  const payments = db.payments.getByStudentId(student.id);
  const feePayments = payments.filter(p => p.feeStructureId === fee.id && p.status === "paid");
  const totalPaid = feePayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  const totalAmount = parseFloat(fee.amount) || 0;
  const outstanding = Math.max(0, totalAmount - totalPaid);

  if (outstanding <= 0) {
    return res.status(400).json({ message: "Fee is already fully paid" });
  }

  const school = db.schools.getById(student.schoolId);

  res.json({
    student: {
      id: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      className: student.className,
      admissionNumber: student.admissionNumber,
    },
    school: school ? { name: school.name, id: school.id } : null,
    fee: {
      id: fee.id,
      name: fee.name,
      totalAmount,
      totalPaid,
      outstanding,
      dueDate: fee.dueDate || null,
      academicSession: fee.academicSession || null,
      term: fee.term || null,
      className: fee.className || null,
    },
  });
});

router.post("/me/children/:studentId/fees/:feeId/pay-now/initialize", authMiddleware, paymentInitRateLimiter, async (req, res) => {
  if (req.user.role !== "parent") {
    return res.status(403).json({ message: "Parent access required" });
  }

  const paystackConfig = getPaystackConfig();
  if (!paystackConfig.configured) {
    return res.status(503).json({ message: "Online payment is not configured. Please contact the school administrator." });
  }

  const { amount } = req.body;
  if (!amount || parseFloat(amount) <= 0) {
    return res.status(400).json({ message: "Payment amount must be greater than zero." });
  }

  const link = db.parentStudents.getByParentId(req.user.id).find(l => l.studentId === req.params.studentId);
  if (!link) {
    return res.status(403).json({ message: "Student not linked to this parent" });
  }

  const student = db.students.getById(req.params.studentId);
  if (!student || student.schoolId !== link.schoolId) {
    return res.status(404).json({ message: "Student not found" });
  }

  const fee = db.feeStructures.getById(req.params.feeId);
  if (!fee || fee.schoolId !== student.schoolId) {
    return res.status(404).json({ message: "Fee not found for this student" });
  }

  const payments = db.payments.getByStudentId(student.id);
  const feePayments = payments.filter(p => p.feeStructureId === fee.id && p.status === "paid");
  const totalPaid = feePayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  const totalAmount = parseFloat(fee.amount) || 0;
  const outstanding = Math.max(0, totalAmount - totalPaid);

  if (outstanding <= 0) {
    return res.status(400).json({ message: "Fee is already fully paid" });
  }

  const requestedAmount = parseFloat(amount);
  if (requestedAmount > outstanding) {
    return res.status(400).json({ message: `Amount cannot exceed outstanding balance of ₦${outstanding.toLocaleString()}` });
  }

  const reference = `SCH-${Date.now().toString(36).toUpperCase()}-${student.id.slice(-4)}`;
  const existingPending = db.payments.getAll().find(p => p.reference === reference && p.status === "pending");
  if (existingPending) {
    return res.status(409).json({ message: "Duplicate payment detected. Please try again." });
  }

  const pendingPayment = {
    id: Date.now().toString(),
    schoolId: student.schoolId,
    studentId: student.id,
    feeStructureId: fee.id,
    amount: requestedAmount,
    method: "online",
    status: "pending",
    reference,
    paidAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const createdPayment = db.payments.create(pendingPayment);

  const amountKobo = Math.round(requestedAmount * 100);
  const paystackResult = await initializePaystackTransaction({
    email: req.user.email,
    amountKobo,
    reference,
    metadata: {
      scholapayPaymentId: createdPayment.id,
      studentId: student.id,
      feeId: fee.id,
      schoolId: student.schoolId,
      parentId: req.user.id,
    },
    callbackUrl: `${req.protocol}://${req.get("host")}/#/parent-dashboard`,
  });

  if (!paystackResult.initialized) {
    db.payments.delete(createdPayment.id);
    return res.status(502).json({ message: paystackResult.error || "Failed to initialize payment gateway" });
  }

  res.status(201).json({
    payment: {
      id: createdPayment.id,
      reference: createdPayment.reference,
      amount: createdPayment.amount,
      status: createdPayment.status,
    },
    paystack: {
      authorizationUrl: paystackResult.authorizationUrl,
      reference: paystackResult.reference,
      accessCode: paystackResult.accessCode,
    },
  });
});

router.get("/me/payments/verify", authMiddleware, (req, res) => {
  if (req.user.role !== "parent") {
    return res.status(403).json({ message: "Parent access required" });
  }

  const { reference } = req.query;
  if (!reference) {
    return res.status(400).json({ message: "Payment reference is required" });
  }

  const payment = db.payments.getAll().find(p => p.reference === reference);
  if (!payment) {
    return res.status(404).json({ message: "Payment not found" });
  }

  const link = db.parentStudents.getByParentId(req.user.id).find(l => l.studentId === payment.studentId);
  if (!link || payment.schoolId !== link.schoolId) {
    return res.status(403).json({ message: "Access denied to this payment" });
  }

  res.json({ payment });
});

router.post("/paystack/verify", authMiddleware, paymentRateLimiter, async (req, res) => {
  if (req.user.role !== "parent") {
    return res.status(403).json({ message: "Parent access required" });
  }

  const { reference } = req.body;
  if (!reference) {
    return res.status(400).json({ message: "Payment reference is required" });
  }

  const payment = db.payments.getAll().find(p => p.reference === reference);
  if (!payment) {
    return res.status(404).json({ message: "Payment not found" });
  }

  const link = db.parentStudents.getByParentId(req.user.id).find(l => l.studentId === payment.studentId);
  if (!link || payment.schoolId !== link.schoolId) {
    return res.status(403).json({ message: "Access denied to this payment" });
  }

  if (payment.status === "paid") {
    const student = db.students.getById(payment.studentId);
    const fee = db.feeStructures.getById(payment.feeStructureId);
    const school = db.schools.getById(payment.schoolId);
    const receipt = buildReceipt(payment, student, fee, school);
    return res.json({ message: "Payment already verified", payment, receipt });
  }

  const verification = await verifyPaystackTransaction({ reference });
  if (!verification.verified || !verification.successful) {
    db.payments.update(payment.id, { status: "failed", updatedAt: new Date().toISOString() });
    return res.status(400).json({ message: verification.error || "Payment verification failed" });
  }

  const expectedAmountKobo = Math.round(payment.amount * 100);
  if (verification.amount !== expectedAmountKobo) {
    return res.status(400).json({ message: "Payment amount mismatch" });
  }

  const updatedPayment = db.payments.update(payment.id, {
    status: "paid",
    paidAt: verification.paidAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const student = db.students.getById(payment.studentId);
  const fee = db.feeStructures.getById(payment.feeStructureId);
  const school = db.schools.getById(payment.schoolId);
  const receipt = buildReceipt(updatedPayment, student, fee, school);

  res.json({ message: "Payment verified successfully", payment: updatedPayment, receipt });
});

module.exports = router;
