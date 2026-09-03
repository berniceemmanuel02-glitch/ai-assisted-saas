const { test } = require("node:test");
const assert = require("node:assert");
const http = require("node:http");
const db = require("../backend/data/store");

process.env.PAYSTACK_SECRET_KEY = "test_fake_key_for_paystack_tests";
process.env.PAYSTACK_MOCK = "true";

const BASE = "http://localhost:5000";

function request(method, path, headers = {}, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }
        resolve({ status: res.statusCode, body: parsed });
      });
    });

    req.on("error", reject);
    if (body !== undefined) req.write(typeof body === "string" ? body : JSON.stringify(body));
    req.end();
  });
}

let schoolAToken;
let schoolAId;
let schoolBToken;
let schoolBId;
let parentAToken;
let parentAId;
let parentBToken;
let parentBId;
let studentAId;
let studentBId;
let linkAId;
let paymentAId;

test("parents: create parent account A", async () => {
  const email = `parent-${Date.now()}@example.com`;
  const res = await request("POST", "/api/parent-auth/register", {}, {
    name: "Parent A",
    email,
    password: "parentpass123",
  });
  assert.strictEqual(res.status, 201);
  assert.ok(res.body.token);
  assert.strictEqual(res.body.user.role, "parent");
  parentAToken = res.body.token;
  parentAId = res.body.user.id;
});

test("parents: create parent account B", async () => {
  const email = `parentb-${Date.now()}@example.com`;
  const res = await request("POST", "/api/parent-auth/register", {}, {
    name: "Parent B",
    email,
    password: "parentbpass123",
  });
  assert.strictEqual(res.status, 201);
  parentBToken = res.body.token;
  parentBId = res.body.user.id;
});

test("parents: create school A and student A", async () => {
  const email = `school-parent-${Date.now()}@example.com`;
  const registerRes = await request("POST", "/api/auth/register", {}, {
    name: "School Parent Admin",
    email,
    password: "schoolpass123",
  });
  assert.strictEqual(registerRes.status, 201);
  schoolAId = registerRes.body.user.schoolId;
  schoolAToken = registerRes.body.token;

  const studentRes = await request("POST", "/api/students", {
    Authorization: `Bearer ${schoolAToken}`,
  }, {
    schoolId: schoolAId,
    firstName: "Child",
    lastName: "One",
    admissionNumber: "ADM-PARENT-001",
    className: "JSS1",
    parentName: "Parent A",
    parentEmail: "parent-a@example.com",
    parentPhone: "08012345678",
  });
  assert.strictEqual(studentRes.status, 201);
  studentAId = studentRes.body.student.id;
});

test("parents: create school B and student B", async () => {
  const email = `schoolb-parent-${Date.now()}@example.com`;
  const registerRes = await request("POST", "/api/auth/register", {}, {
    name: "School B Admin",
    email,
    password: "schoolbpass123",
  });
  assert.strictEqual(registerRes.status, 201);
  schoolBId = registerRes.body.user.schoolId;
  schoolBToken = registerRes.body.token;

  const studentRes = await request("POST", "/api/students", {
    Authorization: `Bearer ${schoolBToken}`,
  }, {
    schoolId: schoolBId,
    firstName: "Child",
    lastName: "Two",
    admissionNumber: "ADM-PARENT-002",
    className: "JSS2",
    parentName: "Parent B",
    parentEmail: "parent-b@example.com",
    parentPhone: "08087654321",
  });
  assert.strictEqual(studentRes.status, 201);
  studentBId = studentRes.body.student.id;
});

test("parents: admin can link parent to student in own school", async () => {
  const res = await request("POST", "/api/parents/link", {
    Authorization: `Bearer ${schoolAToken}`,
  }, {
    parentId: parentAId,
    studentId: studentAId,
    parentName: "Parent A",
    parentPhone: "08012345678",
    parentEmail: "parent-a@example.com",
  });
  assert.strictEqual(res.status, 201);
  assert.ok(res.body.link);
  linkAId = res.body.link.id;
});

test("parents: duplicate link is prevented", async () => {
  const res = await request("POST", "/api/parents/link", {
    Authorization: `Bearer ${schoolAToken}`,
  }, {
    parentId: parentAId,
    studentId: studentAId,
    parentName: "Parent A",
    parentPhone: "08012345678",
    parentEmail: "parent-a@example.com",
  });
  assert.strictEqual(res.status, 409);
});

