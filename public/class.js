// Individual Class Page Functionality - Real Data Only
class ClassManager {
    constructor() {
        this.classId = this.getClassIdFromURL();
        this.classData = null;
        this.user = JSON.parse(localStorage.getItem('user'));
        this.userId = this.user ? this.user.id : null;
        this.currentVideoIndex = null;
        this.progressInterval = null;
        this.videos = [];
        this.recordings = []; // Store Cloudinary recordings
        this.isEnrolled = false;
        this.isLoading = true;
        this.init();
    }

    getClassIdFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('id');
    }

    async init() {
        if (!this.classId) {
            window.location.href = 'classes.html';
            return;
        }
        
        // Show loading state immediately
        this.showLoadingState();
        
        try {
            // Load all data in parallel for better performance
            await Promise.all([
                this.loadClassData(),
                this.checkEnrollment(),
                this.loadClassVideos(),
                this.loadClassRecordings() // Load Cloudinary recordings
            ]);
            
            // Only render after ALL data is loaded
            this.renderClassData();
            this.renderVideos();
            this.renderRecordings(); // Render recordings in the recordings tab
            this.setupEventListeners();
        } catch (error) {
            console.error('Initialization error:', error);
            this.showError('Failed to load class data. Please refresh the page.');
        } finally {
            this.isLoading = false;
            this.hideLoadingState();
        }
    }

    showLoadingState() {
        // Show loading indicators
        const classNameEl = document.getElementById('className');
        if (classNameEl) classNameEl.innerHTML = '<div class="loading-pulse">Loading...</div>';
        
        const videosContainer = document.getElementById('videosContainer');
        if (videosContainer) {
            videosContainer.innerHTML = `
                <div class="loading-skeleton">
                    <div class="skeleton-card"></div>
                    <div class="skeleton-card"></div>
                    <div class="skeleton-card"></div>
                </div>
            `;
        }
        
        const recordingsContainer = document.getElementById('recordingsContainer');
        if (recordingsContainer) {
            recordingsContainer.innerHTML = `
                <div class="loading-skeleton">
                    <div class="skeleton-card"></div>
                    <div class="skeleton-card"></div>
                    <div class="skeleton-card"></div>
                </div>
            `;
        }
    }

    hideLoadingState() {
        // Remove loading indicators (they'll be replaced with actual content)
    }

    async loadClassData() {
        try {
            const response = await fetch(`https://fissk-backend.onrender.com/register/class/${this.classId}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: Class not found`);
            }
            
            const data = await response.json();
            
            if (data.classA && data.classA.length > 0) {
                this.classData = data.classA[0];
            } else {
                throw new Error('Class not found');
            }
        } catch (error) {
            console.error('Error loading class data:', error);
            this.showError('Could not load class information. Please try again.');
            throw error;
        }
    }

    async checkEnrollment() {
        if (!this.user || !this.user.email) {
            this.isEnrolled = false;
            return;
        }
        
        try {
            const response = await fetch('https://fissk-backend.onrender.com/register/get-user-classes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: this.user.email })
            });
            
            if (!response.ok) {
                throw new Error('Failed to check enrollment');
            }
            
            const data = await response.json();
            
            if (data.classes && data.classes.length) {
                this.isEnrolled = data.classes.some(c => 
                    (c.class_id?.toString() === this.classId) || (c._id?.toString() === this.classId)
                );
            }
        } catch (error) {
            console.error('Error checking enrollment:', error);
            this.isEnrolled = false;
        }
    }

    async loadClassVideos() {
        try {
            const response = await fetch(`https://fissk-backend.onrender.com/api/by-class/${this.classId}`);
            
            if (!response.ok) {
                throw new Error('Failed to load videos');
            }
            
            this.videos = await response.json();
            console.log('Videos loaded:', this.videos);
            
            // Load user progress only if enrolled
            if (this.userId && this.isEnrolled) {
                await this.loadUserProgress();
            }
            
            // Load upcoming sessions
            await this.loadUpcomingSessions();
            
        } catch (error) {
            console.error('Error loading class videos:', error);
            this.videos = [];
            // Don't throw - videos are optional
        }
    }

    // NEW: Load Cloudinary recordings for this class
    async loadClassRecordings() {
        try {
            console.log('Loading recordings for class:', this.classId);
            const response = await fetch(`https://fissk-backend.onrender.com/api/by-class/${this.classId}`);
            
            if (!response.ok) {
                throw new Error('Failed to load recordings');
            }
            
            const allVideos = await response.json();
            
            // Filter recordings (videos with cloudinaryUrl or hlsUrl)
            this.recordings = allVideos.filter(video => 
                video.cloudinaryUrl || video.hlsUrl || video.url
            );
            
            console.log('Recordings loaded:', this.recordings.length);
        } catch (error) {
            console.error('Error loading class recordings:', error);
            this.recordings = [];
        }
    }

    async loadUserProgress() {
        try {
            const response = await fetch('https://fissk-backend.onrender.com/register/user-progress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: this.userId, classId: this.classId }),
            });
            
            if (!response.ok) {
                throw new Error('Failed to load progress');
            }
            
            const progress = await response.json();
            
            const progressBar = document.getElementById('classProgress');
            const progressText = document.getElementById('progressText');
            
            if (progressBar && progressText && progress.progress && progress.progress[0]) {
                const progValue = progress.progress[0].progress || 0;
                progressBar.style.width = `${progValue}%`;
                progressText.textContent = `${progValue}% Complete`;
            }
        } catch (error) {
            console.error('Error loading progress:', error);
            // Don't throw - progress is optional
        }
    }

    async loadUpcomingSessions() {
        try {
            const res = await fetch('https://fissk-backend.onrender.com/register/class/upcoming', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: this.classId }),
            });
            
            if (!res.ok) {
                throw new Error('Failed to load sessions');
            }
            
            const json = await res.json();
            const upcoming = Array.isArray(json.upcoming) ? json.upcoming : [];
            
            const container = document.getElementById('upcomingSessions');
            if (!container) return;
            
            if (upcoming.length === 0) {
                container.innerHTML = '<p class="no-data">No upcoming live sessions yet</p>';
            } else {
                container.innerHTML = upcoming.map(s => `
                    <div class="enrolled-class-card upcoming">
                        <div class="session-header"><h4>${this.escapeHtml(s.session_title)}</h4></div>
                        <p>${this.escapeHtml(s.description || '')}</p>
                        <div class="session-details">
                            <div class="session-info">
                                <span>📅 ${new Date(s.date).toLocaleDateString()} at ${s.time || ''}</span>
                            </div><br>
                            <div class="session-actions">
                                <button class="btn btn-primary join-session" data-session-id="${s.id}">Join Session</button>
                            </div>
                        </div>
                    </div><br>
                `).join('');
                
                // Add event listeners to join buttons
                container.querySelectorAll('.join-session').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        window.open(`newlivestream.html?session=${btn.dataset.sessionId}`, '_blank');
                    });
                });
            }
        } catch (error) {
            console.error('Error loading upcoming sessions:', error);
            const container = document.getElementById('upcomingSessions');
            if (container) {
                container.innerHTML = '<p class="no-data">Unable to load upcoming sessions</p>';
            }
        }
    }

    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Back to classes button
        const backBtn = document.getElementById('backToClasses');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                window.location.href = 'classes.html';
            });
        }

        // Enrollment button
        const enrollBtn = document.getElementById('enrollBtn');
        if (enrollBtn) {
            // Remove existing listeners to avoid duplicates
            const newEnrollBtn = enrollBtn.cloneNode(true);
            enrollBtn.parentNode.replaceChild(newEnrollBtn, enrollBtn);
            newEnrollBtn.addEventListener('click', () => {
                this.handleEnrollment();
            });
        }
    }
switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `${tabName}Tab`);
    });
    
    // Load forum content when forum tab is clicked
    if (tabName === 'forum') {
        this.renderClassForum();
    }
    
    // Load reviews when reviews tab is clicked
    if (tabName === 'reviews') {
        // this.renderClassReviews(); // We'll add this in the next feature
    }
}

    async renderClassData() {
        if (!this.classData) {
            this.showError('Class data not available');
            return;
        }
        
        try {
            // Update page title
            document.title = `${this.classData.title} - FISSK Online Academy`;

            // Update hero section
            const classNameEl = document.getElementById('className');
            const classDescEl = document.getElementById('classDescription');
            
            if (classNameEl) classNameEl.textContent = this.classData.title;
            if (classDescEl) classDescEl.textContent = this.classData.description;
            
            // Update meta information
            const levelEl = document.getElementById('classLevel');
            const durationEl = document.getElementById('classDuration');
            const studentsEl = document.getElementById('classStudents');
            
            if (levelEl) levelEl.textContent = `🟢 ${this.classData.level || 'Beginner'}`;
            if (durationEl) durationEl.textContent = `🕒 ${this.classData.duration || 'Self-paced'}`;
            if (studentsEl) studentsEl.textContent = `👥 ${this.classData.maxStudents || 0} Students`;

            // Update enrollment button
            const enrollBtn = document.getElementById('enrollBtn');
            if (enrollBtn) {
                if (this.isEnrolled) {
                    enrollBtn.textContent = 'Already Enrolled ✓';
                    enrollBtn.disabled = true;
                    enrollBtn.classList.add('enrolled');
                } else {
                    enrollBtn.textContent = 'Enroll Now';
                    enrollBtn.disabled = false;
                    enrollBtn.classList.remove('enrolled');
                }
            }

            // Load instructor info
            if (this.classData.instructorId) {
                try {
                    const response = await fetch('https://fissk-backend.onrender.com/register/classes/instructor', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ instructor_id: this.classData.instructorId }),
                    });
                    const dataA = await response.json();
                    
                    const instructorNameEl = document.getElementById('instructorName');
                    const instructorBioEl = document.getElementById('instructorBio');
                    
                    if (instructorNameEl && dataA.instructorData) {
                        const name = `${dataA.instructorData.firstName || ''} ${dataA.instructorData.lastName || ''}`.trim();
                        instructorNameEl.textContent = name || 'Staff';
                    }
                    if (instructorBioEl) {
                        instructorBioEl.textContent = `Certified ${this.classData.title} Instructor`;
                    }
                } catch (err) {
                    console.error('Error loading instructor:', err);
                    const instructorNameEl = document.getElementById('instructorName');
                    if (instructorNameEl) instructorNameEl.textContent = 'Staff';
                }
            }

            // Render class details
            this.renderClassDetails();
        } catch(err) {
            console.error('Error rendering class data:', err);
        }
    }

    renderClassDetails() {
        const detailsContent = document.getElementById('classDetailsContent');
        if (!detailsContent) return;
        
        detailsContent.innerHTML = `
            <div class="class-details">
                <h4>Course Overview</h4>
                <p>${this.escapeHtml(this.classData.description || 'No description available')}</p>
                ${this.classData.syllabus ? `<h4>Syllabus</h4><p>${this.escapeHtml(this.classData.syllabus)}</p>` : ''}
            </div>
        `;
    }
       
  // ===== RENDER CLASS FORUM =====
