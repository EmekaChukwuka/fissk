// ===== ADMIN APP - MAIN =====
class AdminApp {
    constructor() {
        this.token = localStorage.getItem('token');
        this.user = JSON.parse(localStorage.getItem('user'));
        this.baseUrl = 'https://fissk-backend.onrender.com';
        
        // Check if user is logged in and is admin
        if (!this.token || !this.user || this.user.user_type !== 'admin') {
            console.log(this.user)
            //window.location.href = '../login.html';
            return;
        }
        
        this.init();
    }
    
    init() {
        this.updateUserInfo();
        this.initSidebar();
        this.setupEventListeners();
    }
    
    getHeaders() {
        return {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
        };
    }
    
    updateUserInfo() {
        document.getElementById('adminName').textContent = this.user.firstname || 'Admin';
        // Determine role from user data or default
        document.getElementById('adminRole').textContent = 'Super Admin';
    }
    
    initSidebar() {
        // Mobile sidebar toggle
        const hamburger = document.createElement('button');
        hamburger.innerHTML = '☰';
        hamburger.style.cssText = `
            display: none;
            background: none;
            border: none;
            font-size: 1.5rem;
            color: var(--admin-gray-dark);
            cursor: pointer;
            padding: 8px;
        `;
        hamburger.id = 'sidebarToggle';
        
        const topbar = document.querySelector('.admin-topbar');
        if (topbar) {
            topbar.prepend(hamburger);
        }
        
        hamburger.addEventListener('click', () => {
            document.getElementById('adminSidebar').classList.toggle('open');
        });
        
        // Close sidebar on outside click (mobile)
        document.addEventListener('click', (e) => {
            const sidebar = document.getElementById('adminSidebar');
            if (window.innerWidth <= 768) {
                if (!sidebar.contains(e.target) && e.target !== hamburger) {
                    sidebar.classList.remove('open');
                }
            }
        });
        
        // Update badge counts
        this.updateBadgeCounts();
    }
    
    async updateBadgeCounts() {
        try {
            // Get pending instructors
            const usersRes = await fetch(`${this.baseUrl}/api/admin/instructors/pending`, {
                headers: this.getHeaders()
            });
            const usersData = await usersRes.json();
            if (usersData.success) {
                const count = usersData.instructors?.length || 0;
                const badge = document.getElementById('pendingUsersBadge');
                if (badge) {
                    badge.textContent = count;
                    badge.style.display = count > 0 ? 'inline' : 'none';
                }
            }
            
            // Get pending payouts
            const payoutsRes = await fetch(`${this.baseUrl}/api/admin/payouts/pending`, {
                headers: this.getHeaders()
            });
            const payoutsData = await payoutsRes.json();
            if (payoutsData.success) {
                const count = payoutsData.withdrawals?.length || 0;
                const badge = document.getElementById('pendingPayoutsBadge');
                if (badge) {
                    badge.textContent = count;
                    badge.style.display = count > 0 ? 'inline' : 'none';
                }
            }
        } catch (error) {
            console.error('Error updating badges:', error);
        }
    }
    
    setupEventListeners() {
        // Handle active nav links
        document.querySelectorAll('.admin-nav a').forEach(link => {
            link.addEventListener('click', function() {
                document.querySelectorAll('.admin-nav a').forEach(l => l.classList.remove('active'));
                this.classList.add('active');
            });
        });
    }
    
    // ===== DASHBOARD =====
    async initDashboard() {
        try {
            const response = await fetch(`${this.baseUrl}/api/admin/stats`, {
                headers: this.getHeaders()
            });
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.message || 'Failed to load stats');
            }
            
            this.renderStats(data.stats);
            this.renderRecentActivity(data.stats.recentActivity || []);
            
        } catch (error) {
            console.error('Dashboard error:', error);
            this.showToast('Failed to load dashboard data', 'error');
        }
    }
    
    renderStats(stats) {
        document.getElementById('totalStudents').textContent = stats.totalStudents || 0;
        document.getElementById('totalInstructors').textContent = stats.totalInstructors || 0;
        document.getElementById('totalClasses').textContent = stats.totalClasses || 0;
        document.getElementById('totalRevenue').textContent = `₦${(stats.totalRevenue || 0).toLocaleString()}`;
        document.getElementById('pendingWithdrawals').textContent = stats.pendingWithdrawals || 0;
        document.getElementById('pendingInstructors').textContent = stats.pendingInstructors || 0;
    }
    
    renderRecentActivity(activities) {
        const tbody = document.getElementById('recentActivityBody');
        
        if (!activities || activities.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; padding: 40px; color: var(--admin-gray);">
                        No recent activity
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = activities.map(activity => `
            <tr>
                <td>${this.formatAction(activity.action)}</td>
                <td>${activity.targetName || activity.targetId || '—'}</td>
                <td>${activity.adminName || 'Admin'}</td>
                <td>${this.formatDate(activity.createdAt)}</td>
            </tr>
        `).join('');
    }
    
    formatAction(action) {
        const actions = {
            'user_created': '👤 User Created',
            'user_updated': '✏️ User Updated',
            'user_suspended': '⛔ User Suspended',
            'user_activated': '✅ User Activated',
            'instructor_approved': '👨‍🏫 Instructor Approved',
            'instructor_rejected': '❌ Instructor Rejected',
            'class_created': '📚 Class Created',
            'class_updated': '📝 Class Updated',
            'class_deleted': '🗑️ Class Deleted',
            'class_featured': '⭐ Class Featured',
            'payment_viewed': '💳 Payment Viewed',
            'payment_processed': '✅ Payment Processed',
            'payout_approved': '💰 Payout Approved',
            'payout_rejected': '❌ Payout Rejected',
            'payout_processed': '✅ Payout Processed',
            'settings_updated': '⚙️ Settings Updated',
            'admin_login': '🔑 Admin Login',
            'admin_logout': '🚪 Admin Logout'
        };
        return actions[action] || action;
    }
    
    formatDate(date) {
        if (!date) return '—';
        const d = new Date(date);
        const now = new Date();
        const diff = now - d;
        
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
        
        return d.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }
    
    // ===== TOAST NOTIFICATION =====
    showToast(message, type = 'info') {
        const existing = document.querySelector('.admin-toast');
        if (existing) existing.remove();
        
        const toast = document.createElement('div');
        toast.className = 'admin-toast';
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 24px;
            right: 24px;
            padding: 16px 24px;
            border-radius: 12px;
            color: white;
            background: ${type === 'error' ? '#EF4444' : type === 'success' ? '#10B981' : '#6C3CE1'};
            z-index: 9999;
            box-shadow: 0 4px 24px rgba(0,0,0,0.15);
            font-weight: 500;
            animation: slideUp 0.3s ease;
        `;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(20px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }
    
    // ===== LOADING STATE =====
    showLoading(container) {
        if (container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--admin-gray);">
                    <div class="spinner"></div>
                    <p>Loading...</p>
                </div>
            `;
        }
    }
}

// ===== LOGOUT =====
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '../login.html';
}

// ===== INITIALIZE =====
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if on admin page
    if (document.querySelector('.admin-wrapper')) {
        window.AdminApp = new AdminApp();
    }
});

// Add spinner styles
const spinnerStyle = document.createElement('style');
spinnerStyle.textContent = `
    .spinner {
        display: inline-block;
        width: 30px;
        height: 30px;
        border: 3px solid #f3f3f3;
        border-top: 3px solid #6C3CE1;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
    }
    
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
    
    @keyframes slideUp {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
`;
document.head.appendChild(spinnerStyle);