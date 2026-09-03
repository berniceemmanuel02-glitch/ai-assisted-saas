let currentUser = null;
let currentSchool = null;
let parentUser = null;

function showLogin() {
  currentUser = null;
  currentSchool = null;
  parentUser = null;
  localStorage.removeItem("scholapay_token");
  localStorage.removeItem("scholapay_user");
  localStorage.removeItem("scholapay_school");
  document.getElementById("sidebar").style.display = "none";
  document.getElementById("header").style.display = "none";
  renderLogin();
}

function showApp() {
  document.getElementById("sidebar").style.display = "flex";
  document.getElementById("header").style.display = "flex";
  updateHeader();
  updateNavActive();
}

function updateHeader() {
  if (!currentSchool) return;
  document.getElementById("header-school-name").textContent = currentSchool.name || "My School";
  document.getElementById("header-school-id").textContent = currentSchool.id ? `ID: ${currentSchool.id}` : "";
  document.getElementById("header-user-name").textContent = currentUser ? currentUser.name : "";
}

function updateNavActive() {
  const hash = location.hash.replace("#", "") || "dashboard";
  document.querySelectorAll(".sidebar-link").forEach(link => {
    link.classList.toggle("active", link.getAttribute("data-section") === hash);
  });
}

async function handleLogout() {
  localStorage.removeItem("scholapay_token");
  localStorage.removeItem("scholapay_user");
  localStorage.removeItem("scholapay_school");
  currentUser = null;
  currentSchool = null;
  showLogin();
}

async function loadSchool() {
  try {
    const data = await api.get("/api/auth/me");
    currentUser = data.user;
    localStorage.setItem("scholapay_user", JSON.stringify(currentUser));
    if (data.school) {
      currentSchool = data.school;
      localStorage.setItem("scholapay_school", JSON.stringify(currentSchool));
    } else {
      currentSchool = null;
      localStorage.removeItem("scholapay_school");
    }
    showApp();
    route();
  } catch {
    showLanding();
  }
}

async function checkAuth() {
  const token = localStorage.getItem("scholapay_token");
  if (!token) { showLanding(); return; }
  currentSchool = JSON.parse(localStorage.getItem("scholapay_school") || "null");
  await loadSchool();
}

function showLanding() {
  currentUser = null;
  currentSchool = null;
  parentUser = null;
  localStorage.removeItem("scholapay_token");
  localStorage.removeItem("scholapay_user");
  localStorage.removeItem("scholapay_school");
  document.getElementById("sidebar").style.display = "none";
  document.getElementById("header").style.display = "none";
  renderLanding();
}

function renderLanding() {
  const main = document.getElementById("main-content");
  main.innerHTML = `
    <div class="hero">
      <h1>Scholapay</h1>
      <p>The modern way to manage school fees in Nigeria. Collect payments, track students, and simplify billing for your school.</p>
      <div style="display:flex; gap:1rem; flex-wrap:wrap; justify-content:center;">
        <button class="btn btn-primary" onclick="showLogin()">School Admin</button>
        <button class="btn btn-outline" onclick="showParentLogin()">Parent Portal</button>
      </div>
    </div>
  `;
}

function renderLogin() {
  const main = document.getElementById("main-content");
  main.innerHTML = `
    <div class="auth-container">
      <div class="card">
        <h2>School Login</h2>
        <div id="auth-alert" class="alert alert-error"></div>
        <form id="login-form">
          <div class="form-group">
            <label>Email</label>
            <input type="email" id="login-email" required placeholder="admin@school.com">
          </div>
          <div class="form-group">
            <label>Password</label>
            <input type="password" id="login-password" required placeholder="••••••••">
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%; justify-content:center;">Login</button>
        </form>
        <div class="auth-footer">
          Don't have an account? <a onclick="renderRegister()">Create School Account</a>
        </div>
        <div class="auth-footer" style="margin-top:0.5rem;">
          <a onclick="showParentLogin()" style="color:var(--primary); font-weight:500;">Parent Portal</a>
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
      localStorage.setItem("scholapay_token", data.token);
      localStorage.setItem("scholapay_user", JSON.stringify(data.user));
      await loadSchool();
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
        <h2>Create School Account</h2>
        <div id="auth-alert" class="alert alert-error"></div>
        <form id="register-form">
          <div class="form-group">
            <label>Full Name</label>
            <input type="text" id="reg-name" required placeholder="Your name">
          </div>
          <div class="form-group">
            <label>Email</label>
            <input type="email" id="reg-email" required placeholder="you@school.com">
          </div>
          <div class="form-group">
            <label>Password</label>
            <input type="password" id="reg-password" required placeholder="••••••••">
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%; justify-content:center;">Create Account</button>
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
      localStorage.setItem("scholapay_token", data.token);
      localStorage.setItem("scholapay_user", JSON.stringify(data.user));
      await loadSchool();
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

async function route() {
  if (!currentUser) return;
  const hash = location.hash.replace("#", "") || "dashboard";
  const main = document.getElementById("main-content");
  updateNavActive();

  switch (hash) {
    case "dashboard":
      await renderDashboard(main);
      break;
    case "students":
      renderStudents(main);
      break;
    case "fees":
      renderFees(main);
      break;
    case "payments":
      renderPayments(main);
      break;
    case "parents":
      renderParents(main);
      break;
    default:
      await renderDashboard(main);
  }
}

function init() {
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      if (parentUser) {
        handleParentLogout();
      } else {
        handleLogout();
      }
    });
  }
  const menuBtn = document.getElementById("mobile-menu-btn");
  if (menuBtn) {
    menuBtn.addEventListener("click", () => {
      document.getElementById("sidebar").classList.toggle("open");
    });
  }
  window.addEventListener("hashchange", () => {
    const hash = location.hash.replace("#", "");
    if (hash === "parent-dashboard" || hash.startsWith("parent-dashboard")) {
      if (!parentUser) {
        checkParentAuth();
      }
    } else if (hash === "parent-login") {
      showParentLogin();
    } else {
      if (parentUser) {
        parentUser = null;
        localStorage.removeItem("scholapay_user");
      }
      route();
    }
  });
  const hash = location.hash.replace("#", "");
  if (hash === "parent-dashboard" || hash.startsWith("parent-dashboard")) {
    checkParentAuth();
  } else if (hash === "parent-login") {
    showParentLogin();
  } else {
    checkAuth();
  }
}

document.addEventListener("DOMContentLoaded", init);
