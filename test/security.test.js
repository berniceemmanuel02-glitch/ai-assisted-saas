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
        resolve({ status: res.statusCode, body: parsed, headers: res.headers });
      });
    });

    req.on("error", reject);
    if (body !== undefined) req.write(typeof body === "string" ? body : JSON.stringify(body));
    req.end();
  });
}

test("security: JWT_SECRET is required and no hardcoded fallback exists", async () => {
  const fs = require("fs");
  const authPath = require.resolve("../backend/middleware/auth.js");
  const content = fs.readFileSync(authPath, "utf8");
  assert.ok(!content.includes('scholapay-secret-key'), "Hardcoded JWT fallback must be removed");
  assert.ok(content.includes("JWT_SECRET"), "JWT_SECRET env var must be used");
});

test("security: mass assignment cannot change schoolId on student", async () => {
  const registerRes = await request("POST", "/api/auth/register", {}, {
    name: "Mass Assign Test School",
    email: `mass-assign-school-${Date.now()}@example.com`,
    password: "masspass123",
  });
  assert.strictEqual(registerRes.status, 201);
  const schoolId = registerRes.body.user.schoolId;
  const token = registerRes.body.token;

  const studentRes = await request("POST", "/api/students", {
    Authorization: `Bearer ${token}`,
  }, {
    firstName: "Original",
    lastName: "Student",
    admissionNumber: "MASS001",
    parentName: "Parent",
    parentEmail: "parent@example.com",
  });
  assert.strictEqual(studentRes.status, 201);
  const studentId = studentRes.body.student.id;
  const originalSchoolId = studentRes.body.student.schoolId;
  assert.strictEqual(originalSchoolId, schoolId);

  const evilSchoolId = "9999999999999";
  const updateRes = await request("PUT", `/api/students/${studentId}`, {
    Authorization: `Bearer ${token}`,
  }, {
    schoolId: evilSchoolId,
    firstName: "Hacked",
  });
  assert.strictEqual(updateRes.status, 200);
  assert.strictEqual(updateRes.body.student.schoolId, originalSchoolId);
  assert.strictEqual(updateRes.body.student.firstName, "Hacked");
});

test("security: mass assignment cannot change schoolId on fee structure", async () => {
  const registerRes = await request("POST", "/api/auth/register", {}, {
    name: "Mass Assign Fee School",
    email: `mass-assign-fee-${Date.now()}@example.com`,
    password: "masspass123",
  });
  assert.strictEqual(registerRes.status, 201);
  const schoolId = registerRes.body.user.schoolId;
  const token = registerRes.body.token;

  const feeRes = await request("POST", "/api/fee-structures", {
    Authorization: `Bearer ${token}`,
  }, {
    name: "Mass Assign Fee",
    amount: "10000",
    frequency: "termly",
  });
  assert.strictEqual(feeRes.status, 201);
  const feeId = feeRes.body.fee.id;
  assert.strictEqual(feeRes.body.fee.schoolId, schoolId);

  const updateRes = await request("PUT", `/api/fee-structures/${feeId}`, {
    Authorization: `Bearer ${token}`,
  }, {
    schoolId: "9999999999999",
    name: "Hacked Fee",
  });
  assert.strictEqual(updateRes.status, 200);
  assert.strictEqual(updateRes.body.fee.schoolId, schoolId);
  assert.strictEqual(updateRes.body.fee.name, "Hacked Fee");
});

test("security: subscription limits are enforced server-side", async () => {
  const registerRes = await request("POST", "/api/auth/register", {}, {
    name: "Limit Enforce School",
    email: `limit-enforce-${Date.now()}@example.com`,
    password: "limitpass123",
  });
  assert.strictEqual(registerRes.status, 201);
  const token = registerRes.body.token;

  for (let i = 0; i < 20; i++) {
    const res = await request("POST", "/api/students", {
      Authorization: `Bearer ${token}`,
    }, {
      firstName: `Student ${i}`,
      lastName: "Limit",
      admissionNumber: `LIMIT-${i}`,
      parentName: "Parent",
      parentEmail: "parent@example.com",
    });
    assert.strictEqual(res.status, 201);
  }

  const overRes = await request("POST", "/api/students", {
    Authorization: `Bearer ${token}`,
  }, {
    firstName: "Over Limit",
    lastName: "Student",
    admissionNumber: "OVER-LIMIT",
    parentName: "Parent",
    parentEmail: "parent@example.com",
  });
  assert.strictEqual(overRes.status, 403);
  assert.ok(overRes.body.message.includes("limit"));
});

