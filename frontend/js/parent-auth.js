function showParentLogin() {
  const main = document.getElementById("main-content");
  main.innerHTML = `
    <div class="auth-container">
      <div class="card">
        <h2>Parent Login</h2>
        <div id="parent-auth-alert" class="alert alert-error"></div>
        <form id="parent-login-form">
          <div class="form-group">
            <label>Email</label>
            <input type="email" id="parent-login-email" required placeholder="parent@example.com">
          </div>
          <div class="form-group">
            <label>Password</label>
            <input type="password" id="parent-login-password" required placeholder="••••••••">
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%; justify-content:center;">Login</button>
        </form>
        <div class="auth-footer">
          Don't have an account? <a onclick="showParentRegister()">Create Parent Account</a>
        </div>
      </div>
    </div>
  `;

  document.getElementById("parent-login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("parent-login-email").value;
    const password = document.getElementById("parent-login-password").value;
    const alertEl = document.getElementById("parent-auth-alert");
    try {
      const data = await api.post("/api/parent-auth/login", { email, password });
      localStorage.setItem("scholapay_token", data.token);
      localStorage.setItem("scholapay_user", JSON.stringify(data.user));
      parentUser = data.user;
      showParentApp();
    } catch (err) {
      alertEl.textContent = err.message || "Login failed";
      alertEl.style.display = "block";
    }
  });
}

function showParentRegister() {
  const main = document.getElementById("main-content");
  main.innerHTML = `
    <div class="auth-container">
      <div class="card">
        <h2>Create Parent Account</h2>
        <div id="parent-auth-alert" class="alert alert-error"></div>
        <form id="parent-register-form">
          <div class="form-group">
            <label>Full Name</label>
            <input type="text" id="parent-reg-name" required placeholder="Your full name">
          </div>
          <div class="form-group">
            <label>Email</label>
            <input type="email" id="parent-reg-email" required placeholder="you@example.com">
          </div>
          <div class="form-group">
            <label>Password</label>
            <input type="password" id="parent-reg-password" required placeholder="••••••••">
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%; justify-content:center;">Create Account</button>
        </form>
        <div class="auth-footer">
          Already have an account? <a onclick="showParentLogin()">Login</a>
        </div>
      </div>
    </div>
  `;

  document.getElementById("parent-register-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("parent-reg-name").value;
    const email = document.getElementById("parent-reg-email").value;
    const password = document.getElementById("parent-reg-password").value;
    const alertEl = document.getElementById("parent-auth-alert");
    try {
      const data = await api.post("/api/parent-auth/register", { name, email, password });
      localStorage.setItem("scholapay_token", data.token);
      localStorage.setItem("scholapay_user", JSON.stringify(data.user));
      parentUser = data.user;
      showParentApp();
    } catch (err) {
      alertEl.textContent = err.message || "Registration failed";
      alertEl.style.display = "block";
    }
  });
}

function showParentApp() {
  document.getElementById("sidebar").style.display = "none";
  document.getElementById("header").style.display = "none";
  document.getElementById("main-content").innerHTML = "";
  renderParentDashboard(document.getElementById("main-content"));
}

function handleParentLogout() {
  localStorage.removeItem("scholapay_token");
  localStorage.removeItem("scholapay_user");
  parentUser = null;
  showParentLogin();
}

async function checkParentAuth() {
  const token = localStorage.getItem("scholapay_token");
  if (!token) { showParentLogin(); return; }
  try {
    const data = await api.get("/api/parent-auth/me");
    parentUser = data.user;
    localStorage.setItem("scholapay_user", JSON.stringify(parentUser));
    showParentApp();
  } catch {
    showParentLogin();
  }
}
