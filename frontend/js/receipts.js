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
