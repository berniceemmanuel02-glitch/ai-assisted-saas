let invoicesState = { items: [] };

function renderInvoices(container) {
  container.innerHTML = `
    <div class="card">
      <div class="card-title">Sales Invoices</div>
      <div id="invoices-alert" class="alert alert-error"></div>
      <div id="invoices-loading">Loading...</div>
      <div id="invoices-table" class="table-container" style="display:none;"></div>
    </div>
    <div id="receipt-modal" class="modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <h3>Receipt</h3>
          <button class="modal-close" onclick="invoicesCloseModal()">&times;</button>
        </div>
        <pre id="receipt-content" style="background:var(--bg); padding:1rem; border-radius:var(--radius); overflow:auto; font-size:0.85rem;"></pre>
      </div>
    </div>
  `;

  invoicesLoadList();
}

async function invoicesLoadList() {
  const loading = document.getElementById("invoices-loading");
  const table = document.getElementById("invoices-table");
  try {
    const data = await api.get("/api/invoices");
    invoicesState.items = data.invoices || [];
    if (invoicesState.items.length === 0) {
      loading.innerHTML = `<div class="empty-state"><h3>No invoices yet</h3></div>`;
    } else {
      loading.style.display = "none";
      table.style.display = "block";
      table.innerHTML = `
        <table>
          <thead><tr><th>Invoice #</th><th>Sale ID</th><th>Total</th><th>Status</th><th>Issued</th><th>Actions</th></tr></thead>
          <tbody>
            ${invoicesState.items.map(inv => `
              <tr>
                <td>${escapeHtml(inv.invoiceNumber)}</td>
                <td>${escapeHtml(inv.saleId)}</td>
                <td>$${Number(inv.total).toFixed(2)}</td>
                <td><span class="badge ${inv.paymentStatus === 'paid' ? 'badge-success' : 'badge-warning'}">${escapeHtml(inv.paymentStatus)}</span></td>
                <td>${new Date(inv.issueDate).toLocaleString()}</td>
                <td>
                  ${inv.paymentStatus !== "paid" ? `<button class="btn btn-small btn-success" onclick="invoicesPay('${inv.id}')">Pay</button>` : ""}
                  <button class="btn btn-small btn-primary" onclick="invoicesReceipt('${inv.id}')">Receipt</button>
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

async function invoicesPay(id) {
  if (!confirm("Pay this invoice?")) return;
  try {
    await api.post(`/api/invoices/${id}/pay`);
    invoicesLoadList();
  } catch (err) {
    showAlert("#invoices-alert", err.message);
  }
}

async function invoicesReceipt(id) {
  try {
    const data = await api.get(`/api/invoices/${id}/receipt`);
    document.getElementById("receipt-content").textContent = JSON.stringify(data, null, 2);
    document.getElementById("receipt-modal").classList.add("active");
  } catch (err) {
    showAlert("#invoices-alert", err.message);
  }
}

function invoicesCloseModal() {
  document.getElementById("receipt-modal").classList.remove("active");
}

window.invoicesPay = invoicesPay;
window.invoicesReceipt = invoicesReceipt;
window.invoicesCloseModal = invoicesCloseModal;