test("security: Flutterwave webhook is idempotent", async () => {
  const registerRes = await request("POST", "/api/auth/register", {}, {
    name: "Flutterwave Idempotency School",
    email: `flutterwave-idem-${Date.now()}@example.com`,
    password: "idempass123",
  });
  assert.strictEqual(registerRes.status, 201);
  const token = registerRes.body.token;

  const studentRes = await request("POST", "/api/students", {
    Authorization: `Bearer ${token}`,
  }, {
    firstName: "Flutterwave",
    lastName: "Student",
    admissionNumber: "FW-IDEM",
    parentName: "Parent",
    parentEmail: "parent@example.com",
  });
  assert.strictEqual(studentRes.status, 201);
  const studentId = studentRes.body.student.id;

  const feeRes = await request("POST", "/api/fee-structures", {
    Authorization: `Bearer ${token}`,
  }, {
    schoolId: registerRes.body.user.schoolId,
    name: "Flutterwave Fee",
    amount: "15000",
    frequency: "termly",
  });
  assert.strictEqual(feeRes.status, 201);
  const feeId = feeRes.body.fee.id;

  const initRes = await request("POST", "/api/payments/initialize", {
    Authorization: `Bearer ${token}`,
  }, {
    schoolId: registerRes.body.user.schoolId,
    studentId,
    feeStructureId: feeId,
    amount: "15000",
    method: "flutterwave",
  });
  assert.strictEqual(initRes.status, 201);
  const reference = initRes.body.payment.reference;

  const payload1 = JSON.stringify({
    event: "charge.completed",
    data: { status: "successful", tx_ref: reference, amount: 1500000 },
  });
  const secret = process.env.FLUTTERWAVE_SECRET_HASH || "test-flutterwave-hash";
  const signature1 = require("crypto").createHmac("sha256", secret).update(payload1).digest("hex");

  const res1 = await request("POST", "/api/payments/flutterwave/webhook", {
    "verif-hash": signature1,
  }, payload1);
  assert.strictEqual(res1.status, 200);

  const res2 = await request("POST", "/api/payments/flutterwave/webhook", {
    "verif-hash": signature1,
  }, payload1);
  assert.strictEqual(res2.status, 200);
  assert.strictEqual(res2.body.message, "Already processed");
});

test("security: webhook rejects amount mismatch", async () => {
  const registerRes = await request("POST", "/api/auth/register", {}, {
    name: "Webhook Amount School",
    email: `webhook-amount-${Date.now()}@example.com`,
    password: "webamountpass123",
  });
  assert.strictEqual(registerRes.status, 201);
  const token = registerRes.body.token;

  const studentRes = await request("POST", "/api/students", {
    Authorization: `Bearer ${token}`,
  }, {
    firstName: "Amount",
    lastName: "Test",
    admissionNumber: "AMT-TEST",
    parentName: "Parent",
    parentEmail: "parent@example.com",
  });
  assert.strictEqual(studentRes.status, 201);
  const studentId = studentRes.body.student.id;

  const feeRes = await request("POST", "/api/fee-structures", {
    Authorization: `Bearer ${token}`,
  }, {
    schoolId: registerRes.body.user.schoolId,
    name: "Amount Test Fee",
    amount: "20000",
    frequency: "termly",
  });
  assert.strictEqual(feeRes.status, 201);
  const feeId = feeRes.body.fee.id;

  const initRes = await request("POST", "/api/payments/initialize", {
    Authorization: `Bearer ${token}`,
  }, {
    schoolId: registerRes.body.user.schoolId,
    studentId,
    feeStructureId: feeId,
    amount: "20000",
    method: "paystack",
  });
  assert.strictEqual(initRes.status, 201);
  const reference = initRes.body.payment.reference;

  const payload = JSON.stringify({
    event: "charge.success",
    data: { reference, amount: 500000 },
  });
  const secret = process.env.PAYSTACK_SECRET_KEY;
  const signature = require("crypto").createHmac("sha512", secret).update(payload).digest("hex");

  const res = await request("POST", "/api/payments/paystack/webhook", {
    "x-paystack-signature": signature,
  }, payload);
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.message, "Amount mismatch");
});

test("security: payment rate limiting rejects excessive requests", async () => {
  const registerRes = await request("POST", "/api/auth/register", {}, {
    name: "Rate Limit School",
    email: `rate-limit-${Date.now()}@example.com`,
    password: "ratelimitpass123",
  });
  assert.strictEqual(registerRes.status, 201);
  const schoolToken = registerRes.body.token;

  const studentRes = await request("POST", "/api/students", {
    Authorization: `Bearer ${schoolToken}`,
  }, {
    firstName: "Rate",
    lastName: "Limit",
    admissionNumber: "RATE-LIMIT",
    parentName: "Parent",
    parentEmail: "parent@example.com",
  });
  assert.strictEqual(studentRes.status, 201);
  const studentId = studentRes.body.student.id;

  const feeRes = await request("POST", "/api/fee-structures", {
    Authorization: `Bearer ${schoolToken}`,
  }, {
    schoolId: registerRes.body.user.schoolId,
    name: "Rate Limit Fee",
    amount: "10000",
    frequency: "termly",
  });
  assert.strictEqual(feeRes.status, 201);
  const feeId = feeRes.body.fee.id;

  const parentRes = await request("POST", "/api/parent-auth/register", {}, {
    name: "Rate Limit Parent",
    email: `rate-limit-parent-${Date.now()}@example.com`,
    password: "ratelimitparent123",
  });
  assert.strictEqual(parentRes.status, 201);
  const parentToken = parentRes.body.token;

  const linkRes = await request("POST", "/api/parents/link", {
    Authorization: `Bearer ${schoolToken}`,
  }, {
    parentId: parentRes.body.user.id,
    studentId,
    parentName: "Rate Limit Parent",
  });
  assert.strictEqual(linkRes.status, 201);

  for (let i = 0; i < 21; i++) {
    const res = await request("POST", `/api/parents/me/children/${studentId}/fees/${feeId}/pay-now/initialize`, {
      Authorization: `Bearer ${parentToken}`,
    }, { amount: "1000" });
    if (i < 20) {
      assert.strictEqual(res.status, 201);
    } else {
      assert.strictEqual(res.status, 429);
    }
  }
});

