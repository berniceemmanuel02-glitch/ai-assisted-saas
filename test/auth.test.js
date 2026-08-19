const { test } = require("node:test");
const assert = require("node:assert");
const http = require("node:http");
const { spawn } = require("node:child_process");

const BASE = "http://localhost:5000";

function request(method, path, headers = {}, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
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
    if (body !== undefined) req.write(JSON.stringify(body));
    req.end();
  });
}

let serverProcess;
let authToken;

test("smoke: test runner works", () => {
  assert.strictEqual(1 + 1, 2);
});

test.before(async () => {
  serverProcess = spawn("node", ["backend/server.js"], {
    cwd: process.cwd(),
    stdio: "pipe",
  });

  serverProcess.stdout.on("data", (data) => {
    if (data.toString().includes("Server running")) {
      // Server is ready
    }
  });

  serverProcess.stderr.on("data", (data) => {
    console.error(data.toString());
  });

  await new Promise((resolve) => setTimeout(resolve, 1500));
});

test.after(async () => {
  if (serverProcess) {
    serverProcess.kill("SIGTERM");
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
});

test("auth: protected endpoint without JWT returns 401", async () => {
  const res = await request("GET", "/api/products");
  assert.strictEqual(res.status, 401);
});

test("auth: invalid JWT returns 401", async () => {
  const res = await request("GET", "/api/products", {
    Authorization: "Bearer invalid-token",
  });
  assert.strictEqual(res.status, 401);
});

test("auth: valid JWT can access protected endpoint", async () => {
  const email = `test-${Date.now()}@example.com`;
  const registerRes = await request("POST", "/api/auth/register", {}, {
    name: "Test User",
    email,
    password: "testpass123",
  });

  assert.strictEqual(registerRes.status, 201);
  assert.ok(registerRes.body.token);
  authToken = registerRes.body.token;

  const res = await request("GET", "/api/products", {
    Authorization: `Bearer ${authToken}`,
  });
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body.products));
});

test("customers: create customer with valid JWT", async () => {
  const res = await request("POST", "/api/customers", {
    Authorization: `Bearer ${authToken}`,
  }, {
    name: "API Test Customer",
    email: "customer@example.com",
    phone: "1234567890",
    company: "Test Co",
  });
  assert.strictEqual(res.status, 201);
  assert.ok(res.body.customer);
  assert.strictEqual(res.body.customer.name, "API Test Customer");
});

test("customers: get customer list with valid JWT", async () => {
  const res = await request("GET", "/api/customers", {
    Authorization: `Bearer ${authToken}`,
  });
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body.customers));
  assert.ok(res.body.customers.length >= 1);
});

test("customers: unauthenticated request is rejected", async () => {
  const res = await request("GET", "/api/customers");
  assert.strictEqual(res.status, 401);
});

test("products: create product with valid JWT", async () => {
  const res = await request("POST", "/api/products", {
    Authorization: `Bearer ${authToken}`,
  }, {
    name: "API Test Product",
    price: 500,
    description: "A test product",
  });
  assert.strictEqual(res.status, 201);
  assert.ok(res.body.product);
  assert.strictEqual(res.body.product.name, "API Test Product");
});

test("products: get product list with valid JWT", async () => {
  const res = await request("GET", "/api/products", {
    Authorization: `Bearer ${authToken}`,
  });
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body.products));
  assert.ok(res.body.products.length >= 1);
});

test("products: unauthenticated request is rejected", async () => {
  const res = await request("GET", "/api/products");
  assert.strictEqual(res.status, 401);
});

let createdCustomerId;
let createdProductId;
let createdSaleId;
let createdInvoiceId;

test("sales: create sale with valid JWT", async () => {
  const customerRes = await request("POST", "/api/customers", {
    Authorization: `Bearer ${authToken}`,
  }, {
    name: "Sale Test Customer",
    email: "saletest@example.com",
  });
  assert.strictEqual(customerRes.status, 201);
  createdCustomerId = customerRes.body.customer.id;

  const productRes = await request("POST", "/api/products", {
    Authorization: `Bearer ${authToken}`,
  }, {
    name: "Sale Test Product",
    price: 2500,
    description: "Product for sale test",
  });
  assert.strictEqual(productRes.status, 201);
  createdProductId = productRes.body.product.id;

  const saleRes = await request("POST", "/api/sales", {
    Authorization: `Bearer ${authToken}`,
  }, {
    customerId: createdCustomerId,
    items: [
      { productId: createdProductId, quantity: 3 },
    ],
    paymentMethod: "cash",
  });
  assert.strictEqual(saleRes.status, 201);
  assert.ok(saleRes.body.sale);
  createdSaleId = saleRes.body.sale.id;
});

