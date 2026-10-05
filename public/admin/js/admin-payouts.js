// ===== ADMIN PAYOUTS MANAGEMENT =====
class AdminPayoutsClass {
    constructor() {
        this.currentPaymentPage = 1;
        this.totalPaymentPages = 1;
        this.totalPayments = 0;
        this.pendingPayouts = [];
        this.payments = [];
        this.isInitialized = false;
        this.init();
    }
    
    async init() {
        if (this.isInitialized) return;
        this.isInitialized = true;
        
        if (!window.AdminApp) {
            await new Promise(resolve => {
                const checkInterval = setInterval(() => {
                    if (window.AdminApp) {
                        clearInterval(checkInterval);
                        resolve();
                    }
                }, 100);
            });
        }
        
        await this.loadPayouts();
        this.setupEventListeners();
        console.log('✅ AdminPayouts initialized');
    }
    
    async loadPayouts() {
        await Promise.all([
            this.loadPendingPayouts(),
            this.loadAllPayments()
        ]);
    }
    
    async loadPendingPayouts() {
        const container = document.getElementById('pendingPayoutsBody');
        if (!container) return;
        
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
        if (!container) return;
        
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
            const isProcessing = payout.status === 'processing';
            
            return `
                <tr>
                    <td>
                        <strong>${this.escapeHtml(instructor.firstName || '')} ${this.escapeHtml(instructor.lastName || '')}</strong>
                        <br>
                        <small style="color: var(--admin-gray);">${this.escapeHtml(instructor.email || '—')}</small>
                    </td>
                    <td style="font-weight: 700; color: var(--admin-gray-dark);">
                        ₦${(payout.amount || 0).toLocaleString()}
                    </td>
                    <td>${this.escapeHtml(bankDetails.bankName || '—')}</td>
                    <td>${this.escapeHtml(bankDetails.accountNumber || '—')}</td>
                    <td>
                        <span style="
                            padding: 4px 12px;
                            border-radius: 20px;
                            font-size: 0.75rem;
                            font-weight: 600;
                            background: ${isProcessing ? '#DBEAFE' : '#FEF3C7'};
                            color: ${isProcessing ? '#1E40AF' : '#92400E'};
                        ">
                            ${isProcessing ? '🔄 Processing' : '⏳ Pending'}
                        </span>
                    </td>
                    <td>
                        <div class="actions" style="display: flex; gap: 8px; flex-wrap: wrap;">
                            ${!isProcessing ? `
                                <button class="btn-sm btn-success" 
                                        onclick="window.AdminPayouts.processPayout('${payout._id}', 'approve')"
                                        style="background: #10B981; color: white; padding: 6px 14px; border-radius: 6px; font-size: 0.75rem; font-weight: 600; border: none; cursor: pointer;">
                                    ✅ Approve
                                </button>
                                <button class="btn-sm btn-danger" 
                                        onclick="window.AdminPayouts.processPayout('${payout._id}', 'reject')"
                                        style="background: #EF4444; color: white; padding: 6px 14px; border-radius: 6px; font-size: 0.75rem; font-weight: 600; border: none; cursor: pointer;">
                                    ❌ Reject
                                </button>
                            ` : `
                                <button class="btn-sm btn-primary" 
                                        onclick="window.AdminPayouts.markAsCompleted('${payout._id}', '${payout.amount}')"
                                        style="background: #6C3CE1; color: white; padding: 6px 14px; border-radius: 6px; font-size: 0.75rem; font-weight: 600; border: none; cursor: pointer;">
                                    ✅ Mark as Completed
                                </button>
                                <button class="btn-sm btn-danger" 
                                        onclick="window.AdminPayouts.processPayout('${payout._id}', 'reject')"
                                        style="background: #EF4444; color: white; padding: 6px 14px; border-radius: 6px; font-size: 0.75rem; font-weight: 600; border: none; cursor: pointer;">
                                    ❌ Cancel
                                </button>
                            `}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }
    
    async loadAllPayments() {
        const container = document.getElementById('allPaymentsBody');
        if (!container) return;
        
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
        if (!container) return;
        
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
            
            const statusColors = {
                success: 'active',
                pending: 'pending',
                failed: 'inactive'
            };
            
            return `
                <tr>
                    <td>${this.escapeHtml(user.firstName || '')} ${this.escapeHtml(user.lastName || '')}</td>
                    <td>${this.escapeHtml(classData.title || '—')}</td>
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
        if (!container || !info) return;
        
        const start = (this.currentPaymentPage - 1) * 20 + 1;
        const end = Math.min(this.currentPaymentPage * 20, this.totalPayments);
        info.textContent = `Showing ${start}-${end} of ${this.totalPayments}`;
        
        let buttons = `<button onclick="window.AdminPayouts.goToPaymentPage('prev')" ${this.currentPaymentPage <= 1 ? 'disabled' : ''}>←</button>`;
        
        for (let i = 1; i <= this.totalPaymentPages; i++) {
            if (i === this.currentPaymentPage) {
                buttons += `<button class="active">${i}</button>`;
            } else if (i <= 3 || i > this.totalPaymentPages - 3 || Math.abs(i - this.currentPaymentPage) <= 1) {
                buttons += `<button onclick="window.AdminPayouts.goToPaymentPage(${i})">${i}</button>`;
            } else if (i === 4 && this.currentPaymentPage > 5) {
                buttons += `<span>...</span>`;
            }
        }
        
        buttons += `<button onclick="window.AdminPayouts.goToPaymentPage('next')" ${this.currentPaymentPage >= this.totalPaymentPages ? 'disabled' : ''}>→</button>`;
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
        
        const confirmMsg = action === 'approve' 
            ? 'Approve this withdrawal? The instructor will be notified and you can then transfer the funds manually.'
            : 'Reject this withdrawal? The funds will be returned to the instructor.';
            
        if (!confirm(confirmMsg)) return;
        
        // Find the buttons and show loading
        const buttons = document.querySelectorAll(`button[onclick*="${payoutId}"]`);
        buttons.forEach(btn => {
            btn.disabled = true;
            btn.dataset.originalText = btn.textContent;
        });
        
        const clickedBtn = Array.from(buttons).find(b => 
            b.getAttribute('onclick')?.includes(action)
        );
        if (clickedBtn) {
            clickedBtn.textContent = action === 'approve' ? '⏳ Approving...' : '⏳ Rejecting...';
        }
        
        try {
            const response = await fetch(`${window.AdminApp.baseUrl}/api/admin/payouts/${payoutId}/process`, {
                method: 'PUT',
                headers: window.AdminApp.getHeaders(),
                body: JSON.stringify({ action })
            });
            
            const data = await response.json();
            
            if (data.success) {
                const message = action === 'approve' 
                    ? '✅ Withdrawal approved! Now transfer the funds manually and mark as completed.'
                    : '✅ Withdrawal rejected and funds returned to instructor.';
                window.AdminApp.showToast(message, 'success');
                await this.loadPayouts();
                window.AdminApp.updateBadgeCounts();
            } else {
                throw new Error(data.message || `Failed to ${actionText} withdrawal`);
            }
        } catch (error) {
            console.error('Process payout error:', error);
            window.AdminApp.showToast(`❌ ${error.message || `Failed to ${actionText} withdrawal`}`, 'error');
            
            buttons.forEach(btn => {
                btn.disabled = false;
                btn.textContent = btn.dataset.originalText || btn.textContent;
            });
        }
    }
    
