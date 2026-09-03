function renderFees(container) {
  container.innerHTML = `
    <div class="card">
      <div class="card-title">Fee Structures</div>
      <div id="fees-alert" class="alert alert-error"></div>
      <div id="fees-loading" class="loading-state">Loading...</div>
      <div id="fees-content" style="display:none;"></div>
    </div>
  `;

  loadFees();
}

async function loadFees() {
  try {
    const data = await api.get("/api/fee-structures");
    const fees = data.fees || [];

    document.getElementById("fees-loading").style.display = "none";
    const content = document.getElementById("fees-content");
    content.style.display = "block";

    if (fees.length === 0) {
      content.innerHTML = `
        <div class="empty-state">
          <h3>No fee structures yet</h3>
          <p>Create your first fee structure to get started.</p>
          <button class="btn btn-primary" onclick="openFeeModal()">Create Fee Structure</button>
        </div>
      `;
      return;
    }

    content.innerHTML = `
      <div style="margin-bottom:1rem;">
        <button class="btn btn-primary" onclick="openFeeModal()">Create Fee Structure</button>
      </div>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Fee Name</th>
              <th>Amount</th>
              <th>Frequency</th>
              <th>Term</th>
              <th>Class</th>
              <th>Due Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${fees.map(f => `
              <tr>
                <td><a href="#" onclick="viewFee('${f.id}'); return false;" style="color:var(--primary); text-decoration:none; font-weight:500;">${escapeHtml(f.name)}</a></td>
                <td>&#8358;${parseFloat(f.amount).toLocaleString()}</td>
                <td>${escapeHtml(f.frequency)}</td>
                <td>${escapeHtml(f.term || "-")}</td>
                <td>${escapeHtml(f.className || "All Classes")}</td>
                <td>${f.dueDate ? new Date(f.dueDate).toLocaleDateString() : "-"}</td>
                <td><span class="badge ${(f.status || 'active') === 'active' ? 'badge-success' : 'badge-danger'}">${escapeHtml(f.status || "active")}</span></td>
                <td>
                  <button class="btn btn-small btn-outline" onclick="viewFee('${f.id}')">View</button>
                  <button class="btn btn-small btn-outline" onclick="editFee('${f.id}')">Edit</button>
                  <button class="btn btn-small btn-danger" onclick="deleteFee('${f.id}')">Remove</button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    showAlert("#fees-alert", err.message);
  }
}

