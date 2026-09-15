const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const FILES = {
  users: path.join(DATA_DIR, "users.json"),
  schools: path.join(DATA_DIR, "schools.json"),
  students: path.join(DATA_DIR, "students.json"),
  feeStructures: path.join(DATA_DIR, "fee-structures.json"),
  payments: path.join(DATA_DIR, "payments.json"),
  subscriptions: path.join(DATA_DIR, "subscriptions.json"),
  invoices: path.join(DATA_DIR, "invoices.json"),
  usage: path.join(DATA_DIR, "usage.json"),
  products: path.join(DATA_DIR, "products.json"),
  customers: path.join(DATA_DIR, "customers.json"),
  sales: path.join(DATA_DIR, "sales.json"),
  salesInvoices: path.join(DATA_DIR, "sales-invoices.json"),
  parentStudents: path.join(DATA_DIR, "parent-students.json"),
  invitations: path.join(DATA_DIR, "invitations.json"),
};

let writeQueue = Promise.resolve();

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
    schoolId: row.school_id || null,
    createdAt: row.created_at,
    lastLogin: row.last_login,
  };
}

function mapSchool(row) {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    city: row.city,
    state: row.state,
    email: row.email,
    phone: row.phone,
    logo: row.logo || null,
    subscriptionId: row.subscription_id || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapStudent(row) {
  return {
    id: row.id,
    schoolId: row.school_id,
    firstName: row.first_name,
    lastName: row.last_name,
    admissionNumber: row.admission_number,
    className: row.class_name,
    parentName: row.parent_name,
    parentEmail: row.parent_email,
    parentPhone: row.parent_phone,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapFeeStructure(row) {
  return {
    id: row.id,
    schoolId: row.school_id,
    name: row.name,
    amount: parseFloat(row.amount),
    frequency: row.frequency,
    term: row.term || null,
    className: row.class_name || null,
    dueDate: row.due_date || null,
    academicSession: row.academic_session || null,
    status: row.status || "active",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPayment(row) {
  return {
    id: row.id,
    schoolId: row.school_id,
    studentId: row.student_id,
    feeStructureId: row.fee_structure_id,
    amount: parseFloat(row.amount),
    method: row.method,
    status: row.status,
    reference: row.reference || null,
    paidAt: row.paid_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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

const usePg = process.env.DATABASE_URL && process.env.DATABASE_URL.trim() !== '';

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
        const res = await pool.query("SELECT * FROM users WHERE LOWER(email) = LOWER($1)", [email]);
        return res.rows[0] ? mapUser(res.rows[0]) : undefined;
      },
      getBySchoolId: async (schoolId) => {
        const res = await pool.query("SELECT * FROM users WHERE school_id = $1", [schoolId]);
        return res.rows.map(mapUser);
      },
      create: async (user) => {
        const res = await pool.query(
          `INSERT INTO users (id, name, email, password, role, school_id, created_at, last_login)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *`,
          [user.id, user.name, user.email, user.password, user.role || "user", user.schoolId || null, user.createdAt, user.lastLogin || null]
        );
        return mapUser(res.rows[0]);
      },
    },
    schools: {
      getAll: async () => {
        const res = await pool.query("SELECT * FROM schools");
        return res.rows.map(mapSchool);
      },
      getById: async (id) => {
        const res = await pool.query("SELECT * FROM schools WHERE id = $1", [id]);
        return res.rows[0] ? mapSchool(res.rows[0]) : undefined;
      },
      getByUserId: async (userId) => {
        const user = await pool.query("SELECT school_id FROM users WHERE id = $1", [userId]);
        if (!user.rows[0] || !user.rows[0].school_id) return [];
        const res = await pool.query("SELECT * FROM schools WHERE id = $1", [user.rows[0].school_id]);
        return res.rows.map(mapSchool);
      },
      create: async (school) => {
        const res = await pool.query(
          `INSERT INTO schools (id, name, address, city, state, email, phone, logo, subscription_id, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING *`,
          [school.id, school.name, school.address, school.city, school.state, school.email, school.phone, school.logo || null, school.subscriptionId || null, school.createdAt, school.updatedAt || school.createdAt]
        );
        return mapSchool(res.rows[0]);
      },
    },
    students: {
      getAll: async () => {
        const res = await pool.query("SELECT * FROM students");
        return res.rows.map(mapStudent);
      },
      getById: async (id) => {
        const res = await pool.query("SELECT * FROM students WHERE id = $1", [id]);
        return res.rows[0] ? mapStudent(res.rows[0]) : undefined;
      },
      getBySchoolId: async (schoolId) => {
        const res = await pool.query("SELECT * FROM students WHERE school_id = $1", [schoolId]);
        return res.rows.map(mapStudent);
      },
      create: async (student) => {
        const res = await pool.query(
          `INSERT INTO students (id, school_id, first_name, last_name, admission_number, class_name, parent_name, parent_email, parent_phone, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING *`,
          [student.id, student.schoolId, student.firstName, student.lastName, student.admissionNumber, student.className, student.parentName, student.parentEmail, student.parentPhone, student.createdAt, student.updatedAt || student.createdAt]
        );
        return mapStudent(res.rows[0]);
      },
      update: async (id, data) => {
        const res = await pool.query(
          `UPDATE students SET first_name = $1, last_name = $2, admission_number = $3, class_name = $4, parent_name = $5, parent_email = $6, parent_phone = $7, updated_at = $8
           WHERE id = $9
           RETURNING *`,
          [data.firstName, data.lastName, data.admissionNumber, data.className, data.parentName, data.parentEmail, data.parentPhone, data.updatedAt || new Date().toISOString(), id]
        );
        return res.rows[0] ? mapStudent(res.rows[0]) : null;
      },
      delete: async (id) => {
        const res = await pool.query("DELETE FROM students WHERE id = $1 RETURNING id", [id]);
        return res.rowCount > 0;
      },
    },
    feeStructures: {
      getAll: async () => {
        const res = await pool.query("SELECT * FROM fee_structures");
        return res.rows.map(mapFeeStructure);
      },
      getById: async (id) => {
        const res = await pool.query("SELECT * FROM fee_structures WHERE id = $1", [id]);
        return res.rows[0] ? mapFeeStructure(res.rows[0]) : undefined;
      },
      getBySchoolId: async (schoolId) => {
        const res = await pool.query("SELECT * FROM fee_structures WHERE school_id = $1", [schoolId]);
        return res.rows.map(mapFeeStructure);
      },
      create: async (fee) => {
        const res = await pool.query(
          `INSERT INTO fee_structures (id, school_id, name, amount, frequency, term, class_name, due_date, academic_session, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING *`,
          [fee.id, fee.schoolId, fee.name, fee.amount, fee.frequency, fee.term || null, fee.className || null, fee.dueDate || null, fee.academicSession || null, fee.status || "active", fee.createdAt, fee.updatedAt || fee.createdAt]
        );
        return mapFeeStructure(res.rows[0]);
      },
      update: async (id, data) => {
        const res = await pool.query(
          `UPDATE fee_structures SET name = $1, amount = $2, frequency = $3, term = $4, class_name = $5, due_date = $6, academic_session = $7, status = $8, updated_at = $9
           WHERE id = $10
           RETURNING *`,
          [data.name, data.amount, data.frequency, data.term || null, data.className || null, data.dueDate || null, data.academicSession || null, data.status || "active", data.updatedAt || new Date().toISOString(), id]
        );
        return res.rows[0] ? mapFeeStructure(res.rows[0]) : null;
      },
      delete: async (id) => {
        const res = await pool.query("DELETE FROM fee_structures WHERE id = $1 RETURNING id", [id]);
        return res.rowCount > 0;
      },
    },
    payments: {
      getAll: async () => {
        const res = await pool.query("SELECT * FROM payments");
        return res.rows.map(mapPayment);
      },
      getById: async (id) => {
        const res = await pool.query("SELECT * FROM payments WHERE id = $1", [id]);
        return res.rows[0] ? mapPayment(res.rows[0]) : undefined;
      },
      getBySchoolId: async (schoolId) => {
        const res = await pool.query("SELECT * FROM payments WHERE school_id = $1", [schoolId]);
        return res.rows.map(mapPayment);
      },
      getByStudentId: async (studentId) => {
        const res = await pool.query("SELECT * FROM payments WHERE student_id = $1", [studentId]);
        return res.rows.map(mapPayment);
      },
      create: async (payment) => {
        const res = await pool.query(
          `INSERT INTO payments (id, school_id, student_id, fee_structure_id, amount, method, status, reference, paid_at, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING *`,
          [payment.id, payment.schoolId, payment.studentId, payment.feeStructureId, payment.amount, payment.method, payment.status, payment.reference || null, payment.paidAt || null, payment.createdAt, payment.updatedAt || payment.createdAt]
        );
        return mapPayment(res.rows[0]);
      },
      update: async (id, data) => {
        const res = await pool.query(
          `UPDATE payments SET status = $1, reference = $2, paid_at = $3, updated_at = $4
           WHERE id = $5
           RETURNING *`,
          [data.status, data.reference || null, data.paidAt || null, data.updatedAt || new Date().toISOString(), id]
        );
        return res.rows[0] ? mapPayment(res.rows[0]) : null;
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
          [invoice.id, invoice.userId, invoice.invoiceNumber, invoice.planId, invoice.amount, invoice.currency || "NGN", invoice.description || null, invoice.status, invoice.paidAt || null, invoice.createdAt]
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
      decrement: async (userId, feature, amount = 1) => {
        const res = await pool.query(
          `UPDATE usage SET count = GREATEST(0, count - $3) WHERE user_id = $1 AND feature = $2 RETURNING *`,
          [userId, feature, amount]
        );
        if (res.rows[0] && res.rows[0].count === 0) {
          await pool.query(`DELETE FROM usage WHERE user_id = $1 AND feature = $2`, [userId, feature]);
        }
        return res.rows[0] ? mapUsage(res.rows[0]) : null;
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
    parentStudents: {
      getAll: async () => {
        const res = await pool.query("SELECT * FROM parent_students");
        return res.rows.map(row => ({ ...row, id: String(row.id) }));
      },
      getById: async (id) => {
        const res = await pool.query("SELECT * FROM parent_students WHERE id = $1", [id]);
        return res.rows[0] ? { ...res.rows[0], id: String(res.rows[0].id) } : undefined;
      },
      getByParentId: async (parentId) => {
        const res = await pool.query("SELECT * FROM parent_students WHERE parent_id = $1", [parentId]);
        return res.rows.map(row => ({ ...row, id: String(row.id) }));
      },
      getByStudentId: async (studentId) => {
        const res = await pool.query("SELECT * FROM parent_students WHERE student_id = $1", [studentId]);
        return res.rows.map(row => ({ ...row, id: String(row.id) }));
      },
      getBySchoolId: async (schoolId) => {
        const res = await pool.query(
          `SELECT ps.* FROM parent_students ps
           JOIN students s ON ps.student_id = s.id
           WHERE s.school_id = $1`,
          [schoolId]
        );
        return res.rows.map(row => ({ ...row, id: String(row.id) }));
      },
      create: async (link) => {
        const res = await pool.query(
          `INSERT INTO parent_students (parent_id, student_id, parent_name, parent_phone, parent_email, school_id, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *`,
          [link.parentId, link.studentId, link.parentName, link.parentPhone || null, link.parentEmail || null, link.schoolId, link.createdAt, link.updatedAt || link.createdAt]
        );
        return { ...res.rows[0], id: String(res.rows[0].id) };
      },
      update: async (id, data) => {
        const res = await pool.query(
          `UPDATE parent_students SET parent_name = $1, parent_phone = $2, parent_email = $3, updated_at = $4
           WHERE id = $5
           RETURNING *`,
          [data.parentName, data.parentPhone || null, data.parentEmail || null, data.updatedAt || new Date().toISOString(), id]
        );
        return res.rows[0] ? { ...res.rows[0], id: String(res.rows[0].id) } : null;
      },
      delete: async (id) => {
        const res = await pool.query("DELETE FROM parent_students WHERE id = $1 RETURNING id", [id]);
        return res.rowCount > 0;
      },
      deleteByStudentId: async (studentId) => {
        const res = await pool.query("DELETE FROM parent_students WHERE student_id = $1 RETURNING id", [studentId]);
        return res.rowCount > 0;
      },
    },
    invitations: {
      getAll: async () => {
        const res = await pool.query("SELECT * FROM invitations");
        return res.rows;
      },
      getById: async (id) => {
        const res = await pool.query("SELECT * FROM invitations WHERE id = $1", [id]);
        return res.rows[0] || undefined;
      },
      getByTokenHash: async (tokenHash) => {
        const res = await pool.query("SELECT * FROM invitations WHERE token_hash = $1 AND used = false AND expires_at > NOW()", [tokenHash]);
        return res.rows[0] || undefined;
      },
      getByEmail: async (email) => {
        const res = await pool.query("SELECT * FROM invitations WHERE LOWER(email) = LOWER($1)", [email]);
        return res.rows;
      },
      getBySchoolId: async (schoolId) => {
        const res = await pool.query("SELECT * FROM invitations WHERE school_id = $1", [schoolId]);
        return res.rows;
      },
      create: async (invitation) => {
        const res = await pool.query(
          `INSERT INTO invitations (id, email, school_id, inviter_id, token_hash, expires_at, used, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING *`,
          [invitation.id, invitation.email, invitation.schoolId, invitation.inviterId, invitation.tokenHash, invitation.expiresAt, invitation.used || false, invitation.createdAt, invitation.updatedAt || invitation.createdAt]
        );
        return res.rows[0];
      },
      update: async (id, data) => {
        const res = await pool.query(
          `UPDATE invitations SET email = $1, school_id = $2, inviter_id = $3, token_hash = $4, expires_at = $5, used = $6, updated_at = $7
           WHERE id = $8
           RETURNING *`,
          [data.email, data.schoolId, data.inviterId, data.tokenHash, data.expiresAt, data.used, data.updatedAt || new Date().toISOString(), id]
        );
        return res.rows[0] || null;
      },
    },
  };

  module.exports = db;
} else {
  const db = {
    users: {
      getAll: () => load(FILES.users),
      getById: (id) => load(FILES.users).find((u) => u.id === id),
      getByEmail: (email) => load(FILES.users).find((u) => u.email.toLowerCase() === email.toLowerCase()),
      getBySchoolId: (schoolId) => load(FILES.users).filter((u) => u.schoolId === schoolId),
      create: (user) => {
        const users = load(FILES.users);
        users.push(user);
        save(FILES.users, users);
        return user;
      },
      update: (id, data) => {
        const items = load(FILES.users);
        const idx = items.findIndex((u) => u.id === id);
        if (idx === -1) return null;
        items[idx] = { ...items[idx], ...data };
        save(FILES.users, items);
        return items[idx];
      },
    },
    schools: {
      getAll: () => load(FILES.schools),
      getById: (id) => load(FILES.schools).find((s) => s.id === id),
      getByUserId: (userId) => {
        const user = load(FILES.users).find((u) => u.id === userId);
        if (!user || !user.schoolId) return [];
        return load(FILES.schools).filter((s) => s.id === user.schoolId);
      },
      create: (school) => {
        const items = load(FILES.schools);
        items.push(school);
        save(FILES.schools, items);
        return school;
      },
      update: (id, data) => {
        const items = load(FILES.schools);
        const idx = items.findIndex((s) => s.id === id);
        if (idx === -1) return null;
        items[idx] = { ...items[idx], ...data };
        save(FILES.schools, items);
        return items[idx];
      },
    },
    students: {
      getAll: () => load(FILES.students),
      getById: (id) => load(FILES.students).find((s) => s.id === id),
      getBySchoolId: (schoolId) => load(FILES.students).filter((s) => s.schoolId === schoolId),
      create: (student) => {
        const items = load(FILES.students);
        items.push(student);
        save(FILES.students, items);
        return student;
      },
      update: (id, data) => {
        const items = load(FILES.students);
        const idx = items.findIndex((s) => s.id === id);
        if (idx === -1) return null;
        items[idx] = { ...items[idx], ...data };
        save(FILES.students, items);
        return items[idx];
      },
      delete: (id) => {
        const items = load(FILES.students);
        const idx = items.findIndex((s) => s.id === id);
        if (idx === -1) return false;
        items.splice(idx, 1);
        save(FILES.students, items);
        return true;
      },
    },
    feeStructures: {
      getAll: () => load(FILES.feeStructures),
      getById: (id) => load(FILES.feeStructures).find((f) => f.id === id),
      getBySchoolId: (schoolId) => load(FILES.feeStructures).filter((f) => f.schoolId === schoolId),
      create: (fee) => {
        const items = load(FILES.feeStructures);
        items.push(fee);
        save(FILES.feeStructures, items);
        return fee;
      },
      update: (id, data) => {
        const items = load(FILES.feeStructures);
        const idx = items.findIndex((f) => f.id === id);
        if (idx === -1) return null;
        items[idx] = { ...items[idx], ...data };
        save(FILES.feeStructures, items);
        return items[idx];
      },
      delete: (id) => {
        const items = load(FILES.feeStructures);
        const idx = items.findIndex((f) => f.id === id);
        if (idx === -1) return false;
        items.splice(idx, 1);
        save(FILES.feeStructures, items);
        return true;
      },
    },
    payments: {
      getAll: () => load(FILES.payments),
      getById: (id) => load(FILES.payments).find((p) => p.id === id),
      getBySchoolId: (schoolId) => load(FILES.payments).filter((p) => p.schoolId === schoolId),
      getByStudentId: (studentId) => load(FILES.payments).filter((p) => p.studentId === studentId),
      create: (payment) => {
        const items = load(FILES.payments);
        items.push(payment);
        save(FILES.payments, items);
        return payment;
      },
      update: (id, data) => {
        const items = load(FILES.payments);
        const idx = items.findIndex((p) => p.id === id);
        if (idx === -1) return null;
        items[idx] = { ...items[idx], ...data };
        save(FILES.payments, items);
        return items[idx];
      },
      delete: (id) => {
        const items = load(FILES.payments);
        const idx = items.findIndex((p) => p.id === id);
        if (idx === -1) return false;
        items.splice(idx, 1);
        save(FILES.payments, items);
        return true;
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
      decrement: (userId, feature, amount = 1) => {
        const items = load(FILES.usage);
        const idx = items.findIndex((u) => u.userId === userId && u.feature === feature);
        if (idx !== -1) {
          items[idx].count = Math.max(0, items[idx].count - amount);
          if (items[idx].count === 0) {
            items.splice(idx, 1);
          }
          save(FILES.usage, items);
        }
        return idx >= 0 ? items[idx] : null;
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
    parentStudents: {
      getAll: () => load(FILES.parentStudents),
      getById: (id) => load(FILES.parentStudents).find((p) => p.id === id),
      getByParentId: (parentId) => load(FILES.parentStudents).filter((p) => p.parentId === parentId),
      getByStudentId: (studentId) => load(FILES.parentStudents).filter((p) => p.studentId === studentId),
      getBySchoolId: (schoolId) => load(FILES.parentStudents).filter((p) => p.schoolId === schoolId),
      create: (link) => {
        const items = load(FILES.parentStudents);
        items.push(link);
        save(FILES.parentStudents, items);
        return link;
      },
      update: (id, data) => {
        const items = load(FILES.parentStudents);
        const idx = items.findIndex((p) => p.id === id);
        if (idx === -1) return null;
        items[idx] = { ...items[idx], ...data };
        save(FILES.parentStudents, items);
        return items[idx];
      },
      delete: (id) => {
        const items = load(FILES.parentStudents);
        const idx = items.findIndex((p) => p.id === id);
        if (idx === -1) return false;
        items.splice(idx, 1);
        save(FILES.parentStudents, items);
        return true;
      },
      deleteByStudentId: (studentId) => {
        const items = load(FILES.parentStudents).filter((p) => p.studentId !== studentId);
        save(FILES.parentStudents, items);
        return true;
      },
    },
    invitations: {
      getAll: () => load(FILES.invitations),
      getById: (id) => load(FILES.invitations).find((i) => i.id === id),
      getByTokenHash: (tokenHash) => load(FILES.invitations).find((i) => i.tokenHash === tokenHash && !i.used && i.expiresAt > new Date().toISOString()),
      getByEmail: (email) => load(FILES.invitations).filter((i) => i.email.toLowerCase() === email.toLowerCase()),
      getBySchoolId: (schoolId) => load(FILES.invitations).filter((i) => i.schoolId === schoolId),
      create: (invitation) => {
        const items = load(FILES.invitations);
        items.push(invitation);
        save(FILES.invitations, items);
        return invitation;
      },
      update: (id, data) => {
        const items = load(FILES.invitations);
        const idx = items.findIndex((i) => i.id === id);
        if (idx === -1) return null;
        items[idx] = { ...items[idx], ...data };
        save(FILES.invitations, items);
        return items[idx];
      },
    },
  };

  module.exports = db;
}