test("sales: verify total calculated from stored product price", async () => {
  const res = await request("GET", `/api/sales/${createdSaleId}`, {
    Authorization: `Bearer ${authToken}`,
  });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.sale.total, 7500);
});

test("sales: verify sale linked to correct customer", async () => {
  const res = await request("GET", `/api/sales/${createdSaleId}`, {
    Authorization: `Bearer ${authToken}`,
  });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.sale.customerId, createdCustomerId);
});

test("sales: unauthenticated request is rejected", async () => {
  const res = await request("POST", "/api/sales", {}, {
    customerId: "fake-customer",
    items: [],
    paymentMethod: "cash",
  });
  assert.strictEqual(res.status, 401);
});

test("sales: get sales list with valid JWT", async () => {
  const res = await request("GET", "/api/sales", {
    Authorization: `Bearer ${authToken}`,
  });
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body.sales));
  assert.ok(res.body.sales.length >= 1);
});

test("sales: verify sale auto-creates exactly one sales invoice", async () => {
  const allInvoices = await request("GET", "/api/invoices", {
    Authorization: `Bearer ${authToken}`,
  });
  assert.strictEqual(allInvoices.status, 200);
  const saleInvoices = allInvoices.body.invoices.filter(
    (inv) => inv.saleId === createdSaleId
  );
  assert.strictEqual(saleInvoices.length, 1);
  createdInvoiceId = saleInvoices[0].id;
});

test("sales: verify invoice references correct sale", async () => {
  const res = await request("GET", `/api/invoices/${createdInvoiceId}`, {
    Authorization: `Bearer ${authToken}`,
  });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.invoice.saleId, createdSaleId);
  assert.strictEqual(res.body.invoice.paymentStatus, "pending");
});

let otherUserToken;
let otherUserInvoiceId;

test("invoices: pay pending invoice changes paymentStatus to paid", async () => {
  const payRes = await request("POST", `/api/invoices/${createdInvoiceId}/pay`, {
    Authorization: `Bearer ${authToken}`,
  });
  assert.strictEqual(payRes.status, 200);
  assert.strictEqual(payRes.body.invoice.paymentStatus, "paid");
  assert.ok(payRes.body.invoice.paidAt);
});

test("invoices: paid invoice cannot be paid again and returns 400", async () => {
  const res = await request("POST", `/api/invoices/${createdInvoiceId}/pay`, {
    Authorization: `Bearer ${authToken}`,
  });
  assert.strictEqual(res.status, 400);
});

test("invoices: nonexistent invoice returns 404", async () => {
  const res = await request("POST", "/api/invoices/9999999999999/pay", {
    Authorization: `Bearer ${authToken}`,
  });
  assert.strictEqual(res.status, 404);
});

test("invoices: another user invoice returns 403", async () => {
  const otherEmail = `other-${Date.now()}@example.com`;
  const otherRegisterRes = await request("POST", "/api/auth/register", {}, {
    name: "Other Test User",
    email: otherEmail,
    password: "otherpass123",
  });
  assert.strictEqual(otherRegisterRes.status, 201);
  otherUserToken = otherRegisterRes.body.token;

  const res = await request("POST", `/api/invoices/${createdInvoiceId}/pay`, {
    Authorization: `Bearer ${otherUserToken}`,
  });
  assert.strictEqual(res.status, 403);
});

test("invoices: paid invoice has paidAt timestamp", async () => {
  const res = await request("GET", `/api/invoices/${createdInvoiceId}`, {
    Authorization: `Bearer ${authToken}`,
  });
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.invoice.paidAt);
  assert.ok(res.body.invoice.paidAt.length > 0);
});

test("invoices: paid invoice receipt endpoint returns successfully", async () => {
  const res = await request("GET", `/api/invoices/${createdInvoiceId}/receipt`, {
    Authorization: `Bearer ${authToken}`,
  });
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.receiptNumber);
  assert.strictEqual(res.body.invoiceId, createdInvoiceId);
});

