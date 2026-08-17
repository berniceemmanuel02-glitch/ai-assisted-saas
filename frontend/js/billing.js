let billingState = { invoices: [] };

function renderBilling(container) {
  container.innerHTML = `
    <div class="card">
      <div class="card-title" style="display:flex; justify-content:space-between; align-items:center;">
        Subscription Billing
        <button class="btn btn-primary" onclick="billingOpenModal()">+ New Invoice</button>
      </div>
      <div id="billing-alert" class="alert alert-error"></div>
      <div id="billing-loading">Loading...</div>
      <div id="billing-table" class="table-container" style="display:none;"></div>
    </div>
    <div id="billing-modal" class="modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <h3>Create Subscription Invoice</h3>
          <button class="modal-close" onclick="billingCloseModal()">&times;</button>
        </div>
        <div id="billing-modal-alert" class="alert alert-error"></div>
        <form id="billing-form">
          <div class="form-group">
            <label>Plan</label>
            <select id="billing-plan">
              <option value="free">Starter (Free)</option>
              <option value="pro">Professional ($29/mo)</option>
              <option value="enterprise">Enterprise ($99/mo)</option>
            </select>
          </div>
          <div class="form-group">
            <label>Amount (optional)</label>
            <input type="number" id="billing-amount" step="0.01" min="0" placeholder="Override amount">
          </div>
          <div class="form-group">
            <label>Description (optional)</label>
            <input type="text" id="billing-description" placeholder="Invoice description">
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%; justify-content:center;">Create Invoice</button>
        </form>
      </div>
    </div>
    <div id="billing-receipt-modal" class="modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <h3>Receipt</h3>
          <button class="modal-close" onclick="billingCloseReceiptModal()">&times;</button>
        </div>
        <pre id="billing-receipt-content" style="background:var(--bg); padding:1rem; border-radius:var(--radius); overflow:auto; font-size:0.85rem;"></pre>
      </div>
    </div>
  `;

  billingLoadList();
  document.getElementById("billing-form").addEventListener("submit", billingHandleSubmit);
}

async function billingLoadList() {
  const loading = document.getElementById("billing-loading");
  const table = document.getElementById("billing-table");
  try {
    const data = await api.get("/api/billing/");
    billingState.invoices = data.invoices || [];
    if (billingState.invoices.length === 0) {
      loading.innerHTML = `<div class="empty-state"><h3>No subscription invoices</h3><p>Create one to test billing.</p></div>`;
    } else {
      loading.style.display = "none";
      table.style.display = "block";
      table.innerHTML = `
        <table>
          <thead><tr><th>Invoice #</th><th>Amount</th><th>Status</th><th>Description</th><th>Actions</th></tr></thead>
          <tbody>
            ${billingState.invoices.map(inv => `
              <tr>
                <td>${escapeHtml(inv.invoiceNumber)}</td>
                <td>$${Number(inv.amount).toFixed(2)}</td>
                <td><span class="badge ${inv.status === 'paid' ? 'badge-success' : 'badge-warning'}">${escapeHtml(inv.status)}</span></td>
                <td>${escapeHtml(inv.description || "")}</td>
                <td>
                  ${inv.status !== "paid" ? `<button class="btn btn-small btn-success" onclick="billingPay('${inv.id}')">Pay</button>` : ""}
                  ${inv.status === "paid" ? `<button class="btn btn-small btn-primary" onclick="billingReceipt('${inv.id}')">Receipt</button>` : ""}
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `;
    }
  } catch (err) {
    loading.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
  }
}

function billingOpenModal() {
  hideAlert("#billing-modal-alert");
  document.getElementById("billing-form").reset();
  document.getElementById("billing-modal").classList.add("active");
}

function billingCloseModal() {
  document.getElementById("billing-modal").classList.remove("active");
}

async function billingHandleSubmit(e) {
  e.preventDefault();
  const planId = document.getElementById("billing-plan").value;
  const amount = document.getElementById("billing-amount").value ? parseFloat(document.getElementById("billing-amount").value) : undefined;
  const description = document.getElementById("billing-description").value.trim() || undefined;
  try {
    await api.post("/api/billing/create", { planId, amount, description });
    billingCloseModal();
    billingLoadList();
  } catch (err) {
    showAlert("#billing-modal-alert", err.message);
  }
}

async function billingPay(id) {
  if (!confirm("Pay this subscription invoice?")) return;
  try {
    await api.post(`/api/billing/pay/${id}`);
    billingLoadList();
  } catch (err) {
    showAlert("#billing-alert", err.message);
  }
}

async function billingReceipt(id) {
  try {
    const data = await api.get(`/api/billing/receipt/${id}`);
    document.getElementById("billing-receipt-content").textContent = JSON.stringify(data, null, 2);
    document.getElementById("billing-receipt-modal").classList.add("active");
  } catch (err) {
    showAlert("#billing-alert", err.message);
  }
}

function billingCloseReceiptModal() {
  document.getElementById("billing-receipt-modal").classList.remove("active");
}

window.billingOpenModal = billingOpenModal;
window.billingCloseModal = billingCloseModal;
window.billingPay = billingPay;
window.billingReceipt = billingReceipt;
window.billingCloseReceiptModal = billingCloseReceiptModal;
