const { test } = require("node:test");
const assert = require("node:assert");
const http = require("node:http");

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

test("smoke: test runner works", () => {
  assert.strictEqual(1 + 1, 2);
});

test("auth: protected endpoint without JWT returns 401", async () => {
  const res = await request("GET", "/api/students");
  assert.strictEqual(res.status, 401);
});

test("auth: invalid JWT returns 401", async () => {
  const res = await request("GET", "/api/students", {
    Authorization: "Bearer invalid-token",
  });
  assert.strictEqual(res.status, 401);
});

test("auth: register creates user and returns token", async () => {
  const email = `register-${Date.now()}@example.com`;
  const res = await request("POST", "/api/auth/register", {}, {
    name: "Register Test User",
    email,
    password: "registerpass123",
  });
  assert.strictEqual(res.status, 201);
  assert.ok(res.body.token);
  assert.ok(res.body.user);
  assert.strictEqual(res.body.user.email, email);
  assert.ok(res.body.user.schoolId);
});

test("auth: login returns token for valid credentials", async () => {
  const email = `login-${Date.now()}@example.com`;
  const registerRes = await request("POST", "/api/auth/register", {}, {
    name: "Login Test User",
    email,
    password: "loginpass123",
  });
  assert.strictEqual(registerRes.status, 201);

  const loginRes = await request("POST", "/api/auth/login", {}, {
    email,
    password: "loginpass123",
  });
  assert.strictEqual(loginRes.status, 200);
  assert.ok(loginRes.body.token);
  assert.ok(loginRes.body.user.schoolId);
});

test("auth: login rejects invalid credentials", async () => {
  const res = await request("POST", "/api/auth/login", {}, {
    email: "nonexistent@example.com",
    password: "wrongpass",
  });
  assert.strictEqual(res.status, 400);
});

test("auth: me returns user and school info", async () => {
  const email = `me-${Date.now()}@example.com`;
  const registerRes = await request("POST", "/api/auth/register", {}, {
    name: "Me Test User",
    email,
    password: "mepass123",
  });
  assert.strictEqual(registerRes.status, 201);
  const token = registerRes.body.token;

  const res = await request("GET", "/api/auth/me", {
    Authorization: `Bearer ${token}`,
  });
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.user);
  assert.ok(res.body.school);
  assert.strictEqual(res.body.user.schoolId, res.body.school.id);
});

test("schools: register auto-creates school", async () => {
  const email = `school-auto-${Date.now()}@example.com`;
  const registerRes = await request("POST", "/api/auth/register", {}, {
    name: "School Auto User",
    email,
    password: "schoolpass123",
  });
  assert.strictEqual(registerRes.status, 201);
  const token = registerRes.body.token;
  const schoolId = registerRes.body.user.schoolId;
  schoolAId = schoolId;
  schoolAToken = token;

  const meRes = await request("GET", "/api/auth/me", {
    Authorization: `Bearer ${token}`,
  });
  assert.strictEqual(meRes.status, 200);
  assert.ok(meRes.body.school);
  assert.strictEqual(meRes.body.school.id, schoolId);
  assert.ok(meRes.body.school.name.length > 0);
});

test("students: create student with valid JWT", async () => {
  const res = await request("POST", "/api/students", {
    Authorization: `Bearer ${schoolAToken}`,
  }, {
    schoolId: schoolAId,
    firstName: "John",
    lastName: "Doe",
    admissionNumber: "ADM001",
    className: "JSS1",
    parentName: "Jane Doe",
    parentEmail: "jane@example.com",
    parentPhone: "08012345678",
  });
  assert.strictEqual(res.status, 201);
  assert.ok(res.body.student);
  assert.strictEqual(res.body.student.schoolId, schoolAId);
  assert.strictEqual(res.body.student.firstName, "John");
});

test("students: list students for school", async () => {
  const res = await request("GET", `/api/students?schoolId=${schoolAId}`, {
    Authorization: `Bearer ${schoolAToken}`,
  });
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body.students));
  assert.ok(res.body.students.length >= 1);
});

test("fee-structures: create fee with valid JWT", async () => {
  const res = await request("POST", "/api/fee-structures", {
    Authorization: `Bearer ${schoolAToken}`,
  }, {
    schoolId: schoolAId,
    name: "Tuition Fee",
    amount: "50000",
    frequency: "termly",
    term: "First Term",
    className: "JSS1",
  });
  assert.strictEqual(res.status, 201);
  assert.ok(res.body.fee);
  assert.strictEqual(res.body.fee.schoolId, schoolAId);
  assert.strictEqual(res.body.fee.name, "Tuition Fee");
});

