// instructor/lessons/edit.js - Lesson Editor
class LessonEditor {
    constructor() {
        this.user = JSON.parse(localStorage.getItem('user'));
        this.token = localStorage.getItem('token');
        this.lessonId = this.getQueryParam('lessonId');
        this.classId = this.getQueryParam('classId');
        this.lessonData = null;
        this.contentItems = [];
        this.availableVideos = [];
        this.availableQuizzes = [];
        this.editingIndex = -1;
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

        if (!this.lessonId) {
            alert('No lesson specified');
            window.location.href = '../../instructor-dashboard.html#classes';
            return;
        }

        this.loadUserData();
        await this.loadAvailableContent();
        await this.loadLessonData();
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

    async loadAvailableContent() {
        try {
            if (!this.classId) {
                // Try to get classId from lesson data later
                return;
            }

            // Load available videos
            const videoRes = await fetch(`https://fissk-backend.onrender.com/api/lessons/available-videos/${this.classId}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (videoRes.ok) {
                const videoData = await videoRes.json();
                this.availableVideos = videoData.videos || [];
            }

            // Load available quizzes
            const quizRes = await fetch(`https://fissk-backend.onrender.com/api/lessons/available-quizzes/${this.classId}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (quizRes.ok) {
                const quizData = await quizRes.json();
                this.availableQuizzes = quizData.quizzes || [];
            }

            this.populateSelects();
        } catch (error) {
            console.error('Load available content error:', error);
        }
    }

    populateSelects() {
        // Populate video select
        const videoSelect = document.getElementById('videoSelect');
        if (videoSelect) {
            videoSelect.innerHTML = `
                <option value="">Select a recorded video...</option>
                ${this.availableVideos.map(v => `
                    <option value="${v._id}">${this.escapeHtml(v.classTitle || v.name || v.filename)}</option>
                `).join('')}
            `;
        }

        // Populate quiz select
        const quizSelect = document.getElementById('quizSelect');
        if (quizSelect) {
            quizSelect.innerHTML = `
                <option value="">Select a quiz...</option>
                ${this.availableQuizzes.map(q => `
                    <option value="${q._id}">${this.escapeHtml(q.title)} (${q.questionCount || 0} questions)</option>
                `).join('')}
            `;
        }
    }

    async loadLessonData() {
        try {
            const response = await fetch(`https://fissk-backend.onrender.com/api/lessons/${this.lessonId}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (!response.ok) throw new Error('Failed to load lesson');

            const data = await response.json();
            this.lessonData = data.lesson;
            this.classId = this.lessonData.classId;
            this.contentItems = this.lessonData.contentItems || [];

            // Populate form
            document.getElementById('lessonTitle').value = this.lessonData.title || '';
            document.getElementById('lessonDescription').value = this.lessonData.description || '';
            document.getElementById('lessonOrder').value = this.lessonData.order || 1;
            document.getElementById('isFreePreview').checked = this.lessonData.isFreePreview || false;
            document.getElementById('isPublished').checked = this.lessonData.isPublished !== false;

            // Set page title
            document.getElementById('pageTitle').textContent = `✏️ ${this.lessonData.title}`;

            // Render content items
            this.renderContentItems();

            // After loading lesson, load available content with classId
            if (this.classId) {
                await this.loadAvailableContent();
            }

        } catch (error) {
            console.error('Load lesson error:', error);
            alert('Failed to load lesson data');
            window.location.href = '../../instructor-dashboard.html#classes';
        }
    }

    setupEventListeners() {
        // Add content button
        document.getElementById('addContentBtn').addEventListener('click', () => {
            this.openContentModal();
        });

        // Form submission
        document.getElementById('lessonForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveLesson();
        });

        // Preview button
        document.getElementById('previewBtn').addEventListener('click', () => {
            this.previewLesson();
        });

        // Delete button
        document.getElementById('deleteBtn').addEventListener('click', () => {
            this.deleteLesson();
        });

        // Content type change
        document.getElementById('contentType').addEventListener('change', () => {
            this.toggleContentFields();
        });

        // Content form submission
        document.getElementById('contentForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveContentItem();
        });

        // Close modal on click outside
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        });

        // Close modal buttons
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.closest('.modal').style.display = 'none';
            });
        });
    }

    toggleContentFields() {
        const type = document.getElementById('contentType').value;
        
        // Hide all fields
        document.getElementById('textField').style.display = 'none';
        document.getElementById('videoField').style.display = 'none';
        document.getElementById('quizField').style.display = 'none';
        document.getElementById('materialField').style.display = 'none';
        document.getElementById('linkField').style.display = 'none';
        document.getElementById('embedField').style.display = 'none';

        // Show relevant fields
        switch (type) {
            case 'text':
                document.getElementById('textField').style.display = 'block';
                break;
            case 'video':
                document.getElementById('videoField').style.display = 'block';
                break;
            case 'quiz':
                document.getElementById('quizField').style.display = 'block';
                break;
            case 'material':
                document.getElementById('materialField').style.display = 'block';
                break;
            case 'link':
                document.getElementById('linkField').style.display = 'block';
                break;
            case 'embed':
                document.getElementById('embedField').style.display = 'block';
                break;
        }
    }

    openContentModal(data = null) {
        const modal = document.getElementById('contentModal');
        const title = document.getElementById('contentModalTitle');
        const form = document.getElementById('contentForm');
        const submitBtn = document.getElementById('saveContentBtn');

        if (data) {
            title.textContent = '✏️ Edit Content';
            submitBtn.textContent = 'Update Content';
            this.editingIndex = this.contentItems.indexOf(data);
            
            document.getElementById('contentType').value = data.type || 'text';
            document.getElementById('contentTitle').value = data.title || '';
            document.getElementById('isRequired').checked = data.isRequired !== false;

            // Set specific fields
            switch (data.type) {
                case 'text':
                    document.getElementById('contentText').value = data.content || '';
                    break;
                case 'video':
                    document.getElementById('videoSelect').value = data.contentId || '';
                    break;
                case 'quiz':
                    document.getElementById('quizSelect').value = data.contentId || '';
                    break;
                case 'material':
                    document.getElementById('fileUrl').value = data.content || '';
                    document.getElementById('fileName').value = data.fileName || '';
                    break;
                case 'link':
                    document.getElementById('linkUrl').value = data.content || '';
                    document.getElementById('linkTarget').value = data.linkTarget || '_blank';
                    break;
                case 'embed':
                    document.getElementById('embedCode').value = data.content || '';
                    break;
            }
        } else {
            title.textContent = 'Add Content';
            submitBtn.textContent = 'Add Content';
            this.editingIndex = -1;
            form.reset();
            document.getElementById('isRequired').checked = true;
        }

        this.toggleContentFields();
        modal.style.display = 'flex';
    }

    saveContentItem() {
        const type = document.getElementById('contentType').value;
        const title = document.getElementById('contentTitle').value.trim();
        const isRequired = document.getElementById('isRequired').checked;

        if (!title) {
            alert('Please enter a title');
            return;
        }

        let content = '';
        let contentId = null;
        let additional = {};

        switch (type) {
            case 'text':
                content = document.getElementById('contentText').value;
                break;
            case 'video':
                contentId = document.getElementById('videoSelect').value;
                if (!contentId) {
                    alert('Please select a video');
                    return;
                }
                break;
            case 'quiz':
                contentId = document.getElementById('quizSelect').value;
                if (!contentId) {
                    alert('Please select a quiz');
                    return;
                }
                break;
            case 'material':
                content = document.getElementById('fileUrl').value;
                additional.fileName = document.getElementById('fileName').value;
                break;
            case 'link':
                content = document.getElementById('linkUrl').value;
                additional.linkTarget = document.getElementById('linkTarget').value;
                if (!content) {
                    alert('Please enter a link URL');
                    return;
                }
                break;
            case 'embed':
                content = document.getElementById('embedCode').value;
                break;
        }

        const item = {
            type,
            title,
            content: content || '',
            contentId: contentId,
            isRequired,
            order: this.contentItems.length,
            ...additional
        };

        if (this.editingIndex >= 0) {
            // Update existing
            item.order = this.contentItems[this.editingIndex].order;
            this.contentItems[this.editingIndex] = item;
        } else {
            // Add new
            this.contentItems.push(item);
        }

        document.getElementById('contentModal').style.display = 'none';
        this.renderContentItems();
    }

    renderContentItems() {
        const container = document.getElementById('contentItemsList');
        if (!container) return;

        if (this.contentItems.length === 0) {
            container.innerHTML = `
                <div class="empty-content">
                    <p>📝 No content added yet</p>
                    <p class="empty-sub">Click "Add Content" to start building your lesson</p>
                </div>
            `;
            return;
        }

        const typeLabels = {
            text: 'Text',
            video: 'Video',
            quiz: 'Quiz',
            material: 'Material',
            link: 'Link',
            embed: 'Embed'
        };

        container.innerHTML = this.contentItems.map((item, index) => `
            <div class="content-item" data-index="${index}">
                <span class="drag-handle">⠿</span>
                <span class="item-type-badge ${item.type}">${typeLabels[item.type] || item.type}</span>
                <span class="item-title">${this.escapeHtml(item.title)}</span>
                ${item.isRequired !== false ? '<span class="item-required">Required</span>' : '<span class="item-required" style="color:#a0aec0;">Optional</span>'}
                <div class="item-actions">
                    <button class="btn-sm btn-outline edit-item-btn" data-index="${index}">✏️</button>
                    <button class="btn-sm btn-danger remove-item-btn" data-index="${index}">✕</button>
                </div>
            </div>
        `).join('');

        // Edit buttons
        container.querySelectorAll('.edit-item-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.index);
                this.openContentModal(this.contentItems[index]);
            });
        });

        // Remove buttons
        container.querySelectorAll('.remove-item-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.index);
                if (confirm('Remove this content item?')) {
                    this.contentItems.splice(index, 1);
                    this.renderContentItems();
                }
            });
        });
    }

    async saveLesson() {
        const title = document.getElementById('lessonTitle').value.trim();
        const description = document.getElementById('lessonDescription').value.trim();
        const order = parseInt(document.getElementById('lessonOrder').value) || 0;
        const isFreePreview = document.getElementById('isFreePreview').checked;
        const isPublished = document.getElementById('isPublished').checked;

        if (!title) {
            alert('Please enter a lesson title');
            return;
        }

        // Clean up content items
        const items = this.contentItems.map((item, index) => ({
            type: item.type || 'text',
            title: item.title || `Item ${index + 1}`,
            content: item.content || '',
            contentId: item.contentId || null,
            order: index,
            isRequired: item.isRequired !== false,
            duration: item.duration || 0,
            fileName: item.fileName || '',
            linkTarget: item.linkTarget || '_blank'
        }));

        const payload = {
            title,
            description,
            contentItems: items,
            order,
            isFreePreview,
            isPublished
        };

        const saveBtn = document.getElementById('saveBtn');
        const originalText = saveBtn.textContent;
        saveBtn.disabled = true;
        saveBtn.textContent = '⏳ Saving...';

        try {
            const response = await fetch(`https://fissk-backend.onrender.com/api/lessons/${this.lessonId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to update lesson');
            }

            const data = await response.json();
            alert('✅ Lesson updated successfully!');
            window.location.href = '../../instructor-dashboard.html#classes';

        } catch (error) {
            console.error('Save lesson error:', error);
            alert('❌ ' + error.message);
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = originalText;
        }
    }

    async deleteLesson() {
        if (!confirm('⚠️ Are you sure you want to delete this lesson? This action cannot be undone.')) {
            return;
        }

        try {
            const response = await fetch(`https://fissk-backend.onrender.com/api/lessons/${this.lessonId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to delete lesson');
            }

            alert('✅ Lesson deleted successfully!');
            window.location.href = '../../instructor-dashboard.html#classes';

        } catch (error) {
            console.error('Delete lesson error:', error);
            alert('❌ ' + error.message);
        }
    }

    previewLesson() {
        const modal = document.getElementById('previewModal');
        const content = document.getElementById('previewContent');

        const title = document.getElementById('lessonTitle').value || 'Untitled Lesson';
        const description = document.getElementById('lessonDescription').value || '';
        const items = this.contentItems;

        let itemsHTML = '';
        if (items.length === 0) {
            itemsHTML = '<p style="color: #6B7280; text-align: center;">No content items added yet.</p>';
        } else {
            itemsHTML = items.map(item => {
                let previewContent = '';
                switch (item.type) {
                    case 'text':
                        previewContent = `<p style="color: #4a5568; white-space: pre-wrap;">${this.escapeHtml(item.content || '')}</p>`;
                        break;
                    case 'video':
                        previewContent = `<div style="background: #1a202c; padding: 20px; border-radius: 8px; text-align: center; color: white;">🎥 Video: ${this.escapeHtml(item.title)}</div>`;
                        break;
                    case 'quiz':
                        previewContent = `<div style="background: #fef3c7; padding: 20px; border-radius: 8px; text-align: center;">📝 Quiz: ${this.escapeHtml(item.title)}</div>`;
                        break;
                    case 'material':
                        previewContent = `<div style="background: #d1fae5; padding: 20px; border-radius: 8px; text-align: center;">📄 Material: ${this.escapeHtml(item.title)}</div>`;
                        break;
                    case 'link':
                        previewContent = `<div style="background: #e0e7ff; padding: 20px; border-radius: 8px; text-align: center;">🔗 Link: ${this.escapeHtml(item.title)}</div>`;
                        break;
                    case 'embed':
                        previewContent = `<div style="background: #f3e8ff; padding: 20px; border-radius: 8px; text-align: center;">🎬 Embed: ${this.escapeHtml(item.title)}</div>`;
                        break;
                    default:
                        previewContent = `<p>${this.escapeHtml(item.content || '')}</p>`;
                }

                return `
                    <div style="padding: 16px; background: #f8f9fa; border-radius: 8px; margin-bottom: 12px; border-left: 4px solid #8B5FBF;">
                        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                            <strong style="color: #2D3748;">${this.escapeHtml(item.title)}</strong>
                            <span style="font-size: 0.7rem; color: #6B7280;">${item.isRequired !== false ? 'Required' : 'Optional'}</span>
                        </div>
                        ${previewContent}
                    </div>
                `;
            }).join('');
        }

        content.innerHTML = `
            <div style="margin-bottom: 16px;">
                <h1 style="color: #1A1A2E;">${this.escapeHtml(title)}</h1>
                ${description ? `<p style="color: #4a5568;">${this.escapeHtml(description)}</p>` : ''}
            </div>
            <div style="margin-top: 16px;">
                ${itemsHTML}
            </div>
            <div style="margin-top: 20px; padding: 16px; background: #f8f9fa; border-radius: 8px; text-align: center; color: #6B7280;">
                ${items.length} content item${items.length > 1 ? 's' : ''}
            </div>
        `;

        modal.style.display = 'flex';
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
    new LessonEditor();
});

function logout() {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    window.location.href = '../../index.html';
}