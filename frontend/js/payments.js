let paymentStudents = [];
let paymentFees = [];

function renderPayments(container) {
  container.innerHTML = `
    <div class="card">
      <div class="card-title">Payments</div>
      <div id="payments-alert" class="alert alert-error"></div>
      <div id="payments-loading" class="loading-state">Loading...</div>
      <div id="payments-content" style="display:none;"></div>
    </div>
  `;

  loadPayments();
}

async function loadPayments() {
  try {
    const [paymentsRes, studentsRes, feesRes] = await Promise.all([
      api.get("/api/payments"),
      api.get("/api/students"),
      api.get("/api/fee-structures"),
    ]);

    paymentStudents = studentsRes.students || [];
    paymentFees = feesRes.fees || [];
    const payments = paymentsRes.payments || [];

    document.getElementById("payments-loading").style.display = "none";
    const content = document.getElementById("payments-content");
    content.style.display = "block";

    if (payments.length === 0) {
      content.innerHTML = `
        <div class="empty-state">
          <h3>No payments recorded yet</h3>
          <p>Record your first payment to get started.</p>
          <button class="btn btn-primary" onclick="openPaymentModal()">Record Payment</button>
        </div>
      `;
      return;
    }

    const totalCollected = payments.filter(p => p.status === "paid").reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    const pending = payments.filter(p => p.status === "pending").reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

    content.innerHTML = `
      <div class="stats-grid" style="margin-bottom:1.5rem;">
        <div class="stat-card">
          <h3>Total Collected</h3>
          <div class="value" style="color:var(--success);">&#8358;${totalCollected.toLocaleString()}</div>
        </div>
        <div class="stat-card">
          <h3>Pending</h3>
          <div class="value" style="color:var(--accent);">&#8358;${pending.toLocaleString()}</div>
        </div>
        <div class="stat-card">
          <h3>Total Payments</h3>
          <div class="value">${payments.length}</div>
        </div>
      </div>
      <div style="margin-bottom:1rem;">
        <button class="btn btn-primary" onclick="openPaymentModal()">Record Payment</button>
      </div>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Reference</th>
              <th>Student</th>
              <th>Fee</th>
              <th>Amount</th>
              <th>Method</th>
              <th>Status</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${payments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(p => {
              const student = paymentStudents.find(s => s.id === p.studentId);
              const fee = paymentFees.find(f => f.id === p.feeStructureId);
              return `
                <tr>
                  <td>${escapeHtml(p.reference || "-")}</td>
                  <td>${student ? escapeHtml(student.firstName + " " + student.lastName) : "Unknown"}</td>
                  <td>${fee ? escapeHtml(fee.name) : "Unknown"}</td>
                  <td>&#8358;${parseFloat(p.amount).toLocaleString()}</td>
                  <td>${escapeHtml(p.method || "-")}</td>
                  <td><span class="badge ${p.status === 'paid' ? 'badge-success' : p.status === 'confirmed' ? 'badge-success' : 'badge-warning'}">${escapeHtml(p.status)}</span></td>
                  <td>${p.paidAt ? new Date(p.paidAt).toLocaleDateString() : new Date(p.createdAt).toLocaleDateString()}</td>
                  <td>
                    <button class="btn btn-small btn-outline" onclick="viewReceipt('${p.id}')">Receipt</button>
                    ${p.status !== "paid" ? `<button class="btn btn-small btn-success" onclick="confirmPayment('${p.id}')">Confirm</button>` : ""}
                  </td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    showAlert("#payments-alert", err.message);
  }
}