test("parents: admin cannot link parent to another school's student", async () => {
  const res = await request("POST", "/api/parents/link", {
    Authorization: `Bearer ${schoolBToken}`,
  }, {
    parentId: parentAId,
    studentId: studentAId,
    parentName: "Hacker Parent",
    parentPhone: "08099999999",
    parentEmail: "hacker@evil.com",
  });
  assert.strictEqual(res.status, 404);
});

test("parents: admin can list parents for school", async () => {
  const res = await request("GET", "/api/parents", {
    Authorization: `Bearer ${schoolAToken}`,
  });
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body.parents));
  assert.ok(res.body.parents.length >= 1);
});

test("parents: admin can view students linked to parent", async () => {
  const res = await request("GET", `/api/parents/${parentAId}/students`, {
    Authorization: `Bearer ${schoolAToken}`,
  });
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body.students));
  assert.strictEqual(res.body.students.length, 1);
  assert.strictEqual(res.body.students[0].id, studentAId);
});

test("parents: parent can view own linked children", async () => {
  const res = await request("GET", "/api/parents/me/children", {
    Authorization: `Bearer ${parentAToken}`,
  });
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body.children));
  assert.strictEqual(res.body.children.length, 1);
  assert.strictEqual(res.body.children[0].id, studentAId);
});

test("parents: parent cannot access another parent's student", async () => {
  const res = await request("GET", "/api/parents/me/children", {
    Authorization: `Bearer ${parentBToken}`,
  });
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body.children));
  assert.strictEqual(res.body.children.length, 0);
});

test("parents: admin can remove link", async () => {
  const res = await request("DELETE", `/api/parents/link/${linkAId}`, {
    Authorization: `Bearer ${schoolAToken}`,
  });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.message, "Link removed");
});

test("parents: parent sees empty state after unlink", async () => {
  const res = await request("GET", "/api/parents/me/children", {
    Authorization: `Bearer ${parentAToken}`,
  });
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body.children));
  assert.strictEqual(res.body.children.length, 0);
});

test("parents: admin can link second child to same parent", async () => {
  const res = await request("POST", "/api/parents/link", {
    Authorization: `Bearer ${schoolAToken}`,
  }, {
    parentId: parentAId,
    studentId: studentAId,
    parentName: "Parent A",
    parentPhone: "08012345678",
    parentEmail: "parent-a@example.com",
  });
  assert.strictEqual(res.status, 201);
});

test("parents: parent dashboard shows linked children via me/children", async () => {
  const res = await request("GET", "/api/parents/me/children", {
    Authorization: `Bearer ${parentAToken}`,
  });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.children.length, 1);
  assert.strictEqual(res.body.children[0].className, "JSS1");
});

test("parents: create fee structure and payment for child", async () => {
  const feeRes = await request("POST", "/api/fee-structures", {
    Authorization: `Bearer ${schoolAToken}`,
  }, {
    schoolId: schoolAId,
    name: "Tuition Fee",
    amount: "50000",
    frequency: "termly",
    term: "First Term",
    className: "JSS1",
    dueDate: new Date(Date.now() + 86400000 * 30).toISOString().split("T")[0],
    academicSession: "2025/2026",
  });
  assert.strictEqual(feeRes.status, 201);
  const feeId = feeRes.body.fee.id;

  const paymentRes = await request("POST", "/api/payments/record", {
    Authorization: `Bearer ${schoolAToken}`,
  }, {
    studentId: studentAId,
    feeStructureId: feeId,
    amount: "20000",
    method: "cash",
  });
  assert.strictEqual(paymentRes.status, 201);
});

test("parents: parent can view children summary with fee totals", async () => {
  const res = await request("GET", "/api/parents/me/children-summary", {
    Authorization: `Bearer ${parentAToken}`,
  });
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body.children));
  assert.strictEqual(res.body.children.length, 1);
  const child = res.body.children[0];
  assert.strictEqual(child.studentId, studentAId);
  assert.strictEqual(child.totalFees, 50000);
  assert.strictEqual(child.totalPaid, 20000);
  assert.strictEqual(child.outstanding, 30000);
  assert.strictEqual(child.paymentStatus, "partial");
  assert.strictEqual(child.overdueCount, 0);
});

test("parents: parent can view linked child fee details", async () => {
  const res = await request("GET", `/api/parents/me/children/${studentAId}/fees`, {
    Authorization: `Bearer ${parentAToken}`,
  });
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.student);
  assert.ok(res.body.summary);
  assert.ok(Array.isArray(res.body.fees));
  assert.strictEqual(res.body.fees.length, 1);
  assert.strictEqual(res.body.summary.totalFees, 50000);
  assert.strictEqual(res.body.summary.totalPaid, 20000);
  assert.strictEqual(res.body.summary.outstanding, 30000);
  assert.strictEqual(res.body.summary.overdueCount, 0);
  assert.strictEqual(res.body.fees[0].feeName, "Tuition Fee");
  assert.strictEqual(res.body.fees[0].totalAmount, 50000);
  assert.strictEqual(res.body.fees[0].totalPaid, 20000);
  assert.strictEqual(res.body.fees[0].outstanding, 30000);
  assert.strictEqual(res.body.fees[0].paymentStatus, "partial");
});

