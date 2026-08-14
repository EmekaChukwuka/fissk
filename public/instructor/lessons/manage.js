// instructor/lessons/manage.js - Lesson Manager
class LessonManager {
    constructor() {
        this.user = JSON.parse(localStorage.getItem('user'));
        this.token = localStorage.getItem('token');
        this.classId = this.getQueryParam('classId');
        this.lessons = [];
        this.init();
    }

    getQueryParam(param) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(param);
    }

    async init() {
        if (!this.user || !this.token) {
            window.location.href = '../../login.html';
            return;
        }

        if (!this.classId) {
            // Try to get from session storage
            this.classId = sessionStorage.getItem('manageClassId');
            if (!this.classId) {
                alert('No class specified');
                window.location.href = '../../instructor-dashboard.html#classes';
                return;
            }
        }

        sessionStorage.setItem('manageClassId', this.classId);
        this.loadUserData();
        await this.loadClassInfo();
        await this.loadLessons();
        this.setupEventListeners();
    }

    loadUserData() {
        const dropdown = document.getElementById('user-dropdown');
        if (dropdown && this.user) {
            dropdown.innerHTML = `
                <img src="https://ui-avatars.com/api/?name=${this.user.firstname}+${this.user.lastname}&background=8B5FBF&color=fff" alt="User" class="user-avatar">
                <span>${this.user.firstname}</span>
                <div class="dropdown-content">
                    <a href="#" class="logout" onclick="logout()">Logout</a>
                </div>
            `;
        }
    }

    async loadClassInfo() {
        try {
            const response = await fetch(`https://fissk-backend.onrender.com/register/class/${this.classId}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (response.ok) {
                const data = await response.json();
                const classData = data.class || data;
                document.getElementById('classInfo').textContent = `Class: ${classData.title || 'Unknown'}`;
                document.getElementById('createLessonBtn').href = `create.html?classId=${this.classId}`;
            }
        } catch (error) {
            console.error('Load class info error:', error);
        }
    }

    async loadLessons() {
        try {
            const response = await fetch(`https://fissk-backend.onrender.com/api/lessons/instructor/class/${this.classId}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (!response.ok) throw new Error('Failed to load lessons');

            const data = await response.json();
            this.lessons = data.lessons || [];

            this.updateStats();
            this.renderLessons();

        } catch (error) {
            console.error('Load lessons error:', error);
            document.getElementById('lessonsBody').innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 40px; color: #EF4444;">
                        ❌ Failed to load lessons: ${error.message}
                    </td>
                </tr>
            `;
        }
    }

    updateStats() {
        const total = this.lessons.length;
        const published = this.lessons.filter(l => l.isPublished).length;
        const drafts = total - published;
        const totalItems = this.lessons.reduce((sum, l) => sum + (l.contentItems?.length || 0), 0);

        document.getElementById('totalLessons').textContent = total;
        document.getElementById('publishedLessons').textContent = published;
        document.getElementById('draftLessons').textContent = drafts;
        document.getElementById('totalItems').textContent = totalItems;
    }

    renderLessons() {
        const tbody = document.getElementById('lessonsBody');

        if (this.lessons.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6">
                        <div class="no-lessons">
                            <span class="icon">📚</span>
                            <p>No lessons created yet</p>
                            <p style="font-size: 0.9rem; color: #a0aec0;">Click "Create New Lesson" to get started</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.lessons.map((lesson, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>
                    <strong>${this.escapeHtml(lesson.title)}</strong>
                    ${lesson.description ? `<br><span style="font-size: 0.8rem; color: #6B7280;">${this.escapeHtml(lesson.description.substring(0, 60))}${lesson.description.length > 60 ? '...' : ''}</span>` : ''}
                </td>
                <td>${lesson.contentItems?.length || 0}</td>
                <td>${lesson.estimatedTime || 0} min</td>
                <td>
                    <span class="status-badge ${lesson.isPublished ? 'published' : 'draft'}">
                        ${lesson.isPublished ? '✅ Published' : '📝 Draft'}
                    </span>
                </td>
                <td>
                    <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                        <a href="edit.html?lessonId=${lesson._id}" class="btn-sm btn-primary">✏️ Edit</a>
                        <button class="btn-sm ${lesson.isPublished ? 'btn-warning' : 'btn-success'} toggle-publish-btn" data-lesson-id="${lesson._id}" data-published="${lesson.isPublished}">
                            ${lesson.isPublished ? '📥 Unpublish' : '📤 Publish'}
                        </button>
                        <button class="btn-sm btn-danger delete-btn" data-lesson-id="${lesson._id}">🗑️</button>
                    </div>
                </td>
            </tr>
        `).join('');

        // Add event listeners
        tbody.querySelectorAll('.toggle-publish-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const lessonId = btn.dataset.lessonId;
                const currentStatus = btn.dataset.published === 'true';
                this.togglePublish(lessonId, currentStatus);
            });
        });

        tbody.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const lessonId = btn.dataset.lessonId;
                this.deleteLesson(lessonId);
            });
        });
    }

    async togglePublish(lessonId, currentStatus) {
        const newStatus = !currentStatus;
        const action = newStatus ? 'publish' : 'unpublish';
        
        if (!confirm(`Are you sure you want to ${action} this lesson?`)) return;

        try {
            const response = await fetch(`https://fissk-backend.onrender.com/api/lessons/${lessonId}/publish`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ isPublished: newStatus })
            });

            if (!response.ok) throw new Error('Failed to update lesson status');

            const data = await response.json();
            alert(`✅ Lesson ${newStatus ? 'published' : 'unpublished'} successfully!`);
            await this.loadLessons();

        } catch (error) {
            console.error('Toggle publish error:', error);
            alert('❌ ' + error.message);
        }
    }

    async deleteLesson(lessonId) {
        if (!confirm('⚠️ Are you sure you want to delete this lesson? This action cannot be undone.')) return;

        try {
            const response = await fetch(`https://fissk-backend.onrender.com/api/lessons/${lessonId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error('Failed to delete lesson');

            alert('✅ Lesson deleted successfully!');
            await this.loadLessons();

        } catch (error) {
            console.error('Delete lesson error:', error);
            alert('❌ ' + error.message);
        }
    }

    setupEventListeners() {
        // Refresh button (if any)
        // Add any additional event listeners
    }

    escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/[&<>]/g, function(s) {
            return ({'&': '&amp;', '<': '&lt;', '>': '&gt;'})[s];
        });
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    new LessonManager();
});

function logout() {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    window.location.href = '../../index.html';
}