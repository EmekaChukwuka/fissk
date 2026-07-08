// ===== ADMIN PAYOUTS MANAGEMENT =====
class AdminPayouts {
    constructor() {
        this.currentPaymentPage = 1;
        this.totalPaymentPages = 1;
        this.totalPayments = 0;
        this.pendingPayouts = [];
        this.payments = [];
        this.init();
    }
    
    async init() {
        await this.loadPayouts();
        this.setupEventListeners();
    }
    
    async loadPayouts() {
        await Promise.all([
            this.loadPendingPayouts(),
            this.loadAllPayments()
        ]);
    }
    
    async loadPendingPayouts() {
        const container = document.getElementById('pendingPayoutsBody');
        container.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px; color: var(--admin-gray);">
                    Loading pending payouts...
                </td>
            </tr>
        `;
        
        try {
            const response = await fetch(`${window.AdminApp.baseUrl}/api/admin/payouts/pending`, {
                headers: window.AdminApp.getHeaders()
            });
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.message || 'Failed to load pending payouts');
            }
            
            this.pendingPayouts = data.withdrawals || [];
            this.renderPendingPayouts();
            
        } catch (error) {
            console.error('Load pending payouts error:', error);
            container.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 40px; color: var(--admin-danger);">
                        ❌ Failed to load pending payouts
                    </td>
                </tr>
            `;
        }
    }
    
    renderPendingPayouts() {
        const container = document.getElementById('pendingPayoutsBody');
        
        if (!this.pendingPayouts || this.pendingPayouts.length === 0) {
            container.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 40px; color: var(--admin-gray);">
                        ✅ No pending withdrawals
                    </td>
                </tr>
            `;
            return;
        }
        
        container.innerHTML = this.pendingPayouts.map(payout => {
            const instructor = payout.instructor || {};
            const bankDetails = payout.bankDetails || {};
            
            return `
                <tr>
                    <td>
                        <strong>${instructor.firstName || ''} ${instructor.lastName || ''}</strong>
                        <br>
                        <small style="color: var(--admin-gray);">${instructor.email || '—'}</small>
                    </td>
                    <td style="font-weight: 700; color: var(--admin-gray-dark);">
                        ₦${(payout.amount || 0).toLocaleString()}
                    </td>
                    <td>${bankDetails.bankName || '—'}</td>
                    <td>${bankDetails.accountNumber || '—'}</td>
                    <td>${payout.createdAt ? new Date(payout.createdAt).toLocaleDateString() : '—'}</td>
                    <td>
                        <div class="actions">
                            <button class="btn-sm btn-success" onclick="AdminPayouts.processPayout('${payout._id}', 'approve')">
                                ✅ Approve
                            </button>
                            <button class="btn-sm btn-danger" onclick="AdminPayouts.processPayout('${payout._id}', 'reject')">
                                ❌ Reject
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }
    
    async loadAllPayments() {
        const container = document.getElementById('allPaymentsBody');
        container.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 40px; color: var(--admin-gray);">
                    Loading transactions...
                </td>
            </tr>
        `;
        
        try {
            const url = `${window.AdminApp.baseUrl}/api/admin/payments?page=${this.currentPaymentPage}&limit=20`;
            
            const response = await fetch(url, {
                headers: window.AdminApp.getHeaders()
            });
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.message || 'Failed to load payments');
            }
            
            this.payments = data.payments || [];
            this.totalPayments = data.pagination?.total || 0;
            this.totalPaymentPages = data.pagination?.pages || 1;
            this.currentPaymentPage = data.pagination?.page || 1;
            
            this.renderAllPayments();
            this.renderPaymentPagination();
            
        } catch (error) {
            console.error('Load payments error:', error);
            container.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 40px; color: var(--admin-danger);">
                        ❌ Failed to load transactions
                    </td>
                </tr>
            `;
        }
    }
    
    renderAllPayments() {
        const container = document.getElementById('allPaymentsBody');
        
        if (!this.payments || this.payments.length === 0) {
            container.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 40px; color: var(--admin-gray);">
                        No transactions found
                    </td>
                </tr>
            `;
            return;
        }
        
        container.innerHTML = this.payments.map(payment => {
            const user = payment.user || {};
            const classData = payment.class || {};
            const instructor = payment.instructor || {};
            
            const statusColors = {
                success: 'active',
                pending: 'pending',
                failed: 'inactive'
            };
            
            return `
                <tr>
                    <td>${user.firstName || ''} ${user.lastName || ''}</td>
                    <td>${classData.title || '—'}</td>
                    <td>₦${(payment.amount || 0).toLocaleString()}</td>
                    <td>₦${(payment.instructorEarning || 0).toLocaleString()}</td>
                    <td>₦${(payment.platformFee || 0).toLocaleString()}</td>
                    <td>${payment.paidAt ? new Date(payment.paidAt).toLocaleDateString() : '—'}</td>
                    <td><span class="status-badge ${statusColors[payment.status] || 'pending'}">${payment.status || '—'}</span></td>
                </tr>
            `;
        }).join('');
    }
    
    renderPaymentPagination() {
        const container = document.getElementById('paymentPaginationButtons');
        const info = document.getElementById('paymentPageInfo');
        
        const start = (this.currentPaymentPage - 1) * 20 + 1;
        const end = Math.min(this.currentPaymentPage * 20, this.totalPayments);
        info.textContent = `Showing ${start}-${end} of ${this.totalPayments}`;
        
        let buttons = `<button onclick="AdminPayouts.goToPaymentPage('prev')" ${this.currentPaymentPage <= 1 ? 'disabled' : ''}>←</button>`;
        
        for (let i = 1; i <= this.totalPaymentPages; i++) {
            if (i === this.currentPaymentPage) {
                buttons += `<button class="active">${i}</button>`;
            } else if (i <= 3 || i > this.totalPaymentPages - 3 || Math.abs(i - this.currentPaymentPage) <= 1) {
                buttons += `<button onclick="AdminPayouts.goToPaymentPage(${i})">${i}</button>`;
            } else if (i === 4 && this.currentPaymentPage > 5) {
                buttons += `<span>...</span>`;
            }
        }
        
        buttons += `<button onclick="AdminPayouts.goToPaymentPage('next')" ${this.currentPaymentPage >= this.totalPaymentPages ? 'disabled' : ''}>→</button>`;
        container.innerHTML = buttons;
    }
    
    async goToPaymentPage(page) {
        if (page === 'prev' && this.currentPaymentPage > 1) {
            this.currentPaymentPage--;
        } else if (page === 'next' && this.currentPaymentPage < this.totalPaymentPages) {
            this.currentPaymentPage++;
        } else if (typeof page === 'number') {
            this.currentPaymentPage = page;
        } else {
            return;
        }
        await this.loadAllPayments();
    }
    
    async processPayout(payoutId, action) {
        const actionText = action === 'approve' ? 'approve' : 'reject';
        if (!confirm(`Are you sure you want to ${actionText} this withdrawal request?`)) return;
        
        try {
            const response = await fetch(`${window.AdminApp.baseUrl}/api/admin/payouts/${payoutId}/process`, {
                method: 'PUT',
                headers: window.AdminApp.getHeaders(),
                body: JSON.stringify({ action })
            });
            
            const data = await response.json();
            
            if (data.success) {
                window.AdminApp.showToast(`✅ Withdrawal ${action === 'approve' ? 'approved' : 'rejected'} successfully!`, 'success');
                await this.loadPayouts();
                window.AdminApp.updateBadgeCounts();
            } else {
                throw new Error(data.message || `Failed to ${actionText} withdrawal`);
            }
        } catch (error) {
            console.error('Process payout error:', error);
            window.AdminApp.showToast(`❌ Failed to ${actionText} withdrawal`, 'error');
        }
    }
    
    setupEventListeners() {
        // Auto-refresh every 60 seconds
        setInterval(() => {
            this.loadPendingPayouts();
        }, 60000);
    }
}

// ===== INITIALIZE =====
document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('.admin-wrapper') && document.querySelector('#pendingPayoutsBody')) {
        window.AdminPayouts = new AdminPayouts();
    }
});