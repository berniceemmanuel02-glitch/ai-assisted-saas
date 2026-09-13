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
        <div class="auth-divider">
          <span>or continue with Google</span>
        </div>
        <button type="button" class="btn btn-google" onclick="handleGoogleLogin()" style="width:100%; justify-content:center;">
          <svg class="google-icon" viewBox="0 0 24 24" width="20" height="20">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>
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

async function handleGoogleLogin() {
  const alertEl = document.getElementById("parent-auth-alert");
  const btn = event?.currentTarget;

  if (!btn || typeof google === "undefined" || !google.accounts || !google.accounts.id) {
    alertEl.textContent = "Google Sign-In is not available. Please try again.";
    alertEl.style.display = "block";
    return;
  }

  btn.disabled = true;
  btn.setAttribute("data-original-html", btn.innerHTML);
  btn.innerHTML = "Signing in...";

  try {
    if (!window.GOOGLE_CLIENT_ID) {
      const config = await api.get("/api/parent-auth/config");
      window.GOOGLE_CLIENT_ID = config.googleClientId;
    }

    if (!window.GOOGLE_CLIENT_ID) {
      throw new Error("Google Client ID not configured");
    }

    google.accounts.id.initialize({
      client_id: window.GOOGLE_CLIENT_ID,
      callback: async (response) => {
        try {
          const data = await api.post("/api/parent-auth/google/verify", {
            credential: response.credential,
          });
          localStorage.setItem("scholapay_token", data.token);
          localStorage.setItem("scholapay_user", JSON.stringify(data.user));
          parentUser = data.user;
          showParentApp();
        } catch (err) {
          alertEl.textContent = err.message || "Google login failed";
          alertEl.style.display = "block";
          btn.disabled = false;
          btn.innerHTML = btn.getAttribute("data-original-html") || btn.innerHTML;
        }
      },
      auto_select: false,
    });

    google.accounts.id.prompt();
  } catch (err) {
    alertEl.textContent = err.message || "Failed to initialize Google login";
    alertEl.style.display = "block";
    btn.disabled = false;
    btn.innerHTML = btn.getAttribute("data-original-html") || btn.innerHTML;
  }
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

async function checkParentAuth() {
  const urlParams = new URLSearchParams(window.location.search);
  const googleToken = urlParams.get("google_token");

  if (googleToken) {
    localStorage.setItem("scholapay_token", googleToken);
    window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
  }

  const token = localStorage.getItem("scholapay_token");
  if (!token) {
    showParentLogin();
    return;
  }

  try {
    const data = await api.get("/api/parent-auth/me");
    parentUser = data.user;
    localStorage.setItem("scholapay_user", JSON.stringify(parentUser));
    showParentApp();
  } catch {
    localStorage.removeItem("scholapay_token");
    localStorage.removeItem("scholapay_user");
    showParentLogin();
  }
}