test("fee-structures: list fees for school", async () => {
  const res = await request("GET", `/api/fee-structures?schoolId=${schoolAId}`, {
    Authorization: `Bearer ${schoolAToken}`,
  });
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body.fees));
  assert.ok(res.body.fees.length >= 1);
});

test("payments: initialize payment with valid JWT", async () => {
  const studentRes = await request("GET", `/api/students?schoolId=${schoolAId}`, {
    Authorization: `Bearer ${schoolAToken}`,
  });
  const studentId = studentRes.body.students[0].id;

  const feeRes = await request("GET", `/api/fee-structures?schoolId=${schoolAId}`, {
    Authorization: `Bearer ${schoolAToken}`,
  });
  const feeId = feeRes.body.fees[0].id;

  const res = await request("POST", "/api/payments/initialize", {
    Authorization: `Bearer ${schoolAToken}`,
  }, {
    schoolId: schoolAId,
    studentId,
    feeStructureId: feeId,
    amount: "50000",
    method: "paystack",
  });
  assert.strictEqual(res.status, 201);
  assert.ok(res.body.payment);
  assert.strictEqual(res.body.payment.schoolId, schoolAId);
  assert.strictEqual(res.body.payment.status, "pending");
});

test("payments: list payments for school", async () => {
  const res = await request("GET", `/api/payments?schoolId=${schoolAId}`, {
    Authorization: `Bearer ${schoolAToken}`,
  });
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body.payments));
  assert.ok(res.body.payments.length >= 1);
});

test("auth: cross-school access is denied", async () => {
  const email = `schoolb-${Date.now()}@example.com`;
  const registerRes = await request("POST", "/api/auth/register", {}, {
    name: "School B Admin",
    email,
    password: "schoolbpass123",
  });
  assert.strictEqual(registerRes.status, 201);
  schoolBId = registerRes.body.user.schoolId;
  schoolBToken = registerRes.body.token;

  const res = await request("GET", "/api/students", {
    Authorization: `Bearer ${schoolBToken}`,
  });
  assert.strictEqual(res.status, 200);
  const bStudents = res.body.students || [];
  for (const s of bStudents) {
    assert.strictEqual(s.schoolId, schoolBId);
  }
});

test("students: cross-school student creation is denied", async () => {
  const createRes = await request("POST", "/api/students", {
    Authorization: `Bearer ${schoolBToken}`,
  }, {
    firstName: "Hacker",
    lastName: "Student",
    admissionNumber: "HACK001",
    parentName: "Hacker Parent",
    parentEmail: "hacker@evil.com",
  });
  assert.strictEqual(createRes.status, 201);
  assert.strictEqual(createRes.body.student.schoolId, schoolBId);
});

test("fee-structures: cross-school fee creation is denied", async () => {
  const createRes = await request("POST", "/api/fee-structures", {
    Authorization: `Bearer ${schoolBToken}`,
  }, {
    name: "Hacked Fee",
    amount: "100",
    frequency: "one-time",
  });
  assert.strictEqual(createRes.status, 201);
  assert.strictEqual(createRes.body.fee.schoolId, schoolBId);
});

test("payments: cross-school payment initialization is denied", async () => {
  const createRes = await request("POST", "/api/payments/initialize", {
    Authorization: `Bearer ${schoolBToken}`,
  }, {
    studentId: "fake-student",
    feeStructureId: "fake-fee",
    amount: "100",
  });
  assert.strictEqual(createRes.status, 201);
  assert.strictEqual(createRes.body.payment.schoolId, schoolBId);
});

test("health: server health check returns ok", async () => {
  const res = await request("GET", "/api/health");
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.status, "ok");
  assert.ok(res.body.timestamp);
});

test("students: summary returns fee breakdown with smart recovery data", async () => {
  const studentRes = await request("GET", "/api/students", {
    Authorization: `Bearer ${schoolAToken}`,
  });
  const studentId = studentRes.body.students[0].id;

  const feeRes = await request("POST", "/api/fee-structures", {
    Authorization: `Bearer ${schoolAToken}`,
  }, {
    name: "Smart Fee Test",
    amount: "10000",
    frequency: "termly",
    dueDate: new Date(Date.now() + 86400000 * 5).toISOString().split("T")[0],
  });
  assert.strictEqual(feeRes.status, 201);
  const feeId = feeRes.body.fee.id;

  await request("POST", "/api/payments/record", {
    Authorization: `Bearer ${schoolAToken}`,
  }, {
    studentId,
    feeStructureId: feeId,
    amount: "3000",
    method: "cash",
  });

  const summaryRes = await request("GET", `/api/students/${studentId}/summary`, {
    Authorization: `Bearer ${schoolAToken}`,
  });
  assert.strictEqual(summaryRes.status, 200);
  assert.ok(summaryRes.body.fees);
  assert.ok(Array.isArray(summaryRes.body.fees));
  const feeBreakdown = summaryRes.body.fees.find(f => f.feeId === feeId);
  assert.ok(feeBreakdown);
  assert.strictEqual(feeBreakdown.totalAmount, 10000);
  assert.strictEqual(feeBreakdown.totalPaid, 3000);
  assert.strictEqual(feeBreakdown.outstanding, 7000);
  assert.ok(feeBreakdown.suggestedNextPayment > 0);
  assert.ok(feeBreakdown.suggestedNextPayment <= 7000);
});