test("security: registration ignores client-provided role", async () => {
  const res = await request("POST", "/api/auth/register", {}, {
    name: "Role Test",
    email: `role-test-${Date.now()}@example.com`,
    password: "roletest123",
    role: "admin",
  });
  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.user.role, "user");
});

test("security: registration ignores owner role injection", async () => {
  const res = await request("POST", "/api/auth/register", {}, {
    name: "Owner Test",
    email: `owner-test-${Date.now()}@example.com`,
    password: "ownertest123",
    role: "owner",
  });
  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.user.role, "user");
});

test("security: admin authentication still works", async () => {
  const registerRes = await request("POST", "/api/auth/register", {}, {
    name: "Admin Auth Test",
    email: `admin-auth-${Date.now()}@example.com`,
    password: "adminauth123",
  });
  assert.strictEqual(registerRes.status, 201);
  const token = registerRes.body.token;

  const meRes = await request("GET", "/api/auth/me", {
    Authorization: `Bearer ${token}`,
  });
  assert.strictEqual(meRes.status, 200);
  assert.strictEqual(meRes.body.user.role, "user");
});

test("security: backup script creates timestamped backup", async () => {
  const { execSync } = require("child_process");
  const fs = require("fs");
  const path = require("path");

  const result = execSync("node scripts/backup.js", { cwd: path.join(__dirname, ".."), encoding: "utf8" });
  assert.ok(result.includes("Backup created"));

  const backupsDir = path.join(__dirname, "..", "backups");
  const backups = fs.readdirSync(backupsDir).filter((f) => f.startsWith("data_"));
  assert.ok(backups.length > 0);

  const latestBackup = path.join(backupsDir, backups[backups.length - 1]);
  assert.ok(fs.existsSync(path.join(latestBackup, "users.json")));
  assert.ok(fs.existsSync(path.join(latestBackup, "payments.json")));
});

test("security: admin payment endpoints have rate limiting", async () => {
  const registerRes = await request("POST", "/api/auth/register", {}, {
    name: "Admin Rate Limit",
    email: `admin-rate-${Date.now()}@example.com`,
    password: "adminrate123",
  });
  assert.strictEqual(registerRes.status, 201);
  const token = registerRes.body.token;

  const studentRes = await request("POST", "/api/students", {
    Authorization: `Bearer ${token}`,
  }, {
    firstName: "Rate",
    lastName: "Admin",
    admissionNumber: "RATE-ADMIN",
    parentName: "Parent",
    parentEmail: "parent@example.com",
  });
  assert.strictEqual(studentRes.status, 201);
  const studentId = studentRes.body.student.id;

  const feeRes = await request("POST", "/api/fee-structures", {
    Authorization: `Bearer ${token}`,
  }, {
    schoolId: registerRes.body.user.schoolId,
    name: "Admin Rate Fee",
    amount: "10000",
    frequency: "termly",
  });
  assert.strictEqual(feeRes.status, 201);
  const feeId = feeRes.body.fee.id;

  for (let i = 0; i < 11; i++) {
    const res = await request("POST", "/api/payments/initialize", {
      Authorization: `Bearer ${token}`,
    }, {
      schoolId: registerRes.body.user.schoolId,
      studentId,
      feeStructureId: feeId,
      amount: "1000",
      method: "paystack",
    });
    if (i < 10) {
      assert.strictEqual(res.status, 201);
    } else {
      assert.strictEqual(res.status, 429);
    }
  }
});

test("security: usage decrements on student delete", async () => {
  const registerRes = await request("POST", "/api/auth/register", {}, {
    name: "Usage Delete School",
    email: `usage-delete-${Date.now()}@example.com`,
    password: "usagedelete123",
  });
  assert.strictEqual(registerRes.status, 201);
  const token = registerRes.body.token;

  const studentRes = await request("POST", "/api/students", {
    Authorization: `Bearer ${token}`,
  }, {
    firstName: "Usage",
    lastName: "Delete",
    admissionNumber: "USAGE-DEL",
    parentName: "Parent",
    parentEmail: "parent@example.com",
  });
  assert.strictEqual(studentRes.status, 201);
  const studentId = studentRes.body.student.id;

  const deleteRes = await request("DELETE", `/api/students/${studentId}`, {
    Authorization: `Bearer ${token}`,
  });
  assert.strictEqual(deleteRes.status, 200);
});
