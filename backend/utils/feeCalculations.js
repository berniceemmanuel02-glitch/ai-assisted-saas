function getFeeBreakdown(student, fees, payments) {
  const studentFees = fees.filter(f => f.schoolId === student.schoolId);
  const now = new Date();

  return studentFees.map(fee => {
    const feePayments = payments
      .filter(p => p.studentId === student.id && p.feeStructureId === fee.id && p.status === "paid")
      .sort((a, b) => new Date(b.paidAt || b.createdAt) - new Date(a.paidAt || a.createdAt));

    const totalPaid = feePayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    const totalAmount = parseFloat(fee.amount) || 0;
    const outstanding = totalAmount - totalPaid;

    const dueDate = fee.dueDate ? new Date(fee.dueDate) : null;
    const isOverdue = dueDate && dueDate < now && outstanding > 0;
    const daysRemaining = dueDate ? Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24)) : null;
    const daysOverdue = isOverdue ? Math.abs(daysRemaining) : 0;

    const suggestedNextPayment = outstanding > 0 ? Math.min(outstanding, totalAmount * 0.5) : 0;
    const paymentStatus = outstanding <= 0 ? "paid" : totalPaid > 0 ? "partial" : "unpaid";

    return {
      feeId: fee.id,
      feeName: fee.name,
      totalAmount,
      totalPaid,
      outstanding,
      paymentStatus,
      dueDate: fee.dueDate || null,
      isOverdue,
      daysRemaining: dueDate ? daysRemaining : null,
      daysOverdue,
      suggestedNextPayment,
      lastPayment: feePayments[0] || null,
      payments: feePayments,
      academicSession: fee.academicSession || null,
      term: fee.term || null,
      className: fee.className || null,
      frequency: fee.frequency || null,
    };
  });
}

function getStudentSummary(student, payments, fees) {
  const breakdown = getFeeBreakdown(student, fees, payments);
  const totalFees = breakdown.reduce((sum, b) => sum + b.totalAmount, 0);
  const totalPaid = breakdown.reduce((sum, b) => sum + b.totalPaid, 0);
  const outstanding = totalFees - totalPaid;
  const overdueCount = breakdown.filter(b => b.isOverdue).length;
  const paymentStatus = outstanding <= 0 ? "paid" : totalPaid > 0 ? "partial" : "unpaid";

  return {
    student,
    totalFees,
    totalPaid,
    outstanding,
    paymentStatus,
    overdueCount,
    fees: breakdown,
    payments,
  };
}

module.exports = { getFeeBreakdown, getStudentSummary };