test("parents: parent cannot view unlinked student fees", async () => {
  const res = await request("GET", `/api/parents/me/children/${studentBId}/fees`, {
    Authorization: `Bearer ${parentAToken}`,
  });
  assert.strictEqual(res.status, 403);
});

test("parents: parent cannot access another parent's child fees", async () => {
  const res = await request("GET", `/api/parents/me/children/${studentAId}/fees`, {
    Authorization: `Bearer ${parentBToken}`,
  });
  assert.strictEqual(res.status, 403);
});

test("parents: school isolation enforced for parent fee access", async () => {
  const studentARes = await request("GET", "/api/students", {
    Authorization: `Bearer ${schoolAToken}`,
  });
  const studentAId = studentARes.body.students[0].id;

  const parentARes = await request("POST", "/api/parent-auth/register", {}, {
    name: "Parent Hack",
    email: `parent-hack-${Date.now()}@example.com`,
    password: "hackpass123",
  });
  assert.strictEqual(parentARes.status, 201);
  const parentHackToken = parentARes.body.token;

  const linkRes = await request("POST", "/api/parents/link", {
    Authorization: `Bearer ${schoolBToken}`,
  }, {
    parentId: parentARes.body.user.id,
    studentId: studentBId,
    parentName: "Parent Hack",
  });
  assert.strictEqual(linkRes.status, 201);

  const crossRes = await request("GET", `/api/parents/me/children/${studentAId}/fees`, {
    Authorization: `Bearer ${parentHackToken}`,
  });
  assert.strictEqual(crossRes.status, 403);
});

test("parents: create payment for child A", async () => {
  const feeRes = await request("POST", "/api/fee-structures", {
    Authorization: `Bearer ${schoolAToken}`,
  }, {
    schoolId: schoolAId,
    name: "Tuition Fee",
    amount: "50000",
    frequency: "termly",
    term: "First Term",
    className: "JSS1",
    dueDate: new Date(Date.now() + 86400000 * 30).toISOString().split("T")[0],
    academicSession: "2025/2026",
  });
  assert.strictEqual(feeRes.status, 201);
  const feeId = feeRes.body.fee.id;

  const paymentRes = await request("POST", "/api/payments/record", {
    Authorization: `Bearer ${schoolAToken}`,
  }, {
    studentId: studentAId,
    feeStructureId: feeId,
    amount: "20000",
    method: "cash",
    reference: "PAY-PARENT-001",
    notes: "First installment",
  });
  assert.strictEqual(paymentRes.status, 201);
  paymentAId = paymentRes.body.payment.id;
});

test("parents: create payment for child B", async () => {
  const feeRes = await request("POST", "/api/fee-structures", {
    Authorization: `Bearer ${schoolBToken}`,
  }, {
    schoolId: schoolBId,
    name: "Bus Fee",
    amount: "15000",
    frequency: "termly",
    term: "First Term",
    className: "JSS2",
    dueDate: new Date(Date.now() + 86400000 * 30).toISOString().split("T")[0],
    academicSession: "2025/2026",
  });
  assert.strictEqual(feeRes.status, 201);
  const feeId = feeRes.body.fee.id;

  const paymentRes = await request("POST", "/api/payments/record", {
    Authorization: `Bearer ${schoolBToken}`,
  }, {
    studentId: studentBId,
    feeStructureId: feeId,
    amount: "10000",
    method: "bank_transfer",
    reference: "PAY-PARENT-002",
    notes: "Bus fee payment",
  });
  assert.strictEqual(paymentRes.status, 201);
});

test("parents: parent can view payments for linked child", async () => {
  const res = await request("GET", "/api/parents/me/payments", {
    Authorization: `Bearer ${parentAToken}`,
  });
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body.payments));
  assert.ok(res.body.payments.length >= 1);
  const payment = res.body.payments.find(p => p.studentId === studentAId);
  assert.ok(payment);
  assert.strictEqual(payment.studentName, "Child One");
  assert.strictEqual(payment.feeName, "Tuition Fee");
  assert.strictEqual(payment.amount, 20000);
  assert.strictEqual(payment.method, "cash");
  assert.strictEqual(payment.reference, "PAY-PARENT-001");
  assert.strictEqual(payment.notes, "First installment");
  assert.ok(payment.receiptNumber);
});

