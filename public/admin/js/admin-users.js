// ===== ADMIN USERS MANAGEMENT =====
class AdminUsersClass {
    constructor() {
        this.currentPage = 1;
        this.totalPages = 1;
        this.totalUsers = 0;
        this.users = [];
        this.filteredUsers = [];
        this.pendingUserId = null;
        this.isInitialized = false;
        this.init();
    }
    
    async init() {
        if (this.isInitialized) return;
        this.isInitialized = true;
        
        // Wait for AdminApp to be ready
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
        
        await this.loadUsers();
        this.setupEventListeners();
        console.log('✅ AdminUsers initialized');
    }
    
    async loadUsers() {
        const container = document.getElementById('usersTableBody');
        if (!container) return;
        
        container.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px; color: var(--admin-gray);">
                    Loading users...
                </td>
            </tr>
        `;
        
        try {
            const type = document.getElementById('userTypeFilter')?.value || 'all';
            const status = document.getElementById('userStatusFilter')?.value || 'all';
            const search = document.getElementById('userSearch')?.value || '';
            
            const url = `${window.AdminApp.baseUrl}/api/admin/users?page=${this.currentPage}&limit=20&type=${type}&status=${status}&search=${encodeURIComponent(search)}`;
            
            const response = await fetch(url, {
                headers: window.AdminApp.getHeaders()
            });
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.message || 'Failed to load users');
            }
            
            this.users = data.users || [];
            this.totalUsers = data.pagination?.total || 0;
            this.totalPages = data.pagination?.pages || 1;
            this.currentPage = data.pagination?.page || 1;
            
            this.renderUsers();
            this.renderPagination();
            
        } catch (error) {
            console.error('Load users error:', error);
            if (container) {
                container.innerHTML = `
                    <tr>
                        <td colspan="6" style="text-align: center; padding: 40px; color: var(--admin-danger);">
                            ❌ Failed to load users. <button onclick="AdminUsers.loadUsers()" style="cursor: pointer; color: var(--admin-primary);">Retry</button>
                        </td>
                    </tr>
                `;
            }
        }
    }
    
    renderUsers() {
        const container = document.getElementById('usersTableBody');
        if (!container) return;
        
        if (!this.users || this.users.length === 0) {
            container.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 40px; color: var(--admin-gray);">
                        No users found
                    </td>
                </tr>
            `;
            return;
        }
        
        container.innerHTML = this.users.map(user => {
            const status = user.isActive !== false ? 'active' : 'inactive';
            const statusLabel = status === 'active' ? '✅ Active' : '⛔ Inactive';
            
            let approvalBadge = '';
            if (user.userType === 'instructor' && !user.isApproved) {
                approvalBadge = '<span class="status-badge pending">⏳ Pending</span>';
            }
            
            let adminBadge = '';
            if (user.userType === 'admin') {
                adminBadge = '<span class="status-badge" style="background: #e0e7ff; color: #4f46e5;">👑 Admin</span>';
            }
            
            return `
                <tr>
                    <td>
                        <strong>${user.firstName || ''} ${user.lastName || ''}</strong>
                        ${approvalBadge}
                        ${adminBadge}
                    </td>
                    <td>${user.email}</td>
                    <td>${user.userType || '—'}</td>
                    <td><span class="status-badge ${status}">${statusLabel}</span></td>
                    <td>${user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}</td>
                    <td>
                        <div class="actions">
                            ${user.userType === 'instructor' && !user.isApproved ? `
                                <button class="btn-sm btn-success" onclick="AdminUsers.openApproveModal('${user._id}', '${user.firstName} ${user.lastName}')">
                                    ✅ Approve
                                </button>
                            ` : ''}
                            ${user.userType !== 'admin' ? `
                                <button class="btn-sm ${user.isActive !== false ? 'btn-danger' : 'btn-success'}" 
                                        onclick="AdminUsers.toggleUserStatus('${user._id}', ${user.isActive !== false ? 'false' : 'true'})">
                                    ${user.isActive !== false ? '⛔ Suspend' : '✅ Activate'}
                                </button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }
    
    renderPagination() {
        const container = document.getElementById('paginationButtons');
        const info = document.getElementById('pageInfo');
        if (!container || !info) return;
        
        const start = (this.currentPage - 1) * 20 + 1;
        const end = Math.min(this.currentPage * 20, this.totalUsers);
        info.textContent = `Showing ${start}-${end} of ${this.totalUsers}`;
        
        let buttons = `<button onclick="AdminUsers.goToPage('prev')" ${this.currentPage <= 1 ? 'disabled' : ''}>←</button>`;
        
        for (let i = 1; i <= this.totalPages; i++) {
            if (i === this.currentPage) {
                buttons += `<button class="active">${i}</button>`;
            } else if (i <= 3 || i > this.totalPages - 3 || Math.abs(i - this.currentPage) <= 1) {
                buttons += `<button onclick="AdminUsers.goToPage(${i})">${i}</button>`;
            } else if (i === 4 && this.currentPage > 5) {
                buttons += `<span>...</span>`;
            }
        }
        
        buttons += `<button onclick="AdminUsers.goToPage('next')" ${this.currentPage >= this.totalPages ? 'disabled' : ''}>→</button>`;
        container.innerHTML = buttons;
    }
    
    async goToPage(page) {
        if (page === 'prev' && this.currentPage > 1) {
            this.currentPage--;
        } else if (page === 'next' && this.currentPage < this.totalPages) {
            this.currentPage++;
        } else if (typeof page === 'number') {
            this.currentPage = page;
        } else {
            return;
        }
        await this.loadUsers();
    }
    
    filterUsers() {
        this.currentPage = 1;
        this.loadUsers();
    }
    
    openApproveModal(userId, userName) {
        this.pendingUserId = userId;
        const nameEl = document.getElementById('approveInstructorName');
        if (nameEl) nameEl.textContent = userName;
        const modal = document.getElementById('approveModal');
        if (modal) modal.classList.add('active');
    }
    
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.remove('active');
        this.pendingUserId = null;
    }
    
