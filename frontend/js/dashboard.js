async function renderDashboard(container) {
  container.innerHTML = `
    <div id="dashboard-loading" class="loading-state">Loading dashboard...</div>
    <div id="dashboard-content" style="display:none;"></div>
  `;

  try {
    const [statsRes, recentRes, overdueRes] = await Promise.all([
      api.get("/api/dashboard/stats"),
      api.get("/api/dashboard/recent-payments"),
      api.get("/api/dashboard/overdue-students"),
    ]);

    const stats = statsRes || {};
    const recentPayments = recentRes?.payments || [];
    const overdueStudents = overdueRes?.students || [];

    document.getElementById("dashboard-loading").style.display = "none";
    const content = document.getElementById("dashboard-content");
    content.style.display = "block";

    const collectionRate = stats.collectionRate || 0;
    const collectionColor = collectionRate >= 80 ? "var(--success)" : collectionRate >= 50 ? "var(--accent)" : "var(--danger)";

    content.innerHTML = `
      <div style="margin-bottom:1.5rem;">
        <h2 style="margin-bottom:0.25rem;">Welcome, ${escapeHtml(currentUser ? currentUser.name : "")}</h2>
        <p style="color:var(--text-muted);">${currentSchool ? escapeHtml(currentSchool.name) : "No school selected"} ${currentSchool?.id ? `<span style="font-size:0.85rem; color:var(--text-muted);">(ID: ${currentSchool.id})</span>` : ""}</p>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <h3>Total Students</h3>
          <div class="value">${stats.totalStudents || 0}</div>
        </div>
        <div class="stat-card">
          <h3>Total Fees Expected</h3>
          <div class="value">&#8358;${(stats.totalFeesExpected || 0).toLocaleString()}</div>
        </div>
        <div class="stat-card">
          <h3>Total Collected</h3>
          <div class="value" style="color:var(--success);">&#8358;${(stats.totalCollected || 0).toLocaleString()}</div>
        </div>
        <div class="stat-card">
          <h3>Outstanding Balance</h3>
          <div class="value" style="color:var(--danger);">&#8358;${(stats.totalOutstanding || 0).toLocaleString()}</div>
        </div>
        <div class="stat-card">
          <h3>Collection Rate</h3>
          <div class="value" style="color:${collectionColor};">${collectionRate}%</div>
          <div class="sub">${collectionRate >= 80 ? "Excellent" : collectionRate >= 50 ? "Good progress" : "Needs attention"}</div>
        </div>
        <div class="stat-card">
          <h3>Overdue Payments</h3>
          <div class="value" style="color:var(--danger);">${stats.overdueCount || 0}</div>
        </div>
      </div>

      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap:1.5rem; margin-top:1.5rem;">
        <div class="card">
          <div class="card-title">Recent Payments</div>
          ${recentPayments.length === 0 ? `
            <div class="empty-state">
              <p>No payments recorded yet.</p>
            </div>
          ` : `
            <div class="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Fee</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  ${recentPayments.map(p => `
                    <tr>
                      <td>${escapeHtml(p.studentName)}</td>
                      <td>${escapeHtml(p.feeName)}</td>
                      <td>&#8358;${parseFloat(p.amount).toLocaleString()}</td>
                      <td><span class="badge ${p.status === 'paid' ? 'badge-success' : 'badge-warning'}">${escapeHtml(p.status)}</span></td>
                      <td>${p.paidAt ? new Date(p.paidAt).toLocaleDateString() : new Date(p.createdAt).toLocaleDateString()}</td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          `}
        </div>

        <div class="card">
          <div class="card-title">Students with Outstanding Balances</div>
          ${overdueStudents.length === 0 ? `
            <div class="empty-state">
              <p>No outstanding balances. Great job!</p>
            </div>
          ` : `
            <div class="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Class</th>
                    <th>Outstanding</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${overdueStudents.map(s => `
                    <tr>
                      <td>${escapeHtml(s.firstName + " " + s.lastName)}</td>
                      <td>${escapeHtml(s.className || "-")}</td>
                      <td style="color:var(--danger); font-weight:600;">&#8358;${parseFloat(s.outstanding).toLocaleString()}</td>
                      <td>${s.hasOverdue ? '<span class="badge badge-overdue">Overdue</span>' : '<span class="badge badge-warning">Pending</span>'}</td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          `}
        </div>
      </div>

      <div class="card" style="margin-top:1.5rem;">
        <div class="card-title">Quick Actions</div>
        <div style="display:flex; gap:1rem; flex-wrap:wrap;">
          <button class="btn btn-primary" onclick="location.hash='students'">Add Student</button>
          <button class="btn btn-accent" onclick="location.hash='fees'">Create Fee</button>
          <button class="btn btn-success" onclick="location.hash='payments'">Record Payment</button>
          <button class="btn btn-outline" onclick="showInviteModal()">Send Admin Invite</button>
        </div>
      </div>
    `;
  } catch (err) {
    document.getElementById("dashboard-loading").style.display = "none";
    showAlert("#dashboard-content", err.message);
  }
}