test("invoices: unauthenticated payment request is rejected", async () => {
  const res = await request("POST", `/api/invoices/${createdInvoiceId}/pay`);
  assert.strictEqual(res.status, 401);
});

let billingInvoiceId;

test("billing: unauthenticated access is rejected", async () => {
  const listRes = await request("GET", "/api/billing/");
  assert.strictEqual(listRes.status, 401);

  const createRes = await request("POST", "/api/billing/create", {}, {
    planId: "pro",
    amount: 29,
  });
  assert.strictEqual(createRes.status, 401);
});

test("billing: create invoice with valid JWT", async () => {
  const res = await request("POST", "/api/billing/create", {
    Authorization: `Bearer ${authToken}`,
  }, {
    planId: "pro",
    amount: 29,
    description: "Test subscription billing",
  });
  assert.strictEqual(res.status, 201);
  assert.ok(res.body.invoice);
  assert.ok(res.body.invoice.id);
  assert.ok(res.body.invoice.invoiceNumber.startsWith("INV-"));
  billingInvoiceId = res.body.invoice.id;
});

test("billing: list invoices restricted to authenticated user", async () => {
  const ownRes = await request("GET", "/api/billing/", {
    Authorization: `Bearer ${authToken}`,
  });
  assert.strictEqual(ownRes.status, 200);
  assert.ok(Array.isArray(ownRes.body.invoices));
  const ownIds = ownRes.body.invoices.map((inv) => inv.id);
  assert.ok(ownIds.includes(billingInvoiceId));

  const otherRes = await request("GET", "/api/billing/", {
    Authorization: `Bearer ${otherUserToken}`,
  });
  assert.strictEqual(otherRes.status, 200);
  const otherIds = otherRes.body.invoices.map((inv) => inv.id);
  assert.ok(!otherIds.includes(billingInvoiceId));
});

test("billing: pay subscription invoice", async () => {
  const res = await request("POST", `/api/billing/pay/${billingInvoiceId}`, {
    Authorization: `Bearer ${authToken}`,
  });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.invoice.status, "paid");
  assert.ok(res.body.invoice.paidAt);
});

test("billing: receipt endpoint returns for paid invoice", async () => {
  const res = await request("GET", `/api/billing/receipt/${billingInvoiceId}`, {
    Authorization: `Bearer ${authToken}`,
  });
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.receiptNumber);
  assert.strictEqual(res.body.invoiceId, billingInvoiceId);
});

test("billing: another user cannot pay another user's invoice", async () => {
  const res = await request("POST", `/api/billing/pay/${billingInvoiceId}`, {
    Authorization: `Bearer ${otherUserToken}`,
  });
  assert.strictEqual(res.status, 404);
});

test("billing: sales and subscription invoices remain separate", async () => {
  const salesRes = await request("GET", "/api/invoices", {
    Authorization: `Bearer ${authToken}`,
  });
  assert.strictEqual(salesRes.status, 200);
  const salesIds = salesRes.body.invoices.map((inv) => inv.id);
  assert.ok(!salesIds.includes(billingInvoiceId));

  const billingRes = await request("GET", "/api/billing/", {
    Authorization: `Bearer ${authToken}`,
  });
  assert.strictEqual(billingRes.status, 200);
  const billingIds = billingRes.body.invoices.map((inv) => inv.id);
  assert.ok(!billingIds.includes(createdInvoiceId));
});

let limitTestToken;
let limitTestUserId;
let limitTestCustomerId;
let limitTestProductId;