test("parents: parent with multiple children sees all linked payments", async () => {
  const linkBRes = await request("POST", "/api/parents/link", {
    Authorization: `Bearer ${schoolBToken}`,
  }, {
    parentId: parentAId,
    studentId: studentBId,
    parentName: "Parent A",
    parentPhone: "08012345678",
    parentEmail: "parent-a@example.com",
  });
  assert.strictEqual(linkBRes.status, 201);

  const res = await request("GET", "/api/parents/me/payments", {
    Authorization: `Bearer ${parentAToken}`,
  });
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body.payments));
  assert.ok(res.body.payments.length >= 2);

  const childAPayments = res.body.payments.filter(p => p.studentId === studentAId);
  const childBPayments = res.body.payments.filter(p => p.studentId === studentBId);
  assert.ok(childAPayments.length >= 1);
  assert.ok(childBPayments.length >= 1);
});

test("parents: parent cannot see payments for unlinked student", async () => {
  const unlinkedStudentId = "999999";
  const res = await request("GET", "/api/parents/me/payments", {
    Authorization: `Bearer ${parentAToken}`,
  });
  assert.strictEqual(res.status, 200);
  const unlinkedPayments = res.body.payments.filter(p => p.studentId === unlinkedStudentId);
  assert.strictEqual(unlinkedPayments.length, 0);
});

test("parents: parent cannot access another parent's payments", async () => {
  const res = await request("GET", "/api/parents/me/payments", {
    Authorization: `Bearer ${parentBToken}`,
  });
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body.payments));
  assert.strictEqual(res.body.payments.length, 0);
});

test("parents: school isolation enforced for parent payments", async () => {
  const parentHackRes = await request("POST", "/api/parent-auth/register", {}, {
    name: "Parent Hack",
    email: `parent-hack-payments-${Date.now()}@example.com`,
    password: "hackpass123",
  });
  assert.strictEqual(parentHackRes.status, 201);
  const parentHackToken = parentHackRes.body.token;

  const linkRes = await request("POST", "/api/parents/link", {
    Authorization: `Bearer ${schoolBToken}`,
  }, {
    parentId: parentHackRes.body.user.id,
    studentId: studentBId,
    parentName: "Parent Hack",
  });
  assert.strictEqual(linkRes.status, 201);

  const res = await request("GET", "/api/parents/me/payments", {
    Authorization: `Bearer ${parentHackToken}`,
  });
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body.payments));
  const schoolAPayments = res.body.payments.filter(p => p.studentId === studentAId);
  assert.strictEqual(schoolAPayments.length, 0);
});

test("payments: admin can still list payments for school", async () => {
  const res = await request("GET", "/api/payments", {
    Authorization: `Bearer ${schoolAToken}`,
  });
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body.payments));
  assert.ok(res.body.payments.length >= 1);
});

test("parents: parent can view receipt for linked child payment", async () => {
  const res = await request("GET", `/api/parents/me/children/${studentAId}/payments/${paymentAId}/receipt`, {
    Authorization: `Bearer ${parentAToken}`,
  });
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.receipt);
  assert.strictEqual(res.body.receipt.receiptNumber, `RCP-${paymentAId}`);
  assert.strictEqual(res.body.receipt.student.name, "Child One");
  assert.strictEqual(res.body.receipt.fee.name, "Tuition Fee");
  assert.strictEqual(res.body.receipt.fee.originalAmount, 50000);
  assert.strictEqual(res.body.receipt.fee.previousPaid, 0);
  assert.strictEqual(res.body.receipt.fee.currentPayment, 20000);
  assert.strictEqual(res.body.receipt.fee.remainingBalance, 30000);
  assert.strictEqual(res.body.receipt.payment.method, "cash");
  assert.strictEqual(res.body.receipt.payment.reference, "PAY-PARENT-001");
  assert.strictEqual(res.body.receipt.payment.notes, "First installment");
  assert.ok(res.body.receipt.school.name);
  assert.ok(res.body.receipt.school.id);
});

test("parents: parent cannot view another parent's receipt", async () => {
  const res = await request("GET", `/api/parents/me/children/${studentAId}/payments/${paymentAId}/receipt`, {
    Authorization: `Bearer ${parentBToken}`,
  });
  assert.strictEqual(res.status, 403);
});

