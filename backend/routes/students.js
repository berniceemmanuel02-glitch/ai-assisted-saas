const db = require("../data/store");
const { authMiddleware } = require("../middleware/auth");
const { getFeeBreakdown, getStudentSummary } = require("../utils/feeCalculations");
const { enforceLimit, trackUsage } = require("../middleware/featureLimit");

const router = require("express").Router();

router.get("/", authMiddleware, (req, res) => {
  const userSchools = db.schools.getByUserId(req.user.id);
  if (!userSchools.length) return res.status(404).json({ message: "No school found for user" });
  const schoolId = userSchools[0].id;
  const students = db.students.getBySchoolId(schoolId);
  res.json({ students });
});

router.get("/:id", authMiddleware, (req, res) => {
  const student = db.students.getById(req.params.id);
  if (!student) return res.status(404).json({ message: "Student not found" });

  const userSchools = db.schools.getByUserId(req.user.id);
  const hasAccess = userSchools.some((s) => s.id === student.schoolId);
  if (!hasAccess) return res.status(403).json({ message: "Access denied to this student" });

  res.json({ student });
});

router.get("/:id/summary", authMiddleware, (req, res) => {
  const student = db.students.getById(req.params.id);
  if (!student) return res.status(404).json({ message: "Student not found" });

  const userSchools = db.schools.getByUserId(req.user.id);
  const hasAccess = userSchools.some((s) => s.id === student.schoolId);
  if (!hasAccess) return res.status(403).json({ message: "Access denied to this student" });

  const payments = db.payments.getByStudentId(student.id);
  const fees = db.feeStructures.getBySchoolId(student.schoolId);
  const summary = getStudentSummary(student, payments, fees);
  res.json(summary);
});

router.get("/:id/fees", authMiddleware, (req, res) => {
  const student = db.students.getById(req.params.id);
  if (!student) return res.status(404).json({ message: "Student not found" });

  const userSchools = db.schools.getByUserId(req.user.id);
  const hasAccess = userSchools.some((s) => s.id === student.schoolId);
  if (!hasAccess) return res.status(403).json({ message: "Access denied to this student" });

  const payments = db.payments.getByStudentId(student.id);
  const fees = db.feeStructures.getBySchoolId(student.schoolId);
  const breakdown = getFeeBreakdown(student, fees, payments);
  res.json({ fees: breakdown });
});

router.get("/:id/payments", authMiddleware, (req, res) => {
  const student = db.students.getById(req.params.id);
  if (!student) return res.status(404).json({ message: "Student not found" });

  const userSchools = db.schools.getByUserId(req.user.id);
  const hasAccess = userSchools.some((s) => s.id === student.schoolId);
  if (!hasAccess) return res.status(403).json({ message: "Access denied to this student" });

  const payments = db.payments.getByStudentId(student.id);
  const fees = db.feeStructures.getBySchoolId(student.schoolId);

  const enriched = payments
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(p => {
      const fee = fees.find(f => f.id === p.feeStructureId);
      return {
        id: p.id,
        amount: p.amount,
        method: p.method,
        status: p.status,
        reference: p.reference,
        paidAt: p.paidAt,
        createdAt: p.createdAt,
        notes: p.notes || "",
        feeName: fee ? fee.name : "Unknown",
      };
    });

  res.json({ payments: enriched });
});

router.post("/", authMiddleware, enforceLimit("students"), trackUsage("students"), (req, res) => {
  try {
    const { firstName, lastName, admissionNumber, className, parentName, parentEmail, parentPhone, admissionDate, gender, address, status } = req.body;
    if (!firstName || !lastName || !admissionNumber || !parentName || !parentEmail) {
      return res.status(400).json({ message: "Required fields missing" });
    }
    const userSchools = db.schools.getByUserId(req.user.id);
    if (!userSchools.length) return res.status(403).json({ message: "No school associated with user" });
    const schoolId = userSchools[0].id;

    const student = {
      id: Date.now().toString(),
      schoolId,
      firstName,
      lastName,
      admissionNumber,
      className: className || "",
      parentName,
      parentEmail,
      parentPhone: parentPhone || "",
      admissionDate: admissionDate || new Date().toISOString(),
      gender: gender || "",
      address: address || "",
      status: status || "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const created = db.students.create(student);
    res.status(201).json({ message: "Student added", student: created });
  } catch (error) {
    res.status(500).json({ message: "Failed to add student", error: error.message });
  }
});

router.put("/:id", authMiddleware, (req, res) => {
  try {
    const student = db.students.getById(req.params.id);
    if (!student) return res.status(404).json({ message: "Student not found" });

    const userSchools = db.schools.getByUserId(req.user.id);
    const hasAccess = userSchools.some((s) => s.id === student.schoolId);
    if (!hasAccess) return res.status(403).json({ message: "Access denied to this student" });

    const allowed = ["firstName", "lastName", "admissionNumber", "className", "parentName", "parentEmail", "parentPhone", "admissionDate", "gender", "address", "status"];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }
    updates.updatedAt = new Date().toISOString();

    const updated = db.students.update(req.params.id, updates);
    res.json({ message: "Student updated", student: updated });
  } catch (error) {
    res.status(500).json({ message: "Failed to update student", error: error.message });
  }
});

router.delete("/:id", authMiddleware, (req, res) => {
  const student = db.students.getById(req.params.id);
  if (!student) return res.status(404).json({ message: "Student not found" });

  const userSchools = db.schools.getByUserId(req.user.id);
  const hasAccess = userSchools.some((s) => s.id === student.schoolId);
  if (!hasAccess) return res.status(403).json({ message: "Access denied to this student" });

  const deleted = db.students.delete(req.params.id);
  if (!deleted) return res.status(404).json({ message: "Student not found" });

  try {
    db.usage.decrement(req.user.id, "students", 1);
  } catch (e) {
    console.error("Failed to decrement usage for students:", e.message);
  }

  res.json({ message: "Student removed" });
});

module.exports = router;
