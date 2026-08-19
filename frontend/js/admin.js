function renderAdmin(container) {
  container.innerHTML = `
    <div class="card">
      <div class="card-title">Admin Dashboard</div>
      <div id="admin-alert" class="alert alert-error"></div>
      <div id="admin-loading">Loading...</div>
      <div id="admin-content" style="display:none;"></div>
    </div>
  `;

  loadAdminData();
}

async function loadAdminData() {
  const loading = document.getElementById("admin-loading");
  const content = document.getElementById("admin-content");
  const alertEl = document.getElementById("admin-alert");

  try {
    const [statsRes, usersRes] = await Promise.all([
      api.get("/api/admin/stats"),
      api.get("/api/admin/users"),
    ]);

    const stats = statsRes;
    const users = usersRes.users || [];

    loading.style.display = "none";
    content.style.display = "block";

    content.innerHTML = `
      <div class="stats-grid" style="margin-bottom:1.5rem;">
        <div class="stat-card">
          <h3>Total Users</h3>
          <div class="value">${escapeHtml(String(stats.totalUsers || 0))}</div>
        </div>
        <div class="stat-card">
          <h3>Active Users</h3>
          <div class="value">${escapeHtml(String(stats.activeUsers || 0))}</div>
        </div>
        <div class="stat-card">
          <h3>Paid Users</h3>
          <div class="value">${escapeHtml(String(stats.paidUsers || 0))}</div>
        </div>
        <div class="stat-card">
          <h3>Revenue</h3>
          <div class="value">$${escapeHtml(String(stats.revenue || 0))}</div>
        </div>
        <div class="stat-card">
          <h3>Pending Payments</h3>
          <div class="value">${escapeHtml(String(stats.pendingPayments || 0))}</div>
        </div>
      </div>
      <div class="card">
        <div class="card-title">Registered Users</div>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Registration Date</th>
                <th>Current Plan</th>
                <th>Account Status</th>
              </tr>
            </thead>
            <tbody>
              ${users.map((u) => `
                <tr>
                  <td>${escapeHtml(u.name)}</td>
                  <td>${escapeHtml(u.email)}</td>
                  <td>${escapeHtml(new Date(u.createdAt).toLocaleString())}</td>
                  <td><span class="badge badge-info">${escapeHtml(u.plan)}</span></td>
                  <td><span class="badge ${u.status === "active" ? "badge-success" : "badge-warning"}">${escapeHtml(u.status)}</span></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (err) {
    loading.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
  }
}

window.renderAdmin = renderAdmin;
