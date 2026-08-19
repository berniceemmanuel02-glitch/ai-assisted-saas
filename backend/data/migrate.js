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

function load(file) {
  if (!fs.existsSync(file)) return [];
  try {
    const data = fs.readFileSync(file, "utf8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function migrate() {
  const { Pool } = require("pg");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  await pool.query("BEGIN");

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        created_at TIMESTAMP NOT NULL,
        last_login TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        user_id VARCHAR(255) PRIMARY KEY REFERENCES users(id),
        plan_id VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL,
        start_date TIMESTAMP NOT NULL,
        end_date TIMESTAMP NOT NULL
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL REFERENCES users(id),
        invoice_number VARCHAR(255) UNIQUE NOT NULL,
        plan_id VARCHAR(50) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'USD',
        description TEXT,
        status VARCHAR(50) NOT NULL,
        paid_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS usage (
        user_id VARCHAR(255) NOT NULL REFERENCES users(id),
        feature VARCHAR(50) NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (user_id, feature)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL REFERENCES users(id),
        name VARCHAR(255) NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        description TEXT,
        created_at TIMESTAMP NOT NULL,
        updated_at TIMESTAMP NOT NULL
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL REFERENCES users(id),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(50),
        company VARCHAR(255),
        created_at TIMESTAMP NOT NULL,
        updated_at TIMESTAMP NOT NULL
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS sales (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL REFERENCES users(id),
        customer_id VARCHAR(255) NOT NULL,
        items JSONB NOT NULL,
        total DECIMAL(10,2) NOT NULL,
        payment_method VARCHAR(50) NOT NULL,
        date TIMESTAMP NOT NULL,
        created_at TIMESTAMP NOT NULL,
        updated_at TIMESTAMP NOT NULL
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS sales_invoices (
        id VARCHAR(255) PRIMARY KEY,
        invoice_number VARCHAR(255) UNIQUE NOT NULL,
        user_id VARCHAR(255) NOT NULL REFERENCES users(id),
        sale_id VARCHAR(255) NOT NULL,
        customer_id VARCHAR(255) NOT NULL,
        items JSONB NOT NULL,
        subtotal DECIMAL(10,2) NOT NULL,
        total DECIMAL(10,2) NOT NULL,
        payment_status VARCHAR(50) NOT NULL DEFAULT 'pending',
        issue_date TIMESTAMP NOT NULL,
        paid_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL
      )
    `);

    const users = load(FILES.users);
    for (const user of users) {
      await pool.query(
        `INSERT INTO users (id, name, email, password, role, created_at, last_login)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        [user.id, user.name, user.email, user.password, user.role || "user", user.createdAt, user.lastLogin || null]
      );
    }

    const subscriptions = load(FILES.subscriptions);
    for (const sub of subscriptions) {
      await pool.query(
        `INSERT INTO subscriptions (user_id, plan_id, status, start_date, end_date)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id) DO NOTHING`,
        [sub.userId, sub.planId, sub.status, sub.startDate, sub.endDate]
      );
    }

    const invoices = load(FILES.invoices);
    for (const inv of invoices) {
      await pool.query(
        `INSERT INTO invoices (id, user_id, invoice_number, plan_id, amount, currency, description, status, paid_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO NOTHING`,
        [inv.id, inv.userId, inv.invoiceNumber, inv.planId, inv.amount, inv.currency || "USD", inv.description || null, inv.status, inv.paidAt || null, inv.createdAt]
      );
    }

    const usage = load(FILES.usage);
    for (const u of usage) {
      await pool.query(
        `INSERT INTO usage (user_id, feature, count)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, feature) DO NOTHING`,
        [u.userId, u.feature, u.count]
      );
    }

    const products = load(FILES.products);
    for (const p of products) {
      await pool.query(
        `INSERT INTO products (id, user_id, name, price, description, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        [p.id, p.userId, p.name, p.price, p.description || null, p.createdAt, p.updatedAt || p.createdAt]
      );
    }

    const customers = load(FILES.customers);
    for (const c of customers) {
      await pool.query(
        `INSERT INTO customers (id, user_id, name, email, phone, company, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO NOTHING`,
        [c.id, c.userId, c.name, c.email || null, c.phone || null, c.company || null, c.createdAt, c.updatedAt || c.createdAt]
      );
    }

    const sales = load(FILES.sales);
    for (const s of sales) {
      await pool.query(
        `INSERT INTO sales (id, user_id, customer_id, items, total, payment_method, date, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO NOTHING`,
        [s.id, s.userId, s.customerId, JSON.stringify(s.items || []), s.total, s.paymentMethod, s.date, s.createdAt, s.updatedAt || s.date]
      );
    }

    const salesInvoices = load(FILES.salesInvoices);
    for (const si of salesInvoices) {
      await pool.query(
        `INSERT INTO sales_invoices (id, invoice_number, user_id, sale_id, customer_id, items, subtotal, total, payment_status, issue_date, paid_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (id) DO NOTHING`,
        [si.id, si.invoiceNumber, si.userId, si.saleId, si.customerId, JSON.stringify(si.items || []), si.subtotal, si.total, si.paymentStatus || "pending", si.issueDate, si.paidAt || null, si.createdAt]
      );
    }

    await pool.query("COMMIT");
    console.log("Migration completed successfully");
  } catch (error) {
    await pool.query("ROLLBACK");
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
