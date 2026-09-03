let currentParentView = "list";
let parentPaymentHistoryFilter = "";

async function renderParentDashboard(container) {
  currentParentView = "list";
  parentPaymentHistoryFilter = "";
  container.innerHTML = `
    <div id="parent-loading" class="loading-state">Loading dashboard...</div>
    <div id="parent-content" style="display:none;"></div>
  `;

  const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
  const reference = params.get("reference");
  const status = params.get("status");

  if (reference) {
    if (status === "success") {
      await verifyAndShowPaymentResult(reference, true);
    } else if (status === "failed" || status === "cancelled") {
      await verifyAndShowPaymentResult(reference, false);
    }
    window.location.hash = "parent-dashboard";
    return;
  }

  await renderParentChildrenList();
}

async function verifyAndShowPaymentResult(reference, expectedSuccess) {
  const content = document.getElementById("parent-content");
  if (!content) return;

  content.innerHTML = `
    <div id="parent-payment-result-loading" class="loading-state">Verifying payment...</div>
    <div id="parent-payment-result-content" style="display:none;"></div>
  `;

  try {
    const res = await api.post("/api/parents/me/payments/verify", { reference });
    const isSuccess = res.payment && res.payment.status === "paid";
    renderPaymentResult(isSuccess ? "success" : "failure", isSuccess ? res : { message: res.message || "Payment verification failed" });
  } catch (err) {
    document.getElementById("parent-payment-result-loading").style.display = "none";
    const resultContent = document.getElementById("parent-payment-result-content");
    resultContent.style.display = "block";
    renderPaymentResult("failure", { message: err.message || "Payment verification failed" });
  }
}

