let studentSearch = "";
let studentFilter = "";

function renderStudents(container) {
  container.innerHTML = `
    <div class="card">
      <div class="card-title">Students</div>
      <div id="students-alert" class="alert alert-error"></div>
      <div id="students-loading" class="loading-state">Loading...</div>
      <div id="students-content" style="display:none;"></div>
    </div>
  `;

  const content = document.getElementById("students-content");

  const searchBar = document.createElement("div");
  searchBar.className = "search-bar";
  searchBar.innerHTML = `
    <input type="text" id="student-search-input" placeholder="Search students by name or admission number..." value="${escapeHtml(studentSearch)}">
    <select id="student-filter-select">
      <option value="">All Status</option>
      <option value="active">Active</option>
      <option value="inactive">Inactive</option>
    </select>
    <button class="btn btn-primary" onclick="openStudentModal()">Add Student</button>
  `;

  const listContainer = document.createElement("div");
  listContainer.id = "student-list-container";

  content.appendChild(searchBar);
  content.appendChild(listContainer);

  document.getElementById("student-search-input").addEventListener("input", (e) => {
    studentSearch = e.target.value.toLowerCase();
    renderStudentList(listContainer);
  });

  document.getElementById("student-filter-select").addEventListener("change", (e) => {
    studentFilter = e.target.value;
    renderStudentList(listContainer);
  });

  renderStudentList(listContainer);
}

