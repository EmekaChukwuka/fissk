// ============================================================
// LESSON - View and Progress Through Lessons
// ============================================================

(function() {
    'use strict';

    const state = {
        classId: null,
        lessonId: null,
        lessons: [],
        currentIndex: 0,
        user: JSON.parse(localStorage.getItem('user')),
        token: localStorage.getItem('token')
    };

    const elements = {
        lessonList: document.getElementById('lessonList'),
        lessonTitle: document.getElementById('lessonTitle'),
        lessonPosition: document.getElementById('lessonPosition'),
        lessonDuration: document.getElementById('lessonDuration'),
        lessonStatus: document.getElementById('lessonStatus'),
        lessonBody: document.getElementById('lessonBody'),
        prevBtn: document.getElementById('prevLessonBtn'),
        nextBtn: document.getElementById('nextLessonBtn'),
        completeBtn: document.getElementById('completeBtn')
    };

    // ===== INIT =====
    async function init() {
        state.classId = getQueryParam('classId');
        state.lessonId = getQueryParam('lessonId');

        if (!state.classId) {
            showToast('No class specified', 'error');
            window.location.href = 'classes.html';
            return;
        }

        if (!state.user || !state.token) {
            showToast('Please login to view lessons', 'error');
            window.location.href = 'login.html';
            return;
        }

        loadUserData();
        await loadLessons();

        // If lessonId is specified, load that lesson
        if (state.lessonId) {
            const index = state.lessons.findIndex(l => l._id === state.lessonId);
            if (index !== -1) {
                state.currentIndex = index;
                renderLesson();
                renderSidebar();
                return;
            }
        }

        // Otherwise, load the first lesson
        if (state.lessons.length > 0) {
            state.currentIndex = 0;
            renderLesson();
            renderSidebar();
        }

        setupEventListeners();
    }

    // ===== HELPERS =====
    function getQueryParam(param) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(param);
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 14px 24px;
            border-radius: 12px;
            background: ${type === 'success' ? '#10B981' : type === 'error' ? '#EF4444' : '#6C3CE1'};
            color: white;
            z-index: 10000;
            box-shadow: 0 4px 20px rgba(0,0,0,0.2);
            max-width: 400px;
            font-weight: 500;
            animation: slideIn 0.3s ease;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
    }

    // ===== LOAD USER DATA =====
    function loadUserData() {
        const userDropdown = document.getElementById('user-dropdown');
        if (userDropdown && state.user) {
            userDropdown.innerHTML = `
                <img src="https://ui-avatars.com/api/?name=${state.user.firstname}+${state.user.lastname}&background=8B5FBF&color=fff" alt="User" class="user-avatar">
                <span>${state.user.firstname}</span>
                <div class="dropdown-content">
                    <a href="profile.html">Profile</a>
                    <a href="#" class="logout" onclick="logout()">Logout</a>
                </div>
            `;
        }
    }

    // ===== LOAD LESSONS =====
    async function loadLessons() {
        try {
            const response = await fetch(`https://fissk-backend.onrender.com/api/lessons/class/${state.classId}`, {
                headers: { 'Authorization': `Bearer ${state.token}` }
            });

            if (!response.ok) throw new Error('Failed to load lessons');

            const data = await response.json();
            state.lessons = data.lessons || [];
        } catch (error) {
            console.error('Load lessons error:', error);
            showToast('Failed to load lessons', 'error');
        }
    }

    // ===== RENDER SIDEBAR =====
    function renderSidebar() {
        if (state.lessons.length === 0) {
            elements.lessonList.innerHTML = `
                <li style="padding: 12px; color: var(--text-light); text-align: center;">
                    No lessons available yet.
                </li>
            `;
            return;
        }

        elements.lessonList.innerHTML = state.lessons.map((lesson, index) => `
            <li class="lesson-item ${index === state.currentIndex ? 'active' : ''} ${lesson.completed ? 'completed' : ''}" 
                data-index="${index}">
                ${lesson.completed ? '✅' : '📖'} ${escapeHtml(lesson.title)}
                <span class="lesson-status">${index + 1}</span>
            </li>
        `).join('');

        // Add click listeners
        elements.lessonList.querySelectorAll('.lesson-item').forEach(item => {
            item.addEventListener('click', () => {
                const index = parseInt(item.dataset.index);
                state.currentIndex = index;
                renderLesson();
                renderSidebar();
            });
        });
    }

    // ===== RENDER LESSON =====
    function renderLesson() {
        const lesson = state.lessons[state.currentIndex];
        if (!lesson) {
            elements.lessonTitle.textContent = 'Lesson not found';
            elements.lessonBody.innerHTML = '<p>Lesson not found.</p>';
            return;
        }

        // Update header
        elements.lessonTitle.textContent = lesson.title;
        elements.lessonPosition.textContent = `Lesson ${state.currentIndex + 1} of ${state.lessons.length}`;
        elements.lessonDuration.textContent = `⏱️ ${lesson.estimatedTime || 0} min`;
        elements.lessonStatus.textContent = lesson.completed ? '✅ Completed' : '📖 In Progress';

        // Render content
        let contentHTML = '';

        if (lesson.description) {
            contentHTML += `<p style="margin-bottom: 16px; color: var(--text-secondary);">${escapeHtml(lesson.description)}</p>`;
        }

        // Render content items
        if (lesson.contentItems && lesson.contentItems.length > 0) {
            lesson.contentItems.forEach(item => {
                contentHTML += renderContentItem(item);
            });
        } else {
            contentHTML += '<p style="color: var(--text-light);">No content in this lesson yet.</p>';
        }

        elements.lessonBody.innerHTML = contentHTML;

        // Update buttons
        elements.prevBtn.disabled = state.currentIndex === 0;
        elements.nextBtn.disabled = state.currentIndex === state.lessons.length - 1;

        // Update complete button
        if (lesson.completed) {
            elements.completeBtn.textContent = '✅ Completed';
            elements.completeBtn.classList.add('completed');
        } else {
            elements.completeBtn.textContent = '✅ Mark as Complete';
            elements.completeBtn.classList.remove('completed');
        }

        // Update URL
        const url = new URL(window.location);
        url.searchParams.set('lessonId', lesson._id);
        window.history.pushState({}, '', url);
    }

    // ===== RENDER CONTENT ITEM =====
    function renderContentItem(item) {
        const typeIcons = {
            'text': '📝',
            'video': '🎥',
            'quiz': '📝',
            'material': '📄',
            'assignment': '✍️',
            'link': '🔗',
            'embed': '🎬'
        };

        const icon = typeIcons[item.type] || '📌';
        const typeLabels = {
            'text': 'Text',
            'video': 'Video',
            'quiz': 'Quiz',
            'material': 'Material',
            'assignment': 'Assignment',
            'link': 'Link',
            'embed': 'Embed'
        };

        let content = '';

        switch (item.type) {
            case 'text':
                content = `<div class="item-content">${item.content || ''}</div>`;
                break;

            case 'video':
                if (item.muxPlaybackId) {
                    content = `
                        <div class="item-content">
                            <video controls style="width: 100%; border-radius: 8px;">
                                <source src="https://stream.mux.com/${item.muxPlaybackId}.m3u8" type="application/x-mpegURL">
                            </video>
                            ${item.content ? `<p style="margin-top: 8px;">${escapeHtml(item.content)}</p>` : ''}
                        </div>
                    `;
                } else if (item.videoUrl) {
                    content = `
                        <div class="item-content">
                            <video controls style="width: 100%; border-radius: 8px;">
                                <source src="${item.videoUrl}" type="video/mp4">
                            </video>
                            ${item.content ? `<p style="margin-top: 8px;">${escapeHtml(item.content)}</p>` : ''}
                        </div>
                    `;
                }
                break;

            case 'quiz':
                content = `
                    <div class="item-content">
                        ${item.quizId ? `
                            <a href="quiz/take.html?quizId=${item.quizId._id}" class="btn btn-primary">
                                📝 Take Quiz
                            </a>
                            <p style="margin-top: 8px; color: var(--text-light); font-size: 0.9rem;">
                                ${item.quizId.questions ? `${item.quizId.questions.length} questions` : ''}
                            </p>
                        ` : '<p>Quiz not available</p>'}
                        ${item.content ? `<p style="margin-top: 8px;">${escapeHtml(item.content)}</p>` : ''}
                    </div>
                `;
                break;

            case 'material':
                content = `
                    <div class="item-content">
                        ${item.fileUrl ? `
                            <a href="${item.fileUrl}" class="btn btn-outline" download>
                                📥 Download ${item.fileName || 'File'}
                            </a>
                            ${item.fileSize ? `<span style="margin-left: 12px; color: var(--text-light); font-size: 0.85rem;">${(item.fileSize / 1024).toFixed(1)} KB</span>` : ''}
                        ` : '<p>File not available</p>'}
                        ${item.content ? `<p style="margin-top: 8px;">${escapeHtml(item.content)}</p>` : ''}
                    </div>
                `;
                break;

            case 'link':
                content = `
                    <div class="item-content">
                        <a href="${item.linkUrl}" target="${item.linkTarget || '_blank'}" class="btn btn-outline">
                            🔗 ${escapeHtml(item.title)}
                        </a>
                        ${item.content ? `<p style="margin-top: 8px;">${escapeHtml(item.content)}</p>` : ''}
                    </div>
                `;
                break;

            case 'embed':
                content = `
                    <div class="item-content">
                        ${item.embedCode ? item.embedCode : ''}
                        ${item.content ? `<p style="margin-top: 8px;">${escapeHtml(item.content)}</p>` : ''}
                    </div>
                `;
                break;

            default:
                content = `<div class="item-content">${escapeHtml(item.content || '')}</div>`;
        }

        return `
            <div class="content-item">
                <div class="item-type">
                    <span class="content-type-icon">${icon}</span>
                    ${typeLabels[item.type] || item.type}
                    ${item.isRequired ? '' : ' (Optional)'}
                </div>
                ${item.title ? `<div class="item-title">${escapeHtml(item.title)}</div>` : ''}
                ${content}
            </div>
        `;
    }

    // ===== MARK LESSON COMPLETE =====
    async function markComplete() {
        const lesson = state.lessons[state.currentIndex];
        if (lesson.completed) return;

        try {
            const response = await fetch(`https://fissk-backend.onrender.com/api/lessons/${lesson._id}/complete`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${state.token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error('Failed to mark lesson as complete');

            const data = await response.json();
            lesson.completed = true;
            renderLesson();
            renderSidebar();
            showToast('✅ Lesson completed!', 'success');
        } catch (error) {
            console.error('Mark complete error:', error);
            showToast('Failed to mark lesson as complete', 'error');
        }
    }

    // ===== NAVIGATION =====
    function goToPrev() {
        if (state.currentIndex > 0) {
            state.currentIndex--;
            renderLesson();
            renderSidebar();
            window.scrollTo(0, 0);
        }
    }

    function goToNext() {
        if (state.currentIndex < state.lessons.length - 1) {
            state.currentIndex++;
            renderLesson();
            renderSidebar();
            window.scrollTo(0, 0);
        }
    }

    // ===== EVENT LISTENERS =====
    function setupEventListeners() {
        elements.prevBtn.addEventListener('click', goToPrev);
        elements.nextBtn.addEventListener('click', goToNext);
        elements.completeBtn.addEventListener('click', markComplete);

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') goToPrev();
            if (e.key === 'ArrowRight') goToNext();
        });
    }

    // ===== LOGOUT =====
    function logout() {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        window.location.href = 'index.html';
    }

    // ===== START =====
    document.addEventListener('DOMContentLoaded', init);
})();