async function renderParentChildrenList() {
  currentParentView = "list";
  const content = document.getElementById("parent-content");
  if (!content) return;

  const parentLoading = document.getElementById("parent-loading");
  if (parentLoading) parentLoading.style.display = "none";

  content.innerHTML = `
    <div style="margin-bottom:1.5rem;">
      <h2 style="margin-bottom:0.25rem;">Welcome, ${escapeHtml(parentUser ? parentUser.name : "")}</h2>
      <p style="color:var(--text-muted);">Parent Portal</p>
    </div>
    <div id="parent-children-loading" class="loading-state">Loading children...</div>
    <div id="parent-children-content" style="display:none;"></div>
  `;

  try {
    const data = await api.get("/api/parents/me/children-summary");
    const children = data.children || [];

    document.getElementById("parent-children-loading").style.display = "none";
    const childrenContent = document.getElementById("parent-children-content");
    childrenContent.style.display = "block";

    if (children.length === 0) {
      childrenContent.innerHTML = `
        <div class="card">
          <div class="card-title">Linked Children</div>
          <div class="empty-state">
            <h3>No children linked yet</h3>
            <p>Contact your school administrator to link your child to this account.</p>
          </div>
        </div>
      `;
      return;
    }

    childrenContent.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:0.5rem;">
        <div class="card-title" style="margin-bottom:0;">Linked Children</div>
        <button class="btn btn-primary" onclick="renderParentPaymentHistory()">Payment History</button>
      </div>
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:1rem;">
        ${children.map(c => `
          <div class="card" style="cursor:pointer; margin-bottom:0; transition: box-shadow 0.2s;" onclick="renderParentChildDetails('${c.studentId}', '${c.linkId}')">
            <div style="font-weight:600; font-size:1.05rem; margin-bottom:0.75rem; color:var(--primary);">${escapeHtml(c.firstName + " " + c.lastName)}</div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.5rem; font-size:0.9rem;">
              <div>
                <div style="color:var(--text-muted); font-size:0.8rem;">Student ID</div>
                <div>${escapeHtml(c.admissionNumber || c.studentId)}</div>
              </div>
              <div>
                <div style="color:var(--text-muted); font-size:0.8rem;">Class</div>
                <div>${escapeHtml(c.className || "-")}</div>
              </div>
              <div>
                <div style="color:var(--text-muted); font-size:0.8rem;">Total Fees</div>
                <div>&#8358;${parseFloat(c.totalFees || 0).toLocaleString()}</div>
              </div>
              <div>
                <div style="color:var(--text-muted); font-size:0.8rem;">Total Paid</div>
                <div style="color:var(--success);">&#8358;${parseFloat(c.totalPaid || 0).toLocaleString()}</div>
              </div>
              <div>
                <div style="color:var(--text-muted); font-size:0.8rem;">Outstanding</div>
                <div style="color:var(--danger); font-weight:600;">&#8358;${parseFloat(c.outstanding || 0).toLocaleString()}</div>
              </div>
              <div>
                <div style="color:var(--text-muted); font-size:0.8rem;">Overdue Fees</div>
                <div>${c.overdueCount || 0}</div>
              </div>
            </div>
          </div>
        `).join("")}
      </div>
    `;
  } catch (err) {
    document.getElementById("parent-children-loading").style.display = "none";
    const childrenContent = document.getElementById("parent-children-content");
    childrenContent.style.display = "block";
    childrenContent.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
  }
}

async function renderParentChildDetails(studentId, linkId) {
  currentParentView = "details";
  const content = document.getElementById("parent-content");
  if (!content) return;

  content.innerHTML = `
    <div id="parent-detail-loading" class="loading-state">Loading fee details...</div>
    <div id="parent-detail-content" style="display:none;"></div>
  `;

  try {
    const data = await api.get("/api/parents/me/children/" + studentId + "/fees");
    const student = data.student;
    const summary = data.summary;
    const fees = data.fees || [];

    document.getElementById("parent-detail-loading").style.display = "none";
    const detailContent = document.getElementById("parent-detail-content");
    detailContent.style.display = "block";

    const statusBadge = summary.paymentStatus === "paid" ? "badge-success" : summary.paymentStatus === "partial" ? "badge-warning" : "badge-danger";
    const statusText = summary.paymentStatus === "paid" ? "Paid" : summary.paymentStatus === "partial" ? "Partially Paid" : "Outstanding";

    detailContent.innerHTML = `
      <div style="margin-bottom:1.5rem; display:flex; align-items:center; gap:1rem; flex-wrap:wrap;">
        <button class="btn btn-outline" onclick="renderParentChildrenList()">&larr; Back to Children</button>
        <button class="btn btn-primary" onclick="renderParentPaymentHistory('${studentId}')">Payment History</button>
        <div>
          <h2 style="margin-bottom:0.25rem;">${escapeHtml(student.firstName + " " + student.lastName)}</h2>
          <p style="color:var(--text-muted); font-size:0.9rem;">${escapeHtml(student.className || "No class")} &bull; ${escapeHtml(student.admissionNumber || student.id)}</p>
        </div>
      </div>

      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:1rem; margin-bottom:1.5rem;">
        <div class="card" style="margin-bottom:0;">
          <div style="color:var(--text-muted); font-size:0.85rem; text-transform:uppercase; letter-spacing:0.05em;">Total Fees</div>
          <div style="font-size:1.25rem; font-weight:600;">&#8358;${parseFloat(summary.totalFees || 0).toLocaleString()}</div>
        </div>
        <div class="card" style="margin-bottom:0;">
          <div style="color:var(--text-muted); font-size:0.85rem; text-transform:uppercase; letter-spacing:0.05em;">Total Paid</div>
          <div style="font-size:1.25rem; font-weight:600; color:var(--success);">&#8358;${parseFloat(summary.totalPaid || 0).toLocaleString()}</div>
        </div>
        <div class="card" style="margin-bottom:0;">
          <div style="color:var(--text-muted); font-size:0.85rem; text-transform:uppercase; letter-spacing:0.05em;">Outstanding</div>
          <div style="font-size:1.25rem; font-weight:600; color:var(--danger);">&#8358;${parseFloat(summary.outstanding || 0).toLocaleString()}</div>
        </div>
        <div class="card" style="margin-bottom:0;">
          <div style="color:var(--text-muted); font-size:0.85rem; text-transform:uppercase; letter-spacing:0.05em;">Status</div>
          <div><span class="badge ${statusBadge}">${statusText}</span></div>
        </div>
        <div class="card" style="margin-bottom:0;">
          <div style="color:var(--text-muted); font-size:0.85rem; text-transform:uppercase; letter-spacing:0.05em;">Overdue Fees</div>
          <div style="font-size:1.25rem; font-weight:600; color:var(--danger);">${summary.overdueCount || 0}</div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Fee Breakdown</div>
        ${fees.length === 0 ? `
          <div class="empty-state">
            <h3>No fees assigned</h3>
            <p>There are no fees for this student yet.</p>
          </div>
        ` : `
          <div class="table-container" style="overflow-x:auto;">
            <table>
              <thead>
                <tr>
                  <th>Fee Name</th>
                  <th>Session</th>
                  <th>Term/Class</th>
                  <th>Total</th>
                  <th>Paid</th>
                  <th>Outstanding</th>
                  <th>Due Date</th>
                  <th>Status</th>
                  <th>Days Left</th>
                  <th>Days Overdue</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${fees.map(f => {
                  const statusBadge = f.paymentStatus === 'paid' ? 'badge-success' : f.isOverdue ? 'badge-overdue' : f.paymentStatus === 'partial' ? 'badge-warning' : 'badge-danger';
                  const statusText = f.paymentStatus === 'paid' ? 'Paid' : f.isOverdue ? 'Overdue' : f.paymentStatus === 'partial' ? 'Partially Paid' : 'Outstanding';
                  const canPay = f.outstanding > 0;
                  return `
                    <tr>
                      <td><strong>${escapeHtml(f.feeName)}</strong></td>
                      <td>${escapeHtml(f.academicSession || "-")}</td>
                      <td>${escapeHtml((f.term || "-") + (f.className ? " / " + f.className : ""))}</td>
                      <td>&#8358;${parseFloat(f.totalAmount).toLocaleString()}</td>
                      <td style="color:var(--success);">&#8358;${parseFloat(f.totalPaid).toLocaleString()}</td>
                      <td style="color:var(--danger); font-weight:600;">&#8358;${parseFloat(f.outstanding).toLocaleString()}</td>
                      <td>${f.dueDate ? new Date(f.dueDate).toLocaleDateString() : "-"}</td>
                      <td><span class="badge ${statusBadge}">${statusText}</span></td>
                      <td>${f.daysRemaining !== null && f.daysRemaining !== undefined ? (f.daysRemaining > 0 ? f.daysRemaining : 0) : "-"}</td>
                      <td>${f.daysOverdue || 0}</td>
                      <td>${canPay ? `<button class="btn btn-small btn-primary" onclick="renderParentPayNow('${student.id}', '${f.feeId}')">Pay Now</button>` : '<span style="color:var(--text-muted); font-size:0.85rem;">Paid</span>'}</td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
          </div>
        `}
      </div>
    `;
  } catch (err) {
    document.getElementById("parent-detail-loading").style.display = "none";
    detailContent.style.display = "block";
    detailContent.innerHTML = `
      <button class="btn btn-outline" onclick="renderParentChildrenList()" style="margin-bottom:1rem;">&larr; Back to Children</button>
      <div class="alert alert-error">${escapeHtml(err.message)}</div>
    `;
  }
}

async function renderParentPayNow(studentId, feeId) {
  const modal = document.createElement("div");
  modal.className = "modal-overlay active";
  modal.innerHTML = `
    <div class="modal" style="max-width: 520px; width: 95%;">
      <div class="modal-header">
        <h3>Make Payment</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
      </div>
      <div class="modal-body">
        <div id="parent-pay-now-loading" class="loading-state">Loading payment details...</div>
        <div id="parent-pay-now-content" style="display:none;"></div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  try {
    const data = await api.get("/api/parents/me/children/" + studentId + "/fees/" + feeId + "/pay-now");
    const student = data.student;
    const school = data.school;
    const fee = data.fee;

    document.getElementById("parent-pay-now-loading").style.display = "none";
    const content = document.getElementById("parent-pay-now-content");
    content.style.display = "block";

    content.innerHTML = `
      <div style="margin-bottom:1rem; padding:1rem; background:var(--bg); border-radius:0.5rem;">
        <div style="font-weight:600; margin-bottom:0.5rem; color:var(--primary);">${escapeHtml(school ? school.name : "School")}</div>
        <div style="font-size:0.9rem; color:var(--text-muted);">
          <div><strong>Student:</strong> ${escapeHtml(student.firstName + " " + student.lastName)}</div>
          <div><strong>Student ID:</strong> ${escapeHtml(student.admissionNumber || student.id)}</div>
          <div><strong>Class:</strong> ${escapeHtml(student.className || "-")}</div>
        </div>
      </div>

      <div style="margin-bottom:1rem; padding:1rem; background:var(--bg); border-radius:0.5rem;">
        <div style="font-weight:600; margin-bottom:0.5rem;">${escapeHtml(fee.name)}</div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.5rem; font-size:0.9rem;">
          <div><span style="color:var(--text-muted);">Total Fee:</span> <strong>&#8358;${parseFloat(fee.totalAmount).toLocaleString()}</strong></div>
          <div><span style="color:var(--text-muted);">Amount Paid:</span> <strong style="color:var(--success);">&#8358;${parseFloat(fee.totalPaid).toLocaleString()}</strong></div>
          <div><span style="color:var(--text-muted);">Outstanding:</span> <strong style="color:var(--danger);">&#8358;${parseFloat(fee.outstanding).toLocaleString()}</strong></div>
          <div><span style="color:var(--text-muted);">Due Date:</span> ${fee.dueDate ? new Date(fee.dueDate).toLocaleDateString() : "-"}</div>
          ${fee.academicSession ? `<div><span style="color:var(--text-muted);">Session:</span> ${escapeHtml(fee.academicSession)}</div>` : ""}
          ${fee.term ? `<div><span style="color:var(--text-muted);">Term:</span> ${escapeHtml(fee.term)}</div>` : ""}
        </div>
      </div>

      <div style="margin-bottom:1rem;">
        <label for="pay-now-amount" style="font-weight:500; display:block; margin-bottom:0.5rem;">Amount to Pay (₦)</label>
        <input type="number" id="pay-now-amount" placeholder="Enter amount" min="0" step="0.01" style="width:100%; padding:0.75rem; border-radius:0.375rem; border:1px solid var(--border); font-size:1rem;" oninput="calculateRemainingBalance()">
        <div id="pay-now-validation" style="color:var(--danger); font-size:0.85rem; margin-top:0.5rem; display:none;"></div>
      </div>

      <div style="margin-bottom:1rem; padding:0.75rem; background:var(--bg); border-radius:0.375rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
        <span style="font-weight:500;">Remaining after payment:</span>
        <span id="pay-now-remaining" style="font-weight:700; color:var(--danger);">₦${parseFloat(fee.outstanding).toLocaleString()}</span>
      </div>

      <div style="display:flex; gap:0.5rem; justify-content:flex-end; flex-wrap:wrap;">
        <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
        <button class="btn btn-primary" id="pay-now-submit" onclick="initiatePaystackPayment('${studentId}', '${feeId}')">Pay Now</button>
      </div>
    `;

    window.calculateRemainingBalance = function() {
      const amountInput = document.getElementById("pay-now-amount");
      const remainingEl = document.getElementById("pay-now-remaining");
      const validationEl = document.getElementById("pay-now-validation");
      const submitBtn = document.getElementById("pay-now-submit");
      const outstanding = parseFloat(fee.outstanding) || 0;
      const entered = parseFloat(amountInput.value) || 0;
      const remaining = Math.max(0, outstanding - entered);

      remainingEl.textContent = "₦" + remaining.toLocaleString();

      if (entered <= 0) {
        validationEl.textContent = "Amount must be greater than zero.";
        validationEl.style.display = "block";
        submitBtn.disabled = true;
        return;
      }

      if (entered > outstanding) {
        validationEl.textContent = "Amount cannot exceed outstanding balance of ₦" + outstanding.toLocaleString() + ".";
        validationEl.style.display = "block";
        submitBtn.disabled = true;
        return;
      }

      validationEl.style.display = "none";
      submitBtn.disabled = false;
    };
  } catch (err) {
    document.getElementById("parent-pay-now-loading").style.display = "none";
    content.style.display = "block";
    content.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
  }
}

async function initiatePaystackPayment(studentId, feeId) {
  const amountInput = document.getElementById("pay-now-amount");
  const validationEl = document.getElementById("pay-now-validation");
  const submitBtn = document.getElementById("pay-now-submit");

  const amount = parseFloat(amountInput.value) || 0;
  if (amount <= 0) {
    validationEl.textContent = "Amount must be greater than zero.";
    validationEl.style.display = "block";
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Initializing...";

  try {
    const res = await api.post("/api/parents/me/children/" + studentId + "/fees/" + feeId + "/pay-now/initialize", { amount });
    const authorizationUrl = res.paystack && res.paystack.authorizationUrl;
    if (authorizationUrl) {
      window.location.href = authorizationUrl;
    } else {
      throw new Error("Payment gateway did not return an authorization URL");
    }
  } catch (err) {
    validationEl.textContent = err.message || "Failed to initialize payment. Please try again.";
    validationEl.style.display = "block";
    submitBtn.disabled = false;
    submitBtn.textContent = "Pay Now";
  }
}

function renderPaymentResult(status, data) {
  const container = document.getElementById("main-content");
  if (!container) return;

  if (status === "success") {
    const payment = data.payment || {};
    const receipt = data.receipt || {};
    container.innerHTML = `
      <div class="card" style="max-width:700px; margin:2rem auto; text-align:center;">
        <div style="font-size:3rem; margin-bottom:1rem;">✅</div>
        <h2 style="margin-bottom:0.5rem; color:var(--success);">Payment Successful</h2>
        <p style="color:var(--text-muted); margin-bottom:1.5rem;">Your payment has been processed successfully.</p>

        <div style="text-align:left; padding:1rem; background:var(--bg); border-radius:0.5rem; margin-bottom:1rem;">
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.75rem; font-size:0.9rem;">
            <div><span style="color:var(--text-muted);">Amount Paid:</span> <strong>&#8358;${parseFloat(payment.amount || 0).toLocaleString()}</strong></div>
            <div><span style="color:var(--text-muted);">Student:</span> <strong>${escapeHtml(receipt.student ? receipt.student.name : "")}</strong></div>
            <div><span style="color:var(--text-muted);">Fee:</span> <strong>${escapeHtml(receipt.fee ? receipt.fee.name : "")}</strong></div>
            <div><span style="color:var(--text-muted);">Reference:</span> <strong>${escapeHtml(payment.reference || "")}</strong></div>
            <div><span style="color:var(--text-muted);">Remaining Balance:</span> <strong style="color:var(--danger);">&#8358;${parseFloat(receipt.fee ? receipt.fee.remainingBalance : 0).toLocaleString()}</strong></div>
            <div><span style="color:var(--text-muted);">Date:</span> <strong>${payment.paidAt ? new Date(payment.paidAt).toLocaleDateString() : "-"}</strong></div>
          </div>
        </div>

        <div style="display:flex; gap:0.5rem; justify-content:center; flex-wrap:wrap;">
          <button class="btn btn-primary" onclick="viewReceiptFromSuccess('${payment.reference}')">View Receipt</button>
          <button class="btn btn-outline" onclick="window.print()">Print Receipt</button>
          <button class="btn btn-outline" onclick="location.hash='parent-dashboard'">Back to Dashboard</button>
        </div>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="card" style="max-width:700px; margin:2rem auto; text-align:center;">
        <div style="font-size:3rem; margin-bottom:1rem;">❌</div>
        <h2 style="margin-bottom:0.5rem; color:var(--danger);">Payment Failed</h2>
        <p style="color:var(--text-muted); margin-bottom:1.5rem;">${escapeHtml(data.message || "Your payment could not be processed. Please try again.")}</p>
        <div style="display:flex; gap:0.5rem; justify-content:center; flex-wrap:wrap;">
          <button class="btn btn-primary" onclick="location.hash='parent-dashboard'">Back to Dashboard</button>
        </div>
      </div>
    `;
  }
}

async function viewReceiptFromSuccess(reference) {
  try {
    const res = await api.get("/api/parents/me/payments/verify?reference=" + encodeURIComponent(reference));
    if (res.payment && res.receipt) {
      viewParentReceipt(res.payment.studentId, res.payment.id);
    } else {
      alert("Receipt not available yet.");
    }
  } catch (err) {
    alert("Failed to load receipt: " + err.message);
  }
}


async function renderParentPaymentHistory(preselectedStudentId) {
  currentParentView = "payments";
  parentPaymentHistoryFilter = preselectedStudentId || "";
  const content = document.getElementById("parent-content");
  if (!content) return;

  content.innerHTML = `
    <div style="margin-bottom:1.5rem; display:flex; align-items:center; gap:1rem; flex-wrap:wrap;">
      <button class="btn btn-outline" onclick="renderParentChildrenList()">&larr; Back to Children</button>
      <h2 style="margin-bottom:0; flex:1;">Payment History</h2>
    </div>
    <div id="parent-payments-loading" class="loading-state">Loading payment history...</div>
    <div id="parent-payments-content" style="display:none;"></div>
  `;

  try {
    const data = await api.get("/api/parents/me/payments");
    let payments = data.payments || [];
    const children = data.children || [];

    let filteredPayments = payments;
    if (parentPaymentHistoryFilter) {
      filteredPayments = payments.filter(p => p.studentId === parentPaymentHistoryFilter);
    }

    document.getElementById("parent-payments-loading").style.display = "none";
    const paymentsContent = document.getElementById("parent-payments-content");
    paymentsContent.style.display = "block";

    const filterHtml = children.length > 1 ? `
      <div style="margin-bottom:1rem;">
        <label for="parent-payment-filter" style="font-weight:500; margin-right:0.5rem;">Filter by child:</label>
        <select id="parent-payment-filter" onchange="applyParentPaymentFilter(this.value)" style="padding:0.5rem; border-radius:0.375rem; border:1px solid var(--border);">
          <option value="">All Children</option>
          ${children.map(c => `<option value="${c.studentId}" ${parentPaymentHistoryFilter === c.studentId ? 'selected' : ''}>${escapeHtml(c.firstName + " " + c.lastName)}</option>`).join("")}
        </select>
      </div>
    ` : "";

    if (filteredPayments.length === 0) {
      paymentsContent.innerHTML = `
        ${filterHtml}
        <div class="card">
          <div class="card-title">Payment History</div>
          <div class="empty-state">
            <h3>No payments recorded yet</h3>
            <p>Payments made for your linked children will appear here.</p>
          </div>
        </div>
      `;
      return;
    }

    paymentsContent.innerHTML = `
      ${filterHtml}
      <div class="card">
        <div class="card-title">Payment History</div>
        <div class="table-container" style="overflow-x:auto;">
          <table>
            <thead>
              <tr>
                <th>Child</th>
                <th>Fee</th>
                <th>Amount</th>
                <th>Date</th>
                <th>Method</th>
                <th>Reference</th>
                <th>Receipt</th>
              </tr>
            </thead>
            <tbody>
              ${filteredPayments.map(p => `
                <tr>
                  <td><strong>${escapeHtml(p.studentName)}</strong></td>
                  <td>${escapeHtml(p.feeName)}</td>
                  <td>&#8358;${parseFloat(p.amount).toLocaleString()}</td>
                  <td>${p.paidAt ? new Date(p.paidAt).toLocaleDateString() : new Date(p.createdAt).toLocaleDateString()}</td>
                  <td>${escapeHtml(p.method || "-")}</td>
                  <td>${escapeHtml(p.reference || "-")}</td>
                  <td><button class="btn btn-small btn-primary" onclick="viewParentReceipt('${p.studentId}', '${p.id}')">View Receipt</button></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (err) {
    document.getElementById("parent-payments-loading").style.display = "none";
    paymentsContent.style.display = "block";
    paymentsContent.innerHTML = `
      <button class="btn btn-outline" onclick="renderParentChildrenList()" style="margin-bottom:1rem;">&larr; Back to Children</button>
      <div class="alert alert-error">${escapeHtml(err.message)}</div>
    `;
  }
}

function applyParentPaymentFilter(studentId) {
  parentPaymentHistoryFilter = studentId;
  renderParentPaymentHistory(studentId || undefined);
}

async function viewParentReceipt(studentId, paymentId) {
  const modal = document.createElement("div");
  modal.className = "modal-overlay active";
  modal.innerHTML = `
    <div class="modal" style="max-width: 600px; width: 95%;">
      <div class="modal-header">
        <h3>Payment Receipt</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
      </div>
      <div class="modal-body">
        <div id="parent-receipt-loading" class="loading-state">Loading receipt...</div>
        <div id="parent-receipt-content" style="display:none;"></div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  try {
    const data = await api.get("/api/parents/me/children/" + studentId + "/payments/" + paymentId + "/receipt");
    const receipt = data.receipt;

    document.getElementById("parent-receipt-loading").style.display = "none";
    const receiptContent = document.getElementById("parent-receipt-content");
    receiptContent.style.display = "block";

    receiptContent.innerHTML = `
      <div id="parent-receipt-print-area" style="border:1px solid var(--border); border-radius:0.5rem; padding:1.5rem; background:#fff;">
        <div style="text-align:center; margin-bottom:1rem; padding-bottom:1rem; border-bottom:2px solid var(--primary);">
          <div style="font-size:1.25rem; font-weight:700; color:var(--primary);">Scholapay</div>
          <div style="font-size:0.85rem; color:var(--text-muted);">School Fee Management</div>
        </div>

        <div style="display:flex; justify-content:space-between; margin-bottom:1rem; flex-wrap:wrap; gap:0.5rem;">
          <div>
            <div style="font-weight:600;">${escapeHtml(receipt.school.name)}</div>
            <div style="font-size:0.85rem; color:var(--text-muted);">ID: ${escapeHtml(receipt.school.id)}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-weight:600;">Receipt #${escapeHtml(receipt.receiptNumber)}</div>
            <div style="font-size:0.85rem; color:var(--text-muted);">${new Date(receipt.printedAt).toLocaleString()}</div>
          </div>
        </div>

        <div style="margin-bottom:1rem; padding:1rem; background:var(--bg); border-radius:0.375rem;">
          <div style="font-weight:600; margin-bottom:0.5rem;">Student Information</div>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.5rem; font-size:0.9rem;">
            <div><span style="color:var(--text-muted);">Name:</span> ${escapeHtml(receipt.student.name)}</div>
            <div><span style="color:var(--text-muted);">Student ID:</span> ${escapeHtml(receipt.student.id)}</div>
            <div><span style="color:var(--text-muted);">Admission No:</span> ${escapeHtml(receipt.student.admissionNumber || "-")}</div>
          </div>
        </div>

        <div style="margin-bottom:1rem; padding:1rem; background:var(--bg); border-radius:0.375rem;">
          <div style="font-weight:600; margin-bottom:0.5rem;">Payment Details</div>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.5rem; font-size:0.9rem;">
            <div><span style="color:var(--text-muted);">Fee:</span> ${escapeHtml(receipt.fee.name)}</div>
            <div><span style="color:var(--text-muted);">Original Amount:</span> &#8358;${parseFloat(receipt.fee.originalAmount).toLocaleString()}</div>
            <div><span style="color:var(--text-muted);">Previous Paid:</span> &#8358;${parseFloat(receipt.fee.previousPaid).toLocaleString()}</div>
            <div><span style="color:var(--text-muted);">Current Payment:</span> &#8358;${parseFloat(receipt.fee.currentPayment).toLocaleString()}</div>
            <div><span style="color:var(--text-muted);">Remaining Balance:</span> &#8358;${parseFloat(receipt.fee.remainingBalance).toLocaleString()}</div>
            <div><span style="color:var(--text-muted);">Method:</span> ${escapeHtml(receipt.payment.method)}</div>
            <div><span style="color:var(--text-muted);">Reference:</span> ${escapeHtml(receipt.payment.reference)}</div>
            <div><span style="color:var(--text-muted);">Date:</span> ${new Date(receipt.payment.date).toLocaleDateString()}</div>
            ${receipt.payment.notes ? `<div style="grid-column:1/-1;"><span style="color:var(--text-muted);">Notes:</span> ${escapeHtml(receipt.payment.notes)}</div>` : ""}
          </div>
        </div>

        <div style="text-align:center; margin-top:1rem; padding-top:1rem; border-top:1px solid var(--border); color:var(--text-muted); font-size:0.85rem;">
          Powered by Scholapay
        </div>
      </div>

      <div style="display:flex; gap:0.5rem; margin-top:1rem; justify-content:flex-end;">
        <button class="btn btn-outline" onclick="window.print()">Print Receipt</button>
        <button class="btn btn-primary" onclick="this.closest('.modal-overlay').remove()">Close</button>
      </div>
    `;
  } catch (err) {
    document.getElementById("parent-receipt-loading").style.display = "none";
    receiptContent.style.display = "block";
    receiptContent.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
  }
}