async renderClassForum() {
    const container = document.getElementById('classForumContainer');
    if (!container) return;
    
    // Check if user is enrolled
    if (!this.isEnrolled) {
        container.innerHTML = `
            <div class="forum-locked">
                <p>🔒 Enroll in this class to participate in discussions</p>
                <button class="btn btn-primary" id="enrollFromForumBtn">Enroll Now</button>
            </div>
        `;
        // Add event listener for the enroll button
        const enrollBtn = container.querySelector('#enrollFromForumBtn');
        if (enrollBtn) {
            enrollBtn.addEventListener('click', () => {
                this.handleEnrollment();
            });
        }
        return;
    }
    
    try {
        // Fetch class forum topics
        const response = await fetch(`https://fissk-backend.onrender.com/forum-api/class/${this.classId}/topics`);
        const topics = await response.json();
        
        if (!topics || topics.length === 0) {
            container.innerHTML = `
                <div class="forum-empty">
                    <p>💬 No discussions yet</p>
                    <p class="forum-empty-sub">Be the first to start a discussion about this class!</p>
                    <button class="btn btn-primary" id="startDiscussionBtn">Start Discussion</button>
                </div>
            `;
            // Add event listener for the start discussion button
            const startBtn = container.querySelector('#startDiscussionBtn');
            if (startBtn) {
                startBtn.addEventListener('click', () => {
                    this.openNewClassTopic();
                });
            }
            return;
        }
        
        // Render topics
        container.innerHTML = `
            <div class="forum-header-actions">
                <button class="btn btn-primary" id="startDiscussionBtn">
                    + New Discussion
                </button>
                <div class="forum-filters">
                    <select id="forumSort">
                        <option value="latest">Latest</option>
                        <option value="popular">Most Popular</option>
                        <option value="unanswered">Unanswered</option>
                    </select>
                </div>
            </div>
            <div class="forum-topics-list">
                ${topics.map(topic => `
                    <div class="forum-topic-item ${topic.isPinned ? 'pinned' : ''} ${topic.solved ? 'solved' : ''}">
                        <div class="forum-topic-left">
                            ${topic.isPinned ? '<span class="pin-badge">📌</span>' : ''}
                            ${topic.solved ? '<span class="solved-badge">✅ Solved</span>' : ''}
                            <a href="#" data-topic-id="${topic._id}" class="forum-topic-title">
                                ${this.escapeHtml(topic.title)}
                            </a>
                            <div class="forum-topic-meta">
                                <span>👤 ${this.escapeHtml(topic.author_name || 'Anonymous')}</span>
                                <span>💬 ${topic.replyCount || 0}</span>
                                <span>👀 ${topic.views || 0}</span>
                                <span>📅 ${new Date(topic.createdAt).toLocaleDateString()}</span>
                            </div>
                        </div>
                        ${topic.category_name ? `<span class="topic-category">${this.escapeHtml(topic.category_name)}</span>` : ''}
                    </div>
                `).join('')}
            </div>
        `;
        
        // Add event listener for the start discussion button
        const startBtn = container.querySelector('#startDiscussionBtn');
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                this.openNewClassTopic();
            });
        }
        
        // Add event listener for the sort dropdown
        const sortSelect = container.querySelector('#forumSort');
        if (sortSelect) {
            sortSelect.addEventListener('change', () => {
                this.filterForumTopics();
            });
        }
        
        // Add event listeners for topic clicks
        container.querySelectorAll('.forum-topic-title').forEach(el => {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                const topicId = el.dataset.topicId;
                if (topicId) {
                    this.viewForumTopic(topicId);
                }
            });
        });
        
    } catch (error) {
        console.error('Render forum error:', error);
        container.innerHTML = `
            <div class="forum-error">
                <p>⚠️ Failed to load discussions: ${error.message}</p>
                <button class="btn btn-outline" id="retryForumBtn">Retry</button>
            </div>
        `;
        const retryBtn = container.querySelector('#retryForumBtn');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => {
                this.renderClassForum();
            });
        }
    }
}

    // ===== OPEN NEW CLASS TOPIC MODAL =====
    openNewClassTopic() {
        const modal = document.getElementById('newClassTopicModal');
        if (!modal) {
            // Create modal if it doesn't exist
            this.createNewTopicModal();
            return;
        }
        
        // Populate categories
        this.loadClassForumCategories();
        modal.style.display = 'flex';
    }

    // ===== CREATE NEW TOPIC MODAL =====
    createNewTopicModal() {
        const modalHTML = `
            <div id="newClassTopicModal" class="modal">
                <div class="modal-content">
                    <span class="close-modal" onclick="document.getElementById('newClassTopicModal').style.display='none'">&times;</span>
                    <h2>Start New Discussion</h2>
                    <form id="newClassTopicForm">
                        <div class="form-group">
                            <label>Title</label>
                            <input type="text" id="classTopicTitle" placeholder="What's your question?" required>
                        </div>
                        <div class="form-group">
                            <label>Category</label>
                            <select id="classTopicCategory">
                                <option value="">General</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Content</label>
                            <textarea id="classTopicContent" rows="6" placeholder="Describe your question or topic..." required></textarea>
                        </div>
                        <div class="form-actions">
                            <button type="submit" class="btn btn-primary">Post Discussion</button>
                            <button type="button" class="btn btn-outline" onclick="document.getElementById('newClassTopicModal').style.display='none'">Cancel</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        document.getElementById('newClassTopicForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitClassTopic();
        });
    }

    // ===== LOAD CLASS FORUM CATEGORIES =====
    async loadClassForumCategories() {
        try {
            const response = await fetch(`https://fissk-backend.onrender.com/forum-api/class/${this.classId}/categories`);
            const categories = await response.json();
            
            const select = document.getElementById('classTopicCategory');
            if (select) {
                select.innerHTML = `
                    <option value="">General</option>
                    ${categories.map(c => `<option value="${c._id}">${c.icon || '📌'} ${c.name}</option>`).join('')}
                `;
            }
        } catch (error) {
            console.error('Load categories error:', error);
        }
    }

    // ===== SUBMIT CLASS TOPIC =====
    async submitClassTopic() {
        const title = document.getElementById('classTopicTitle').value.trim();
        const content = document.getElementById('classTopicContent').value.trim();
        const categoryId = document.getElementById('classTopicCategory').value;
        
        if (!title || !content) {
            alert('Please fill in all required fields');
            return;
        }
        
        try {
            const response = await fetch(`https://fissk-backend.onrender.com/forum-api/class/${this.classId}/topics`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    content,
                    categoryId: categoryId || null,
                    userId: this.userId
                })
            });
            
            if (response.ok) {
                document.getElementById('newClassTopicModal').style.display = 'none';
                this.renderClassForum();
                showToast('Discussion posted successfully!', false);
            } else {
                const error = await response.json();
                showToast(error.message || 'Failed to post discussion', true);
            }
        } catch (error) {
            console.error('Submit topic error:', error);
            showToast('Failed to post discussion', true);
        }
    }

    // ===== VIEW FORUM TOPIC =====
    viewForumTopic(topicId) {
        // Navigate to topic detail page
        window.location.href = `forum-post.html?classId=${this.classId}&topicId=${topicId}`;
    }

    // ===== FILTER FORUM TOPICS =====
    async filterForumTopics() {
        // Re-fetch with filter
        await this.renderClassForum();
    }    

    renderVideos() {
        const videosContainer = document.getElementById('videosContainer');
        const noVideos = document.getElementById('noVideos');

        if (!this.videos || this.videos.length === 0) {
            if (videosContainer) videosContainer.style.display = 'none';
            if (noVideos) {
                noVideos.style.display = 'block';
                noVideos.innerHTML = '<p>No videos available for this class yet.</p>';
            }
            return;
        }
        
        if (noVideos) noVideos.style.display = 'none';
        if (videosContainer) {
            videosContainer.style.display = 'grid';
            videosContainer.innerHTML = this.videos.map((video, index) => `
                <div class="video-card" data-video-index="${index}" data-video-id="${video._id || video.id}">
                    <div class="video-thumbnail" style="background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);">
                        <span class="play-icon">▶</span>
                    </div>
                    <div class="video-info">
                        <h4>${this.escapeHtml(video.videoDetails?.title || video.title || 'Untitled')}</h4>
                        <p>${this.escapeHtml(video.videoDetails?.description || video.description || 'No description')}</p>
                        <div class="video-meta">
                            <span>⏱️ ${video.videoDetails?.duration || 'Unknown'}</span>
                        </div>
                    </div>
                </div>
            `).join('');

            // Add click event to video cards
            videosContainer.querySelectorAll('.video-card').forEach(card => {
                card.addEventListener('click', () => {
                    const videoIndex = parseInt(card.dataset.videoIndex);
                    this.playVideo(videoIndex);
                });
            });
        }
    }

    // NEW: Render Cloudinary recordings in the recordings tab
    renderRecordings() {
        const recordingsContainer = document.getElementById('recordingsContainer');
        const noRecordings = document.getElementById('noRecordings');

        if (!this.recordings || this.recordings.length === 0) {
            if (recordingsContainer) recordingsContainer.style.display = 'none';
            if (noRecordings) {
                noRecordings.style.display = 'block';
                noRecordings.innerHTML = '<p>No past livestream recordings available for this class yet.</p>';
            }
            return;
        }
        
        if (noRecordings) noRecordings.style.display = 'none';
        if (recordingsContainer) {
            recordingsContainer.style.display = 'grid';
            recordingsContainer.innerHTML = this.recordings.map((recording, index) => {
                // Get the video URL (support multiple formats)
                console.log(recording)
               // In class.js, look for this line in renderRecordings():
                const videoUrl = recording.hlsUrl || recording.cloudinaryUrl || recording.url || 
                 (recording.muxPlaybackId ? `https://stream.mux.com/${recording.muxPlaybackId}.m3u8` : null);
                const thumbnailUrl = recording.thumbnailUrl || '';
                const title = recording.classTitle || recording.name || recording.filename || `Recording ${index + 1}`;
                const description = recording.classDescription || recording.description || 'Past livestream recording';
                const date = recording.uploadDate || recording.createdAt;
                const duration = recording.duration || 'Unknown';
                
                return `
                    <div class="recording-card" data-recording-index="${index}" data-recording-url="${videoUrl}">
                        <div class="video-thumbnail" style="background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%); position: relative;">
                            <span class="play-icon">▶</span>
                            ${thumbnailUrl ? `<img src="${thumbnailUrl}" style="width: 100%; height: 100%; object-fit: cover; position: absolute; top: 0; left: 0; opacity: 0.3;">` : ''}
                        </div>
                        <div class="video-info">
                            <h4>📹 ${this.escapeHtml(title)}</h4>
                            <p>${this.escapeHtml(description)}</p>
                            <div class="video-meta">
                                <span>⏱️ ${duration}</span>
                                ${date ? `<span>📅 ${new Date(date).toLocaleDateString()}</span>` : ''}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            // Add click event to recording cards
            recordingsContainer.querySelectorAll('.recording-card').forEach(card => {
                card.addEventListener('click', () => {
                    const recordingUrl = card.dataset.recordingUrl;
                    if (recordingUrl) {
                        this.playRecording(recordingUrl, card);
                    } else {
                        alert('Video URL not available');
                    }
                });
            });
        }
    }

    // NEW: Play recording in modal
    playRecording(videoUrl, cardElement) {
        const title = cardElement.querySelector('h4')?.textContent || 'Recording';
        const description = cardElement.querySelector('p')?.textContent || '';

        const modal = document.getElementById('videoModal');
        const videoPlayer = document.getElementById('videoPlayer');
        const videoTitle = document.getElementById('videoTitle');
        const videoDescription = document.getElementById('videoDescription');
        
        // Clear previous source
        videoPlayer.innerHTML = '';
        
        // Create source element based on URL type
        const source = document.createElement('source');
        source.src = videoUrl;
        
        if (videoUrl.includes('.m3u8') || videoUrl.includes('m3u8')) {
            source.type = 'application/x-mpegURL';
            // For HLS, we need to use hls.js
            if (typeof Hls !== 'undefined') {
                const hls = new Hls();
                hls.loadSource(videoUrl);
                hls.attachMedia(videoPlayer);
            }
        } else if (videoUrl.includes('.mp4')) {
            source.type = 'video/mp4';
            videoPlayer.appendChild(source);
        } else {
            source.type = 'video/mp4';
            videoPlayer.appendChild(source);
        }
        
        videoPlayer.load();
        videoTitle.textContent = title;
        videoDescription.textContent = description;

        modal.style.display = 'flex';
        
        // Close modal function
        const closeModal = () => {
            modal.style.display = 'none';
            videoPlayer.pause();
            videoPlayer.currentTime = 0;
            if (this.progressInterval) clearInterval(this.progressInterval);
        };

        const closeBtn = document.querySelector('.close-modal');
        if (closeBtn) closeBtn.onclick = closeModal;
        
        modal.onclick = (e) => {
            if (e.target === modal) closeModal();
        };

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.style.display === 'flex') {
                closeModal();
            }
        });
    }

    playVideo(videoIndex) {
        const video = this.videos[videoIndex];
        if (!video) return;

        const modal = document.getElementById('videoModal');
        const videoPlayer = document.getElementById('videoPlayer');
        const videoTitle = document.getElementById('videoTitle');
        const videoDescription = document.getElementById('videoDescription');
        
        const videoUrl = video.url || video.videoUrl;
        if (!videoUrl) {
            alert('Video URL not available');
            return;
        }
        
        videoPlayer.src = videoUrl;
        videoTitle.textContent = video.videoDetails?.title || video.title || 'Video';
        videoDescription.textContent = video.videoDetails?.description || video.description || '';

        modal.style.display = 'flex';
        
        // Resume progress
        this.restoreProgress(videoPlayer, videoIndex);
        
        // Track progress
        this.trackProgress(videoPlayer, videoIndex);

        // Close modal function
        const closeModal = () => {
            modal.style.display = 'none';
            videoPlayer.pause();
            videoPlayer.currentTime = 0;
            clearInterval(this.progressInterval);
        };

        const closeBtn = document.querySelector('.close-modal');
        if (closeBtn) closeBtn.onclick = closeModal;
        
        modal.onclick = (e) => {
            if (e.target === modal) closeModal();
        };

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.style.display === 'flex') {
                closeModal();
            }
        });
    }

    trackProgress(videoPlayer, videoIndex) {
        clearInterval(this.progressInterval);
        
        this.progressInterval = setInterval(() => {
            if (!videoPlayer.paused && !videoPlayer.ended && videoPlayer.currentTime) {
                // Save to localStorage
                localStorage.setItem(`video_progress_${this.classId}_${videoIndex}`, videoPlayer.currentTime.toString());
                
                // Save to backend if enrolled
                if (this.userId && this.isEnrolled) {
                    const progressPercent = Math.floor((videoPlayer.currentTime / videoPlayer.duration) * 100);
                    if (progressPercent > 0) {
                        fetch('https://fissk-backend.onrender.com/register/progress/update', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                progress: progressPercent,
                                userId: this.userId,
                                classId: this.classId
                            })
                        }).catch(() => {});
                    }
                }
            }
        }, 10000);
    }

    restoreProgress(videoPlayer, videoIndex) {
        const saved = localStorage.getItem(`video_progress_${this.classId}_${videoIndex}`);
        if (saved) {
            const progress = parseFloat(saved);
            if (progress > 0 && progress < videoPlayer.duration) {
                videoPlayer.currentTime = progress;
            }
        }
    }

    async handleEnrollment() {
        if (this.isEnrolled) {
            alert('You are already enrolled in this class!');
            return;
        }

        if (!this.user || !this.user.email) {
            alert('Please login to enroll in this class');
            window.location.href = 'index.html';
            return;
        }

        const enrollBtn = document.getElementById('enrollBtn');
        if (enrollBtn) {
            enrollBtn.disabled = true;
            enrollBtn.textContent = 'Processing...';
        }

        try {
            const response = await fetch('https://fissk-backend.onrender.com/register/join-class', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ classId: this.classId, email: this.user.email })
            });

            if (response.ok) {
                this.isEnrolled = true;
                this.renderClassData();
                alert('Successfully enrolled in the class!');
                location.reload();
            } else {
                const error = await response.json();
                throw new Error(error.message || 'Enrollment failed');
            }
        } catch (error) {
            console.error('Error enrolling in class:', error);
            alert(error.message || 'Failed to enroll in class. Please try again.');
            if (enrollBtn) {
                enrollBtn.disabled = false;
                enrollBtn.textContent = 'Enroll Now';
            }
        }
    }

    showError(message) {
        const container = document.querySelector('.class-container') || document.querySelector('.container');
        if (container) {
            container.innerHTML = `
                <div class="error-message" style="text-align: center; padding: 50px;">
                    <p style="color: #e74c3c; font-size: 18px;">⚠️ ${message}</p>
                    <div style="margin-top: 20px;">
                        <button class="btn btn-primary" onclick="location.reload()">Retry</button>
                        <a href="classes.html" class="btn btn-outline">Back to Classes</a>
                    </div>
                </div>
            `;
        }
    }

    escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/[&<>]/g, function(s) {
            return ({'&': '&amp;', '<': '&lt;', '>': '&gt;'})[s];
        });
    }
}
// ===== INITIALIZE AND EXPOSE GLOBALLY =====
let classManagerInstance = null;

// Function to initialize the class manager
function initClassManager() {
    if (!classManagerInstance) {
        classManagerInstance = new ClassManager();
        // Expose globally so onclick handlers can access it
        window.classManager = classManagerInstance;
        console.log('✅ ClassManager initialized and exposed globally');
    }
    return classManagerInstance;
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initClassManager();
});

// Also handle the case where DOM is already loaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initClassManager();
}

// ===== USER DROPDOWN AND NAVIGATION =====
const userData = localStorage.getItem('user');
if (userData) {
    const loginBtn = document.getElementById('login-btn');
    const signupBtn = document.getElementById('signup-btn');
    if (loginBtn) loginBtn.style.display = 'none';
    if (signupBtn) signupBtn.style.display = 'none';
} else {
    const dashboardBtn = document.getElementById('dashboard-btn');
    if (dashboardBtn) dashboardBtn.style.display = 'none';
}

// ===== MOBILE NAVIGATION =====
const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');

if (hamburger) {
    hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('active');
        navMenu.classList.toggle('active');
        
        if (navMenu.classList.contains('active')) {
            navMenu.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        } else {
            navMenu.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    });
}

document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        navMenu.classList.remove('active');
        navMenu.style.display = 'none';
        document.body.style.overflow = 'auto';
    });
});

// ===== MAKE showToast GLOBAL =====
// Ensure showToast is available globally for onclick handlers
if (typeof showToast === 'undefined') {
    window.showToast = function(msg, isError = false) {
        const toast = document.createElement('div');
        toast.textContent = msg;
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: ${isError ? '#e74c3c' : '#27ae60'};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            animation: slideIn 0.3s ease;
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    };
}

// Add slideIn animation if not already defined
if (!document.getElementById('toastStyles')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'toastStyles';
    styleSheet.textContent = `
        @keyframes slideIn {
            from {
                opacity: 0;
                transform: translateX(100px);
            }
            to {
                opacity: 1;
                transform: translateX(0);
            }
        }
    `;
    document.head.appendChild(styleSheet);
}

console.log('✅ Class Manager initialized. window.classManager available:', !!window.classManager);