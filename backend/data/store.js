const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const FILES = {
  users: path.join(DATA_DIR, "users.json"),
  subscriptions: path.join(DATA_DIR, "subscriptions.json"),
  invoices: path.join(DATA_DIR, "invoices.json"),
  usage: path.join(DATA_DIR, "usage.json"),
  products: path.join(DATA_DIR, "products.json"),
  customers: path.join(DATA_DIR, "customers.json"),
  sales: path.join(DATA_DIR, "sales.json"),
  salesInvoices: path.join(DATA_DIR, "sales-invoices.json"),
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function load(file) {
  ensureDataDir();
  if (!fs.existsSync(file)) return [];
  try {
    const data = fs.readFileSync(file, "utf8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function save(file, data) {
  ensureDataDir();
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function mapUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    password: row.password,
    role: row.role,
    createdAt: row.created_at,
    lastLogin: row.last_login,
  };
}

function mapSubscription(row) {
  return {
    id: row.id,
    userId: row.user_id,
    planId: row.plan_id,
    status: row.status,
    startDate: row.start_date,
    endDate: row.end_date,
  };
}

function mapInvoice(row) {
  return {
    id: row.id,
    userId: row.user_id,
    invoiceNumber: row.invoice_number,
    planId: row.plan_id,
    amount: parseFloat(row.amount),
    currency: row.currency,
    description: row.description,
    status: row.status,
    paidAt: row.paid_at,
    createdAt: row.created_at,
  };
}

function mapUsage(row) {
  return {
    userId: row.user_id,
    feature: row.feature,
    count: row.count,
  };
}

function mapProduct(row) {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    price: parseFloat(row.price),
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCustomer(row) {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    company: row.company,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSale(row) {
  return {
    id: row.id,
    userId: row.user_id,
    customerId: row.customer_id,
    items: row.items || [],
    total: parseFloat(row.total),
    paymentMethod: row.payment_method,
    date: row.date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSalesInvoice(row) {
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    userId: row.user_id,
    saleId: row.sale_id,
    customerId: row.customer_id,
    items: row.items || [],
    subtotal: parseFloat(row.subtotal),
    total: parseFloat(row.total),
    paymentStatus: row.payment_status,
    issueDate: row.issue_date,
    paidAt: row.paid_at,
    createdAt: row.created_at,
  };
}

const usePg = process.env.DATABASE_URL === true || process.env.DATABASE_URL !== undefined;

if (usePg) {
  const { Pool } = require("pg");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  const db = {
    users: {
      getAll: async () => {
        const res = await pool.query("SELECT * FROM users");
        return res.rows.map(mapUser);
      },
      getById: async (id) => {
        const res = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
        return res.rows[0] ? mapUser(res.rows[0]) : undefined;
      },
      getByEmail: async (email) => {
        const res = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        return res.rows[0] ? mapUser(res.rows[0]) : undefined;
      },
      create: async (user) => {
        const res = await pool.query(
          `INSERT INTO users (id, name, email, password, role, created_at, last_login)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [user.id, user.name, user.email, user.password, user.role || "user", user.createdAt, user.lastLogin || null]
        );
        return mapUser(res.rows[0]);
      },
    },
    subscriptions: {
      getAll: async () => {
        const res = await pool.query("SELECT * FROM subscriptions");
        return res.rows.map(mapSubscription);
      },
      getByUserId: async (userId) => {
        const res = await pool.query("SELECT * FROM subscriptions WHERE user_id = $1", [userId]);
        return res.rows[0] ? mapSubscription(res.rows[0]) : undefined;
      },
      create: async (sub) => {
        const res = await pool.query(
          `INSERT INTO subscriptions (user_id, plan_id, status, start_date, end_date)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [sub.userId, sub.planId, sub.status, sub.startDate, sub.endDate]
        );
        return mapSubscription(res.rows[0]);
      },
      update: async (userId, data) => {
        const res = await pool.query(
          `UPDATE subscriptions SET plan_id = $1, status = $2, start_date = $3, end_date = $4
           WHERE user_id = $5
           RETURNING *`,
          [data.planId, data.status, data.startDate, data.endDate, userId]
        );
        return res.rows[0] ? mapSubscription(res.rows[0]) : null;
      },
    },
    invoices: {
      getAll: async () => {
        const res = await pool.query("SELECT * FROM invoices");
        return res.rows.map(mapInvoice);
      },
      getByUserId: async (userId) => {
        const res = await pool.query("SELECT * FROM invoices WHERE user_id = $1", [userId]);
        return res.rows.map(mapInvoice);
      },
      create: async (invoice) => {
        const res = await pool.query(
          `INSERT INTO invoices (id, user_id, invoice_number, plan_id, amount, currency, description, status, paid_at, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING *`,
          [invoice.id, invoice.userId, invoice.invoiceNumber, invoice.planId, invoice.amount, invoice.currency || "USD", invoice.description || null, invoice.status, invoice.paidAt || null, invoice.createdAt]
        );
        return mapInvoice(res.rows[0]);
      },
    },
    usage: {
      getAll: async () => {
        const res = await pool.query("SELECT * FROM usage");
        return res.rows.map(mapUsage);
      },
      getByUserIdAndFeature: async (userId, feature) => {
        const res = await pool.query("SELECT * FROM usage WHERE user_id = $1 AND feature = $2", [userId, feature]);
        return res.rows[0] ? mapUsage(res.rows[0]) : undefined;
      },
      increment: async (userId, feature, amount = 1) => {
        const res = await pool.query(
          `INSERT INTO usage (user_id, feature, count) VALUES ($1, $2, $3)
           ON CONFLICT (user_id, feature) DO UPDATE SET count = usage.count + $3
           RETURNING *`,
          [userId, feature, amount]
        );
        return mapUsage(res.rows[0]);
      },
      reset: async (userId) => {
        await pool.query("DELETE FROM usage WHERE user_id = $1", [userId]);
      },
    },
    products: {
      getAll: async () => {
        const res = await pool.query("SELECT * FROM products");
        return res.rows.map(mapProduct);
      },
      getById: async (id) => {
        const res = await pool.query("SELECT * FROM products WHERE id = $1", [id]);
        return res.rows[0] ? mapProduct(res.rows[0]) : undefined;
      },
      getByUserId: async (userId) => {
        const res = await pool.query("SELECT * FROM products WHERE user_id = $1", [userId]);
        return res.rows.map(mapProduct);
      },
      create: async (product) => {
        const res = await pool.query(
          `INSERT INTO products (id, user_id, name, price, description, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [product.id, product.userId, product.name, product.price, product.description || null, product.createdAt, product.updatedAt || product.createdAt]
        );
        return mapProduct(res.rows[0]);
      },
      update: async (id, data) => {
        const res = await pool.query(
          `UPDATE products SET name = $1, price = $2, description = $3, updated_at = $4
           WHERE id = $5
           RETURNING *`,
          [data.name, data.price, data.description || null, data.updatedAt || new Date().toISOString(), id]
        );
        return res.rows[0] ? mapProduct(res.rows[0]) : null;
      },
      delete: async (id) => {
        const res = await pool.query("DELETE FROM products WHERE id = $1 RETURNING id", [id]);
        return res.rowCount > 0;
      },
    },
    customers: {
      getAll: async () => {
        const res = await pool.query("SELECT * FROM customers");
        return res.rows.map(mapCustomer);
      },
      getById: async (id) => {
        const res = await pool.query("SELECT * FROM customers WHERE id = $1", [id]);
        return res.rows[0] ? mapCustomer(res.rows[0]) : undefined;
      },
      getByUserId: async (userId) => {
        const res = await pool.query("SELECT * FROM customers WHERE user_id = $1", [userId]);
        return res.rows.map(mapCustomer);
      },
      create: async (customer) => {
        const res = await pool.query(
          `INSERT INTO customers (id, user_id, name, email, phone, company, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *`,
          [customer.id, customer.userId, customer.name, customer.email || null, customer.phone || null, customer.company || null, customer.createdAt, customer.updatedAt || customer.createdAt]
        );
        return mapCustomer(res.rows[0]);
      },
      update: async (id, data) => {
        const res = await pool.query(
          `UPDATE customers SET name = $1, email = $2, phone = $3, company = $4, updated_at = $5
           WHERE id = $6
           RETURNING *`,
          [data.name, data.email || null, data.phone || null, data.company || null, data.updatedAt || new Date().toISOString(), id]
        );
        return res.rows[0] ? mapCustomer(res.rows[0]) : null;
      },
      delete: async (id) => {
        const res = await pool.query("DELETE FROM customers WHERE id = $1 RETURNING id", [id]);
        return res.rowCount > 0;
      },
    },
    sales: {
      getAll: async () => {
        const res = await pool.query("SELECT * FROM sales");
        return res.rows.map(mapSale);
      },
      getById: async (id) => {
        const res = await pool.query("SELECT * FROM sales WHERE id = $1", [id]);
        return res.rows[0] ? mapSale(res.rows[0]) : undefined;
      },
      getByUserId: async (userId) => {
        const res = await pool.query("SELECT * FROM sales WHERE user_id = $1", [userId]);
        return res.rows.map(mapSale);
      },
      create: async (sale) => {
        const res = await pool.query(
          `INSERT INTO sales (id, user_id, customer_id, items, total, payment_method, date, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING *`,
          [sale.id, sale.userId, sale.customerId, JSON.stringify(sale.items || []), sale.total, sale.paymentMethod, sale.date, sale.createdAt, sale.updatedAt || sale.date]
        );
        return mapSale(res.rows[0]);
      },
    },
    salesInvoices: {
      getAll: async () => {
        const res = await pool.query("SELECT * FROM sales_invoices");
        return res.rows.map(mapSalesInvoice);
      },
      getById: async (id) => {
        const res = await pool.query("SELECT * FROM sales_invoices WHERE id = $1", [id]);
        return res.rows[0] ? mapSalesInvoice(res.rows[0]) : undefined;
      },
      getByUserId: async (userId) => {
        const res = await pool.query("SELECT * FROM sales_invoices WHERE user_id = $1", [userId]);
        return res.rows.map(mapSalesInvoice);
      },
      getBySaleId: async (saleId) => {
        const res = await pool.query("SELECT * FROM sales_invoices WHERE sale_id = $1", [saleId]);
        return res.rows[0] ? mapSalesInvoice(res.rows[0]) : undefined;
      },
      create: async (invoice) => {
        const res = await pool.query(
          `INSERT INTO sales_invoices (id, invoice_number, user_id, sale_id, customer_id, items, subtotal, total, payment_status, issue_date, paid_at, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           RETURNING *`,
          [invoice.id, invoice.invoiceNumber, invoice.userId, invoice.saleId, invoice.customerId, JSON.stringify(invoice.items || []), invoice.subtotal, invoice.total, invoice.paymentStatus || "pending", invoice.issueDate, invoice.paidAt || null, invoice.createdAt]
        );
        return mapSalesInvoice(res.rows[0]);
      },
      update: async (id, data) => {
        const res = await pool.query(
          `UPDATE sales_invoices SET payment_status = $1, paid_at = $2
           WHERE id = $3
           RETURNING *`,
          [data.paymentStatus, data.paidAt || null, id]
        );
        return res.rows[0] ? mapSalesInvoice(res.rows[0]) : null;
      },
    },
  };

  module.exports = db;
} else {
  const db = {
    users: {
      getAll: () => load(FILES.users),
      getById: (id) => load(FILES.users).find((u) => u.id === id),
      getByEmail: (email) => load(FILES.users).find((u) => u.email === email),
      create: (user) => {
        const users = load(FILES.users);
        users.push(user);
        save(FILES.users, users);
        return user;
      },
    },
    subscriptions: {
      getAll: () => load(FILES.subscriptions),
      getByUserId: (userId) => load(FILES.subscriptions).find((s) => s.userId === userId),
      create: (sub) => {
        const items = load(FILES.subscriptions);
        items.push(sub);
        save(FILES.subscriptions, items);
        return sub;
      },
      update: (userId, data) => {
        const items = load(FILES.subscriptions);
        const idx = items.findIndex((s) => s.userId === userId);
        if (idx === -1) return null;
        items[idx] = { ...items[idx], ...data };
        save(FILES.subscriptions, items);
        return items[idx];
      },
    },
    invoices: {
      getAll: () => load(FILES.invoices),
      getByUserId: (userId) => load(FILES.invoices).filter((i) => i.userId === userId),
      create: (invoice) => {
        const items = load(FILES.invoices);
        items.push(invoice);
        save(FILES.invoices, items);
        return invoice;
      },
    },
    usage: {
      getAll: () => load(FILES.usage),
      getByUserIdAndFeature: (userId, feature) => load(FILES.usage).find((u) => u.userId === userId && u.feature === feature),
      increment: (userId, feature, amount = 1) => {
        const items = load(FILES.usage);
        const idx = items.findIndex((u) => u.userId === userId && u.feature === feature);
        if (idx === -1) {
          items.push({ userId, feature, count: amount });
        } else {
          items[idx].count += amount;
        }
        save(FILES.usage, items);
        return items[idx >= 0 ? idx : items.length - 1];
      },
      reset: (userId) => {
        const items = load(FILES.usage).filter((u) => u.userId !== userId);
        save(FILES.usage, items);
      },
    },
    products: {
      getAll: () => load(FILES.products),
      getById: (id) => load(FILES.products).find((p) => p.id === id),
      getByUserId: (userId) => load(FILES.products).filter((p) => p.userId === userId),
      create: (product) => {
        const items = load(FILES.products);
        items.push(product);
        save(FILES.products, items);
        return product;
      },
      update: (id, data) => {
        const items = load(FILES.products);
        const idx = items.findIndex((p) => p.id === id);
        if (idx === -1) return null;
        items[idx] = { ...items[idx], ...data };
        save(FILES.products, items);
        return items[idx];
      },
      delete: (id) => {
        const items = load(FILES.products);
        const idx = items.findIndex((p) => p.id === id);
        if (idx === -1) return false;
        items.splice(idx, 1);
        save(FILES.products, items);
        return true;
      },
    },
    customers: {
      getAll: () => load(FILES.customers),
      getById: (id) => load(FILES.customers).find((c) => c.id === id),
      getByUserId: (userId) => load(FILES.customers).filter((c) => c.userId === userId),
      create: (customer) => {
        const items = load(FILES.customers);
        items.push(customer);
        save(FILES.customers, items);
        return customer;
      },
      update: (id, data) => {
        const items = load(FILES.customers);
        const idx = items.findIndex((c) => c.id === id);
        if (idx === -1) return null;
        items[idx] = { ...items[idx], ...data };
        save(FILES.customers, items);
        return items[idx];
      },
      delete: (id) => {
        const items = load(FILES.customers);
        const idx = items.findIndex((c) => c.id === id);
        if (idx === -1) return false;
        items.splice(idx, 1);
        save(FILES.customers, items);
        return true;
      },
    },
    sales: {
      getAll: () => load(FILES.sales),
      getById: (id) => load(FILES.sales).find((s) => s.id === id),
      getByUserId: (userId) => load(FILES.sales).filter((s) => s.userId === userId),
      create: (sale) => {
        const items = load(FILES.sales);
        items.push(sale);
        save(FILES.sales, items);
        return sale;
      },
    },
    salesInvoices: {
      getAll: () => load(FILES.salesInvoices),
      getById: (id) => load(FILES.salesInvoices).find((i) => i.id === id),
      getByUserId: (userId) => load(FILES.salesInvoices).filter((i) => i.userId === userId),
      getBySaleId: (saleId) => load(FILES.salesInvoices).find((i) => i.saleId === saleId),
      create: (invoice) => {
        const items = load(FILES.salesInvoices);
        items.push(invoice);
        save(FILES.salesInvoices, items);
        return invoice;
      },
      update: (id, data) => {
        const items = load(FILES.salesInvoices);
        const idx = items.findIndex((i) => i.id === id);
        if (idx === -1) return null;
        items[idx] = { ...items[idx], ...data };
        save(FILES.salesInvoices, items);
        return items[idx];
      },
    },
  };

  module.exports = db;
}
