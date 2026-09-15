const { test } = require("node:test");
const assert = require("node:assert");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const BASE = "http://localhost:5000";

function request(method, pathStr, headers = {}, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathStr, BASE);
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

let adminToken;
let adminUser;
let adminSchoolId;
let invitationToken;
let invitedEmail;

test("invitations: authenticated admin can create invitation", async () => {
  const email = `inviter-${Date.now()}@example.com`;
  const registerRes = await request("POST", "/api/auth/register", {}, {
    name: "Invitation Inviter",
    email,
    password: "inviterpass123",
  });
  assert.strictEqual(registerRes.status, 201);

  adminToken = registerRes.body.token;
  adminUser = registerRes.body.user;
  adminSchoolId = registerRes.body.user.schoolId;

  invitedEmail = `invitee-${Date.now()}@example.com`;
  const res = await request("POST", "/api/invitations", {
    Authorization: `Bearer ${adminToken}`,
  }, { email: invitedEmail });

  assert.strictEqual(res.status, 201);
  assert.ok(res.body.inviteLink, "Response should include inviteLink");
  assert.ok(res.body.inviteLink.includes("/admin/accept-invite?token="));
  assert.strictEqual(res.body.email, invitedEmail.toLowerCase());
  assert.strictEqual(res.body.schoolId, adminSchoolId);
  assert.ok(res.body.expiresAt);

  const url = new URL(res.body.inviteLink);
  invitationToken = url.searchParams.get("token");
  assert.ok(invitationToken && invitationToken.length > 0);
});

test("invitations: unauthenticated user cannot create invitation", async () => {
  const res = await request("POST", "/api/invitations", {}, {
    email: `unauth-${Date.now()}@example.com`,
  });
  assert.strictEqual(res.status, 401);
});

test("invitations: invitation is tied to inviter's school", async () => {
  const res = await request("GET", `/api/invitations/${invitationToken}`);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.schoolId, adminSchoolId);
});

test("invitations: invited admin can create account via invitation link", async () => {
  const res = await request("POST", `/api/invitations/${invitationToken}/accept`, {}, {
    name: "Invited Admin",
    password: "newpass1234",
    confirmPassword: "newpass1234",
  });
  assert.strictEqual(res.status, 201);
  assert.ok(res.body.token);
  assert.strictEqual(res.body.user.role, "admin");
  assert.strictEqual(res.body.user.schoolId, adminSchoolId);
  assert.strictEqual(res.body.user.email, invitedEmail.toLowerCase());
});

test("invitations: used invitation is rejected", async () => {
  const res = await request("POST", `/api/invitations/${invitationToken}/accept`, {}, {
    name: "Second Attempt",
    password: "newpass1234",
    confirmPassword: "newpass1234",
  });
  assert.strictEqual(res.status, 404);
  assert.ok(res.body.message.includes("not found, expired, or already used"));
});

test("invitations: invalid token is rejected", async () => {
  const res = await request("GET", "/api/invitations/nonexistent-token-12345");
  assert.strictEqual(res.status, 404);
});

test("invitations: duplicate existing email is handled safely", async () => {
  const email = `dup-${Date.now()}@example.com`;

  const inviteRes = await request("POST", "/api/invitations", {
    Authorization: `Bearer ${adminToken}`,
  }, { email });
  assert.strictEqual(inviteRes.status, 201);

  const url = new URL(inviteRes.body.inviteLink);
  const token = url.searchParams.get("token");

  const dupRegisterRes = await request("POST", `/api/invitations/${token}/accept`, {}, {
    name: "Dup User",
    password: "somepass123",
    confirmPassword: "somepass123",
  });
  assert.strictEqual(dupRegisterRes.status, 201);

  const secondAttempt = await request("POST", `/api/invitations/${token}/accept`, {}, {
    name: "Dup User 2",
    password: "somepass123",
    confirmPassword: "somepass123",
  });
  assert.strictEqual(secondAttempt.status, 404);
  assert.ok(secondAttempt.body.message.includes("not found, expired, or already used"));
});

test("invitations: invited email cannot be changed", async () => {
  const email = `changeless-${Date.now()}@example.com`;
  const inviteRes = await request("POST", "/api/invitations", {
    Authorization: `Bearer ${adminToken}`,
  }, { email });
  assert.strictEqual(inviteRes.status, 201);

  const url = new URL(inviteRes.body.inviteLink);
  const token = url.searchParams.get("token");

  const lookupRes = await request("GET", `/api/invitations/${token}`);
  assert.strictEqual(lookupRes.status, 200);
  assert.strictEqual(lookupRes.body.email, email.toLowerCase());
});

test("invitations: expired invitation cannot be accepted", async () => {
  const email = `expired-${Date.now()}@example.com`;

  const inviteRes = await request("POST", "/api/invitations", {
    Authorization: `Bearer ${adminToken}`,
  }, { email });
  assert.strictEqual(inviteRes.status, 201);

  const url = new URL(inviteRes.body.inviteLink);
  const token = url.searchParams.get("token");

  const invitationsFile = path.join(__dirname, "..", "backend", "data", "invitations.json");
  const parsed = JSON.parse(fs.readFileSync(invitationsFile, "utf8"));
  const idx = parsed.findIndex((i) => i.email === email.toLowerCase());
  assert.ok(idx !== -1, "Invitation should exist in data store");

  parsed[idx].expiresAt = new Date(Date.now() - 1000).toISOString();
  fs.writeFileSync(invitationsFile, JSON.stringify(parsed, null, 2));

  const lookupRes = await request("GET", `/api/invitations/${token}`);
  assert.strictEqual(lookupRes.status, 404);
  assert.ok(lookupRes.body.message.includes("not found, expired, or already used"));

  const acceptRes = await request("POST", `/api/invitations/${token}/accept`, {}, {
    name: "Expired User",
    password: "expiredpass123",
    confirmPassword: "expiredpass123",
  });
  assert.strictEqual(acceptRes.status, 404);
  assert.ok(acceptRes.body.message.includes("not found, expired, or already used"));

  const updated = JSON.parse(fs.readFileSync(invitationsFile, "utf8"));
  const inv = updated.find((i) => i.email === email.toLowerCase());
  assert.ok(inv, "Invitation should still exist");
  assert.strictEqual(inv.used, false, "Invitation should not be marked as used");
});
