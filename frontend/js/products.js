let productsState = { items: [], editingId: null };

function renderProducts(container) {
  container.innerHTML = `
    <div class="card">
      <div class="card-title" style="display:flex; justify-content:space-between; align-items:center;">
        Products
        <button class="btn btn-primary" onclick="productsOpenModal()">+ New Product</button>
      </div>
      <div id="products-alert" class="alert alert-error"></div>
      <div id="products-loading">Loading...</div>
      <div id="products-table" class="table-container" style="display:none;"></div>
    </div>
    <div id="product-modal" class="modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <h3 id="product-modal-title">New Product</h3>
          <button class="modal-close" onclick="productsCloseModal()">&times;</button>
        </div>
        <div id="product-modal-alert" class="alert alert-error"></div>
        <form id="product-form">
          <input type="hidden" id="product-id">
          <div class="form-group">
            <label>Name</label>
            <input type="text" id="product-name" required>
          </div>
          <div class="form-group">
            <label>Price</label>
            <input type="number" id="product-price" step="0.01" min="0" required>
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea id="product-description" rows="3"></textarea>
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%; justify-content:center;">Save</button>
        </form>
      </div>
    </div>
  `;

  productsLoadList();

  document.getElementById("product-form").addEventListener("submit", productsHandleSubmit);
}

async function productsLoadList() {
  const loading = document.getElementById("products-loading");
  const table = document.getElementById("products-table");
  try {
    const data = await api.get("/api/products");
    productsState.items = data.products || [];
    if (productsState.items.length === 0) {
      loading.innerHTML = `<div class="empty-state"><h3>No products yet</h3><p>Create your first product to get started.</p></div>`;
    } else {
      loading.style.display = "none";
      table.style.display = "block";
      table.innerHTML = `
        <table>
          <thead><tr><th>Name</th><th>Price</th><th>Description</th><th>Actions</th></tr></thead>
          <tbody>
            ${productsState.items.map(p => `
              <tr>
                <td>${escapeHtml(p.name)}</td>
                <td>$${Number(p.price).toFixed(2)}</td>
                <td>${escapeHtml(p.description || "")}</td>
                <td>
                  <button class="btn btn-small btn-primary" onclick="productsEdit('${p.id}')">Edit</button>
                  <button class="btn btn-small btn-danger" onclick="productsDelete('${p.id}')">Delete</button>
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

function productsOpenModal() {
  productsState.editingId = null;
  document.getElementById("product-modal-title").textContent = "New Product";
  document.getElementById("product-id").value = "";
  document.getElementById("product-name").value = "";
  document.getElementById("product-price").value = "";
  document.getElementById("product-description").value = "";
  hideAlert("#product-modal-alert");
  document.getElementById("product-modal").classList.add("active");
}

function productsCloseModal() {
  document.getElementById("product-modal").classList.remove("active");
}

function productsEdit(id) {
  const p = productsState.items.find(x => x.id === id);
  if (!p) return;
  productsState.editingId = id;
  document.getElementById("product-modal-title").textContent = "Edit Product";
  document.getElementById("product-id").value = p.id;
  document.getElementById("product-name").value = p.name;
  document.getElementById("product-price").value = p.price;
  document.getElementById("product-description").value = p.description || "";
  hideAlert("#product-modal-alert");
  document.getElementById("product-modal").classList.add("active");
}

async function productsHandleSubmit(e) {
  e.preventDefault();
  const id = document.getElementById("product-id").value;
  const name = document.getElementById("product-name").value.trim();
  const price = parseFloat(document.getElementById("product-price").value);
  const description = document.getElementById("product-description").value.trim();
  try {
    if (id) {
      await api.put(`/api/products/${id}`, { name, price, description });
    } else {
      await api.post("/api/products", { name, price, description });
    }
    productsCloseModal();
    productsLoadList();
  } catch (err) {
    showAlert("#product-modal-alert", err.message);
  }
}

async function productsDelete(id) {
  if (!confirm("Delete this product?")) return;
  try {
    await api.delete(`/api/products/${id}`);
    productsLoadList();
  } catch (err) {
    showAlert("#products-alert", err.message);
  }
}

window.productsOpenModal = productsOpenModal;
window.productsCloseModal = productsCloseModal;
window.productsEdit = productsEdit;
window.productsDelete = productsDelete;
