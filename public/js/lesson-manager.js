// ============================================================
// LESSON MANAGER - Create and Edit Lessons
// ============================================================

(function() {
    'use strict';

    const state = {
        classId: null,
        lessonId: null,
        isEditing: false,
        contentItems: [],
        editingIndex: null,
        user: JSON.parse(localStorage.getItem('user')),
        token: localStorage.getItem('token'),
        lessons: []
    };

    // ===== DOM REFERENCES =====
    const elements = {
        title: document.getElementById('lessonTitle'),
        description: document.getElementById('lessonDescription'),
        order: document.getElementById('lessonOrder'),
        isFreePreview: document.getElementById('isFreePreview'),
        isPublished: document.getElementById('isPublished'),
        contentItemsList: document.getElementById('contentItemsList'),
        addContentBtn: document.getElementById('addContentBtn'),
        saveBtn: document.getElementById('saveBtn'),
        saveBtn2: document.getElementById('saveBtn2'),
        previewBtn: document.getElementById('previewBtn'),
        previewBtn2: document.getElementById('previewBtn2'),
        discardBtn: document.getElementById('discardBtn'),
        deleteBtn: document.getElementById('deleteBtn'),
        contentModal: document.getElementById('contentModal'),
        contentModalTitle: document.getElementById('contentModalTitle'),
        contentForm: document.getElementById('contentForm'),
        contentType: document.getElementById('contentType'),
        contentTitle: document.getElementById('contentTitle'),
        contentText: document.getElementById('contentText'),
        videoUrl: document.getElementById('videoUrl'),
        muxPlaybackId: document.getElementById('muxPlaybackId'),
        contentDuration: document.getElementById('contentDuration'),
        quizId: document.getElementById('quizId'),
        fileUrl: document.getElementById('fileUrl'),
        fileName: document.getElementById('fileName'),
        fileSize: document.getElementById('fileSize'),
        linkUrl: document.getElementById('linkUrl'),
        linkTarget: document.getElementById('linkTarget'),
        embedCode: document.getElementById('embedCode'),
        isRequired: document.getElementById('isRequired'),
        saveContentBtn: document.getElementById('saveContentBtn'),
        previewModal: document.getElementById('previewModal'),
        previewContent: document.getElementById('previewContent'),
        createLessonBtn: document.getElementById('createLessonBtn')
    };

    // ===== INIT =====
    async function init() {
        state.classId = QuizUtils.getQueryParam('classId');
        state.lessonId = QuizUtils.getQueryParam('lessonId');

        if (!state.classId && !state.lessonId) {
            QuizUtils.showToast('No class specified', 'error');
            window.location.href = '../../instructor-dashboard.html';
            return;
        }

        if (!state.user || !state.token) {
            QuizUtils.showToast('Please login to manage lessons', 'error');
            window.location.href = '../../login.html';
            return;
        }

        loadUserData();

        // Check if we're on the manage page
        if (document.getElementById('lessonsBody')) {
            await loadLessonsForManagement();
            renderManagePage();
            return;
        }

        // Check if we're on create/edit page
        if (elements.title) {
            setupEventListeners();

            if (state.lessonId) {
                state.isEditing = true;
                await loadLessonForEditing();
                document.querySelector('.builder-header h1').textContent = '✏️ Edit Lesson';
                if (elements.saveBtn) elements.saveBtn.textContent = '💾 Update Lesson';
                if (elements.saveBtn2) elements.saveBtn2.textContent = '💾 Update Lesson';
                if (elements.deleteBtn) elements.deleteBtn.style.display = 'inline-block';
            }

            renderContentItems();
            document.getElementById('contentModal').style.display = 'none';
        }
    }

    // ===== LOAD USER DATA =====
    function loadUserData() {
        const userDropdown = document.getElementById('user-dropdown');
        if (userDropdown && state.user) {
            userDropdown.innerHTML = `
                <img src="https://ui-avatars.com/api/?name=${state.user.firstname}+${state.user.lastname}&background=8B5FBF&color=fff" alt="User" class="user-avatar">
                <span>${state.user.firstname}</span>
                <div class="dropdown-content">
                    <a href="../../profile.html">Profile</a>
                    <a href="#" class="logout" onclick="logout()">Logout</a>
                </div>
            `;
        }
    }

    // ===== LOAD LESSONS FOR MANAGEMENT =====
    async function loadLessonsForManagement() {
        try {
            const response = await fetch(`https://fissk-backend.onrender.com/api/lessons/class/${state.classId}`, {
                headers: { 'Authorization': `Bearer ${state.token}` }
            });

            if (!response.ok) throw new Error('Failed to load lessons');

            const data = await response.json();
            state.lessons = data.lessons || [];
        } catch (error) {
            console.error('Load lessons error:', error);
            QuizUtils.showToast('Failed to load lessons', 'error');
        }
    }

    // ===== RENDER MANAGE PAGE =====
    function renderManagePage() {
        const total = state.lessons.length;
        const published = state.lessons.filter(l => l.isPublished !== false).length;
        const drafts = total - published;

        document.getElementById('totalLessons').textContent = total;
        document.getElementById('publishedLessons').textContent = published;
        document.getElementById('draftLessons').textContent = drafts;

        const body = document.getElementById('lessonsBody');

        if (total === 0) {
            body.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 40px;">
                        <div class="no-lessons">
                            <span class="icon">📚</span>
                            <p>No lessons created yet</p>
                            <a href="create.html?classId=${state.classId}" class="btn btn-primary" style="margin-top: 12px;">
                                + Create First Lesson
                            </a>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        body.innerHTML = state.lessons.map((lesson, index) => {
            const status = lesson.isPublished !== false ? 'published' : 'draft';
            const statusLabel = lesson.isPublished !== false ? '✅ Published' : '📝 Draft';
            const itemCount = lesson.contentItems?.length || 0;

            return `
                <tr>
                    <td>${index + 1}</td>
                    <td><strong>${escapeHtml(lesson.title)}</strong></td>
                    <td>${itemCount} items</td>
                    <td>${lesson.estimatedTime || 0} min</td>
                    <td><span class="status-badge ${status}">${statusLabel}</span></td>
                    <td>
                        <button class="btn-sm btn-outline" onclick="window.location.href='edit.html?classId=${state.classId}&lessonId=${lesson._id}'">✏️ Edit</button>
                        <button class="btn-sm btn-danger" onclick="window.lessonManager.deleteLesson('${lesson._id}')">🗑️</button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // ===== LOAD LESSON FOR EDITING =====
    async function loadLessonForEditing() {
        try {
            const response = await fetch(`https://fissk-backend.onrender.com/api/lessons/${state.lessonId}`, {
                headers: { 'Authorization': `Bearer ${state.token}` }
            });

            if (!response.ok) throw new Error('Failed to load lesson');

            const data = await response.json();
            const lesson = data.lesson;

            elements.title.value = lesson.title || '';
            elements.description.value = lesson.description || '';
            elements.order.value = lesson.order || 1;
            elements.isFreePreview.checked = lesson.isFreePreview || false;
            elements.isPublished.checked = lesson.isPublished !== false;

            state.contentItems = lesson.contentItems || [];
            renderContentItems();

        } catch (error) {
            console.error('Load lesson error:', error);
            QuizUtils.showToast('Failed to load lesson for editing', 'error');
        }
    }

    // ===== RENDER CONTENT ITEMS =====
    function renderContentItems() {
        if (!elements.contentItemsList) return;

        if (state.contentItems.length === 0) {
            elements.contentItemsList.innerHTML = `
                <div class="empty-content">
                    <p>📝 No content added yet</p>
                    <p class="empty-sub">Click "Add Content" to start building your lesson</p>
                </div>
            `;
            return;
        }

        const typeLabels = {
            'text': 'Text',
            'video': 'Video',
            'quiz': 'Quiz',
            'material': 'Material',
            'assignment': 'Assignment',
            'link': 'Link',
            'embed': 'Embed'
        };

        elements.contentItemsList.innerHTML = state.contentItems.map((item, index) => `
            <div class="content-item-editor" data-index="${index}">
                <div class="item-header">
                    <span class="item-type-badge ${item.type}">${typeLabels[item.type] || item.type}</span>
                    <span style="color: var(--text-light); font-size: 0.85rem;">
                        ${item.isRequired ? 'Required' : 'Optional'}
                    </span>
                    <span style="color: var(--text-light); font-size: 0.85rem; margin-left: auto;">
                        ${item.duration ? `⏱️ ${item.duration} min` : ''}
                    </span>
                </div>
                <div class="item-preview">
                    <strong>${escapeHtml(item.title)}</strong>
                    ${item.content ? `<p style="margin: 4px 0 0; font-size: 0.9rem;">${escapeHtml(item.content.substring(0, 100))}${item.content.length > 100 ? '...' : ''}</p>` : ''}
                </div>
                <div class="item-actions">
                    <button class="btn-sm btn-outline edit-content-btn" data-index="${index}">✏️ Edit</button>
                    <button class="btn-sm btn-danger delete-content-btn" data-index="${index}">🗑️</button>
                </div>
            </div>
        `).join('');

        // Add event listeners
        document.querySelectorAll('.edit-content-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const index = parseInt(this.dataset.index);
                openContentModal(index);
            });
        });

        document.querySelectorAll('.delete-content-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const index = parseInt(this.dataset.index);
                if (confirm('Delete this content item?')) {
                    state.contentItems.splice(index, 1);
                    renderContentItems();
                }
            });
        });
    }

    // ===== OPEN CONTENT MODAL =====
    function openContentModal(index = null) {
        state.editingIndex = index;

        const modal = elements.contentModal;
        if (!modal) return;

        if (index !== null && state.contentItems[index]) {
            const item = state.contentItems[index];
            elements.contentModalTitle.textContent = 'Edit Content';
            elements.saveContentBtn.textContent = 'Update Content';
            elements.contentType.value = item.type || 'text';
            elements.contentTitle.value = item.title || '';
            elements.contentText.value = item.content || '';
            elements.videoUrl.value = item.videoUrl || '';
            elements.muxPlaybackId.value = item.muxPlaybackId || '';
            elements.contentDuration.value = item.duration || 5;
            elements.quizId.value = item.quizId?._id || item.quizId || '';
            elements.fileUrl.value = item.fileUrl || '';
            elements.fileName.value = item.fileName || '';
            elements.fileSize.value = item.fileSize || 0;
            elements.linkUrl.value = item.linkUrl || '';
            elements.linkTarget.value = item.linkTarget || '_blank';
            elements.embedCode.value = item.embedCode || '';
            elements.isRequired.checked = item.isRequired !== false;
        } else {
            elements.contentModalTitle.textContent = 'Add Content';
            elements.saveContentBtn.textContent = 'Add Content';
            elements.contentForm.reset();
            elements.contentType.value = 'text';
            elements.contentDuration.value = 5;
            elements.isRequired.checked = true;
        }

        toggleContentFields();
        modal.style.display = 'flex';
    }

    // ===== TOGGLE CONTENT FIELDS =====
    function toggleContentFields() {
        const type = elements.contentType.value;

        document.getElementById('contentTextField').style.display = type === 'text' || type === 'assignment' ? 'block' : 'none';
        document.getElementById('videoFields').style.display = type === 'video' ? 'block' : 'none';
        document.getElementById('quizFields').style.display = type === 'quiz' ? 'block' : 'none';
        document.getElementById('materialFields').style.display = type === 'material' ? 'block' : 'none';
        document.getElementById('linkFields').style.display = type === 'link' ? 'block' : 'none';
        document.getElementById('embedFields').style.display = type === 'embed' ? 'block' : 'none';
    }

    // ===== SAVE CONTENT ITEM =====
    function saveContentItem(e) {
        e.preventDefault();

        const type = elements.contentType.value;
        const title = elements.contentTitle.value.trim();
        const content = elements.contentText.value.trim();
        const isRequired = elements.isRequired.checked;

        if (!title) {
            alert('Please enter a title');
            return;
        }

        const itemData = {
            type,
            title,
            content,
            isRequired,
            duration: parseInt(elements.contentDuration.value) || 0
        };

        // Add type-specific fields
        switch (type) {
            case 'video':
                itemData.videoUrl = elements.videoUrl.value.trim();
                itemData.muxPlaybackId = elements.muxPlaybackId.value.trim();
                break;
            case 'quiz':
                itemData.quizId = elements.quizId.value.trim() || null;
                break;
            case 'material':
                itemData.fileUrl = elements.fileUrl.value.trim();
                itemData.fileName = elements.fileName.value.trim();
                itemData.fileSize = parseInt(elements.fileSize.value) || 0;
                break;
            case 'link':
                itemData.linkUrl = elements.linkUrl.value.trim();
                itemData.linkTarget = elements.linkTarget.value;
                break;
            case 'embed':
                itemData.embedCode = elements.embedCode.value;
                break;
        }

        if (state.editingIndex !== null) {
            state.contentItems[state.editingIndex] = itemData;
        } else {
            state.contentItems.push(itemData);
        }

        elements.contentModal.style.display = 'none';
        renderContentItems();
    }

    // ===== SAVE LESSON =====
    async function saveLesson() {
        const title = elements.title.value.trim();
        const description = elements.description.value.trim();
        const order = parseInt(elements.order.value) || 1;
        const isFreePreview = elements.isFreePreview.checked;
        const isPublished = elements.isPublished.checked;

        if (!title) {
            alert('Please enter a lesson title');
            return;
        }

        const lessonData = {
            classId: state.classId,
            title,
            description,
            contentItems: state.contentItems,
            order,
            isFreePreview,
            isPublished
        };

        const isEditing = state.isEditing && state.lessonId;
        const url = isEditing
            ? `https://fissk-backend.onrender.com/api/lessons/${state.lessonId}`
            : 'https://fissk-backend.onrender.com/api/lessons';
        const method = isEditing ? 'PUT' : 'POST';

        try {
            const btn = elements.saveBtn || elements.saveBtn2;
            if (btn) {
                btn.disabled = true;
                btn.textContent = '⏳ Saving...';
            }

            const response = await fetch(url, {
                method,
                headers: {
                    'Authorization': `Bearer ${state.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(lessonData)
            });

            if (response.status === 401) {
                alert('Session expired. Please login again.');
                window.location.href = '../../login.html';
                return;
            }

            const data = await response.json();

            if (btn) {
                btn.disabled = false;
                btn.textContent = isEditing ? '💾 Update Lesson' : '💾 Save Lesson';
            }

            if (data.success) {
                QuizUtils.showToast(`✅ Lesson ${isEditing ? 'updated' : 'created'} successfully!`, 'success');
                window.location.href = `../../instructor-dashboard.html#classes`;
            } else {
                QuizUtils.showToast('❌ ' + (data.message || 'Failed to save lesson'), 'error');
            }
        } catch (error) {
            console.error('Save lesson error:', error);
            QuizUtils.showToast('Failed to save lesson', 'error');
            const btn = elements.saveBtn || elements.saveBtn2;
            if (btn) {
                btn.disabled = false;
                btn.textContent = isEditing ? '💾 Update Lesson' : '💾 Save Lesson';
            }
        }
    }

    // ===== DELETE LESSON =====
    async function deleteLesson(lessonId) {
        if (!confirm('Are you sure you want to delete this lesson? This action cannot be undone.')) {
            return;
        }

        const id = lessonId || state.lessonId;
        if (!id) return;

        try {
            const response = await fetch(`https://fissk-backend.onrender.com/api/lessons/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${state.token}` }
            });

            const data = await response.json();

            if (data.success) {
                QuizUtils.showToast('✅ Lesson deleted successfully!', 'success');
                window.location.href = '../../instructor-dashboard.html#classes';
            } else {
                QuizUtils.showToast('❌ ' + (data.message || 'Failed to delete lesson'), 'error');
            }
        } catch (error) {
            console.error('Delete lesson error:', error);
            QuizUtils.showToast('Failed to delete lesson', 'error');
        }
    }

    // ===== PREVIEW LESSON =====
    function previewLesson() {
        const title = elements.title.value.trim() || 'Untitled Lesson';
        const description = elements.description.value.trim() || '';
        const items = state.contentItems;

        if (items.length === 0) {
            alert('Add some content first');
            return;
        }

        if (!elements.previewContent) return;

        const typeLabels = {
            'text': 'Text',
            'video': 'Video',
            'quiz': 'Quiz',
            'material': 'Material',
            'assignment': 'Assignment',
            'link': 'Link',
            'embed': 'Embed'
        };

        let previewHTML = `
            <div class="preview-header">
                <h3>${escapeHtml(title)}</h3>
                <p>${escapeHtml(description)}</p>
                <div class="preview-stats">
                    <span>📝 ${items.length} items</span>
                    <span>⏱️ ${items.reduce((sum, i) => sum + (i.duration || 0), 0)} min</span>
                </div>
            </div>
            <div class="preview-items">
        `;

        items.forEach((item, index) => {
            previewHTML += `
                <div class="preview-item">
                    <div class="preview-item-header">
                        <span>${index + 1}. ${escapeHtml(item.title)}</span>
                        <span style="color: var(--text-light); font-size: 0.8rem;">${typeLabels[item.type] || item.type}</span>
                    </div>
                    ${item.content ? `<p style="color: var(--text-secondary);">${escapeHtml(item.content.substring(0, 150))}${item.content.length > 150 ? '...' : ''}</p>` : ''}
                </div>
            `;
        });

        previewHTML += `
            </div>
            <div class="preview-footer">
                <p>This is a preview. Students will see an interactive version.</p>
            </div>
        `;

        elements.previewContent.innerHTML = previewHTML;

        if (elements.previewModal) {
            elements.previewModal.style.display = 'flex';
        }
    }

    // ===== DISCARD =====
    function discard() {
        if (confirm('Are you sure you want to discard changes?')) {
            window.location.href = '../../instructor-dashboard.html#classes';
        }
    }

    // ===== EVENT LISTENERS =====
    function setupEventListeners() {
        if (elements.addContentBtn) {
            elements.addContentBtn.addEventListener('click', () => openContentModal(null));
        }

        if (elements.contentType) {
            elements.contentType.addEventListener('change', toggleContentFields);
        }

        if (elements.contentForm) {
            elements.contentForm.addEventListener('submit', saveContentItem);
        }

        if (elements.saveBtn) {
            elements.saveBtn.addEventListener('click', saveLesson);
        }

        if (elements.saveBtn2) {
            elements.saveBtn2.addEventListener('click', saveLesson);
        }

        if (elements.previewBtn) {
            elements.previewBtn.addEventListener('click', previewLesson);
        }

        if (elements.previewBtn2) {
            elements.previewBtn2.addEventListener('click', previewLesson);
        }

        if (elements.discardBtn) {
            elements.discardBtn.addEventListener('click', discard);
        }

        if (elements.deleteBtn) {
            elements.deleteBtn.addEventListener('click', () => deleteLesson());
        }

        // Modal close on overlay click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        });

        // Close modal on X click
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', function() {
                const modal = this.closest('.modal');
                if (modal) modal.style.display = 'none';
            });
        });

        // Set create lesson button URL
        if (elements.createLessonBtn) {
            elements.createLessonBtn.href = `create.html?classId=${state.classId}`;
        }
    }

    // ===== HELPERS =====
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function logout() {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        window.location.href = '../../login.html';
    }

    // ===== EXPOSE GLOBALLY =====
    window.lessonManager = {
        deleteLesson
    };

    // ===== START =====
    document.addEventListener('DOMContentLoaded', init);
})();