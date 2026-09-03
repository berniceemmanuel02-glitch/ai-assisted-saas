let parentsList = [];

async function renderParents(container) {
  container.innerHTML = `
    <div class="card">
      <div class="card-title">Parents / Guardians</div>
      <div id="parents-alert" class="alert alert-error"></div>
      <div id="parents-loading" class="loading-state">Loading parents...</div>
      <div id="parents-content" style="display:none;"></div>
    </div>
  `;

  await loadParentsList();
}

async function loadParentsList() {
  const loadingEl = document.getElementById("parents-loading");
  const contentEl = document.getElementById("parents-content");
  if (!loadingEl || !contentEl) return;

  loadingEl.style.display = "block";
  contentEl.style.display = "none";

  try {
    const data = await api.get("/api/parents");
    parentsList = data.parents || [];

    loadingEl.style.display = "none";
    contentEl.style.display = "block";

    if (parentsList.length === 0) {
      contentEl.innerHTML = `
        <div class="empty-state">
          <h3>No parents linked yet</h3>
          <p>Link parents to students to see them here.</p>
        </div>
      `;
      return;
    }

    contentEl.innerHTML = `
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Parent Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Children</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${parentsList.map(p => `
              <tr>
                <td><strong>${escapeHtml(p.parentName)}</strong></td>
                <td>${escapeHtml(p.parentEmail || "-")}</td>
                <td>${escapeHtml(p.parentPhone || "-")}</td>
                <td>${p.children.length}</td>
                <td>
                  <button class="btn btn-small btn-primary" onclick="viewParentStudents('${p.parentId}')">View Students</button>
                  <button class="btn btn-small btn-outline" onclick="editParentModal('${p.parentId}')">Edit</button>
                  <button class="btn btn-small btn-danger" onclick="unlinkParent('${p.parentId}')">Unlink All</button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    loadingEl.style.display = "none";
    contentEl.style.display = "block";
    content.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
  }
}

async function viewParentStudents(parentId) {
  const main = document.getElementById("main-content");
  main.innerHTML = `
    <div class="card">
      <div class="card-title">Students Linked to Parent</div>
      <div id="parent-students-loading" class="loading-state">Loading students...</div>
      <div id="parent-students-content" style="display:none;"></div>
    </div>
  `;

  try {
    const data = await api.get("/api/parents/" + parentId + "/students");
    const students = data.students || [];

    document.getElementById("parent-students-loading").style.display = "none";
    const content = document.getElementById("parent-students-content");
    content.style.display = "block";

    if (students.length === 0) {
      content.innerHTML = `
        <div class="empty-state">
          <h3>No students linked</h3>
        </div>
      `;
      return;
    }

    content.innerHTML = `
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Admission No</th>
              <th>Class</th>
              <th>Parent Name</th>
              <th>Parent Phone</th>
              <th>Parent Email</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${students.map(s => `
              <tr>
                <td><strong>${escapeHtml(s.firstName + " " + s.lastName)}</strong></td>
                <td>${escapeHtml(s.admissionNumber || "-")}</td>
                <td>${escapeHtml(s.className || "-")}</td>
                <td>${escapeHtml(s.parentName || "-")}</td>
                <td>${escapeHtml(s.parentPhone || "-")}</td>
                <td>${escapeHtml(s.parentEmail || "-")}</td>
                <td><button class="btn btn-small btn-danger" onclick="unlinkParentStudent('${s.linkId}')">Unlink</button></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    document.getElementById("parent-students-loading").style.display = "none";
    const content = document.getElementById("parent-students-content");
    content.style.display = "block";
    content.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
  }
}

function editParentModal(parentId) {
  const parent = parentsList.find(p => p.parentId === parentId);
  if (!parent) return;

  const modal = document.createElement("div");
  modal.className = "modal-overlay active";
  modal.innerHTML = `
    <div class="modal" style="max-width: 500px;">
      <div class="modal-header">
        <h3>Edit Parent/Guardian</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
      </div>
      <div class="modal-body">
        <div id="edit-parent-alert" class="alert alert-error"></div>
        <form id="edit-parent-form">
          <div class="form-group">
            <label>Parent Name</label>
            <input type="text" id="edit-parent-name" value="${escapeHtml(parent.parentName)}" required>
          </div>
          <div class="form-group">
            <label>Parent Phone</label>
            <input type="tel" id="edit-parent-phone" value="${escapeHtml(parent.parentPhone || "")}">
          </div>
          <div class="form-group">
            <label>Parent Email</label>
            <input type="email" id="edit-parent-email" value="${escapeHtml(parent.parentEmail || "")}">
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%; justify-content:center;">Save Changes</button>
        </form>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById("edit-parent-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const alertEl = document.getElementById("edit-parent-alert");
    alertEl.style.display = "none";
    try {
      await api.put("/api/parents/link/" + parent.children[0].linkId, {
        parentName: document.getElementById("edit-parent-name").value,
        parentPhone: document.getElementById("edit-parent-phone").value,
        parentEmail: document.getElementById("edit-parent-email").value,
      });
      modal.remove();
      await loadParentsList();
    } catch (err) {
      alertEl.textContent = err.message || "Failed to update parent";
      alertEl.style.display = "block";
    }
  });
}

async function unlinkParent(parentId) {
  if (!confirm("Are you sure you want to unlink this parent from all students?")) return;
  try {
    const data = await api.get("/api/parents/" + parentId + "/students");
    const students = data.students || [];
    for (const s of students) {
      await api.delete("/api/parents/link/" + s.linkId);
    }
    await loadParentsList();
  } catch (err) {
    alert("Failed to unlink parent: " + (err.message || "Unknown error"));
  }
}

async function unlinkParentStudent(linkId) {
  if (!confirm("Are you sure you want to unlink this student from the parent?")) return;
  try {
    await api.delete("/api/parents/link/" + linkId);
    const main = document.getElementById("main-content");
    const title = main.querySelector(".card-title");
    if (title && title.textContent.includes("Parent")) {
      const parentId = title.textContent.replace("Students Linked to Parent", "").trim();
      await viewParentStudents(parentId);
    }
    await loadParentsList();
  } catch (err) {
    alert("Failed to unlink student: " + (err.message || "Unknown error"));
  }
}