async function viewFee(id) {
  try {
    const summaryRes = await api.get("/api/fee-structures/" + id + "/summary");
    const fee = summaryRes.fee;
    const summary = summaryRes;

    const container = document.getElementById("main-content");
    container.innerHTML = `
      <div class="card">
        <div class="card-title">Fee Structure Details</div>
        <div id="fee-detail-alert" class="alert alert-error"></div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
          <button class="btn btn-outline" onclick="location.hash='fees'">&larr; Back to Fees</button>
          <div style="display:flex; gap:0.5rem;">
            <button class="btn btn-primary" onclick="editFee('${fee.id}')">Edit</button>
            <button class="btn btn-danger" onclick="deleteFee('${fee.id}')">Remove</button>
          </div>
        </div>

        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:1.5rem;">
          <div>
            <h3 style="margin-bottom:1rem; font-size:1rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em;">Fee Information</h3>
            <div class="detail-row"><div class="detail-label">Fee Name</div><div class="detail-value">${escapeHtml(fee.name)}</div></div>
            <div class="detail-row"><div class="detail-label">Amount</div><div class="detail-value">&#8358;${parseFloat(fee.amount).toLocaleString()}</div></div>
            <div class="detail-row"><div class="detail-label">Frequency</div><div class="detail-value">${escapeHtml(fee.frequency)}</div></div>
            <div class="detail-row"><div class="detail-label">Term</div><div class="detail-value">${escapeHtml(fee.term || "-")}</div></div>
            <div class="detail-row"><div class="detail-label">Class</div><div class="detail-value">${escapeHtml(fee.className || "All Classes")}</div></div>
            <div class="detail-row"><div class="detail-label">Academic Session</div><div class="detail-value">${escapeHtml(fee.academicSession || "-")}</div></div>
            <div class="detail-row"><div class="detail-label">Due Date</div><div class="detail-value">${fee.dueDate ? new Date(fee.dueDate).toLocaleDateString() : "-"}</div></div>
            <div class="detail-row"><div class="detail-label">Status</div><div class="detail-value"><span class="badge ${(fee.status || 'active') === 'active' ? 'badge-success' : 'badge-danger'}">${escapeHtml(fee.status || "active")}</span></div></div>
          </div>

          <div>
            <h3 style="margin-bottom:1rem; font-size:1rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em;">Payment Summary</h3>
            <div class="detail-row"><div class="detail-label">Total Amount</div><div class="detail-value">&#8358;${parseFloat(summary.totalAmount || 0).toLocaleString()}</div></div>
            <div class="detail-row"><div class="detail-label">Total Paid</div><div class="detail-value" style="color:var(--success);">&#8358;${parseFloat(summary.totalPaid || 0).toLocaleString()}</div></div>
            <div class="detail-row"><div class="detail-label">Outstanding</div><div class="detail-value" style="color:var(--danger); font-weight:600;">&#8358;${parseFloat(summary.outstanding || 0).toLocaleString()}</div></div>
            <div class="detail-row"><div class="detail-label">Status</div><div class="detail-value"><span class="badge ${summary.status === 'paid' ? 'badge-success' : summary.status === 'overdue' ? 'badge-danger' : 'badge-warning'}">${escapeHtml(summary.status || "pending")}</span></div></div>
            <div class="detail-row"><div class="detail-label">Assigned Students</div><div class="detail-value">${summary.assignedStudentsCount || 0}</div></div>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    showAlert("#fee-detail-alert", err.message);
  }
}

function openFeeModal(fee = null) {
  const modal = document.createElement("div");
  modal.className = "modal-overlay active";
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>${fee ? "Edit Fee Structure" : "Create Fee Structure"}</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
      </div>
      <div id="fee-modal-alert" class="alert alert-error"></div>
      <form id="fee-form">
        <div class="form-group">
          <label>Fee Name</label>
          <input type="text" id="fee-name" required value="${fee ? escapeHtml(fee.name) : ""}">
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
          <div class="form-group">
            <label>Amount (NGN)</label>
            <input type="number" id="fee-amount" required value="${fee ? fee.amount : ""}">
          </div>
          <div class="form-group">
            <label>Frequency</label>
            <select id="fee-frequency" required>
              <option value="">Select</option>
              <option value="one-time">One-time</option>
              <option value="termly">Termly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
          <div class="form-group">
            <label>Term</label>
            <input type="text" id="fee-term" value="${fee ? escapeHtml(fee.term || "") : ""}">
          </div>
          <div class="form-group">
            <label>Class (optional)</label>
            <input type="text" id="fee-class" value="${fee ? escapeHtml(fee.className || "") : ""}" placeholder="e.g. JSS1 or leave blank for all">
          </div>
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
          <div class="form-group">
            <label>Due Date</label>
            <input type="date" id="fee-due-date" value="${fee && fee.dueDate ? fee.dueDate : ""}">
          </div>
          <div class="form-group">
            <label>Academic Session</label>
            <input type="text" id="fee-session" value="${fee ? escapeHtml(fee.academicSession || "") : ""}" placeholder="e.g. 2025/2026">
          </div>
        </div>
        <button type="submit" class="btn btn-primary" style="width:100%; justify-content:center;">${fee ? "Update Fee Structure" : "Create Fee Structure"}</button>
      </form>
    </div>
  `;
  document.body.appendChild(modal);

  if (fee) {
    document.getElementById("fee-frequency").value = fee.frequency || "";
  }

  document.getElementById("fee-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const alertEl = document.getElementById("fee-modal-alert");
    const body = {
      name: document.getElementById("fee-name").value,
      amount: document.getElementById("fee-amount").value,
      frequency: document.getElementById("fee-frequency").value,
      term: document.getElementById("fee-term").value,
      className: document.getElementById("fee-class").value,
      dueDate: document.getElementById("fee-due-date").value || null,
      academicSession: document.getElementById("fee-session").value || null,
    };

    try {
      if (fee) {
        await api.put("/api/fee-structures/" + fee.id, body);
      } else {
        await api.post("/api/fee-structures", body);
      }
      modal.remove();
      loadFees();
    } catch (err) {
      alertEl.textContent = err.message || "Operation failed";
      alertEl.style.display = "block";
    }
  });
}

function editFee(id) {
  api.get("/api/fee-structures/" + id).then(data => {
    if (data.fee) openFeeModal(data.fee);
  }).catch(() => showAlert("#fees-alert", "Failed to load fee structure"));
}

function deleteFee(id) {
  if (!confirm("Are you sure you want to remove this fee structure? This action cannot be undone.")) return;
  api.delete("/api/fee-structures/" + id).then(() => loadFees()).catch(() => showAlert("#fees-alert", "Failed to remove fee structure"));
}