async function renderStudentList(container) {
  try {
    const data = await api.get("/api/students");
    let students = data.students || [];

    if (studentSearch) {
      students = students.filter(s =>
        (s.firstName + " " + s.lastName).toLowerCase().includes(studentSearch) ||
        s.admissionNumber.toLowerCase().includes(studentSearch)
      );
    }
    if (studentFilter) {
      students = students.filter(s => (s.status || "active") === studentFilter);
    }

    document.getElementById("students-loading").style.display = "none";
    document.getElementById("students-content").style.display = "block";

    if (students.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No students found</h3>
          <p>Add your first student to get started.</p>
          <button class="btn btn-primary" onclick="openStudentModal()">Add Student</button>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Admission No</th>
              <th>Class</th>
              <th>Parent Name</th>
              <th>Parent Phone</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${students.map(s => {
              const status = s.status || "active";
              const statusBadge = status === "active" ? "badge-success" : status === "inactive" ? "badge-danger" : "badge-warning";
              return `
                <tr>
                  <td><a href="#" onclick="viewStudent('${s.id}'); return false;" style="color:var(--primary); text-decoration:none; font-weight:500;">${escapeHtml(s.firstName + " " + s.lastName)}</a></td>
                  <td>${escapeHtml(s.admissionNumber)}</td>
                  <td>${escapeHtml(s.className || "-")}</td>
                  <td>${escapeHtml(s.parentName)}</td>
                  <td>${escapeHtml(s.parentPhone || "-")}</td>
                  <td><span class="badge ${statusBadge}">${escapeHtml(status)}</span></td>
                  <td>
                    <button class="btn btn-small btn-outline" onclick="viewStudent('${s.id}')">View</button>
                    <button class="btn btn-small btn-outline" onclick="editStudent('${s.id}')">Edit</button>
                    <button class="btn btn-small btn-danger" onclick="deleteStudent('${s.id}')">Remove</button>
                  </td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    document.getElementById("students-loading").style.display = "none";
    document.getElementById("students-content").style.display = "block";
    showAlert("#students-alert", err.message);
  }
}

async function viewStudent(id) {
  try {
    const [studentRes, summaryRes, studentPaymentsRes] = await Promise.all([
      api.get("/api/students/" + id),
      api.get("/api/students/" + id + "/summary"),
      api.get("/api/students/" + id + "/payments"),
    ]);

    const student = studentRes.student;
    const summary = summaryRes;
    const studentPayments = studentPaymentsRes.payments || [];

    const container = document.getElementById("main-content");
    container.innerHTML = `
      <div class="card">
        <div class="card-title">Student Details</div>
        <div id="student-detail-alert" class="alert alert-error"></div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
          <button class="btn btn-outline" onclick="location.hash='students'">&larr; Back to Students</button>
          <div style="display:flex; gap:0.5rem;">
            <button class="btn btn-primary" onclick="editStudent('${student.id}')">Edit</button>
            <button class="btn btn-danger" onclick="deleteStudent('${student.id}')">Remove</button>
          </div>
        </div>

        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:1.5rem; margin-bottom:1.5rem;">
          <div class="card" style="margin-bottom:0;">
            <h3 style="margin-bottom:1rem; font-size:1rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em;">Personal Information</h3>
            <div class="detail-row"><div class="detail-label">Full Name</div><div class="detail-value">${escapeHtml(student.firstName + " " + student.lastName)}</div></div>
            <div class="detail-row"><div class="detail-label">Student ID</div><div class="detail-value">${escapeHtml(student.id)}</div></div>
            <div class="detail-row"><div class="detail-label">Admission Number</div><div class="detail-value">${escapeHtml(student.admissionNumber)}</div></div>
            <div class="detail-row"><div class="detail-label">Class</div><div class="detail-value">${escapeHtml(student.className || "-")}</div></div>
            <div class="detail-row"><div class="detail-label">Gender</div><div class="detail-value">${escapeHtml(student.gender || "-")}</div></div>
            <div class="detail-row"><div class="detail-label">Status</div><div class="detail-value"><span class="badge ${(student.status || 'active') === 'active' ? 'badge-success' : 'badge-danger'}">${escapeHtml(student.status || "active")}</span></div></div>
            <div class="detail-row"><div class="detail-label">Admission Date</div><div class="detail-value">${student.admissionDate ? new Date(student.admissionDate).toLocaleDateString() : "-"}</div></div>
            <div class="detail-row"><div class="detail-label">Address</div><div class="detail-value">${escapeHtml(student.address || "-")}</div></div>
          </div>

          <div class="card" style="margin-bottom:0;">
            <h3 style="margin-bottom:1rem; font-size:1rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em;">Parent / Guardian</h3>
            <div class="detail-row"><div class="detail-label">Name</div><div class="detail-value">${escapeHtml(student.parentName)}</div></div>
            <div class="detail-row"><div class="detail-label">Email</div><div class="detail-value">${escapeHtml(student.parentEmail)}</div></div>
            <div class="detail-row"><div class="detail-label">Phone</div><div class="detail-value">${escapeHtml(student.parentPhone || "-")}</div></div>

            <h3 style="margin:1.5rem 0 1rem; font-size:1rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em;">Fee Summary</h3>
            <div class="detail-row"><div class="detail-label">Total Fees</div><div class="detail-value">&#8358;${parseFloat(summary.totalFees || 0).toLocaleString()}</div></div>
            <div class="detail-row"><div class="detail-label">Total Paid</div><div class="detail-value" style="color:var(--success);">&#8358;${parseFloat(summary.totalPaid || 0).toLocaleString()}</div></div>
            <div class="detail-row"><div class="detail-label">Outstanding</div><div class="detail-value" style="color:var(--danger); font-weight:600;">&#8358;${parseFloat(summary.outstanding || 0).toLocaleString()}</div></div>
            <div class="detail-row"><div class="detail-label">Payment Status</div><div class="detail-value"><span class="badge ${summary.paymentStatus === 'paid' ? 'badge-success' : summary.paymentStatus === 'partial' ? 'badge-warning' : 'badge-danger'}">${escapeHtml(summary.paymentStatus || "unpaid")}</span></div></div>
          </div>
        </div>

        <div class="card" style="margin-bottom:1.5rem;">
          <div class="card-title">Fee Breakdown</div>
          ${summary.fees && summary.fees.length > 0 ? `
            <div class="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Fee Name</th>
                    <th>Total Amount</th>
                    <th>Amount Paid</th>
                    <th>Outstanding</th>
                    <th>Due Date</th>
                    <th>Status</th>
                    <th>Suggested Next Payment</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${summary.fees.map(f => {
                    const statusBadge = f.paymentStatus === 'paid' ? 'badge-success' : f.isOverdue ? 'badge-overdue' : f.paymentStatus === 'partial' ? 'badge-warning' : 'badge-danger';
                    const statusText = f.paymentStatus === 'paid' ? 'Paid' : f.isOverdue ? 'Overdue' : f.paymentStatus === 'partial' ? 'Partially Paid' : 'Outstanding';
                    return `
                      <tr>
                        <td><strong>${escapeHtml(f.feeName)}</strong></td>
                        <td>&#8358;${parseFloat(f.totalAmount).toLocaleString()}</td>
                        <td style="color:var(--success);">&#8358;${parseFloat(f.totalPaid).toLocaleString()}</td>
                        <td style="color:var(--danger); font-weight:600;">&#8358;${parseFloat(f.outstanding).toLocaleString()}</td>
                        <td>${f.dueDate ? new Date(f.dueDate).toLocaleDateString() : "-"} ${f.isOverdue ? `<br><small style="color:var(--danger);">${f.daysOverdue} days overdue</small>` : f.daysRemaining !== null && f.daysRemaining >= 0 ? `<br><small>${f.daysRemaining} days left</small>` : ""}</td>
                        <td><span class="badge ${statusBadge}">${statusText}</span></td>
                        <td>${f.suggestedNextPayment > 0 ? '&#8358;' + parseFloat(f.suggestedNextPayment).toLocaleString() : '-'}</td>
                        <td>
                          ${f.outstanding > 0 ? `<button class="btn btn-small btn-primary" onclick="openPaymentModalForFee('${student.id}', '${f.feeId}')">Pay</button>` : ""}
                        </td>
                      </tr>
                    `;
                  }).join("")}
                </tbody>
              </table>
            </div>
          ` : `
            <div class="empty-state">
              <p>No fee structures assigned yet.</p>
            </div>
          `}
        </div>

        <div class="card">
          <div class="card-title">Payment History</div>
          ${studentPayments.length > 0 ? `
            <div class="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Fee</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Reference</th>
                    <th>Notes</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${studentPayments.map(p => `
                    <tr>
                      <td>${p.paidAt ? new Date(p.paidAt).toLocaleDateString() : new Date(p.createdAt).toLocaleDateString()}</td>
                      <td>${escapeHtml(p.feeName || "-")}</td>
                      <td>&#8358;${parseFloat(p.amount).toLocaleString()}</td>
                      <td>${escapeHtml(p.method || "-")}</td>
                      <td>${escapeHtml(p.reference || "-")}</td>
                      <td>${escapeHtml(p.notes || "-")}</td>
                      <td>
                        <button class="btn btn-small btn-outline" onclick="viewReceipt('${p.id}')">Receipt</button>
                      </td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          ` : `
            <div class="empty-state">
              <p>No payments recorded yet.</p>
            </div>
          `}
        </div>
      </div>
    `;
  } catch (err) {
    showAlert("#student-detail-alert", err.message);
  }
}

function openStudentModal(student = null) {
  const modal = document.createElement("div");
  modal.className = "modal-overlay active";
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>${student ? "Edit Student" : "Add Student"}</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
      </div>
      <div id="student-modal-alert" class="alert alert-error"></div>
      <form id="student-form">
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
          <div class="form-group">
            <label>First Name</label>
            <input type="text" id="st-first-name" required value="${student ? escapeHtml(student.firstName) : ""}">
          </div>
          <div class="form-group">
            <label>Last Name</label>
            <input type="text" id="st-last-name" required value="${student ? escapeHtml(student.lastName) : ""}">
          </div>
        </div>
        <div class="form-group">
          <label>Admission Number</label>
          <input type="text" id="st-admission" required value="${student ? escapeHtml(student.admissionNumber) : ""}">
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
          <div class="form-group">
            <label>Class / Level</label>
            <input type="text" id="st-class" value="${student ? escapeHtml(student.className || "") : ""}">
          </div>
          <div class="form-group">
            <label>Gender</label>
            <select id="st-gender">
              <option value="">Select</option>
              <option value="male" ${student && student.gender === "male" ? "selected" : ""}>Male</option>
              <option value="female" ${student && student.gender === "female" ? "selected" : ""}>Female</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>Parent / Guardian Name</label>
          <input type="text" id="st-parent-name" required value="${student ? escapeHtml(student.parentName) : ""}">
        </div>
        <div class="form-group">
          <label>Parent / Guardian Email</label>
          <input type="email" id="st-parent-email" required value="${student ? escapeHtml(student.parentEmail) : ""}">
        </div>
        <div class="form-group">
          <label>Parent / Guardian Phone</label>
          <input type="tel" id="st-parent-phone" value="${student ? escapeHtml(student.parentPhone || "") : ""}">
        </div>
        <div class="form-group">
          <label>Address</label>
          <textarea id="st-address" rows="2">${student ? escapeHtml(student.address || "") : ""}</textarea>
        </div>
        <button type="submit" class="btn btn-primary" style="width:100%; justify-content:center;">${student ? "Update Student" : "Add Student"}</button>
      </form>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById("student-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const alertEl = document.getElementById("student-modal-alert");
    const body = {
      firstName: document.getElementById("st-first-name").value,
      lastName: document.getElementById("st-last-name").value,
      admissionNumber: document.getElementById("st-admission").value,
      className: document.getElementById("st-class").value,
      parentName: document.getElementById("st-parent-name").value,
      parentEmail: document.getElementById("st-parent-email").value,
      parentPhone: document.getElementById("st-parent-phone").value,
      gender: document.getElementById("st-gender").value,
      address: document.getElementById("st-address").value,
    };

    try {
      if (student) {
        await api.put("/api/students/" + student.id, body);
      } else {
        await api.post("/api/students", body);
      }
      modal.remove();
      renderStudentList(document.getElementById("student-list-container"));
    } catch (err) {
      alertEl.textContent = err.message || "Operation failed";
      alertEl.style.display = "block";
    }
  });
}

function editStudent(id) {
  api.get("/api/students/" + id).then(data => {
    if (data.student) openStudentModal(data.student);
  }).catch(() => showAlert("#students-alert", "Failed to load student"));
}

function deleteStudent(id) {
  if (!confirm("Are you sure you want to remove this student? This action cannot be undone.")) return;
  api.delete("/api/students/" + id).then(() => {
    renderStudentList(document.getElementById("student-list-container"));
  }).catch(() => showAlert("#students-alert", "Failed to remove student"));
}
