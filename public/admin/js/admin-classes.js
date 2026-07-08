// ===== ADMIN CLASSES MANAGEMENT =====
class AdminClassesClass {
    constructor() {
        this.currentPage = 1;
        this.totalPages = 1;
        this.totalClasses = 0;
        this.classes = [];
        this.deleteClassId = null;
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
        
        await this.loadClasses();
        this.setupEventListeners();
        console.log('✅ AdminClasses initialized');
    }
    
    async loadClasses() {
        const container = document.getElementById('classesTableBody');
        if (!container) return;
        
        container.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 40px; color: var(--admin-gray);">
                    Loading classes...
                </td>
            </tr>
        `;
        
        try {
            const search = document.getElementById('classSearch')?.value || '';
            
            const url = `${window.AdminApp.baseUrl}/api/admin/classes?page=${this.currentPage}&limit=20&search=${encodeURIComponent(search)}`;
            
            const response = await fetch(url, {
                headers: window.AdminApp.getHeaders()
            });
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.message || 'Failed to load classes');
            }
            
            this.classes = data.classes || [];
            this.totalClasses = data.pagination?.total || 0;
            this.totalPages = data.pagination?.pages || 1;
            this.currentPage = data.pagination?.page || 1;
            
            this.renderClasses();
            this.renderPagination();
            
        } catch (error) {
            console.error('Load classes error:', error);
            if (container) {
                container.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align: center; padding: 40px; color: var(--admin-danger);">
                            ❌ Failed to load classes. <button onclick="AdminClasses.loadClasses()" style="cursor: pointer; color: var(--admin-primary);">Retry</button>
                        </td>
                    </tr>
                `;
            }
        }
    }
    
    renderClasses() {
        const container = document.getElementById('classesTableBody');
        if (!container) return;
        
        if (!this.classes || this.classes.length === 0) {
            container.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 40px; color: var(--admin-gray);">
                        No classes found
                    </td>
                </tr>
            `;
            return;
        }
        
        container.innerHTML = this.classes.map(cls => {
            const isFree = cls.isFree || cls.price === 0;
            const priceDisplay = isFree ? '🎓 Free' : `₦${(cls.price || 0).toLocaleString()}`;
            const status = cls.isActive !== false ? 'active' : 'inactive';
            
            return `
                <tr>
                    <td>
                        <strong>${cls.title || 'Untitled'}</strong>
                        ${cls.isFeatured ? ' ⭐' : ''}
                    </td>
                    <td>${cls.instructorId?.firstName || ''} ${cls.instructorId?.lastName || ''}</td>
                    <td>${priceDisplay}</td>
                    <td>${cls.studentCount || 0}</td>
                    <td>₦${(cls.revenue || 0).toLocaleString()}</td>
                    <td><span class="status-badge ${status}">${status === 'active' ? '✅ Active' : '⛔ Inactive'}</span></td>
                    <td>
                        <div class="actions">
                            <a href="../class.html?id=${cls._id}" target="_blank" class="btn-sm btn-primary">👁️ View</a>
                            <button class="btn-sm btn-danger" onclick="AdminClasses.openDeleteModal('${cls._id}', '${cls.title}')">
                                🗑️ Delete
                            </button>
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
        const end = Math.min(this.currentPage * 20, this.totalClasses);
        info.textContent = `Showing ${start}-${end} of ${this.totalClasses}`;
        
        let buttons = `<button onclick="AdminClasses.goToPage('prev')" ${this.currentPage <= 1 ? 'disabled' : ''}>←</button>`;
        
        for (let i = 1; i <= this.totalPages; i++) {
            if (i === this.currentPage) {
                buttons += `<button class="active">${i}</button>`;
            } else if (i <= 3 || i > this.totalPages - 3 || Math.abs(i - this.currentPage) <= 1) {
                buttons += `<button onclick="AdminClasses.goToPage(${i})">${i}</button>`;
            } else if (i === 4 && this.currentPage > 5) {
                buttons += `<span>...</span>`;
            }
        }
        
        buttons += `<button onclick="AdminClasses.goToPage('next')" ${this.currentPage >= this.totalPages ? 'disabled' : ''}>→</button>`;
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
        await this.loadClasses();
    }
    
    filterClasses() {
        this.currentPage = 1;
        this.loadClasses();
    }
    
    openDeleteModal(classId, className) {
        this.deleteClassId = classId;
        const nameEl = document.getElementById('deleteClassName');
        if (nameEl) nameEl.textContent = className;
        const modal = document.getElementById('deleteClassModal');
        if (modal) modal.classList.add('active');
    }
    
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.remove('active');
        this.deleteClassId = null;
    }
    
    async confirmDelete() {
        if (!this.deleteClassId) return;
        
        if (!confirm('Are you sure you want to delete this class? This will delete all enrollments and related data.')) return;
        
        try {
            const response = await fetch(`${window.AdminApp.baseUrl}/api/admin/classes/${this.deleteClassId}`, {
                method: 'DELETE',
                headers: window.AdminApp.getHeaders()
            });
            
            const data = await response.json();
            
            if (data.success) {
                window.AdminApp.showToast('✅ Class deleted successfully!', 'success');
                this.closeModal('deleteClassModal');
                await this.loadClasses();
            } else {
                throw new Error(data.message || 'Failed to delete class');
            }
        } catch (error) {
            console.error('Delete class error:', error);
            window.AdminApp.showToast('❌ Failed to delete class', 'error');
        }
    }
    
    showCreateModal() {
        window.location.href = '../instructor-dashboard.html#classes';
    }
    
    setupEventListeners() {
        const searchInput = document.getElementById('classSearch');
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.filterClasses();
                }
            });
        }
    }
}

// ===== CREATE GLOBAL INSTANCE =====
let AdminClasses = null;

document.addEventListener('DOMContentLoaded', function() {
    const checkInterval = setInterval(() => {
        if (window.AdminApp) {
            clearInterval(checkInterval);
            AdminClasses = new AdminClassesClass();
            window.AdminClasses = AdminClasses;
            console.log('✅ AdminClasses registered globally');
        }
    }, 100);
    
    setTimeout(() => {
        if (!window.AdminApp) {
            console.warn('⚠️ AdminApp not found, creating AdminClasses anyway');
            AdminClasses = new AdminClassesClass();
            window.AdminClasses = AdminClasses;
        }
    }, 5000);
});