function openPaymentModal(prefillStudentId, prefillFeeId) {
  const modal = document.createElement("div");
  modal.className = "modal-overlay active";

  const studentOptions = paymentStudents.map(s =>
    `<option value="${s.id}" ${s.id === prefillStudentId ? "selected" : ""}>${escapeHtml(s.firstName + " " + s.lastName)} (${escapeHtml(s.admissionNumber)})</option>`
  ).join("");

  const feeOptions = paymentFees.map(f =>
    `<option value="${f.id}" ${f.id === prefillFeeId ? "selected" : ""}>${escapeHtml(f.name)} - &#8358;${parseFloat(f.amount).toLocaleString()}</option>`
  ).join("");

  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>Record Payment</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
      </div>
      <div id="payment-modal-alert" class="alert alert-error"></div>
      <form id="payment-form">
        <div class="form-group">
          <label>Student</label>
          <select id="pay-student-id" required ${prefillStudentId ? "disabled" : ""}>
            <option value="">Select Student</option>
            ${studentOptions}
          </select>
        </div>
        <div class="form-group">
          <label>Fee Structure</label>
          <select id="pay-fee-id" required ${prefillFeeId ? "disabled" : ""}>
            <option value="">Select Fee</option>
            ${feeOptions}
          </select>
        </div>
        <div class="form-group">
          <label>Amount Paid (NGN)</label>
          <input type="number" id="pay-amount" required placeholder="0.00" step="0.01">
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
          <div class="form-group">
            <label>Payment Method</label>
            <select id="pay-method">
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="pos">POS</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div class="form-group">
            <label>Payment Date</label>
            <input type="date" id="pay-date" value="${new Date().toISOString().split('T')[0]}">
          </div>
        </div>
        <div class="form-group">
          <label>Reference / Receipt Number (optional)</label>
          <input type="text" id="pay-reference" placeholder="e.g. REC-001">
        </div>
        <div class="form-group">
          <label>Notes (optional)</label>
          <textarea id="pay-notes" rows="2" placeholder="Additional notes..."></textarea>
        </div>
        <button type="submit" class="btn btn-primary" style="width:100%; justify-content:center;">Record Payment</button>
      </form>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById("payment-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const alertEl = document.getElementById("payment-modal-alert");
    const body = {
      studentId: document.getElementById("pay-student-id").value,
      feeStructureId: document.getElementById("pay-fee-id").value,
      amount: document.getElementById("pay-amount").value,
      method: document.getElementById("pay-method").value,
      reference: document.getElementById("pay-reference").value || null,
      paymentDate: document.getElementById("pay-date").value ? new Date(document.getElementById("pay-date").value).toISOString() : new Date().toISOString(),
      notes: document.getElementById("pay-notes").value || "",
    };

    try {
      const res = await api.post("/api/payments/record", body);
      modal.remove();
      if (prefillStudentId && prefillFeeId) {
        viewStudent(prefillStudentId);
      } else {
        loadPayments();
      }
      if (res.receipt) {
        showReceipt(res.receipt);
      }
    } catch (err) {
      alertEl.textContent = err.message || "Operation failed";
      alertEl.style.display = "block";
    }
  });
}

function openPaymentModalForFee(studentId, feeId) {
  openPaymentModal(studentId, feeId);
}

function confirmPayment(id) {
  if (!confirm("Confirm this payment?")) return;
  api.post("/api/payments/" + id + "/confirm", {}).then(() => loadPayments()).catch(() => showAlert("#payments-alert", "Failed to confirm payment"));
}

async function viewReceipt(paymentId) {
  try {
    const res = await api.get("/api/receipts/" + paymentId);
    showReceipt(res.receipt);
  } catch (err) {
    showAlert("#payments-alert", "Failed to load receipt");
  }
}