test("parents: parent cannot view receipt for unlinked student", async () => {
  const res = await request("GET", `/api/parents/me/children/999999/payments/999999/receipt`, {
    Authorization: `Bearer ${parentAToken}`,
  });
  assert.strictEqual(res.status, 403);
});

test("parents: school isolation enforced for parent receipt access", async () => {
  const parentHackRes = await request("POST", "/api/parent-auth/register", {}, {
    name: "Parent Receipt Hack",
    email: `parent-hack-receipt-${Date.now()}@example.com`,
    password: "hackpass123",
  });
  assert.strictEqual(parentHackRes.status, 201);
  const parentHackToken = parentHackRes.body.token;

  const linkRes = await request("POST", "/api/parents/link", {
    Authorization: `Bearer ${schoolBToken}`,
  }, {
    parentId: parentHackRes.body.user.id,
    studentId: studentBId,
    parentName: "Parent Receipt Hack",
  });
  assert.strictEqual(linkRes.status, 201);

  const res = await request("GET", `/api/parents/me/children/${studentAId}/payments/${paymentAId}/receipt`, {
    Authorization: `Bearer ${parentHackToken}`,
  });
  assert.strictEqual(res.status, 403);
});

test("receipts: admin can still view receipt for payment", async () => {
  const res = await request("GET", `/api/receipts/${paymentAId}`, {
    Authorization: `Bearer ${schoolAToken}`,
  });
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.receipt);
  assert.ok(res.body.receipt.receiptNumber);
});

test("parents: parent can open Pay Now for outstanding fee", async () => {
  const feeRes = await request("GET", "/api/fee-structures", {
    Authorization: `Bearer ${schoolAToken}`,
  });
  const feeId = feeRes.body.fees[0].id;

  const res = await request("GET", `/api/parents/me/children/${studentAId}/fees/${feeId}/pay-now`, {
    Authorization: `Bearer ${parentAToken}`,
  });
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.fee);
  assert.ok(res.body.student);
  assert.ok(res.body.school);
  assert.strictEqual(res.body.fee.outstanding > 0, true);
  assert.strictEqual(res.body.student.id, studentAId);
  assert.strictEqual(res.body.school.id, schoolAId);
});

test("parents: fully paid fee cannot be paid again", async () => {
  const feeRes = await request("GET", "/api/fee-structures", {
    Authorization: `Bearer ${schoolAToken}`,
  });
  const feeId = feeRes.body.fees[0].id;

  const payRes = await request("POST", "/api/payments/record", {
    Authorization: `Bearer ${schoolAToken}`,
  }, {
    studentId: studentAId,
    feeStructureId: feeId,
    amount: "50000",
    method: "cash",
  });
  assert.strictEqual(payRes.status, 201);

  const payNowRes = await request("GET", `/api/parents/me/children/${studentAId}/fees/${feeId}/pay-now`, {
    Authorization: `Bearer ${parentAToken}`,
  });
  assert.strictEqual(payNowRes.status, 400);
  assert.strictEqual(payNowRes.body.message, "Fee is already fully paid");
});

test("parents: cannot open Pay Now for unlinked student", async () => {
  const feeRes = await request("GET", "/api/fee-structures", {
    Authorization: `Bearer ${schoolAToken}`,
  });
  const feeId = feeRes.body.fees[0].id;

  const res = await request("GET", `/api/parents/me/children/${studentAId}/fees/${feeId}/pay-now`, {
    Authorization: `Bearer ${parentBToken}`,
  });
  assert.strictEqual(res.status, 403);
});

test("parents: cannot access another parent's fee via Pay Now", async () => {
  const feeRes = await request("GET", "/api/fee-structures", {
    Authorization: `Bearer ${schoolAToken}`,
  });
  const feeId = feeRes.body.fees[0].id;

  const res = await request("GET", `/api/parents/me/children/${studentAId}/fees/${feeId}/pay-now`, {
    Authorization: `Bearer ${parentBToken}`,
  });
  assert.strictEqual(res.status, 403);
});

test("parents: school isolation enforced for Pay Now", async () => {
  const feeARes = await request("GET", "/api/fee-structures", {
    Authorization: `Bearer ${schoolAToken}`,
  });
  const feeAId = feeARes.body.fees[0].id;

  const parentHackRes = await request("POST", "/api/parent-auth/register", {}, {
    name: "Parent Pay Hack",
    email: `parent-pay-hack-${Date.now()}@example.com`,
    password: "hackpass123",
  });
  assert.strictEqual(parentHackRes.status, 201);
  const parentHackToken = parentHackRes.body.token;

  const linkRes = await request("POST", "/api/parents/link", {
    Authorization: `Bearer ${schoolBToken}`,
  }, {
    parentId: parentHackRes.body.user.id,
    studentId: studentBId,
    parentName: "Parent Pay Hack",
  });
  assert.strictEqual(linkRes.status, 201);

  const res = await request("GET", `/api/parents/me/children/${studentAId}/fees/${feeAId}/pay-now`, {
    Authorization: `Bearer ${parentHackToken}`,
  });
  assert.strictEqual(res.status, 403);
});