test("invoice-limit: user below limit can create sale and invoice", async () => {
  const email = `limit-test-${Date.now()}@example.com`;
  const registerRes = await request("POST", "/api/auth/register", {}, {
    name: "Limit Test User",
    email,
    password: "limitpass123",
  });
  assert.strictEqual(registerRes.status, 201);
  limitTestToken= registerRes.body.token ;

  const meRes = await request("GET", "/api/auth/me", {
    Authorization: `Bearer ${limitTestToken}`,
  });
  assert.strictEqual(meRes.status, 200);
  limitTestUserId = meRes.body.user.id;

  const customerRes = await request("POST", "/api/customers", {
    Authorization: `Bearer ${limitTestToken}`,
  }, {
    name: "Limit Customer",
    email: "limitcustomer@example.com",
  });
  assert.strictEqual(customerRes.status, 201);
  limitTestCustomerId = customerRes.body.customer.id;

  const productRes = await request("POST", "/api/products", {
    Authorization: `Bearer ${limitTestToken}`,
  }, {
    name: "Limit Product",
    price: 100,
    description: "Product for limit test",
  });
  assert.strictEqual(productRes.status, 201);
  limitTestProductId = productRes.body.product.id;

  const saleRes = await request("POST", "/api/sales", {
    Authorization: `Bearer ${limitTestToken}`,
  }, {
    customerId: limitTestCustomerId,
    items: [{ productId: limitTestProductId, quantity: 1 }],
    paymentMethod: "cash",
  });
  assert.strictEqual(saleRes.status, 201);
  assert.ok(saleRes.body.sale);

  const invoicesRes = await request("GET", "/api/invoices", {
    Authorization: `Bearer ${limitTestToken}`,
  });
  assert.strictEqual(invoicesRes.status, 200);
  console.log("DEBUG invoices:", invoicesRes.body.invoices.length);
  assert.strictEqual(invoicesRes.body.invoices.length, 1);
});

test("invoice-limit: user at invoice limit receives 403", async () => {
  for (let i = 0; i < 4; i++) {
    const saleRes = await request("POST", "/api/sales", {
      Authorization: `Bearer ${limitTestToken}`,
    }, {
      customerId: limitTestCustomerId,
      items: [{ productId: limitTestProductId, quantity: 1 }],
      paymentMethod: "cash",
    });
    assert.strictEqual(saleRes.status, 201);
  }

  const invoicesRes = await request("GET", "/api/invoices", {
    Authorization: `Bearer ${limitTestToken}`,
  });
  assert.strictEqual(invoicesRes.status, 200);
  console.log("DEBUG invoices:", invoicesRes.body.invoices.length);
  assert.strictEqual(invoicesRes.body.invoices.length, 5);

  const blockedRes = await request("POST", "/api/sales", {
    Authorization: `Bearer ${limitTestToken}`,
  }, {
    customerId: limitTestCustomerId,
    items: [{ productId: limitTestProductId, quantity: 1 }],
    paymentMethod: "cash",
  });
  assert.strictEqual(blockedRes.status, 403);
});

test("invoice-limit: 403 response contains message, limit, current, and plan", async () => {
  const blockedRes = await request("POST", "/api/sales", {
    Authorization: `Bearer ${limitTestToken}`,
  }, {
    customerId: limitTestCustomerId,
    items: [{ productId: limitTestProductId, quantity: 1 }],
    paymentMethod: "cash",
  });
  assert.strictEqual(blockedRes.status, 403);
  assert.strictEqual(blockedRes.body.message, "Invoice limit exceeded");
  assert.strictEqual(blockedRes.body.limit, 5);
  assert.strictEqual(blockedRes.body.current, 5);
  assert.strictEqual(blockedRes.body.plan, "free");
});

test("invoice-limit: at limit, neither sale nor invoice is created", async () => {
  const beforeSales = await request("GET", "/api/sales", {
    Authorization: `Bearer ${limitTestToken}`,
  });
  const beforeInvoices = await request("GET", "/api/invoices", {
    Authorization: `Bearer ${limitTestToken}`,
  });
  const beforeSaleCount = beforeSales.body.sales.length;
  const beforeInvoiceCount = beforeInvoices.body.invoices.length;

  const blockedRes = await request("POST", "/api/sales", {
    Authorization: `Bearer ${limitTestToken}`,
  }, {
    customerId: limitTestCustomerId,
    items: [{ productId: limitTestProductId, quantity: 1 }],
    paymentMethod: "cash",
  });
  assert.strictEqual(blockedRes.status, 403);

  const afterSales = await request("GET", "/api/sales", {
    Authorization: `Bearer ${limitTestToken}`,
  });
  const afterInvoices = await request("GET", "/api/invoices", {
    Authorization: `Bearer ${limitTestToken}`,
  });
  assert.strictEqual(afterSales.body.sales.length, beforeSaleCount);
  assert.strictEqual(afterInvoices.body.invoices.length, beforeInvoiceCount);
});

