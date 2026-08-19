let currentUser = null;

function requireAuth() {
  const token = localStorage.getItem("salesbook_token");
  if (!token) { showLogin(); return false; }
  currentUser = JSON.parse(localStorage.getItem("salesbook_user") || "{}");
  return true;
}

function showLogin() {
  currentUser = null;
  localStorage.removeItem("salesbook_token");
  localStorage.removeItem("salesbook_user");
  document.getElementById("navbar").style.display = "none";
  renderLogin();
}

function showApp() {
  document.getElementById("navbar").style.display = "flex";
  const adminLink = document.getElementById("admin-nav-link");
  if (adminLink) {
    adminLink.style.display = currentUser && currentUser.role === "admin" ? "inline-block" : "none";
  }
  updateNavActive();
}

function updateNavActive() {
  const hash = location.hash.replace("#", "") || "dashboard";
  document.querySelectorAll(".nav-link").forEach(link => {
    link.classList.toggle("active", link.getAttribute("href") === `#${hash}`);
  });
}

async function handleLogout() {
  localStorage.removeItem("salesbook_token");
  localStorage.removeItem("salesbook_user");
  currentUser = null;
  showLogin();
}

async function checkAuth() {
  const token = localStorage.getItem("salesbook_token");
  if (!token) { showLogin(); return; }
  try {
    const data = await api.get("/api/auth/me");
    currentUser = data.user;
    localStorage.setItem("salesbook_user", JSON.stringify(currentUser));
    showApp();
    route();
  } catch {
    showLogin();
  }
}

function renderLogin() {
  const main = document.getElementById("main-content");
  main.innerHTML = `
    <div class="auth-container">
      <div class="card">
        <h2>Sales Book Login</h2>
        <div id="auth-alert" class="alert alert-error"></div>
        <form id="login-form">
          <div class="form-group">
            <label>Email</label>
            <input type="email" id="login-email" required placeholder="you@example.com">
          </div>
          <div class="form-group">
            <label>Password</label>
            <input type="password" id="login-password" required placeholder="••••••••">
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%; justify-content:center;">Login</button>
        </form>
        <div class="auth-footer">
          Don't have an account? <a onclick="renderRegister()">Register</a>
        </div>
      </div>
    </div>
  `;

  document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;
    const alertEl = document.getElementById("auth-alert");
    try {
      const data = await api.post("/api/auth/login", { email, password });
      localStorage.setItem("salesbook_token", data.token);
      localStorage.setItem("salesbook_user", JSON.stringify(data.user));
      currentUser = data.user;
      showApp();
      route();
    } catch (err) {
      alertEl.textContent = err.message || "Login failed";
      alertEl.style.display = "block";
    }
  });
}

function renderRegister() {
  const main = document.getElementById("main-content");
  main.innerHTML = `
    <div class="auth-container">
      <div class="card">
        <h2>Create Account</h2>
        <div id="auth-alert" class="alert alert-error"></div>
        <form id="register-form">
          <div class="form-group">
            <label>Name</label>
            <input type="text" id="reg-name" required placeholder="Your name">
          </div>
          <div class="form-group">
            <label>Email</label>
            <input type="email" id="reg-email" required placeholder="you@example.com">
          </div>
          <div class="form-group">
            <label>Password</label>
            <input type="password" id="reg-password" required placeholder="••••••••">
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%; justify-content:center;">Register</button>
        </form>
        <div class="auth-footer">
          Already have an account? <a onclick="renderLogin()">Login</a>
        </div>
      </div>
    </div>
  `;

  document.getElementById("register-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("reg-name").value;
    const email = document.getElementById("reg-email").value;
    const password = document.getElementById("reg-password").value;
    const alertEl = document.getElementById("auth-alert");
    try {
      const data = await api.post("/api/auth/register", { name, email, password });
      localStorage.setItem("salesbook_token", data.token);
      localStorage.setItem("salesbook_user", JSON.stringify(data.user));
      currentUser = data.user;
      showApp();
      route();
    } catch (err) {
      alertEl.textContent = err.message || "Registration failed";
      alertEl.style.display = "block";
    }
  });
}

function escapeHtml(str) {
  if (str == null) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function showAlert(selector, message, type = "error") {
  const el = document.querySelector(selector);
  if (!el) return;
  el.textContent = message;
  el.style.display = "block";
  el.className = `alert alert-${type}`;
}

function hideAlert(selector) {
  const el = document.querySelector(selector);
  if (el) el.style.display = "none";
}

async function renderDashboard(container) {
  container.innerHTML = `
    <div class="card">
      <div class="card-title">Dashboard</div>
      <div id="dashboard-alert" class="alert alert-error"></div>
      <div id="dashboard-loading">Loading...</div>
      <div id="dashboard-content" style="display:none;"></div>
    </div>
  `;

  try {
    const [plansData, usageData, subsData] = await Promise.all([
      api.get("/api/plans/current"),
      api.get("/api/usage/me"),
      api.get("/api/subscriptions/"),
    ]);

    const plan = plansData.plan || { id: "free", name: "Starter", limits: { products: 0, customers: 0, invoices: 0, sales: 0 } };
    const usage = usageData.usage || [];
    const sub = subsData.subscription || null;

    const usageMap = {};
    usage.forEach(u => { usageMap[u.feature] = u.used; });

    document.getElementById("dashboard-loading").style.display = "none";
    const content = document.getElementById("dashboard-content");
    content.style.display = "block";

    content.innerHTML = `
      <div style="margin-bottom:1.5rem;">
        <h2 style="margin-bottom:0.25rem;">Welcome, ${escapeHtml(currentUser ? currentUser.name : "")}</h2>
        <p style="color:var(--text-muted);">Plan: <strong>${escapeHtml(plan.name)}</strong> ${sub && sub.status === "active" ? "(Active)" : ""}</p>
      </div>
      <div class="stats-grid">
        <div class="stat-card">
          <h3>Products</h3>
          <div class="value">${usageMap.products || 0} / ${plan.limits.products === Infinity ? "∞" : plan.limits.products}</div>
        </div>
        <div class="stat-card">
          <h3>Customers</h3>
          <div class="value">${usageMap.customers || 0} / ${plan.limits.customers === Infinity ? "∞" : plan.limits.customers}</div>
        </div>
        <div class="stat-card">
          <h3>Sales</h3>
          <div class="value">${usageMap.sales || 0} / ${plan.limits.sales === Infinity ? "∞" : plan.limits.sales}</div>
        </div>
        <div class="stat-card">
          <h3>Invoices</h3>
          <div class="value">${usageMap.invoices || 0} / ${plan.limits.invoices === Infinity ? "∞" : plan.limits.invoices}</div>
        </div>
      </div>
    `;
  } catch (err) {
    showAlert("#dashboard-alert", err.message);
  }
}

async function route() {
  if (!currentUser) return;
  const hash = location.hash.replace("#", "") || "dashboard";
  const main = document.getElementById("main-content");
  updateNavActive();

  switch (hash) {
    case "dashboard":
      await renderDashboard(main);
      break;
    case "products":
      renderProducts(main);
      break;
    case "customers":
      renderCustomers(main);
      break;
    case "sales":
      renderSales(main);
      break;
    case "invoices":
      renderInvoices(main);
      break;
    case "billing":
      renderBilling(main);
      break;
    case "admin":
      renderAdmin(main);
      break;
    default:
      await renderDashboard(main);
  }
}

function init() {
  document.getElementById("logout-btn").addEventListener("click", handleLogout);
  window.addEventListener("hashchange", route);
  checkAuth();
}

document.addEventListener("DOMContentLoaded", init);