test("payments: admin can still record payments", async () => {
  const feeRes = await request("POST", "/api/fee-structures", {
    Authorization: `Bearer ${schoolAToken}`,
  }, {
    schoolId: schoolAId,
    name: "Paystack Test Fee A",
    amount: "20000",
    frequency: "termly",
  });
  assert.strictEqual(feeRes.status, 201);
  const feeId = feeRes.body.fee.id;

  const res = await request("POST", "/api/payments/record", {
    Authorization: `Bearer ${schoolAToken}`,
  }, {
    studentId: studentAId,
    feeStructureId: feeId,
    amount: "25000",
    method: "cash",
  });
  assert.strictEqual(res.status, 201);
});

test("paystack: parent can initialize payment for outstanding fee", async () => {
  const feeRes = await request("POST", "/api/fee-structures", {
    Authorization: `Bearer ${schoolAToken}`,
  }, {
    schoolId: schoolAId,
    name: "Paystack Init Fee",
    amount: "20000",
    frequency: "termly",
  });
  assert.strictEqual(feeRes.status, 201);
  const feeId = feeRes.body.fee.id;

  const originalFetch = global.fetch;
  global.fetch = async (url, options) => {
    if (url.includes("paystack.co/transaction/initialize")) {
      return {
        ok: true,
        json: async () => ({
          status: true,
          message: "Authorization URL created",
          data: {
            authorization_url: "https://checkout.paystack.com/mock",
            access_code: "mock_access_code",
            reference: "SCH-MOCK123",
          },
        }),
      };
    }
    return originalFetch(url, options);
  };

  try {
    const res = await request("POST", `/api/parents/me/children/${studentAId}/fees/${feeId}/pay-now/initialize`, {
      Authorization: `Bearer ${parentAToken}`,
    }, { amount: "10000" });
    assert.strictEqual(res.status, 201);
    assert.ok(res.body.paystack);
    assert.ok(res.body.paystack.authorizationUrl);
    assert.ok(res.body.payment);
    assert.strictEqual(res.body.payment.status, "pending");
  } finally {
    global.fetch = originalFetch;
  }
});

test("paystack: parent cannot initialize payment for fully paid fee", async () => {
  const feeRes = await request("POST", "/api/fee-structures", {
    Authorization: `Bearer ${schoolAToken}`,
  }, {
    schoolId: schoolAId,
    name: "Paystack Full Fee",
    amount: "15000",
    frequency: "termly",
  });
  assert.strictEqual(feeRes.status, 201);
  const feeId = feeRes.body.fee.id;

  const payRes = await request("POST", "/api/payments/record", {
    Authorization: `Bearer ${schoolAToken}`,
  }, {
    studentId: studentAId,
    feeStructureId: feeId,
    amount: "15000",
    method: "cash",
  });
  assert.strictEqual(payRes.status, 201);

  const res = await request("POST", `/api/parents/me/children/${studentAId}/fees/${feeId}/pay-now/initialize`, {
    Authorization: `Bearer ${parentAToken}`,
  }, { amount: "1000" });
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.message, "Fee is already fully paid");
});

test("paystack: parent cannot initialize payment for unlinked student", async () => {
  const feeRes = await request("POST", "/api/fee-structures", {
    Authorization: `Bearer ${schoolBToken}`,
  }, {
    schoolId: schoolBId,
    name: "Paystack Unlinked Fee",
    amount: "15000",
    frequency: "termly",
  });
  assert.strictEqual(feeRes.status, 201);
  const feeId = feeRes.body.fee.id;

  const unlinkedParentRes = await request("POST", "/api/parent-auth/register", {}, {
    name: "Unlinked Parent",
    email: `unlinked-parent-${Date.now()}@example.com`,
    password: "unlinkedpass123",
  });
  assert.strictEqual(unlinkedParentRes.status, 201);
  const unlinkedParentToken = unlinkedParentRes.body.token;

  const res = await request("POST", `/api/parents/me/children/${studentBId}/fees/${feeId}/pay-now/initialize`, {
    Authorization: `Bearer ${unlinkedParentToken}`,
  }, { amount: "1000" });
  assert.strictEqual(res.status, 403);
});