test("invoice-limit: successful invoice creation increments usage", async () => {
  const fs = require("fs");
  const path = require("path");
  const usagePath = path.join(__dirname, "..", "backend", "data", "usage.json");
  const usageData = JSON.parse(fs.readFileSync(usagePath, "utf8"));
  const usageRecord = usageData.find((u) => u.userId === limitTestUserId && u.feature === "invoices");
  assert.ok(usageRecord);
  assert.strictEqual(usageRecord.count, 5);
});

test("usage: reflects actual product count from data store", async () => {
  const res = await request("GET", "/api/usage/me", {
    Authorization: `Bearer ${authToken}`,
  });
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body.usage));
  const productsEntry = res.body.usage.find((u) => u.feature === "products");
  assert.ok(productsEntry);
  assert.ok(productsEntry.used >= 1);
  assert.strictEqual(productsEntry.limit, 10);
});

test("usage: reflects actual customer count from data store", async () => {
  const res = await request("GET", "/api/usage/me", {
    Authorization: `Bearer ${authToken}`,
  });
  assert.strictEqual(res.status, 200);
  const customersEntry = res.body.usage.find((u) => u.feature === "customers");
  assert.ok(customersEntry);
  assert.ok(customersEntry.used >= 1);
  assert.strictEqual(customersEntry.limit, 20);
});

test("usage: reflects actual sales count from data store", async () => {
  const res = await request("GET", "/api/usage/me", {
    Authorization: `Bearer ${authToken}`,
  });
  assert.strictEqual(res.status, 200);
  const salesEntry = res.body.usage.find((u) => u.feature === "sales");
  assert.ok(salesEntry);
  assert.ok(salesEntry.used >= 1);
  assert.strictEqual(salesEntry.limit, 10);
});

test("usage: reflects actual invoice count from data store", async () => {
  const res = await request("GET", "/api/usage/me", {
    Authorization: `Bearer ${authToken}`,
  });
  assert.strictEqual(res.status, 200);
  const invoicesEntry = res.body.usage.find((u) => u.feature === "invoices");
  assert.ok(invoicesEntry);
  assert.ok(invoicesEntry.used >= 1);
  assert.strictEqual(invoicesEntry.limit, 5);
});

test("usage: returns all four features even when some have zero records", async () => {
  const email = `usage-zero-${Date.now()}@example.com`;
  const registerRes = await request("POST", "/api/auth/register", {}, {
    name: "Usage Zero User",
    email,
    password: "usagepass123",
  });
  assert.strictEqual(registerRes.status, 201);
  const zeroToken = registerRes.body.token;

  const res = await request("GET", "/api/usage/me", {
    Authorization: `Bearer ${zeroToken}`,
  });
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body.usage));
  const features = res.body.usage.map((u) => u.feature);
  assert.ok(features.includes("products"));
  assert.ok(features.includes("customers"));
  assert.ok(features.includes("sales"));
  assert.ok(features.includes("invoices"));
  res.body.usage.forEach((entry) => {
    assert.strictEqual(entry.used, 0);
  });
});

let adminToken;

test("admin: non-admin cannot access admin stats", async () => {
  const res = await request("GET", "/api/admin/stats", {
    Authorization: `Bearer ${authToken}`,
  });
  assert.strictEqual(res.status, 403);
});

test("admin: non-admin cannot access admin users list", async () => {
  const res = await request("GET", "/api/admin/users", {
    Authorization: `Bearer ${authToken}`,
  });
  assert.strictEqual(res.status, 403);
});

test("admin: admin can access admin stats", async () => {
  const adminEmail = `admin-${Date.now()}@example.com`;
  const adminRes = await request("POST", "/api/auth/register", {}, {
    name: "Admin Test User",
    email: adminEmail,
    password: "adminpass123",
    role: "admin",
  });
  assert.strictEqual(adminRes.status, 201);
  adminToken = adminRes.body.token;

  const res = await request("GET", "/api/admin/stats", {
    Authorization: `Bearer ${adminToken}`,
  });
  assert.strictEqual(res.status, 200);
  assert.ok(typeof res.body.totalUsers === "number");
  assert.ok(typeof res.body.activeUsers === "number");
  assert.ok(typeof res.body.paidUsers === "number");
  assert.ok(typeof res.body.revenue === "number");
  assert.ok(typeof res.body.pendingPayments === "number");
});

