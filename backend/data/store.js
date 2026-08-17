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