    async confirmApprove() {
        if (!this.pendingUserId) return;
        
        try {
            const response = await fetch(`${window.AdminApp.baseUrl}/api/admin/instructors/${this.pendingUserId}/approve`, {
                method: 'PUT',
                headers: window.AdminApp.getHeaders(),
                body: JSON.stringify({ approve: true })
            });
            
            const data = await response.json();
            
            if (data.success) {
                window.AdminApp.showToast('✅ Instructor approved successfully!', 'success');
                this.closeModal('approveModal');
                await this.loadUsers();
                if (window.AdminApp.updateBadgeCounts) {
                    window.AdminApp.updateBadgeCounts();
                }
            } else {
                throw new Error(data.message || 'Failed to approve');
            }
        } catch (error) {
            console.error('Approve error:', error);
            window.AdminApp.showToast('❌ Failed to approve instructor', 'error');
        }
    }
    
    async confirmReject() {
        if (!this.pendingUserId) return;
        
        if (!confirm('Are you sure you want to reject this instructor?')) return;
        
        try {
            const response = await fetch(`${window.AdminApp.baseUrl}/api/admin/instructors/${this.pendingUserId}/approve`, {
                method: 'PUT',
                headers: window.AdminApp.getHeaders(),
                body: JSON.stringify({ approve: false })
            });
            
            const data = await response.json();
            
            if (data.success) {
                window.AdminApp.showToast('❌ Instructor rejected', 'info');
                this.closeModal('approveModal');
                await this.loadUsers();
                if (window.AdminApp.updateBadgeCounts) {
                    window.AdminApp.updateBadgeCounts();
                }
            } else {
                throw new Error(data.message || 'Failed to reject');
            }
        } catch (error) {
            console.error('Reject error:', error);
            window.AdminApp.showToast('❌ Failed to reject instructor', 'error');
        }
    }
    
    async toggleUserStatus(userId, activate) {
        const action = activate ? 'activate' : 'suspend';
        if (!confirm(`Are you sure you want to ${action} this user?`)) return;
        
        try {
            const response = await fetch(`${window.AdminApp.baseUrl}/api/admin/users/${userId}/status`, {
                method: 'PUT',
                headers: window.AdminApp.getHeaders(),
                body: JSON.stringify({ isActive: activate })
            });
            
            const data = await response.json();
            
            if (data.success) {
                window.AdminApp.showToast(`✅ User ${activate ? 'activated' : 'suspended'} successfully`, 'success');
                await this.loadUsers();
            } else {
                throw new Error(data.message || 'Failed to update status');
            }
        } catch (error) {
            console.error('Status update error:', error);
            window.AdminApp.showToast(`❌ Failed to ${action} user`, 'error');
        }
    }
    
    setupEventListeners() {
        const searchInput = document.getElementById('userSearch');
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.filterUsers();
                }
            });
        }
    }
}

// ===== CREATE GLOBAL INSTANCE =====
let AdminUsers = null;

document.addEventListener('DOMContentLoaded', function() {
    // Wait for AdminApp
    const checkInterval = setInterval(() => {
        if (window.AdminApp) {
            clearInterval(checkInterval);
            AdminUsers = new AdminUsersClass();
            window.AdminUsers = AdminUsers;
            console.log('✅ AdminUsers registered globally');
        }
    }, 100);
    
    // Fallback: if AdminApp doesn't load in 5 seconds, try anyway
    setTimeout(() => {
        if (!window.AdminApp) {
            console.warn('⚠️ AdminApp not found, creating AdminUsers anyway');
            AdminUsers = new AdminUsersClass();
            window.AdminUsers = AdminUsers;
        }
    }, 5000);
});