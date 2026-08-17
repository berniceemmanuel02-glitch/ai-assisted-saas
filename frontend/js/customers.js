let customersState = { items: [], editingId: null };

function renderCustomers(container) {
  container.innerHTML = `
    <div class="card">
      <div class="card-title" style="display:flex; justify-content:space-between; align-items:center;">
        Customers
        <button class="btn btn-primary" onclick="customersOpenModal()">+ New Customer</button>
      </div>
      <div id="customers-alert" class="alert alert-error"></div>
      <div id="customers-loading">Loading...</div>
      <div id="customers-table" class="table-container" style="display:none;"></div>
    </div>
    <div id="customer-modal" class="modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <h3 id="customer-modal-title">New Customer</h3>
          <button class="modal-close" onclick="customersCloseModal()">&times;</button>
        </div>
        <div id="customer-modal-alert" class="alert alert-error"></div>
        <form id="customer-form">
          <input type="hidden" id="customer-id">
          <div class="form-group">
            <label>Name</label>
            <input type="text" id="customer-name" required>
          </div>
          <div class="form-group">
            <label>Email</label>
            <input type="email" id="customer-email">
          </div>
          <div class="form-group">
            <label>Phone</label>
            <input type="text" id="customer-phone">
          </div>
          <div class="form-group">
            <label>Company</label>
            <input type="text" id="customer-company">
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%; justify-content:center;">Save</button>
        </form>
      </div>
    </div>
  `;

  customersLoadList();
  document.getElementById("customer-form").addEventListener("submit", customersHandleSubmit);
}

async function customersLoadList() {
  const loading = document.getElementById("customers-loading");
  const table = document.getElementById("customers-table");
  try {
    const data = await api.get("/api/customers");
    customersState.items = data.customers || [];
    if (customersState.items.length === 0) {
      loading.innerHTML = `<div class="empty-state"><h3>No customers yet</h3><p>Add your first customer.</p></div>`;
    } else {
      loading.style.display = "none";
      table.style.display = "block";
      table.innerHTML = `
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Company</th><th>Actions</th></tr></thead>
          <tbody>
            ${customersState.items.map(c => `
              <tr>
                <td>${escapeHtml(c.name)}</td>
                <td>${escapeHtml(c.email || "")}</td>
                <td>${escapeHtml(c.phone || "")}</td>
                <td>${escapeHtml(c.company || "")}</td>
                <td>
                  <button class="btn btn-small btn-primary" onclick="customersEdit('${c.id}')">Edit</button>
                  <button class="btn btn-small btn-danger" onclick="customersDelete('${c.id}')">Delete</button>
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

function customersOpenModal() {
  customersState.editingId = null;
  document.getElementById("customer-modal-title").textContent = "New Customer";
  document.getElementById("customer-id").value = "";
  document.getElementById("customer-name").value = "";
  document.getElementById("customer-email").value = "";
  document.getElementById("customer-phone").value = "";
  document.getElementById("customer-company").value = "";
  hideAlert("#customer-modal-alert");
  document.getElementById("customer-modal").classList.add("active");
}

function customersCloseModal() {
  document.getElementById("customer-modal").classList.remove("active");
}

function customersEdit(id) {
  const c = customersState.items.find(x => x.id === id);
  if (!c) return;
  customersState.editingId = id;
  document.getElementById("customer-modal-title").textContent = "Edit Customer";
  document.getElementById("customer-id").value = c.id;
  document.getElementById("customer-name").value = c.name;
  document.getElementById("customer-email").value = c.email || "";
  document.getElementById("customer-phone").value = c.phone || "";
  document.getElementById("customer-company").value = c.company || "";
  hideAlert("#customer-modal-alert");
  document.getElementById("customer-modal").classList.add("active");
}

async function customersHandleSubmit(e) {
  e.preventDefault();
  const id = document.getElementById("customer-id").value;
  const name = document.getElementById("customer-name").value.trim();
  const email = document.getElementById("customer-email").value.trim();
  const phone = document.getElementById("customer-phone").value.trim();
  const company = document.getElementById("customer-company").value.trim();
  try {
    if (id) {
      await api.put(`/api/customers/${id}`, { name, email, phone, company });
    } else {
      await api.post("/api/customers", { name, email, phone, company });
    }
    customersCloseModal();
    customersLoadList();
  } catch (err) {
    showAlert("#customer-modal-alert", err.message);
  }
}

async function customersDelete(id) {
  if (!confirm("Delete this customer?")) return;
  try {
    await api.delete(`/api/customers/${id}`);
    customersLoadList();
  } catch (err) {
    showAlert("#customers-alert", err.message);
  }
}

window.customersOpenModal = customersOpenModal;
window.customersCloseModal = customersCloseModal;
window.customersEdit = customersEdit;
window.customersDelete = customersDelete;