test("paystack: parent cannot initialize payment for another parent's fee", async () => {
  const feeRes = await request("POST", "/api/fee-structures", {
    Authorization: `Bearer ${schoolAToken}`,
  }, {
    schoolId: schoolAId,
    name: "Paystack Other Parent Fee",
    amount: "15000",
    frequency: "termly",
  });
  assert.strictEqual(feeRes.status, 201);
  const feeId = feeRes.body.fee.id;

  const res = await request("POST", `/api/parents/me/children/${studentAId}/fees/${feeId}/pay-now/initialize`, {
    Authorization: `Bearer ${parentBToken}`,
  }, { amount: "1000" });
  assert.strictEqual(res.status, 403);
});

test("paystack: amount cannot exceed outstanding balance", async () => {
  const feeRes = await request("POST", "/api/fee-structures", {
    Authorization: `Bearer ${schoolAToken}`,
  }, {
    schoolId: schoolAId,
    name: "Paystack Overshoot Fee",
    amount: "10000",
    frequency: "termly",
  });
  assert.strictEqual(feeRes.status, 201);
  const feeId = feeRes.body.fee.id;

  const res = await request("POST", `/api/parents/me/children/${studentAId}/fees/${feeId}/pay-now/initialize`, {
    Authorization: `Bearer ${parentAToken}`,
  }, { amount: "999999" });
  assert.strictEqual(res.status, 400);
  assert.ok(res.body.message.includes("exceed outstanding balance"));
});

test("paystack: amount cannot be zero or negative", async () => {
  const feeRes = await request("POST", "/api/fee-structures", {
    Authorization: `Bearer ${schoolAToken}`,
  }, {
    schoolId: schoolAId,
    name: "Paystack Zero Fee",
    amount: "10000",
    frequency: "termly",
  });
  assert.strictEqual(feeRes.status, 201);
  const feeId = feeRes.body.fee.id;

  const res = await request("POST", `/api/parents/me/children/${studentAId}/fees/${feeId}/pay-now/initialize`, {
    Authorization: `Bearer ${parentAToken}`,
  }, { amount: "0" });
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.message, "Payment amount must be greater than zero.");
});

test("paystack: school isolation enforced for payment initialization", async () => {
  const feeARes = await request("POST", "/api/fee-structures", {
    Authorization: `Bearer ${schoolAToken}`,
  }, {
    schoolId: schoolAId,
    name: "Paystack Isolation Fee A",
    amount: "15000",
    frequency: "termly",
  });
  assert.strictEqual(feeARes.status, 201);
  const feeAId = feeARes.body.fee.id;

  const parentHackRes = await request("POST", "/api/parent-auth/register", {}, {
    name: "Parent Payment Hack",
    email: `parent-payment-hack-${Date.now()}@example.com`,
    password: "hackpass123",
  });
  assert.strictEqual(parentHackRes.status, 201);
  const parentHackToken = parentHackRes.body.token;

  const linkRes = await request("POST", "/api/parents/link", {
    Authorization: `Bearer ${schoolBToken}`,
  }, {
    parentId: parentHackRes.body.user.id,
    studentId: studentBId,
    parentName: "Parent Payment Hack",
  });
  assert.strictEqual(linkRes.status, 201);

  const res = await request("POST", `/api/parents/me/children/${studentAId}/fees/${feeAId}/pay-now/initialize`, {
    Authorization: `Bearer ${parentHackToken}`,
  }, { amount: "1000" });
  assert.strictEqual(res.status, 403);
});

test("paystack: duplicate transaction prevention", async () => {
  const feeRes = await request("POST", "/api/fee-structures", {
    Authorization: `Bearer ${schoolAToken}`,
  }, {
    schoolId: schoolAId,
    name: "Paystack Duplicate Fee",
    amount: "20000",
    frequency: "termly",
  });
  assert.strictEqual(feeRes.status, 201);
  const feeId = feeRes.body.fee.id;

  const res1 = await request("POST", `/api/parents/me/children/${studentAId}/fees/${feeId}/pay-now/initialize`, {
    Authorization: `Bearer ${parentAToken}`,
  }, { amount: "5000" });
  assert.strictEqual(res1.status, 201);

  const res2 = await request("POST", `/api/parents/me/children/${studentAId}/fees/${feeId}/pay-now/initialize`, {
    Authorization: `Bearer ${parentAToken}`,
  }, { amount: "5000" });
  assert.strictEqual(res2.status, 201);
});