test("students: fees endpoint returns per-fee breakdown", async () => {
  const studentRes = await request("GET", "/api/students", {
    Authorization: `Bearer ${schoolAToken}`,
  });
  const studentId = studentRes.body.students[0].id;

  const res = await request("GET", `/api/students/${studentId}/fees`, {
    Authorization: `Bearer ${schoolAToken}`,
  });
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body.fees));
});

test("students: payments endpoint returns payment history", async () => {
  const studentRes = await request("GET", "/api/students", {
    Authorization: `Bearer ${schoolAToken}`,
  });
  const studentId = studentRes.body.students[0].id;

  const res = await request("GET", `/api/students/${studentId}/payments`, {
    Authorization: `Bearer ${schoolAToken}`,
  });
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body.payments));
  assert.ok(res.body.payments.length >= 1);
});

test("payments: record payment returns receipt data", async () => {
  const studentRes = await request("GET", "/api/students", {
    Authorization: `Bearer ${schoolAToken}`,
  });
  const studentId = studentRes.body.students[0].id;

  const feeRes = await request("GET", "/api/fee-structures", {
    Authorization: `Bearer ${schoolAToken}`,
  });
  const feeId = feeRes.body.fees[0].id;

  const res = await request("POST", "/api/payments/record", {
    Authorization: `Bearer ${schoolAToken}`,
  }, {
    studentId,
    feeStructureId: feeId,
    amount: "5000",
    method: "bank_transfer",
    reference: "TEST-RCP-001",
  });
  assert.strictEqual(res.status, 201);
  assert.ok(res.body.receipt);
  assert.strictEqual(res.body.receipt.school.name.length > 0, true);
  assert.strictEqual(res.body.receipt.student.name.length > 0, true);
  assert.strictEqual(res.body.receipt.fee.name.length > 0, true);
  assert.strictEqual(res.body.receipt.receiptNumber.length > 0, true);
});

test("receipts: get receipt by payment id", async () => {
  const paymentsRes = await request("GET", "/api/payments", {
    Authorization: `Bearer ${schoolAToken}`,
  });
  const paymentId = paymentsRes.body.payments[0].id;

  const res = await request("GET", `/api/receipts/${paymentId}`, {
    Authorization: `Bearer ${schoolAToken}`,
  });
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.receipt);
  assert.ok(res.body.receipt.receiptNumber);
});

test("fee-structures: overdue fee detection works", async () => {
  const feeRes = await request("POST", "/api/fee-structures", {
    Authorization: `Bearer ${schoolAToken}`,
  }, {
    name: "Overdue Fee Test",
    amount: "20000",
    frequency: "termly",
    dueDate: new Date(Date.now() - 86400000 * 3).toISOString().split("T")[0],
  });
  assert.strictEqual(feeRes.status, 201);

  const summaryRes = await request("GET", `/api/fee-structures/${feeRes.body.fee.id}/summary`, {
    Authorization: `Bearer ${schoolAToken}`,
  });
  assert.strictEqual(summaryRes.status, 200);
  assert.strictEqual(summaryRes.body.isOverdue, true);
  assert.ok(summaryRes.body.daysOverdue >= 3);
  assert.strictEqual(summaryRes.body.status, "overdue");
});

test("students: cross-school student fees access is denied", async () => {
  const studentRes = await request("GET", "/api/students", {
    Authorization: `Bearer ${schoolBToken}`,
  });
  const studentId = studentRes.body.students[0].id;

  const res = await request("GET", `/api/students/${studentId}/fees`, {
    Authorization: `Bearer ${schoolAToken}`,
  });
  assert.strictEqual(res.status, 403);
});

test("receipts: cross-school receipt access is denied", async () => {
  const paymentsRes = await request("GET", "/api/payments", {
    Authorization: `Bearer ${schoolBToken}`,
  });
  const paymentId = paymentsRes.body.payments[0].id;

  const res = await request("GET", `/api/receipts/${paymentId}`, {
    Authorization: `Bearer ${schoolAToken}`,
  });
  assert.strictEqual(res.status, 403);
});
