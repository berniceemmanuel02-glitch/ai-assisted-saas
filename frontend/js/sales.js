let salesState = { items: [], customers: [], products: [] };

function renderSales(container) {
  container.innerHTML = `
    <div class="card">
      <div class="card-title" style="display:flex; justify-content:space-between; align-items:center;">
        Sales
        <button class="btn btn-primary" onclick="salesOpenModal()">+ New Sale</button>
      </div>
      <div id="sales-alert" class="alert alert-error"></div>
      <div id="sales-loading">Loading...</div>
      <div id="sales-table" class="table-container" style="display:none;"></div>
    </div>
    <div id="sale-modal" class="modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <h3>New Sale</h3>
          <button class="modal-close" onclick="salesCloseModal()">&times;</button>
        </div>
        <div id="sale-modal-alert" class="alert alert-error"></div>
        <form id="sale-form">
          <div class="form-group">
            <label>Customer</label>
            <select id="sale-customer" required></select>
          </div>
          <div class="form-group">
            <label>Products</label>
            <select id="sale-product"></select>
            <input type="number" id="sale-quantity" min="1" value="1" placeholder="Qty" style="margin-top:0.5rem;">
            <button type="button" class="btn btn-small btn-primary" onclick="salesAddItem()" style="margin-top:0.5rem;">Add Item</button>
          </div>
          <div id="sale-items-list" style="margin-bottom:1rem;"></div>
          <div class="form-group">
            <label>Payment Method</label>
            <select id="sale-payment" required>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="transfer">Transfer</option>
            </select>
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%; justify-content:center;">Create Sale</button>
        </form>
      </div>
    </div>
  `;

  salesState.items = [];
  salesState.selectedItems = [];
  salesLoadList();
  salesLoadOptions();
  document.getElementById("sale-form").addEventListener("submit", salesHandleSubmit);
}

async function salesLoadList() {
  const loading = document.getElementById("sales-loading");
  const table = document.getElementById("sales-table");
  try {
    const data = await api.get("/api/sales");
    salesState.items = data.sales || [];
    if (salesState.items.length === 0) {
      loading.innerHTML = `<div class="empty-state"><h3>No sales yet</h3></div>`;
    } else {
      loading.style.display = "none";
      table.style.display = "block";
      table.innerHTML = `
        <table>
          <thead><tr><th>ID</th><th>Customer</th><th>Total</th><th>Payment</th><th>Date</th></tr></thead>
          <tbody>
            ${salesState.items.map(s => `
              <tr>
                <td>${escapeHtml(s.id)}</td>
                <td>${escapeHtml(s.customerId)}</td>
                <td>$${Number(s.total).toFixed(2)}</td>
                <td>${escapeHtml(s.paymentMethod)}</td>
                <td>${new Date(s.date).toLocaleString()}</td>
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

async function salesLoadOptions() {
  try {
    const [custData, prodData] = await Promise.all([
      api.get("/api/customers"),
      api.get("/api/products"),
    ]);
    salesState.customers = custData.customers || [];
    salesState.products = prodData.products || [];
    const custSelect = document.getElementById("sale-customer");
    if (custSelect) {
      custSelect.innerHTML = salesState.customers.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join("");
    }
    const prodSelect = document.getElementById("sale-product");
    if (prodSelect) {
      prodSelect.innerHTML = salesState.products.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)} ($${Number(p.price).toFixed(2)})</option>`).join("");
    }
  } catch (err) {
    showAlert("#sales-alert", "Failed to load options: " + err.message);
  }
}

function salesAddItem() {
  const productId = document.getElementById("sale-product").value;
  const quantity = parseInt(document.getElementById("sale-quantity").value, 10);
  if (!productId || isNaN(quantity) || quantity <= 0) return;
  salesState.selectedItems.push({ productId, quantity });
  salesRenderSelectedItems();
}

function salesRemoveItem(index) {
  salesState.selectedItems.splice(index, 1);
  salesRenderSelectedItems();
}

function salesRenderSelectedItems() {
  const list = document.getElementById("sale-items-list");
  if (!list) return;
  list.innerHTML = salesState.selectedItems.map((item, i) => {
    const product = salesState.products.find(p => p.id === item.productId);
    return `<div style="display:flex; justify-content:space-between; align-items:center; padding:0.35rem 0; border-bottom:1px solid var(--border);">
      <span>${escapeHtml(product ? product.name : item.productId)} x ${item.quantity}</span>
      <button type="button" class="btn btn-small btn-danger" onclick="salesRemoveItem(${i})">Remove</button>
    </div>`;
  }).join("");
}

function salesOpenModal() {
  salesState.selectedItems = [];
  salesRenderSelectedItems();
  document.getElementById("sale-form").reset();
  hideAlert("#sale-modal-alert");
  document.getElementById("sale-modal").classList.add("active");
}

function salesCloseModal() {
  document.getElementById("sale-modal").classList.remove("active");
}

async function salesHandleSubmit(e) {
  e.preventDefault();
  const customerId = document.getElementById("sale-customer").value;
  const paymentMethod = document.getElementById("sale-payment").value;
  if (!customerId) { showAlert("#sale-modal-alert", "Select a customer"); return; }
  if (salesState.selectedItems.length === 0) { showAlert("#sale-modal-alert", "Add at least one product"); return; }
  try {
    await api.post("/api/sales", {
      customerId,
      items: salesState.selectedItems,
      paymentMethod,
    });
    salesCloseModal();
    salesLoadList();
  } catch (err) {
    showAlert("#sale-modal-alert", err.message);
  }
}

window.salesOpenModal = salesOpenModal;
window.salesCloseModal = salesCloseModal;
window.salesAddItem = salesAddItem;
window.salesRemoveItem = salesRemoveItem;