test("paystack: payment verification succeeds for successful transaction", async () => {
  const feeRes = await request("POST", "/api/fee-structures", {
    Authorization: `Bearer ${schoolAToken}`,
  }, {
    schoolId: schoolAId,
    name: "Paystack Verify Success Fee",
    amount: "20000",
    frequency: "termly",
  });
  assert.strictEqual(feeRes.status, 201);
  const feeId = feeRes.body.fee.id;

  const originalFetch = global.fetch;
  global.fetch = async (url, options) => {
    if (url.includes("paystack.co/transaction/initialize")) {
      return {
        ok: true,
        json: async () => ({
          status: true,
          message: "Authorization URL created",
          data: {
            authorization_url: "https://checkout.paystack.com/mock",
            access_code: "mock_access_code",
            reference: "SCH-VERIFYSUCCESS",
          },
        }),
      };
    }
    if (url.includes("paystack.co/transaction/verify")) {
      return {
        ok: true,
        json: async () => ({
          status: true,
          message: "Verification successful",
          data: {
            status: "success",
            amount: 500000,
            currency: "NGN",
            reference: "SCH-VERIFYSUCCESS",
            paid_at: new Date().toISOString(),
            transaction_date: new Date().toISOString(),
            channel: "card",
            customer: { email: parentUser ? parentUser.email : "parent@example.com" },
          },
        }),
      };
    }
    return originalFetch(url, options);
  };

  try {
    const initRes = await request("POST", `/api/parents/me/children/${studentAId}/fees/${feeId}/pay-now/initialize`, {
      Authorization: `Bearer ${parentAToken}`,
    }, { amount: "5000" });
    assert.strictEqual(initRes.status, 201);
    const reference = initRes.body.payment.reference;

    const verifyRes = await request("POST", "/api/parents/paystack/verify", {
      Authorization: `Bearer ${parentAToken}`,
    }, { reference });
    assert.strictEqual(verifyRes.status, 200);
    assert.ok(verifyRes.body.payment);
    assert.strictEqual(verifyRes.body.payment.status, "paid");
    assert.ok(verifyRes.body.receipt);
  } finally {
    global.fetch = originalFetch;
  }
});

test("paystack: webhook signature validation works", async () => {
  const crypto = require("crypto");
  const secret = process.env.PAYSTACK_SECRET_KEY;
  const payload = JSON.stringify({ event: "charge.success", data: { reference: "SCH-WEBHOOK123" } });
  const signature = crypto.createHmac("sha512", secret).update(payload).digest("hex");

  const res = await request("POST", "/api/payments/paystack/webhook", {
    "x-paystack-signature": signature,
  }, payload);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.received, true);
});

test("paystack: webhook rejects invalid signature", async () => {
  const payload = JSON.stringify({ event: "charge.success", data: { reference: "SCH-WEBHOOKBAD" } });
  const res = await request("POST", "/api/payments/paystack/webhook", {
    "x-paystack-signature": "invalid_signature",
  }, payload);
  assert.strictEqual(res.status, 401);
  assert.strictEqual(res.body.message, "Invalid signature");
});

test("paystack: webhook is idempotent", async () => {
  const feeRes = await request("POST", "/api/fee-structures", {
    Authorization: `Bearer ${schoolAToken}`,
  }, {
    schoolId: schoolAId,
    name: "Paystack Webhook Fee",
    amount: "15000",
    frequency: "termly",
  });
  assert.strictEqual(feeRes.status, 201);
  const feeId = feeRes.body.fee.id;

  const paymentRes = await request("POST", "/api/payments/record", {
    Authorization: `Bearer ${schoolAToken}`,
  }, {
    studentId: studentAId,
    feeStructureId: feeId,
    amount: "1000",
    method: "cash",
  });
  assert.strictEqual(paymentRes.status, 201);
  const paymentId = paymentRes.body.payment.id;

  const crypto = require("crypto");
  const secret = process.env.PAYSTACK_SECRET_KEY;
  const payload = JSON.stringify({
    event: "charge.success",
    data: { reference: paymentRes.body.payment.reference },
  });
  const signature = crypto.createHmac("sha512", secret).update(payload).digest("hex");

  const res1 = await request("POST", "/api/payments/paystack/webhook", {
    "x-paystack-signature": signature,
  }, payload);
  assert.strictEqual(res1.status, 200);

  const res2 = await request("POST", "/api/payments/paystack/webhook", {
    "x-paystack-signature": signature,
  }, payload);
  assert.strictEqual(res2.status, 200);

  const paymentAfter = db.payments.getById(paymentId);
  assert.strictEqual(paymentAfter.status, "paid");
});



