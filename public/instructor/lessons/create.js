// instructor/lessons/create.js - Lesson Builder (FIXED - contentId preservation)
class LessonBuilder {
    constructor() {
        this.user = JSON.parse(localStorage.getItem('user'));
        this.token = localStorage.getItem('token');
        this.classId = this.getQueryParam('classId');
        this.lessonId = this.getQueryParam('lessonId');
        this.contentItems = [];
        this.availableVideos = [];
        this.availableQuizzes = [];
        this.isEdit = !!this.lessonId;
        this.isLoading = true;
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

        if (!this.classId) {
            alert('No class selected. Please go back to your dashboard.');
            window.location.href = '../../instructor-dashboard.html#classes';
            return;
        }

        this.loadUserData();
        
        const classValid = await this.verifyClassAccess();
        if (!classValid) {
            return;
        }

        await this.loadAvailableContent();

        if (this.isEdit) {
            const pageTitle = document.getElementById('pageTitle');
            if (pageTitle) pageTitle.textContent = '✏️ Edit Lesson';
            await this.loadLessonData();
        }

        this.isLoading = false;
        this.setupEventListeners();
    }

    async verifyClassAccess() {
        try {
            const response = await fetch(`https://fissk-backend.onrender.com/register/instructor/classes/${this.classId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ id: this.user.id })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Class access verification failed:', errorText);
                
                if (response.status === 401) {
                    alert('Your session has expired. Please login again.');
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    window.location.href = '../../login.html';
                    return false;
                }
                
                if (response.status === 403) {
                    alert('You do not have permission to create lessons for this class.');
                    window.location.href = '../../instructor-dashboard.html#classes';
                    return false;
                }

                alert('Failed to verify class access. Please try again.');
                window.location.href = '../../instructor-dashboard.html#classes';
                return false;
            }

            const classData = await response.json();
            console.log('Class verified:', classData.title);
            return true;

        } catch (error) {
            console.error('Verify class access error:', error);
            alert('Failed to verify class access. Please try again.');
            window.location.href = '../../instructor-dashboard.html#classes';
            return false;
        }
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
            console.log(`Loading available content for class ${this.classId}...`);

            this.updateSelectsLoading(true);

            const videoRes = await fetch(`https://fissk-backend.onrender.com/api/lessons/available-videos/${this.classId}`, {
                headers: { 
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (videoRes.ok) {
                const videoData = await videoRes.json();
                this.availableVideos = videoData.videos || [];
                console.log(`Loaded ${this.availableVideos.length} videos`);
                console.log('Video data sample:', this.availableVideos[0]);
            } else {
                if (videoRes.status === 401) {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    window.location.href = '../../login.html';
                    return;
                }
                this.availableVideos = [];
            }

            const quizRes = await fetch(`https://fissk-backend.onrender.com/api/lessons/available-quizzes/${this.classId}`, {
                headers: { 
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (quizRes.ok) {
                const quizData = await quizRes.json();
                this.availableQuizzes = quizData.quizzes || [];
                console.log(`Loaded ${this.availableQuizzes.length} quizzes`);
            } else {
                if (quizRes.status === 401) {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    window.location.href = '../../login.html';
                    return;
                }
                this.availableQuizzes = [];
            }

            this.updateSelectsLoading(false);
            this.populateSelects();

        } catch (error) {
            console.error('Load available content error:', error);
            this.updateSelectsLoading(false);
            this.populateSelects();
            
            const warningMsg = document.createElement('div');
            warningMsg.style.cssText = `
                background: #fff3cd;
                color: #856404;
                padding: 12px 16px;
                border-radius: 8px;
                margin: 12px 0;
                border: 1px solid #ffc107;
            `;
            warningMsg.innerHTML = `
                ⚠️ Could not load some content. You can still create text content. 
                Videos and quizzes may not be available if you don't have permission.
            `;
            const container = document.querySelector('.builder-card');
            if (container) {
                container.insertBefore(warningMsg, container.firstChild);
            }
        }
    }

    updateSelectsLoading(isLoading) {
        const videoSelect = document.getElementById('videoSelect');
        const quizSelect = document.getElementById('quizSelect');
        
        if (videoSelect) {
            videoSelect.innerHTML = isLoading 
                ? '<option value="">Loading videos...</option>'
                : '<option value="">Select a recorded video...</option>';
            videoSelect.disabled = isLoading;
        }
        
        if (quizSelect) {
            quizSelect.innerHTML = isLoading 
                ? '<option value="">Loading quizzes...</option>'
                : '<option value="">Select a quiz...</option>';
            quizSelect.disabled = isLoading;
        }
    }

    populateSelects() {
        const videoSelect = document.getElementById('videoSelect');
        if (videoSelect) {
            if (!this.availableVideos || this.availableVideos.length === 0) {
                videoSelect.innerHTML = `
                    <option value="">No videos available</option>
                `;
            } else {
                videoSelect.innerHTML = `
                    <option value="">Select a recorded video...</option>
                    ${this.availableVideos.map(v => `
                        <option value="${v._id}">${this.escapeHtml(v.classTitle || v.name || v.filename || 'Untitled')}</option>
                    `).join('')}
                `;
            }
        }

        const quizSelect = document.getElementById('quizSelect');
        if (quizSelect) {
            if (!this.availableQuizzes || this.availableQuizzes.length === 0) {
                quizSelect.innerHTML = `
                    <option value="">No quizzes available</option>
                `;
            } else {
                quizSelect.innerHTML = `
                    <option value="">Select a quiz...</option>
                    ${this.availableQuizzes.map(q => `
                        <option value="${q._id}">${this.escapeHtml(q.title)} (${q.questionCount || 0} questions)</option>
                    `).join('')}
                `;
            }
        }
    }

    async loadLessonData() {
        try {
            const response = await fetch(`https://fissk-backend.onrender.com/api/lessons/${this.lessonId}`, {
                headers: { 
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    window.location.href = '../../login.html';
                    return;
                }
                throw new Error('Failed to load lesson');
            }

            const data = await response.json();
            const lesson = data.lesson;

            const titleInput = document.getElementById('lessonTitle');
            const descInput = document.getElementById('lessonDescription');
            const publishedCheck = document.getElementById('isPublished');
            const pageTitle = document.getElementById('pageTitle');

            if (titleInput) titleInput.value = lesson.title || '';
            if (descInput) descInput.value = lesson.description || '';
            if (publishedCheck) publishedCheck.checked = lesson.isPublished !== false;
            if (pageTitle) pageTitle.textContent = `✏️ ${lesson.title}`;

            this.contentItems = lesson.contentItems || [];
            this.renderContentItems();

        } catch (error) {
            console.error('Load lesson error:', error);
            alert('Failed to load lesson data');
            window.location.href = '../../instructor-dashboard.html#classes';
        }
    }

    setupEventListeners() {
        const addContentBtn = document.getElementById('addContentBtn');
        if (addContentBtn) {
            addContentBtn.addEventListener('click', () => {
                this.openContentModal();
            });
        }

        const lessonForm = document.getElementById('lessonForm');
        if (lessonForm) {
            lessonForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveLesson();
            });
        }

        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                const modal = btn.closest('.modal');
                if (modal) modal.style.display = 'none';
            });
        });

        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        });

        const contentType = document.getElementById('contentType');
        if (contentType) {
            contentType.addEventListener('change', () => {
                this.toggleContentFields();
            });
        }

        const contentForm = document.getElementById('contentForm');
        if (contentForm) {
            contentForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveContentItem();
            });
        }
    }

    toggleContentFields() {
        const type = document.getElementById('contentType');
        if (!type) return;
        
        const typeValue = type.value;
        
        const textField = document.getElementById('textField');
        const videoField = document.getElementById('videoField');
        const quizField = document.getElementById('quizField');
        const materialField = document.getElementById('materialField');
        const linkField = document.getElementById('linkField');
        const embedField = document.getElementById('embedField');

        if (textField) textField.style.display = 'none';
        if (videoField) videoField.style.display = 'none';
        if (quizField) quizField.style.display = 'none';
        if (materialField) materialField.style.display = 'none';
        if (linkField) linkField.style.display = 'none';
        if (embedField) embedField.style.display = 'none';

        switch (typeValue) {
            case 'text':
                if (textField) textField.style.display = 'block';
                break;
            case 'video':
                if (videoField) videoField.style.display = 'block';
                this.populateSelects();
                break;
            case 'quiz':
                if (quizField) quizField.style.display = 'block';
                this.populateSelects();
                break;
            case 'material':
                if (materialField) materialField.style.display = 'block';
                break;
            case 'link':
                if (linkField) linkField.style.display = 'block';
                break;
            case 'embed':
                if (embedField) embedField.style.display = 'block';
                break;
        }
    }

    openContentModal(data = null) {
        const modal = document.getElementById('contentModal');
        if (!modal) {
            console.error('Content modal not found');
            return;
        }

        const contentForm = document.getElementById('contentForm');
        if (contentForm) contentForm.reset();
        
        const contentType = document.getElementById('contentType');
        if (contentType) contentType.value = 'text';
        
        this.toggleContentFields();

        const title = document.getElementById('contentModalTitle');
        const submitBtn = document.getElementById('saveContentBtn');

        if (data) {
            if (title) title.textContent = '✏️ Edit Content';
            if (submitBtn) submitBtn.textContent = 'Update Content';
            this.editingIndex = this.contentItems.indexOf(data);
            
            const contentTypeEl = document.getElementById('contentType');
            const contentTitleEl = document.getElementById('contentTitle');
            const isRequiredEl = document.getElementById('isRequired');

            if (contentTypeEl) contentTypeEl.value = data.type || 'text';
            if (contentTitleEl) contentTitleEl.value = data.title || '';
            if (isRequiredEl) isRequiredEl.checked = data.isRequired !== false;

            switch (data.type) {
                case 'text':
                    const contentText = document.getElementById('contentText');
                    if (contentText) contentText.value = data.content || '';
                    break;
                case 'video':
                    const videoSelect = document.getElementById('videoSelect');
                    if (videoSelect) videoSelect.value = data.contentId || '';
                    break;
                case 'quiz':
                    const quizSelect = document.getElementById('quizSelect');
                    if (quizSelect) quizSelect.value = data.contentId || '';
                    break;
                case 'material':
                    const fileUrl = document.getElementById('fileUrl');
                    const fileName = document.getElementById('fileName');
                    if (fileUrl) fileUrl.value = data.content || '';
                    if (fileName) fileName.value = data.fileName || '';
                    break;
                case 'link':
                    const linkUrl = document.getElementById('linkUrl');
                    const linkTarget = document.getElementById('linkTarget');
                    if (linkUrl) linkUrl.value = data.content || '';
                    if (linkTarget) linkTarget.value = data.linkTarget || '_blank';
                    break;
                case 'embed':
                    const embedCode = document.getElementById('embedCode');
                    if (embedCode) embedCode.value = data.content || '';
                    break;
            }
        } else {
            if (title) title.textContent = 'Add Content';
            if (submitBtn) submitBtn.textContent = 'Add Content';
            this.editingIndex = -1;
            const isRequiredEl = document.getElementById('isRequired');
            if (isRequiredEl) isRequiredEl.checked = true;
        }

        this.toggleContentFields();
        modal.style.display = 'flex';
        this.populateSelects();
    }

    saveContentItem() {
        const type = document.getElementById('contentType');
        const titleInput = document.getElementById('contentTitle');
        const isRequiredEl = document.getElementById('isRequired');

        if (!type || !titleInput) {
            alert('Form elements not found');
            return;
        }

        const typeValue = type.value;
        const title = titleInput.value.trim();
        const isRequired = isRequiredEl ? isRequiredEl.checked : true;

        if (!title) {
            alert('Please enter a title');
            return;
        }

        let content = '';
        let contentId = null;
        let additional = {};
        let duration = 0;

        switch (typeValue) {
            case 'text':
                const contentText = document.getElementById('contentText');
                content = contentText ? contentText.value : '';
                break;
            case 'video':
                const videoSelect = document.getElementById('videoSelect');
                contentId = videoSelect ? videoSelect.value : '';
                if (!contentId) {
                    alert('Please select a video');
                    return;
                }
                // Find the selected video and get its duration as a number
                const selectedVideo = this.availableVideos.find(v => v._id === contentId);
                if (selectedVideo) {
                    duration = this.parseDurationToMinutes(selectedVideo.duration);
                }
                console.log('Video selected - contentId:', contentId);
                break;
            case 'quiz':
                const quizSelect = document.getElementById('quizSelect');
                contentId = quizSelect ? quizSelect.value : '';
                if (!contentId) {
                    alert('Please select a quiz');
                    return;
                }
                console.log('Quiz selected - contentId:', contentId);
                break;
            case 'material':
                const fileUrl = document.getElementById('fileUrl');
                const fileName = document.getElementById('fileName');
                content = fileUrl ? fileUrl.value : '';
                additional.fileName = fileName ? fileName.value : '';
                break;
            case 'link':
                const linkUrl = document.getElementById('linkUrl');
                const linkTarget = document.getElementById('linkTarget');
                content = linkUrl ? linkUrl.value : '';
                additional.linkTarget = linkTarget ? linkTarget.value : '_blank';
                if (!content) {
                    alert('Please enter a link URL');
                    return;
                }
                break;
            case 'embed':
                const embedCode = document.getElementById('embedCode');
                content = embedCode ? embedCode.value : '';
                break;
        }

        const item = {
            type: typeValue,
            title,
            content: content || '',
            contentId: contentId, // CRITICAL: This must be set for videos and quizzes
            isRequired,
            order: this.contentItems.length,
            duration: duration || 0,
            ...additional
        };

        console.log('Saving content item:', item);

        if (this.editingIndex >= 0) {
            item.order = this.contentItems[this.editingIndex].order;
            this.contentItems[this.editingIndex] = item;
        } else {
            this.contentItems.push(item);
        }

        const modal = document.getElementById('contentModal');
        if (modal) modal.style.display = 'none';
        this.renderContentItems();
    }

    renderContentItems() {
        const container = document.getElementById('contentItemsContainer');
        if (!container) return;

        if (this.contentItems.length === 0) {
            container.innerHTML = `
                <div class="empty-items">No content items added yet. Click "Add Content" to get started.</div>
            `;
            return;
        }

        container.innerHTML = this.contentItems.map((item, index) => `
            <div class="content-item-row" data-index="${index}">
                <span class="item-type-badge ${item.type}">${item.type}</span>
                <span class="item-title">${this.escapeHtml(item.title)}</span>
                ${item.isRequired !== false ? '<span style="color:#10B981;font-size:0.8rem;">Required</span>' : '<span style="color:#a0aec0;font-size:0.8rem;">Optional</span>'}
                <button class="btn-sm btn-outline edit-item-btn" data-index="${index}" style="padding:4px 10px;font-size:0.75rem;border:1px solid #8B5FBF;border-radius:6px;cursor:pointer;background:transparent;color:#8B5FBF;">✏️ Edit</button>
                <button class="btn-sm btn-danger remove-item-btn" data-index="${index}" style="padding:4px 10px;font-size:0.75rem;border:none;border-radius:6px;cursor:pointer;background:#EF4444;color:white;">✕ Remove</button>
            </div>
        `).join('');

        container.querySelectorAll('.edit-item-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.index);
                this.openContentModal(this.contentItems[index]);
            });
        });

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

    /**
     * Convert duration string to minutes (number)
     * Handles formats like: "4 min, 22 sec", "5:30", "10", "04 min, 22 sec1"
     */
    parseDurationToMinutes(durationStr) {
        if (!durationStr) return 0;
        
        if (typeof durationStr === 'number') return durationStr;
        
        const str = String(durationStr).trim();
        console.log('Parsing duration string:', str);
        
        const num = parseFloat(str);
        if (!isNaN(num) && str.match(/^\d+$/)) {
            return num;
        }
        
        const minSecMatch = str.match(/(\d+)\s*min\s*[,.]?\s*(\d+)\s*sec/i);
        if (minSecMatch) {
            const mins = parseInt(minSecMatch[1]);
            const secs = parseInt(minSecMatch[2]);
            const result = mins + (secs / 60);
            console.log(`Parsed "${str}" as ${result} minutes`);
            return result;
        }
        
        const minMatch = str.match(/(\d+)\s*min/i);
        if (minMatch) {
            const result = parseInt(minMatch[1]);
            console.log(`Parsed "${str}" as ${result} minutes`);
            return result;
        }
        
        const timeMatch = str.match(/(\d+):(\d+)/);
        if (timeMatch) {
            const mins = parseInt(timeMatch[1]);
            const secs = parseInt(timeMatch[2]);
            const result = mins + (secs / 60);
            console.log(`Parsed "${str}" as ${result} minutes`);
            return result;
        }
        
        const anyNum = str.match(/\d+/);
        if (anyNum) {
            const result = parseInt(anyNum[0]);
            console.log(`Parsed "${str}" as ${result} minutes (fallback)`);
            return result;
        }
        
        console.log(`Could not parse "${str}", returning 0`);
        return 0;
    }

    async saveLesson() {
        const titleInput = document.getElementById('lessonTitle');
        const descInput = document.getElementById('lessonDescription');
        const publishedCheck = document.getElementById('isPublished');

        const title = titleInput ? titleInput.value.trim() : '';
        const description = descInput ? descInput.value.trim() : '';
        const isPublished = publishedCheck ? publishedCheck.checked : true;

        if (!title) {
            alert('Please enter a lesson title');
            return;
        }

        // Clean up content items - IMPORTANT: Preserve contentId for videos and quizzes
        const items = this.contentItems.map((item, index) => {
            // Ensure duration is a number
            let duration = 0;
            if (item.duration) {
                duration = this.parseDurationToMinutes(item.duration);
            }
            
            console.log('Saving item:', {
                type: item.type,
                title: item.title,
                contentId: item.contentId,
                content: item.content
            });
            
            return {
                type: item.type || 'text',
                title: item.title || `Item ${index + 1}`,
                content: item.content || '',
                contentId: item.contentId || null, // IMPORTANT: Keep the contentId
                order: index,
                isRequired: item.isRequired !== false,
                duration: duration,
                fileName: item.fileName || '',
                linkTarget: item.linkTarget || '_blank'
            };
        });

        // Calculate estimated time
        let estimatedTime = 0;
        items.forEach(item => {
            if (item.duration) estimatedTime += item.duration;
            if (item.type === 'text' && item.content) {
                const wordCount = item.content.split(/\s+/).length;
                estimatedTime += Math.ceil(wordCount / 100);
            }
        });

        const payload = {
            classId: this.classId,
            title,
            description,
            contentItems: items,
            order: 0,
            isFreePreview: false,
            isPublished,
            estimatedTime: Math.round(estimatedTime)
        };

        console.log('Saving lesson payload:', JSON.stringify(payload, null, 2));

        const saveBtn = document.getElementById('saveLessonBtn');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = '⏳ Saving...';
        }

        try {
            const url = this.isEdit 
                ? `https://fissk-backend.onrender.com/api/lessons/${this.lessonId}`
                : 'https://fissk-backend.onrender.com/api/lessons';
            
            const method = this.isEdit ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                if (response.status === 401) {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    window.location.href = '../../login.html';
                    return;
                }
                const errorText = await response.text();
                console.error('Server error response:', errorText);
                let errorMessage = 'Failed to save lesson';
                try {
                    const errorJson = JSON.parse(errorText);
                    errorMessage = errorJson.message || errorMessage;
                } catch (e) {
                    errorMessage = errorText || errorMessage;
                }
                throw new Error(errorMessage);
            }

            const data = await response.json();
            alert(this.isEdit ? '✅ Lesson updated successfully!' : '✅ Lesson created successfully!');
            
            window.location.href = `../../instructor-dashboard.html#classes`;

        } catch (error) {
            console.error('Save lesson error:', error);
            alert('❌ ' + error.message);
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = '💾 Save Lesson';
            }
        }
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
    new LessonBuilder();
});

function logout() {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    window.location.href = '../../index.html';
}