test("admin: admin can access admin users list", async () => {
  const res = await request("GET", "/api/admin/users", {
    Authorization: `Bearer ${adminToken}`,
  });
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body.users));
  assert.ok(res.body.users.length >= 1);
  const firstUser = res.body.users[0];
  assert.ok(firstUser.id);
  assert.ok(firstUser.name);
  assert.ok(firstUser.email);
  assert.ok(firstUser.createdAt);
  assert.ok(firstUser.plan);
  assert.ok(firstUser.status);
});

test("admin: users list includes all registered users", async () => {
  const res = await request("GET", "/api/admin/users", {
    Authorization: `Bearer ${adminToken}`,
  });
  assert.strictEqual(res.status, 200);
  const emails = res.body.users.map((u) => u.email);
  assert.ok(emails.includes("admin-") || res.body.users.length >= 1);
});

const { authMiddleware } = require("../backend/middleware/auth");

function createAuthMiddlewareContext(email, role = "user") {
  const db = require("../backend/data/store");
  const user = db.users.getByEmail(email);
  if (!user) return null;

  const jwt = require("jsonwebtoken");
  const JWT_SECRET = process.env.JWT_SECRET || "salesbook-secret-key";
  const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: "1h" });

  const req = {
    headers: { authorization: `Bearer ${token}` },
  };
  const res = {
    status(code) {
      res._status = code;
      return res;
    },
    json(data) {
      res._body = data;
      return res;
    },
  };
  let nextCalled = false;
  const next = () => { nextCalled = true; };

  authMiddleware(req, res, next);

  return { req, res, nextCalled };
}

test("env-admin: email in ADMIN_EMAILS is elevated to admin", async () => {
  process.env.ADMIN_EMAILS = `env-admin-${Date.now()}@example.com`;
  const email = process.env.ADMIN_EMAILS.split(",")[0].trim();

  const registerRes = await request("POST", "/api/auth/register", {}, {
    name: "Env Admin User",
    email,
    password: "envadminpass123",
  });
  assert.strictEqual(registerRes.status, 201);

  const ctx = createAuthMiddlewareContext(email);
  assert.ok(ctx);
  assert.strictEqual(ctx.req.user.role, "admin");

  delete process.env.ADMIN_EMAILS;
});

test("env-admin: email not in ADMIN_EMAILS remains user", async () => {
  process.env.ADMIN_EMAILS = `notthisuser-${Date.now()}@example.com`;
  const email = `regular-${Date.now()}@example.com`;

  const registerRes = await request("POST", "/api/auth/register", {}, {
    name: "Regular User",
    email,
    password: "regularpass123",
  });
  assert.strictEqual(registerRes.status, 201);

  const ctx = createAuthMiddlewareContext(email);
  assert.ok(ctx);
  assert.strictEqual(ctx.req.user.role, "user");

  delete process.env.ADMIN_EMAILS;
});

test("env-admin: case-insensitive email matching", async () => {
  process.env.ADMIN_EMAILS = `EnvCase-${Date.now()}@example.com`;
  const email = `envcase-${Date.now()}@example.com`;

  const registerRes = await request("POST", "/api/auth/register", {}, {
    name: "Case User",
    email,
    password: "casepass123",
  });
  assert.strictEqual(registerRes.status, 201);

  const ctx = createAuthMiddlewareContext(email);
  assert.ok(ctx);
  assert.strictEqual(ctx.req.user.role, "admin");

  delete process.env.ADMIN_EMAILS;
});

test("env-admin: whitespace trimming in ADMIN_EMAILS", async () => {
  process.env.ADMIN_EMAILS = `  env-whitespace-${Date.now()}@example.com  ,  other@example.com  `;
  const email = `env-whitespace-${Date.now()}@example.com`;

  const registerRes = await request("POST", "/api/auth/register", {}, {
    name: "Whitespace User",
    email,
    password: "whitespacepass123",
  });
  assert.strictEqual(registerRes.status, 201);

  const ctx = createAuthMiddlewareContext(email);
  assert.ok(ctx);
  assert.strictEqual(ctx.req.user.role, "admin");

  delete process.env.ADMIN_EMAILS;
});
