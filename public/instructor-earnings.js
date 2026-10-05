// frontend/instructor-earnings.js
// ===== EARNINGS & PAYOUTS MODULE - FIXED =====

class InstructorEarnings {
    constructor(dashboard) {
        this.dashboard = dashboard;
        this.banks = [];
        this.earnings = null;
        this.bankDetails = null;
        this.bankDetailsVerified = false;
        // Use the same backend URL as the dashboard
        this.baseUrl = 'https://fissk-backend.onrender.com';
        this.init();
    }

    getHeaders() {
        // Try to get headers from dashboard, fallback to own implementation
        if (this.dashboard && typeof this.dashboard.getHeaders === 'function') {
            return this.dashboard.getHeaders();
        }
        
        const headers = { 'Content-Type': 'application/json' };
        const token = localStorage.getItem('token');
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        return headers;
    }

    async init() {
        await this.loadEarnings();
    }

    // ===== LOAD EARNINGS =====
    async loadEarnings() {
        const container = document.getElementById('earningsContent');
        if (!container) return;

        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #6B7280;">
                <div class="spinner"></div>
                <p>Loading your earnings...</p>
            </div>
        `;

        try {
            const res = await fetch(`${this.baseUrl}/api/payout/earnings`, {
                headers: this.getHeaders()
            });

            const data = await res.json();

            if (!data.success) {
                throw new Error(data.message || 'Failed to load earnings');
            }

            this.earnings = data.earnings;
            this.bankDetails = data.bankDetails;
            this.bankDetailsVerified = data.bankDetailsVerified;

            this.renderEarnings();

        } catch (error) {
            console.error('Load earnings error:', error);
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #EF4444;">
                    <p>❌ Failed to load earnings: ${error.message}</p>
                    <button class="btn btn-primary" onclick="window.instructorDashboard.earnings.loadEarnings()" style="margin-top: 16px;">
                        🔄 Retry
                    </button>
                </div>
            `;
        }
    }

    // ===== RENDER EARNINGS =====
    renderEarnings() {
        const container = document.getElementById('earningsContent');
        if (!container || !this.earnings) return;

        const e = this.earnings;
        const hasBankDetails = this.bankDetails && this.bankDetails.accountNumber;

        container.innerHTML = `
            <!-- Stats Cards -->
            <div class="earnings-stats-grid">
                <div class="earnings-stat-card highlight">
                    <div class="stat-icon">💰</div>
                    <div class="stat-value">₦${(e.available || 0).toLocaleString()}</div>
                    <div class="stat-label">Available Balance</div>
                </div>
                <div class="earnings-stat-card">
                    <div class="stat-icon">📈</div>
                    <div class="stat-value">₦${(e.totalRevenue || 0).toLocaleString()}</div>
                    <div class="stat-label">Total Revenue</div>
                </div>
                <div class="earnings-stat-card">
                    <div class="stat-icon">🛒</div>
                    <div class="stat-value">${e.totalSales || 0}</div>
                    <div class="stat-label">Total Sales</div>
                </div>
                <div class="earnings-stat-card">
                    <div class="stat-icon">💸</div>
                    <div class="stat-value">₦${(e.totalWithdrawn || 0).toLocaleString()}</div>
                    <div class="stat-label">Total Withdrawn</div>
                </div>
                ${e.pending > 0 ? `
                <div class="earnings-stat-card pending">
                    <div class="stat-icon">⏳</div>
                    <div class="stat-value">₦${(e.pending || 0).toLocaleString()}</div>
                    <div class="stat-label">Pending Withdrawal</div>
                </div>
                ` : ''}
            </div>

            <!-- Bank Details Section -->
            <div class="earnings-card">
                <div class="card-header">
                    <h3>🏦 Bank Details</h3>
                    ${hasBankDetails ? `
                        <button class="btn btn-outline btn-sm" onclick="window.instructorDashboard.earnings.showBankForm()">
                            ✏️ Update
                        </button>
                    ` : ''}
                </div>
                <div id="bankDetailsDisplay">
                    ${hasBankDetails ? `
                        <div class="bank-info">
                            <div class="bank-field">
                                <span class="field-label">Bank</span>
                                <span class="field-value">${this.escapeHtml(this.bankDetails.bankName)}</span>
                            </div>
                            <div class="bank-field">
                                <span class="field-label">Account Number</span>
                                <span class="field-value">${this.escapeHtml(this.bankDetails.accountNumber)}</span>
                            </div>
                            <div class="bank-field">
                                <span class="field-label">Account Name</span>
                                <span class="field-value">${this.escapeHtml(this.bankDetails.accountName)}</span>
                            </div>
                            <div class="bank-field">
                                <span class="field-label">Status</span>
                                <span class="field-value">
                                    ${this.bankDetailsVerified ? 
                                        '<span class="verified-badge">✅ Verified</span>' : 
                                        '<span class="unverified-badge">⚠️ Not Verified</span>'}
                                </span>
                            </div>
                        </div>
                    ` : `
                        <div class="empty-state">
                            <div class="empty-icon">🏦</div>
                            <h4>No Bank Details</h4>
                            <p>Add your bank details to receive payments from your course sales.</p>
                            <button class="btn btn-primary" onclick="window.instructorDashboard.earnings.showBankForm()">
                                ➕ Add Bank Details
                            </button>
                        </div>
                    `}
                </div>
            </div>

            <!-- Withdraw Section -->
            <div class="earnings-card">
                <div class="card-header">
                    <h3>💸 Request Withdrawal</h3>
                </div>
                <div class="withdraw-section">
                    ${!hasBankDetails ? `
                        <div class="warning-box">
                            ⚠️ Please add your bank details before requesting a withdrawal.
                        </div>
                    ` : e.available <= 0 ? `
                        <div class="info-box">
                            💡 You don't have any funds available to withdraw yet. Keep teaching to earn more!
                        </div>
                    ` : e.pending > 0 ? `
                        <div class="info-box">
                            ⏳ You already have a pending withdrawal of ₦${e.pending.toLocaleString()}.
                            Please wait for it to be processed before requesting another.
                        </div>
                    ` : `
                        <p>Available to withdraw: <strong>₦${e.available.toLocaleString()}</strong></p>
                        <div class="withdraw-actions">
                            <input type="number" id="withdrawAmount" placeholder="Enter amount" min="1" max="${e.available}">
                            <button class="btn btn-primary" onclick="window.instructorDashboard.earnings.requestWithdrawal()">
                                💰 Request Withdrawal
                            </button>
                            <button class="btn btn-outline" onclick="window.instructorDashboard.earnings.withdrawAll()">
                                Withdraw All (₦${e.available.toLocaleString()})
                            </button>
                        </div>
                    `}
                </div>
            </div>

            <!-- Pending Withdrawals -->
            ${e.withdrawals && e.withdrawals.length > 0 ? `
                <div class="earnings-card">
                    <div class="card-header">
                        <h3>📋 Pending Withdrawals</h3>
                    </div>
                    <div class="table-wrapper">
                        <table class="earnings-table">
                            <thead>
                                <tr>
                                    <th>Reference</th>
                                    <th>Amount</th>
                                    <th>Bank</th>
                                    <th>Status</th>
                                    <th>Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${e.withdrawals.map(w => `
                                    <tr>
                                        <td><code>${w.reference}</code></td>
                                        <td><strong>₦${(w.amount || 0).toLocaleString()}</strong></td>
                                        <td>${this.escapeHtml(w.bankDetails?.bankName || '—')}</td>
                                        <td>
                                            <span class="withdrawal-status ${w.status}">
                                                ${this.getStatusLabel(w.status)}
                                            </span>
                                        </td>
                                        <td>${new Date(w.createdAt).toLocaleDateString()}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            ` : ''}

            <!-- Recent Transactions -->
            ${e.transactions && e.transactions.length > 0 ? `
                <div class="earnings-card">
                    <div class="card-header">
                        <h3>💳 Recent Transactions</h3>
                    </div>
                    <div class="table-wrapper">
                        <table class="earnings-table">
                            <thead>
                                <tr>
                                    <th>Student</th>
                                    <th>Course</th>
                                    <th>Amount</th>
                                    <th>Your Earnings</th>
                                    <th>Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${e.transactions.slice(0, 20).map(t => `
                                    <tr>
                                        <td>${this.escapeHtml((t.user?.firstName || '') + ' ' + (t.user?.lastName || ''))}</td>
                                        <td>${this.escapeHtml(t.class?.title || '—')}</td>
                                        <td>₦${(t.amount || 0).toLocaleString()}</td>
                                        <td><strong style="color: #10B981;">+₦${(t.instructorEarning || 0).toLocaleString()}</strong></td>
                                        <td>${t.paidAt ? new Date(t.paidAt).toLocaleDateString() : '—'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            ` : ''}
        `;
    }

    getStatusLabel(status) {
        const labels = {
            'pending': '⏳ Pending',
            'processing': '🔄 Processing',
            'completed': '✅ Completed',
            'failed': '❌ Failed',
            'cancelled': '🚫 Cancelled'
        };
        return labels[status] || status;
    }

    // ===== WITHDRAW ALL =====
    withdrawAll() {
        if (!this.earnings || this.earnings.available <= 0) return;
        const input = document.getElementById('withdrawAmount');
        if (input) {
            input.value = this.earnings.available;
        }
    }

    // ===== SHOW BANK FORM =====
    async showBankForm() {
        const modal = this.createBankModal();
        document.body.appendChild(modal);
        await this.loadBanksList();
    }

    createBankModal() {
        const modal = document.createElement('div');
        modal.className = 'admin-modal active';
        modal.id = 'bankFormModal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h2>🏦 Bank Details</h2>
                    <button class="close-btn" onclick="document.getElementById('bankFormModal').remove()">&times;</button>
                </div>
                <form id="bankForm">
                    <div class="form-group">
                        <label for="bankSelect">Bank Name *</label>
                        <select id="bankSelect" required>
                            <option value="">Loading banks...</option>
                        </select>
                        <input type="hidden" id="bankCode" name="bankCode">
                        <input type="hidden" id="bankNameHidden" name="bankName">
                    </div>
                    <div class="form-group">
                        <label for="accountNumber">Account Number *</label>
                        <input type="text" id="accountNumber" name="accountNumber" 
                               placeholder="10-digit account number" 
                               maxlength="10" 
                               pattern="\\d{10}"
                               required>
                    </div>
                    <div class="form-group">
                        <label for="accountName">Account Name *</label>
                        <input type="text" id="accountName" name="accountName" 
                               placeholder="Will be auto-verified" required>
                        <small style="color: #6B7280; font-size: 0.8rem;">
                            The name will be verified with your bank
                        </small>
                    </div>
                    <div id="validationMessage"></div>
                    <div class="form-actions">
                        <button type="button" class="btn btn-outline" onclick="document.getElementById('bankFormModal').remove()">
                            Cancel
                        </button>
                        <button type="submit" class="btn btn-primary" id="saveBankBtn">
                            💾 Save Bank Details
                        </button>
                    </div>
                </form>
            </div>
        `;

        // Attach submit handler after element is in DOM
        setTimeout(() => {
            const form = document.getElementById('bankForm');
            if (form) {
                form.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.saveBankDetails();
                });
            }
        }, 0);

        return modal;
    }

    async loadBanksList() {
        try {
            const res = await fetch(`${this.baseUrl}/api/payout/banks`, {
                headers: this.getHeaders()
            });

            const data = await res.json();

            if (!data.success) {
                throw new Error(data.message || 'Failed to load banks');
            }

            this.banks = data.banks || [];

            const select = document.getElementById('bankSelect');
            if (select) {
                select.innerHTML = `
                    <option value="">Select your bank...</option>
                    ${this.banks.map(b => `
                        <option value="${b.code}" data-name="${this.escapeHtml(b.name)}">
                            ${this.escapeHtml(b.name)}
                        </option>
                    `).join('')}
                `;

                select.addEventListener('change', function() {
                    const opt = this.options[this.selectedIndex];
                    document.getElementById('bankCode').value = this.value;
                    document.getElementById('bankNameHidden').value = opt.dataset.name || '';
                });
            }

            // Pre-fill if editing
            if (this.bankDetails) {
                const select = document.getElementById('bankSelect');
                if (select && this.bankDetails.bankCode) {
                    select.value = this.bankDetails.bankCode;
                    // Trigger change to populate hidden fields
                    const opt = select.options[select.selectedIndex];
                    if (opt) {
                        document.getElementById('bankCode').value = opt.value;
                        document.getElementById('bankNameHidden').value = opt.dataset.name || '';
                    }
                }
                const accNum = document.getElementById('accountNumber');
                if (accNum) accNum.value = this.bankDetails.accountNumber || '';
                const accName = document.getElementById('accountName');
                if (accName) accName.value = this.bankDetails.accountName || '';
            }
        } catch (error) {
            console.error('Load banks error:', error);
            const select = document.getElementById('bankSelect');
            if (select) {
                select.innerHTML = '<option value="">Failed to load banks. Please try again.</option>';
            }
        }
    }

    async saveBankDetails() {
        const bankCode = document.getElementById('bankCode').value;
        const bankName = document.getElementById('bankNameHidden').value;
        const accountNumber = document.getElementById('accountNumber').value.trim();
        const accountName = document.getElementById('accountName').value.trim();
        const saveBtn = document.getElementById('saveBankBtn');
        const validationMsg = document.getElementById('validationMessage');

        // Validate
        if (!bankCode) {
            validationMsg.innerHTML = '<div class="error-box">Please select a bank</div>';
            return;
        }
        if (!/^\d{10}$/.test(accountNumber)) {
            validationMsg.innerHTML = '<div class="error-box">Account number must be 10 digits</div>';
            return;
        }
        if (!accountName) {
            validationMsg.innerHTML = '<div class="error-box">Please enter the account name</div>';
            return;
        }

        const originalText = saveBtn.textContent;
        saveBtn.textContent = '⏳ Verifying...';
        saveBtn.disabled = true;
        validationMsg.innerHTML = '<div class="info-box">🔍 Verifying with your bank...</div>';

        try {
            const res = await fetch(`${this.baseUrl}/api/payout/bank-details`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({
                    bankName,
                    accountNumber,
                    accountName,
                    bankCode
                })
            });

            const data = await res.json();

            if (data.success) {
                validationMsg.innerHTML = '<div class="success-box">✅ Bank details saved successfully!</div>';
                
                this.bankDetails = data.bankDetails;
                this.bankDetailsVerified = data.bankDetailsVerified;

                setTimeout(() => {
                    const modal = document.getElementById('bankFormModal');
                    if (modal) modal.remove();
                    this.loadEarnings();
                }, 1000);
            } else {
                validationMsg.innerHTML = `<div class="error-box">❌ ${data.message}</div>`;
                saveBtn.textContent = originalText;
                saveBtn.disabled = false;
            }
        } catch (error) {
            console.error('Save bank details error:', error);
            validationMsg.innerHTML = '<div class="error-box">❌ Failed to save. Please try again.</div>';
            saveBtn.textContent = originalText;
            saveBtn.disabled = false;
        }
    }

    // ===== REQUEST WITHDRAWAL =====
    async requestWithdrawal(event) {
        const amountInput = document.getElementById('withdrawAmount');
        const amount = parseFloat(amountInput?.value);

        if (!amount || amount <= 0) {
            this.showToast('Please enter a valid amount', 'error');
            return;
        }

        if (amount > this.earnings.available) {
            this.showToast(`Amount exceeds available balance of ₦${this.earnings.available.toLocaleString()}`, 'error');
            return;
        }

        if (!confirm(`Request a withdrawal of ₦${amount.toLocaleString()}?`)) {
            return;
        }

        const btn = event?.target || document.querySelector('.withdraw-actions .btn-primary');
        const originalText = btn ? btn.textContent : 'Request Withdrawal';
        if (btn) {
            btn.textContent = '⏳ Submitting...';
            btn.disabled = true;
        }

        try {
            const res = await fetch(`${this.baseUrl}/api/payout/withdraw`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({ amount })
            });

            const data = await res.json();

            if (data.success) {
                this.showToast('✅ Withdrawal request submitted successfully!', 'success');
                await this.loadEarnings();
            } else {
                this.showToast('❌ ' + (data.message || 'Failed to request withdrawal'), 'error');
                if (btn) {
                    btn.textContent = originalText;
                    btn.disabled = false;
                }
            }
        } catch (error) {
            console.error('Request withdrawal error:', error);
            this.showToast('❌ Failed to request withdrawal', 'error');
            if (btn) {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        }
    }

    // ===== HELPERS =====
    escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/[&<>"']/g, ch => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[ch]);
    }

    showToast(message, type = 'info') {
        if (this.dashboard && typeof this.dashboard.showMessage === 'function') {
            this.dashboard.showMessage(message, type);
        } else {
            alert(message);
        }
    }
}

// Export for use in instructor-dashboard.js
window.InstructorEarnings = InstructorEarnings;