    async markAsCompleted(payoutId, amount) {
        const transferRef = prompt(
            `Mark ₦${Number(amount).toLocaleString()} as COMPLETED?\n\n` +
            `Have you already sent the money to the instructor's bank account?\n\n` +
            `Enter the transfer reference (optional):`
        );

        if (transferRef === null) return; // User cancelled

        try {
            const response = await fetch(
                `${window.AdminApp.baseUrl}/api/admin/payouts/${payoutId}/complete`,
                {
                    method: 'PUT',
                    headers: window.AdminApp.getHeaders(),
                    body: JSON.stringify({ transferReference: transferRef || undefined })
                }
            );

            const data = await response.json();

            if (data.success) {
                window.AdminApp.showToast('✅ Withdrawal marked as completed! Instructor has been notified.', 'success');
                await this.loadPayouts();
                window.AdminApp.updateBadgeCounts();
            } else {
                throw new Error(data.message || 'Failed to complete');
            }
        } catch (error) {
            console.error('Complete payout error:', error);
            window.AdminApp.showToast(`❌ ${error.message}`, 'error');
        }
    }
    
    setupEventListeners() {
        // Auto-refresh every 60 seconds
        setInterval(() => {
            this.loadPendingPayouts();
        }, 60000);
    }
    
    escapeHtml(s) {
        if (!s) return '';
        return String(s).replace(/[&<>"']/g, ch => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[ch]);
    }
}

// ===== CREATE GLOBAL INSTANCE =====
let AdminPayouts = null;

document.addEventListener('DOMContentLoaded', function() {
    if (document.querySelector('.admin-wrapper') && document.querySelector('#pendingPayoutsBody')) {
        const checkInterval = setInterval(() => {
            if (window.AdminApp) {
                clearInterval(checkInterval);
                AdminPayouts = new AdminPayoutsClass();
                window.AdminPayouts = AdminPayouts;
                console.log('✅ AdminPayouts registered globally');
            }
        }, 100);
        
        setTimeout(() => {
            if (!window.AdminPayouts) {
                console.warn('⚠️ AdminApp not found, creating AdminPayouts anyway');
                AdminPayouts = new AdminPayoutsClass();
                window.AdminPayouts = AdminPayouts;
            }
        }, 5000);
    }
});