function showReceipt(receipt) {
  const modal = document.createElement("div");
  modal.className = "modal-overlay active";
  modal.innerHTML = `
    <div class="modal" style="max-width: 600px;">
      <div class="modal-header">
        <h3>Payment Receipt</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
      </div>
      <div id="receipt-content" style="font-family: 'Segoe UI', system-ui, sans-serif; padding: 1rem 0;">
        <div style="text-align:center; margin-bottom:1.5rem; border-bottom:2px solid var(--primary); padding-bottom:1rem;">
          <h2 style="color:var(--primary); margin-bottom:0.25rem;">Scholapay</h2>
          <p style="color:var(--text-muted); font-size:0.9rem;">School Fee Management Platform</p>
          <p style="color:var(--text-muted); font-size:0.85rem;">Powered by Scholapay</p>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1.5rem; margin-bottom:1.5rem;">
          <div>
            <h4 style="color:var(--text-muted); font-size:0.8rem; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:0.5rem;">School Information</h4>
            <p style="margin:0.25rem 0;"><strong>${escapeHtml(receipt.school.name)}</strong></p>
            <p style="margin:0.25rem 0; color:var(--text-muted); font-size:0.9rem;">School ID: ${escapeHtml(receipt.school.id)}</p>
          </div>
          <div style="text-align:right;">
            <h4 style="color:var(--text-muted); font-size:0.8rem; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:0.5rem;">Receipt Details</h4>
            <p style="margin:0.25rem 0;"><strong>Receipt No:</strong> ${escapeHtml(receipt.receiptNumber)}</p>
            <p style="margin:0.25rem 0; color:var(--text-muted); font-size:0.9rem;">Date: ${new Date(receipt.payment.date).toLocaleDateString()}</p>
            <p style="margin:0.25rem 0; color:var(--text-muted); font-size:0.9rem;">Time: ${new Date(receipt.payment.date).toLocaleTimeString()}</p>
          </div>
        </div>

        <div style="background:var(--bg); border-radius:var(--radius); padding:1rem; margin-bottom:1.5rem;">
          <h4 style="color:var(--text-muted); font-size:0.8rem; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:0.75rem;">Student Information</h4>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.75rem;">
            <div><strong>Name:</strong> ${escapeHtml(receipt.student.name)}</div>
            <div><strong>Student ID:</strong> ${escapeHtml(receipt.student.id)}</div>
            <div><strong>Admission No:</strong> ${escapeHtml(receipt.student.admissionNumber)}</div>
          </div>
        </div>

        <div style="margin-bottom:1.5rem;">
          <h4 style="color:var(--text-muted); font-size:0.8rem; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:0.75rem;">Payment Details</h4>
          <table style="width:100%; border-collapse:collapse;">
            <thead>
              <tr style="background:var(--bg);">
                <th style="text-align:left; padding:0.75rem; border-bottom:1px solid var(--border);">Description</th>
                <th style="text-align:right; padding:0.75rem; border-bottom:1px solid var(--border);">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="padding:0.75rem; border-bottom:1px solid var(--border);">${escapeHtml(receipt.fee.name)}</td>
                <td style="padding:0.75rem; border-bottom:1px solid var(--border); text-align:right;">&#8358;${parseFloat(receipt.fee.originalAmount).toLocaleString()}</td>
              </tr>
              <tr style="background:rgba(22,163,74,0.05);">
                <td style="padding:0.75rem; border-bottom:1px solid var(--border); color:var(--success);"><strong>Previous Payments</strong></td>
                <td style="padding:0.75rem; border-bottom:1px solid var(--border); text-align:right; color:var(--success);">-&#8358;${parseFloat(receipt.fee.previousPaid).toLocaleString()}</td>
              </tr>
              <tr style="background:rgba(15,118,110,0.05);">
                <td style="padding:0.75rem; border-bottom:1px solid var(--border); color:var(--primary);"><strong>Current Payment</strong></td>
                <td style="padding:0.75rem; border-bottom:1px solid var(--border); text-align:right; color:var(--primary);">&#8358;${parseFloat(receipt.fee.currentPayment).toLocaleString()}</td>
              </tr>
              <tr style="background:rgba(220,38,38,0.05);">
                <td style="padding:0.75rem; border-bottom:1px solid var(--border); color:var(--danger);"><strong>Remaining Balance</strong></td>
                <td style="padding:0.75rem; border-bottom:1px solid var(--border); text-align:right; color:var(--danger);">&#8358;${parseFloat(receipt.fee.remainingBalance).toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem; margin-bottom:1.5rem; padding-top:1rem; border-top:1px solid var(--border);">
          <div>
            <p style="margin:0.25rem 0;"><strong>Payment Method:</strong> ${escapeHtml(receipt.payment.method)}</p>
            <p style="margin:0.25rem 0;"><strong>Reference:</strong> ${escapeHtml(receipt.payment.reference)}</p>
          </div>
          <div style="text-align:right;">
            <p style="margin:0.25rem 0;"><strong>Status:</strong> <span class="badge badge-success">Paid</span></p>
          </div>
        </div>

        ${receipt.payment.notes ? `
          <div style="background:var(--bg); border-radius:var(--radius); padding:1rem; margin-bottom:1.5rem;">
            <h4 style="color:var(--text-muted); font-size:0.8rem; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:0.5rem;">Notes</h4>
            <p style="margin:0; font-size:0.9rem;">${escapeHtml(receipt.payment.notes)}</p>
          </div>
        ` : ""}

        <div style="text-align:center; margin-top:2rem; padding-top:1rem; border-top:1px solid var(--border);">
          <p style="color:var(--text-muted); font-size:0.85rem; margin-bottom:1rem;">Powered by Scholapay</p>
          <button class="btn btn-primary" onclick="window.print()">Print Receipt</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}
