const db = require("../data/store");
const { authMiddleware } = require("../middleware/auth");

const router = require("express").Router();

router.get("/stats", authMiddleware, (req, res) => {
  try {
    const userSchools = db.schools.getByUserId(req.user.id);
    if (!userSchools.length) return res.status(404).json({ message: "No school found for user" });
    const schoolId = userSchools[0].id;

    const students = db.students.getBySchoolId(schoolId);
    const fees = db.feeStructures.getBySchoolId(schoolId);
    const payments = db.payments.getBySchoolId(schoolId);

    const totalFeesExpected = fees.reduce((sum, f) => sum + (parseFloat(f.amount) || 0), 0);
    const totalCollected = payments.filter(p => p.status === "paid").reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    const totalOutstanding = totalFeesExpected - totalCollected;
    const collectionRate = totalFeesExpected > 0 ? Math.round((totalCollected / totalFeesExpected) * 100) : 0;

    const overduePayments = payments.filter(p => {
      if (p.status === "paid") return false;
      const fee = fees.find(f => f.id === p.feeStructureId);
      if (!fee || !fee.dueDate) return false;
      return new Date(fee.dueDate) < new Date();
    });
    const overdueCount = overduePayments.length;

    res.json({
      totalStudents: students.length,
      totalFeesExpected,
      totalCollected,
      totalOutstanding,
      overdueCount,
      collectionRate,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to load dashboard stats", error: error.message });
  }
});

router.get("/recent-payments", authMiddleware, (req, res) => {
  try {
    const userSchools = db.schools.getByUserId(req.user.id);
    if (!userSchools.length) return res.status(404).json({ message: "No school found for user" });
    const schoolId = userSchools[0].id;

    const payments = db.payments.getBySchoolId(schoolId);
    const students = db.students.getBySchoolId(schoolId);
    const fees = db.feeStructures.getBySchoolId(schoolId);

    const recentPayments = payments
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 10)
      .map(p => {
        const student = students.find(s => s.id === p.studentId);
        const fee = fees.find(f => f.id === p.feeStructureId);
        return {
          id: p.id,
          amount: p.amount,
          method: p.method,
          status: p.status,
          reference: p.reference,
          paidAt: p.paidAt,
          createdAt: p.createdAt,
          studentName: student ? `${student.firstName} ${student.lastName}` : "Unknown",
          feeName: fee ? fee.name : "Unknown",
        };
      });

    res.json({ payments: recentPayments });
  } catch (error) {
    res.status(500).json({ message: "Failed to load recent payments", error: error.message });
  }
});

router.get("/overdue-students", authMiddleware, (req, res) => {
  try {
    const userSchools = db.schools.getByUserId(req.user.id);
    if (!userSchools.length) return res.status(404).json({ message: "No school found for user" });
    const schoolId = userSchools[0].id;

    const students = db.students.getBySchoolId(schoolId);
    const fees = db.feeStructures.getBySchoolId(schoolId);
    const payments = db.payments.getBySchoolId(schoolId);

    const studentBalances = students.map(student => {
      const studentFees = fees.filter(f => f.schoolId === schoolId);
      const totalFees = studentFees.reduce((sum, f) => sum + (parseFloat(f.amount) || 0), 0);
      const studentPayments = payments.filter(p => p.studentId === student.id && p.status === "paid");
      const totalPaid = studentPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
      const outstanding = totalFees - totalPaid;

      const hasOverdue = fees.some(fee => {
        if (!fee.dueDate) return false;
        return new Date(fee.dueDate) < new Date() && outstanding > 0;
      });

      return {
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        className: student.className,
        totalFees,
        totalPaid,
        outstanding,
        hasOverdue,
      };
    }).filter(s => s.outstanding > 0)
      .sort((a, b) => b.outstanding - a.outstanding)
      .slice(0, 10);

    res.json({ students: studentBalances });
  } catch (error) {
    res.status(500).json({ message: "Failed to load overdue students", error: error.message });
  }
});

module.exports = router;
