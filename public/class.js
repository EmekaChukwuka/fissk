// Individual Class Page Functionality - With Payment Integration
class ClassManager {
    constructor() {
        this.classId = this.getClassIdFromURL();
        this.classData = null;
        this.user = JSON.parse(localStorage.getItem('user'));
        this.userId = this.user ? this.user.id : null;
        this.currentVideoIndex = null;
        this.progressInterval = null;
        this.videos = [];
        this.recordings = [];
        this.isEnrolled = false;
        this.isLoading = true;
        this.hlsInstance = null;
        this.enrollmentPaymentStatus = 'free';
        this.hasPaidAccess = false;
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
        
        this.showLoadingState();
        
        try {
            // Load class data first
            await this.loadClassData();
            
            // Then load everything else
            await Promise.all([
                this.checkEnrollment(),
                this.loadClassVideos(),
                this.loadClassRecordings(),
                this.checkPaymentStatus()
            ]);
            
            this.renderClassData();
            this.renderVideos();
            this.renderClassReviews();
            this.renderRecordings();
            this.renderPriceAndPayment();
            this.setupEventListeners();
        } catch (error) {
            console.error('Initialization error:', error);
            // Error is already shown in loadClassData
        } finally {
            this.isLoading = false;
            this.hideLoadingState();
        }
    }

    showLoadingState() {
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

    hideLoadingState() {}

    async loadClassData() {
        try {
            console.log('Loading class data for ID:', this.classId);
            
            const response = await fetch(`https://fissk-backend.onrender.com/register/class/${this.classId}`);
            
            console.log('Class data response status:', response.status);
            
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('Class not found. Please check the URL or go back to classes.');
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('Class data received:', data);
            
            // Handle different response formats
            if (data.classA && data.classA.length > 0) {
                this.classData = data.classA[0];
            } else if (data.class && data.class._id) {
                this.classData = data.class;
            } else if (data._id) {
                this.classData = data;
            } else if (Array.isArray(data) && data.length > 0) {
                this.classData = data[0];
            } else {
                throw new Error('Class data not found in response');
            }
            
            console.log('Class data loaded:', this.classData.title);
            return this.classData;
            
        } catch (error) {
            console.error('Error loading class data:', error);
            
            // Show error in the UI
            const classNameEl = document.getElementById('className');
            if (classNameEl) {
                classNameEl.innerHTML = '⚠️ Class not found';
            }
            
            const container = document.querySelector('.class-container') || document.querySelector('.container');
            if (container) {
                container.innerHTML = `
                    <div class="error-message" style="text-align: center; padding: 50px;">
                        <p style="color: #e74c3c; font-size: 18px;">⚠️ ${error.message}</p>
                        <div style="margin-top: 20px;">
                            <button class="btn btn-primary" onclick="location.reload()">Retry</button>
                            <a href="classes.html" class="btn btn-outline">Back to Classes</a>
                        </div>
                    </div>
                `;
            }
            
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
            const userId = this.userId || '';
            const response = await fetch(`https://fissk-backend.onrender.com/api/by-class/${this.classId}?userId=${userId}`);
            
            if (!response.ok) {
                throw new Error('Failed to load videos');
            }
            
            const data = await response.json();
            console.log('Videos response:', data);
            
            if (data.success && data.videos) {
                this.videos = data.videos;
                this.hasPaidAccess = data.hasAccess || false;
                this.enrollmentPaymentStatus = data.accessType || 'none';
            } else if (Array.isArray(data)) {
                this.videos = data;
            } else {
                this.videos = [];
            }
            
            console.log('Videos loaded:', this.videos.length);
            
            if (this.userId && this.isEnrolled) {
                await this.loadUserProgress();
            }
            
            await this.loadUpcomingSessions();
            
        } catch (error) {
            console.error('Error loading class videos:', error);
            this.videos = [];
        }
    }

    async loadClassRecordings() {
        try {
            console.log('Loading recordings for class:', this.classId);
            const userId = this.userId || '';
            const response = await fetch(`https://fissk-backend.onrender.com/api/by-class/${this.classId}?userId=${userId}`);
            
            if (!response.ok) {
                throw new Error('Failed to load recordings');
            }
            
            const data = await response.json();
            console.log('Recordings response:', data);
            
            let allVideos = [];
            if (data.success && data.videos) {
                allVideos = data.videos;
            } else if (Array.isArray(data)) {
                allVideos = data;
            }
            
            this.recordings = allVideos.filter(video => 
                video.cloudinaryUrl || video.hlsUrl || video.url || video.muxPlaybackId
            );
            
            console.log('Recordings loaded:', this.recordings.length);
        } catch (error) {
            console.error('Error loading class recordings:', error);
            this.recordings = [];
        }
    }

    async checkPaymentStatus() {
        if (!this.user || !this.user.id) return;
        
        try {
            if (this.classData && (this.classData.isFree || this.classData.price === 0)) {
                this.enrollmentPaymentStatus = 'free';
                this.hasPaidAccess = true;
                return;
            }
            
            if (this.isEnrolled) {
                const response = await fetch('https://fissk-backend.onrender.com/register/get-user-classes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: this.user.email })
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.classes && data.classes.length) {
                        const classEnrollment = data.classes.find(c => 
                            (c.class_id?.toString() === this.classId) || (c._id?.toString() === this.classId)
                        );
                        if (classEnrollment) {
                            this.enrollmentPaymentStatus = classEnrollment.paymentStatus || 'free';
                            this.hasPaidAccess = classEnrollment.paymentStatus === 'paid' || classEnrollment.accessType === 'paid';
                        }
                    }
                }
            }
            
            console.log('Payment status:', this.enrollmentPaymentStatus, 'Paid:', this.hasPaidAccess);
        } catch (error) {
            console.error('Check payment status error:', error);
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
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        const backBtn = document.getElementById('backToClasses');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                window.location.href = 'classes.html';
            });
        }

        const enrollBtn = document.getElementById('enrollBtn');
        if (enrollBtn) {
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
        
        if (tabName === 'forum') {
            this.renderClassForum();
        }
        
        if (tabName === 'reviews') {
            this.renderClassReviews(); 
        }
    }

    async renderClassData() {
        if (!this.classData) {
            this.showError('Class data not available');
            return;
        }
        
        try {
            document.title = `${this.classData.title} - FISSK Online Academy`;

            const classNameEl = document.getElementById('className');
            const classDescEl = document.getElementById('classDescription');
            
            if (classNameEl) classNameEl.textContent = this.classData.title;
            if (classDescEl) classDescEl.textContent = this.classData.description;
            
            const levelEl = document.getElementById('classLevel');
            const durationEl = document.getElementById('classDuration');
            const studentsEl = document.getElementById('classStudents');
            
            if (levelEl) levelEl.textContent = `🟢 ${this.classData.level || 'Beginner'}`;
            if (durationEl) durationEl.textContent = `🕒 ${this.classData.duration || 'Self-paced'}`;
            if (studentsEl) studentsEl.textContent = `👥 ${this.classData.maxStudents || 0} Students`;

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

    renderPriceAndPayment() {
        const price = this.classData?.price || 0;
        const isFree = this.classData?.isFree !== undefined ? this.classData.isFree : true;
        const currency = this.classData?.currency || 'NGN';
        
        const hasPaid = this.isEnrolled && this.enrollmentPaymentStatus === 'paid';
        
        let paymentSection = document.getElementById('paymentSection');
        if (!paymentSection) {
            paymentSection = document.createElement('div');
            paymentSection.id = 'paymentSection';
            paymentSection.className = 'payment-section';
            const actionsContainer = document.querySelector('.class-actions');
            if (actionsContainer) {
                actionsContainer.parentNode.insertBefore(paymentSection, actionsContainer.nextSibling);
            }
        }
        
        if (isFree || price === 0) {
            paymentSection.innerHTML = `
                <div class="payment-info free-badge">
                    <span class="badge free">🎓 FREE CLASS</span>
                    <p>All content is available for free. No payment required.</p>
                </div>
            `;
            return;
        }
        
        if (hasPaid) {
            paymentSection.innerHTML = `
                <div class="payment-info paid-badge">
                    <span class="badge paid">✅ ACCESS GRANTED</span>
                    <p>You have full access to all recordings and materials.</p>
                </div>
            `;
            return;
        }
        
        paymentSection.innerHTML = `
            <div class="payment-info">
                <div class="price-display">
                    <span class="price">${currency} ${price.toLocaleString()}</span>
                    <span class="label">One-time payment • Lifetime access</span>
                </div>
                <div class="payment-benefits">
                    <ul>
                        <li>✅ Full access to all recorded sessions</li>
                        <li>✅ Downloadable course materials</li>
                        <li>✅ Lifetime access</li>
                        <li>✅ Certificate of completion</li>
                    </ul>
                </div>
                <button class="btn btn-primary buy-course-btn" id="buyCourseBtn">
                    💳 Buy Course - ${currency} ${price.toLocaleString()}
                </button>
                <p class="secure-note">🔒 Secure payment via Paystack</p>
            </div>
        `;
        
        const buyBtn = document.getElementById('buyCourseBtn');
        if (buyBtn) {
            buyBtn.addEventListener('click', () => {
                this.initiatePayment();
            });
        }
    }

    async initiatePayment() {
        if (!this.user) {
            window.showToast('Please login to purchase this course', 'error');
            window.location.href = 'login.html';
            return;
        }
        
        const price = this.classData?.price || 0;
        if (price <= 0) {
            window.showToast('This course is free', 'info');
            return;
        }
        
        const buyBtn = document.getElementById('buyCourseBtn');
        if (buyBtn) {
            buyBtn.disabled = true;
            buyBtn.textContent = '⏳ Processing...';
        }
        
        try {
            const response = await fetch('/api/payment/initialize', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    classId: this.classId,
                    userId: this.user.id
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                window.location.href = data.data.authorizationUrl;
            } else {
                window.showToast(data.message || 'Payment initialization failed', 'error');
            }
        } catch (error) {
            console.error('Payment error:', error);
            window.showToast('Failed to initialize payment. Please try again.', 'error');
        } finally {
            if (buyBtn) {
                buyBtn.disabled = false;
                buyBtn.textContent = `💳 Buy Course - ₦${price.toLocaleString()}`;
            }
        }
    }

    async renderClassForum() {
        const container = document.getElementById('classForumContainer');
        if (!container) {
            console.error('Forum container not found!');
            return;
        }
        
        if (!this.isEnrolled) {
            container.innerHTML = `
                <div class="forum-locked">
                    <p>🔒 Enroll in this class to participate in discussions</p>
                    <button class="btn btn-primary" id="enrollFromForumBtn">Enroll Now</button>
                </div>
            `;
            const enrollBtn = container.querySelector('#enrollFromForumBtn');
            if (enrollBtn) {
                enrollBtn.addEventListener('click', () => {
                    this.handleEnrollment();
                });
            }
            return;
        }
        
        container.innerHTML = '<div class="forum-loading">Loading discussions...</div>';
        
        try {
            const url = `https://fissk-backend.onrender.com/forum-api/class/${this.classId}/topics`;
            console.log('Fetching forum topics from:', url);
            
            const response = await fetch(url);
            
            console.log('Response status:', response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Error response:', errorText);
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const topics = await response.json();
            console.log('Forum topics received:', topics);
            console.log('Number of topics:', topics ? topics.length : 0);
            
            if (!topics || topics.length === 0) {
                container.innerHTML = `
                    <div class="forum-empty">
                        <p>💬 No discussions yet</p>
                        <p class="forum-empty-sub">Be the first to start a discussion about this class!</p>
                        <button class="btn btn-primary" id="startDiscussionBtn">Start Discussion</button>
                    </div>
                `;
                const startBtn = container.querySelector('#startDiscussionBtn');
                if (startBtn) {
                    startBtn.addEventListener('click', () => {
                        this.openNewClassTopic();
                    });
                }
                return;
            }
            
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
                    ${topics.map(topic => {
                        const authorName = topic.author_name || 'Anonymous';
                        const replyCount = topic.replyCount || 0;
                        const views = topic.views || 0;
                        const isPinned = topic.isPinned || false;
                        const isSolved = topic.solved || false;
                        const createdAt = topic.createdAt ? new Date(topic.createdAt).toLocaleDateString() : 'Unknown';
                        
                        return `
                            <div class="forum-topic-item ${isPinned ? 'pinned' : ''} ${isSolved ? 'solved' : ''}">
                                <div class="forum-topic-left">
                                    ${isPinned ? '<span class="pin-badge">📌</span>' : ''}
                                    ${isSolved ? '<span class="solved-badge">✅ Solved</span>' : ''}
                                    <a href="#" data-topic-id="${topic._id}" class="forum-topic-title">
                                        ${this.escapeHtml(topic.title)}
                                    </a>
                                    <div class="forum-topic-meta">
                                        <span>👤 ${this.escapeHtml(authorName)}</span>
                                        <span>💬 ${replyCount}</span>
                                        <span>👀 ${views}</span>
                                        <span>📅 ${createdAt}</span>
                                    </div>
                                </div>
                                ${topic.category_name ? `<span class="topic-category">${topic.category_icon || '📌'} ${this.escapeHtml(topic.category_name)}</span>` : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
            
            const startBtn = container.querySelector('#startDiscussionBtn');
            if (startBtn) {
                startBtn.addEventListener('click', () => {
                    this.openNewClassTopic();
                });
            }
            
            const sortSelect = container.querySelector('#forumSort');
            if (sortSelect) {
                sortSelect.addEventListener('change', () => {
                    this.filterForumTopics();
                });
            }
            
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

    openNewClassTopic() {
        const modal = document.getElementById('newClassTopicModal');
        if (!modal) {
            this.createNewTopicModal();
            return;
        }
        
        this.loadClassForumCategories();
        modal.style.display = 'flex';
    }

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

    async submitClassTopic() {
        const title = document.getElementById('classTopicTitle').value.trim();
        const content = document.getElementById('classTopicContent').value.trim();
        const categoryId = document.getElementById('classTopicCategory').value;
        
        if (!title || !content) {
            alert('Please fill in all required fields');
            return;
        }
        
        const submitBtn = document.querySelector('#newClassTopicForm button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Posting...';
        }
        
        try {
            console.log('Submitting topic:', { title, content, categoryId, userId: this.userId, classId: this.classId });
            
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
            
            const data = await response.json();
            console.log('Submit response:', data);
            
            if (response.ok) {
                document.getElementById('newClassTopicModal').style.display = 'none';
                window.showToast('Discussion posted successfully!', false);
                await this.renderClassForum();
            } else {
                window.showToast(data.message || 'Failed to post discussion', true);
            }
        } catch (error) {
            console.error('Submit topic error:', error);
            window.showToast('Failed to post discussion: ' + error.message, true);
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Post Discussion';
            }
        }
    }

    viewForumTopic(topicId) {
        window.location.href = `forum-post.html?classId=${this.classId}&topicId=${topicId}`;
    }

    async filterForumTopics() {
        await this.renderClassForum();
    }

    async renderClassReviews() {
        const container = document.getElementById('classReviewsContainer');
        if (!container) return;
        
        container.innerHTML = '<div class="reviews-loading">Loading reviews...</div>';
        
        try {
            let userReview = null;
            if (this.userId) {
                const userReviewRes = await fetch(
                    `https://fissk-backend.onrender.com/api/reviews/user/${this.userId}/class/${this.classId}`
                );
                if (userReviewRes.ok) {
                    const userReviewData = await userReviewRes.json();
                    userReview = userReviewData.review;
                }
            }
            
            const response = await fetch(
                `https://fissk-backend.onrender.com/api/reviews/class/${this.classId}`
            );
            
            if (!response.ok) {
                throw new Error('Failed to load reviews');
            }
            
            const data = await response.json();
            const { reviews, stats } = data;
            
            let html = `
                <div class="reviews-header">
                    <div class="reviews-stats">
                        <div class="average-rating">
                            <span class="rating-number">${stats.average || 0}</span>
                            <span class="rating-stars">${this.renderStars(stats.average || 0)}</span>
                            <span class="rating-count">${stats.total} reviews</span>
                        </div>
                        <div class="rating-distribution">
                            ${this.renderRatingDistribution(stats.distribution, stats.total)}
                        </div>
                    </div>
                    <div class="reviews-actions">
                        ${this.userId ? `
                            ${userReview ? `
                                <button class="btn btn-outline edit-review-btn">✏️ Edit Your Review</button>
                                <button class="btn btn-danger delete-review-btn">🗑️ Delete</button>
                            ` : `
                                ${this.isEnrolled ? `
                                    <button class="btn btn-primary write-review-btn">✍️ Write a Review</button>
                                ` : `
                                    <span class="review-locked">🔒 Enroll to leave a review</span>
                                `}
                            `}
                        ` : `
                            <a href="login.html" class="btn btn-outline">Login to Review</a>
                        `}
                    </div>
                </div>
                <div class="reviews-list">
                    ${reviews.length === 0 ? `
                        <div class="no-reviews">
                            <p>No reviews yet. Be the first to review this class!</p>
                        </div>
                    ` : `
                        ${reviews.map(review => this.renderReviewCard(review, userReview?._id === review._id)).join('')}
                    `}
                </div>
            `;
            
            container.innerHTML = html;
            this.attachReviewEventListeners(userReview);
            
        } catch (error) {
            console.error('Render reviews error:', error);
            container.innerHTML = `
                <div class="reviews-error">
                    <p>⚠️ Failed to load reviews: ${error.message}</p>
                    <button class="btn btn-outline retry-reviews-btn">Retry</button>
                </div>
            `;
            const retryBtn = container.querySelector('.retry-reviews-btn');
            if (retryBtn) {
                retryBtn.addEventListener('click', () => this.renderClassReviews());
            }
        }
    }

    renderStars(rating) {
        const fullStars = Math.floor(rating);
        const halfStar = rating % 1 >= 0.5 ? 1 : 0;
        const emptyStars = 5 - fullStars - halfStar;
        
        let stars = '';
        for (let i = 0; i < fullStars; i++) stars += '⭐';
        if (halfStar) stars += '✨';
        for (let i = 0; i < emptyStars; i++) stars += '☆';
        
        return stars;
    }

    renderRatingDistribution(distribution, total) {
        if (total === 0) {
            return '<div class="distribution-empty">No ratings yet</div>';
        }
        
        const percentages = {};
        for (let i = 5; i >= 1; i--) {
            percentages[i] = total > 0 ? Math.round((distribution[i] / total) * 100) : 0;
        }
        
        return `
            ${[5, 4, 3, 2, 1].map(star => `
                <div class="distribution-row">
                    <span class="star-label">${star}⭐</span>
                    <div class="distribution-bar">
                        <div class="distribution-fill" style="width: ${percentages[star]}%"></div>
                    </div>
                    <span class="distribution-count">${distribution[star]}</span>
                </div>
            `).join('')}
        `;
    }

    renderReviewCard(review, isUserReview = false) {
        const userName = review.userId?.firstName 
            ? `${review.userId.firstName} ${review.userId.lastName || ''}`.trim()
            : 'Anonymous';
        
        const userInitial = userName.charAt(0) || '?';
        const avatar = review.userId?.profilePicture || '';
        const date = new Date(review.createdAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
        
        return `
            <div class="review-card ${isUserReview ? 'user-review' : ''}">
                <div class="review-header">
                    <div class="reviewer-info">
                        ${avatar ? `
                            <img src="${avatar}" alt="${userName}" class="reviewer-avatar">
                        ` : `
                            <div class="reviewer-avatar initials">${userInitial}</div>
                        `}
                        <div>
                            <span class="reviewer-name">${this.escapeHtml(userName)}</span>
                            ${isUserReview ? '<span class="your-review-badge">Your Review</span>' : ''}
                            ${review.isVerifiedPurchase ? '<span class="verified-badge">✓ Verified</span>' : ''}
                        </div>
                    </div>
                    <div class="review-meta">
                        <span class="review-rating">${this.renderStars(review.rating)}</span>
                        <span class="review-date">${date}</span>
                    </div>
                </div>
                ${review.comment ? `
                    <div class="review-body">
                        <p>${this.escapeHtml(review.comment)}</p>
                    </div>
                ` : ''}
                <div class="review-footer">
                    <button class="review-helpful-btn" data-review-id="${review._id}">
                        👍 Helpful (<span class="helpful-count">0</span>)
                    </button>
                    ${!isUserReview ? `
                        <button class="review-report-btn" data-review-id="${review._id}">
                            🚩 Report
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    attachReviewEventListeners(userReview) {
        const container = document.getElementById('classReviewsContainer');
        if (!container) return;
        
        const writeBtn = container.querySelector('.write-review-btn');
        if (writeBtn) {
            writeBtn.addEventListener('click', () => this.openReviewModal());
        }
        
        const editBtn = container.querySelector('.edit-review-btn');
        if (editBtn) {
            editBtn.addEventListener('click', () => this.openReviewModal(userReview));
        }
        
        const deleteBtn = container.querySelector('.delete-review-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => this.deleteReview());
        }
        
        container.querySelectorAll('.review-helpful-btn').forEach(btn => {
            btn.addEventListener('click', () => this.markReviewHelpful(btn.dataset.reviewId));
        });
        
        container.querySelectorAll('.review-report-btn').forEach(btn => {
            btn.addEventListener('click', () => this.reportReview(btn.dataset.reviewId));
        });
    }

    openReviewModal(existingReview = null) {
        const modal = document.getElementById('reviewModal');
        if (!modal) {
            this.createReviewModal();
            setTimeout(() => this.openReviewModal(existingReview), 100);
            return;
        }
        
        const ratingInputs = modal.querySelectorAll('.star-rating-input');
        const commentInput = document.getElementById('reviewComment');
        const submitBtn = document.getElementById('submitReviewBtn');
        const modalTitle = modal.querySelector('.modal-title');
        
        if (existingReview) {
            modalTitle.textContent = 'Edit Your Review';
            submitBtn.textContent = 'Update Review';
            ratingInputs.forEach(input => {
                if (parseInt(input.value) === existingReview.rating) {
                    input.checked = true;
                    this.highlightStars(input.value);
                }
            });
            if (commentInput) commentInput.value = existingReview.comment || '';
            submitBtn.dataset.reviewId = existingReview._id;
        } else {
            modalTitle.textContent = 'Write a Review';
            submitBtn.textContent = 'Submit Review';
            ratingInputs.forEach(input => input.checked = false);
            if (commentInput) commentInput.value = '';
            delete submitBtn.dataset.reviewId;
            this.resetStarHighlight();
        }
        
        modal.style.display = 'flex';
    }

    createReviewModal() {
        const modalHTML = `
            <div id="reviewModal" class="modal">
                <div class="modal-content review-modal-content">
                    <span class="close-modal" onclick="document.getElementById('reviewModal').style.display='none'">&times;</span>
                    <h2 class="modal-title">Write a Review</h2>
                    <form id="reviewForm">
                        <div class="form-group">
                            <label>Rating *</label>
                            <div class="star-rating">
                                ${[5, 4, 3, 2, 1].map(num => `
                                    <input type="radio" name="rating" value="${num}" id="star${num}" class="star-rating-input">
                                    <label for="star${num}" class="star-label" data-value="${num}">⭐</label>
                                `).join('')}
                            </div>
                            <span id="ratingDisplay" class="rating-display">Select a rating</span>
                        </div>
                        <div class="form-group">
                            <label>Comment (optional)</label>
                            <textarea id="reviewComment" rows="4" placeholder="Share your experience with this class..."></textarea>
                        </div>
                        <div class="form-actions">
                            <button type="button" class="btn btn-outline" onclick="document.getElementById('reviewModal').style.display='none'">Cancel</button>
                            <button type="submit" class="btn btn-primary" id="submitReviewBtn">Submit Review</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        const stars = document.querySelectorAll('.star-label');
        const ratingDisplay = document.getElementById('ratingDisplay');
        
        stars.forEach(star => {
            star.addEventListener('mouseenter', function() {
                const value = parseInt(this.dataset.value);
                window.highlightStars(value);
                ratingDisplay.textContent = `${value} star${value > 1 ? 's' : ''}`;
            });
            
            star.addEventListener('mouseleave', function() {
                const checked = document.querySelector('.star-rating-input:checked');
                if (checked) {
                    window.highlightStars(parseInt(checked.value));
                    ratingDisplay.textContent = `${checked.value} star${checked.value > 1 ? 's' : ''}`;
                } else {
                    window.resetStarHighlight();
                    ratingDisplay.textContent = 'Select a rating';
                }
            });
        });
        
        window.highlightStars = (value) => {
            document.querySelectorAll('.star-label').forEach(s => {
                const starValue = parseInt(s.dataset.value);
                s.style.opacity = starValue <= value ? '1' : '0.3';
                s.style.transform = starValue <= value ? 'scale(1.2)' : 'scale(1)';
            });
        };
        
        window.resetStarHighlight = () => {
            document.querySelectorAll('.star-label').forEach(s => {
                s.style.opacity = '0.5';
                s.style.transform = 'scale(1)';
            });
        };
        
        document.getElementById('reviewForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitReview();
        });
    }

    highlightStars(value) {
        document.querySelectorAll('.star-label').forEach(s => {
            const starValue = parseInt(s.dataset.value);
            s.style.opacity = starValue <= value ? '1' : '0.3';
            s.style.transform = starValue <= value ? 'scale(1.2)' : 'scale(1)';
        });
    }

    resetStarHighlight() {
        document.querySelectorAll('.star-label').forEach(s => {
            s.style.opacity = '0.5';
            s.style.transform = 'scale(1)';
        });
    }

    async submitReview() {
        const ratingInput = document.querySelector('.star-rating-input:checked');
        const comment = document.getElementById('reviewComment').value.trim();
        const submitBtn = document.getElementById('submitReviewBtn');
        const reviewId = submitBtn.dataset.reviewId;
        
        if (!ratingInput) {
            alert('Please select a rating');
            return;
        }
        
        const rating = parseInt(ratingInput.value);
        
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';
        
        try {
            const response = await fetch('https://fissk-backend.onrender.com/api/reviews', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: this.userId,
                    classId: this.classId,
                    rating,
                    comment: comment || ''
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                document.getElementById('reviewModal').style.display = 'none';
                window.showToast('Review saved successfully!', false);
                this.renderClassReviews();
            } else {
                window.showToast(data.message || 'Failed to save review', true);
            }
        } catch (error) {
            console.error('Submit review error:', error);
            window.showToast('Failed to save review. Please try again.', true);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = reviewId ? 'Update Review' : 'Submit Review';
        }
    }

    async deleteReview() {
        if (!confirm('Are you sure you want to delete your review? This cannot be undone.')) {
            return;
        }
        
        try {
            const response = await fetch(
                `https://fissk-backend.onrender.com/api/reviews/${this.userId}/class/${this.classId}`,
                {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: this.userId })
                }
            );
            
            const data = await response.json();
            
            if (data.success) {
                window.showToast('Review deleted successfully', false);
                this.renderClassReviews();
            } else {
                window.showToast(data.message || 'Failed to delete review', true);
            }
        } catch (error) {
            console.error('Delete review error:', error);
            window.showToast('Failed to delete review. Please try again.', true);
        }
    }

    async markReviewHelpful(reviewId) {
        try {
            window.showToast('Thanks for your feedback!', false);
        } catch (error) {
            console.error('Mark helpful error:', error);
        }
    }

    async reportReview(reviewId) {
        const reason = prompt('Please explain why you are reporting this review:');
        if (!reason) return;
        
        try {
            const response = await fetch(`https://fissk-backend.onrender.com/api/reviews/${reviewId}/report`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: this.userId, reason })
            });
            
            const data = await response.json();
            
            if (data.success) {
                window.showToast('Review reported successfully. Our team will review it.', false);
            } else {
                window.showToast(data.message || 'Failed to report review', true);
            }
        } catch (error) {
            console.error('Report review error:', error);
            window.showToast('Failed to report review. Please try again.', true);
        }
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
            videosContainer.innerHTML = this.videos.map((video, index) => {
                const thumbnailUrl = video.thumbnailUrl || 
                    (video.muxPlaybackId ? `https://image.mux.com/${video.muxPlaybackId}/thumbnail.jpg?time=5` : '');
                const isLocked = video.locked === true;
                const title = video.videoDetails?.title || video.title || 'Untitled';
                const description = video.videoDetails?.description || video.description || 'No description';
                const duration = video.videoDetails?.duration || video.duration || 'Unknown';
                const price = video.price || this.classData?.price || 0;
                
                return `
                    <div class="video-card ${isLocked ? 'locked' : ''}" 
                         data-video-index="${index}" 
                         data-video-id="${video._id || video.id}"
                         data-locked="${isLocked}">
                        <div class="video-thumbnail" style="background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%); position: relative;">
                            <span class="play-icon">${isLocked ? '🔒' : '▶'}</span>
                            ${thumbnailUrl ? `<img src="${thumbnailUrl}" style="width: 100%; height: 100%; object-fit: cover; position: absolute; top: 0; left: 0; opacity: 0.5;" onerror="this.style.display='none'">` : ''}
                            ${isLocked ? '<div class="lock-overlay">🔒</div>' : ''}
                            ${isLocked && price > 0 ? '<span class="price-badge">💰 ₦' + price.toLocaleString() + '</span>' : ''}
                        </div>
                        <div class="video-info">
                            <h4>${isLocked ? '🔒 ' : ''}${this.escapeHtml(title)}</h4>
                            <p>${this.escapeHtml(description)}</p>
                            <div class="video-meta">
                                <span>⏱️ ${duration}</span>
                                ${isLocked ? '<span class="locked-badge">🔒 Purchase Required</span>' : ''}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            videosContainer.querySelectorAll('.video-card').forEach((card) => {
                card.addEventListener('click', () => {
                    const videoIndex = parseInt(card.dataset.videoIndex);
                    const isLocked = card.dataset.locked === 'true';
                    
                    if (isLocked) {
                        const price = this.videos[videoIndex]?.price || this.classData?.price || 0;
                        if (price > 0) {
                            window.showToast(`💳 This video requires payment. Price: ₦${price.toLocaleString()}`, true);
                            const paymentSection = document.getElementById('paymentSection');
                            if (paymentSection) {
                                paymentSection.scrollIntoView({ behavior: 'smooth' });
                            }
                        } else {
                            window.showToast('🔒 Please enroll in this class to access this video', true);
                        }
                        return;
                    }
                    
                    console.log('Video card clicked, index:', videoIndex);
                    this.playVideo(videoIndex);
                });
            });
        }
    }

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
                const isLocked = recording.locked === true;
                const videoUrl = recording.hlsUrl || recording.cloudinaryUrl || recording.url || 
                    (recording.muxPlaybackId ? `https://stream.mux.com/${recording.muxPlaybackId}.m3u8` : null);
                const thumbnailUrl = recording.thumbnailUrl || 
                    (recording.muxPlaybackId ? `https://image.mux.com/${recording.muxPlaybackId}/thumbnail.jpg?time=5` : '');
                const title = recording.classTitle || recording.name || recording.filename || `Recording ${index + 1}`;
                const description = recording.classDescription || recording.description || 'Past livestream recording';
                const date = recording.uploadDate || recording.createdAt;
                const duration = recording.duration || 'Unknown';
                const muxStatus = recording.muxStatus || 'preparing';
                const isReady = muxStatus === 'ready';
                const isPreparing = muxStatus === 'preparing' || muxStatus === 'uploading';
                const price = recording.price || this.classData?.price || 0;
                
                const statusBadge = isPreparing 
                    ? '<span class="processing-badge">⏳ Processing...</span>' 
                    : isReady 
                        ? '<span class="ready-badge">✅ Ready</span>' 
                        : '<span class="error-badge">⚠️ Error</span>';
                
                return `
                    <div class="recording-card ${isReady ? 'ready' : 'processing'} ${isLocked ? 'locked' : ''}" 
                         data-recording-index="${index}" 
                         data-recording-url="${videoUrl || ''}"
                         data-mux-playback-id="${recording.muxPlaybackId || ''}"
                         data-mux-status="${muxStatus}"
                         data-locked="${isLocked}">
                        <div class="video-thumbnail" style="background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%); position: relative;">
                            <span class="play-icon">${isLocked ? '🔒' : '▶'}</span>
                            ${thumbnailUrl ? `<img src="${thumbnailUrl}" style="width: 100%; height: 100%; object-fit: cover; position: absolute; top: 0; left: 0; opacity: 0.5;" onerror="this.style.display='none'">` : ''}
                            ${statusBadge}
                            ${!isReady ? '<div class="processing-overlay">⏳ Processing...</div>' : ''}
                            ${isLocked ? '<div class="lock-overlay">🔒</div>' : ''}
                            ${isLocked && price > 0 ? '<span class="price-badge">💰 ₦' + price.toLocaleString() + '</span>' : ''}
                        </div>
                        <div class="video-info">
                            <h4>${isLocked ? '🔒 ' : '📹 '}${this.escapeHtml(title)}</h4>
                            <p>${this.escapeHtml(description)}</p>
                            <div class="video-meta">
                                <span>⏱️ ${duration}</span>
                                ${date ? `<span>📅 ${new Date(date).toLocaleDateString()}</span>` : ''}
                                ${isPreparing ? `<span class="status-text">⏳ Processing...</span>` : ''}
                                ${isLocked ? '<span class="locked-badge">🔒 Purchase Required</span>' : ''}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            recordingsContainer.querySelectorAll('.recording-card').forEach((card) => {
                card.addEventListener('click', () => {
                    const isLocked = card.dataset.locked === 'true';
                    const recordingUrl = card.dataset.recordingUrl;
                    const muxStatus = card.dataset.muxStatus;
                    
                    if (isLocked) {
                        const price = this.classData?.price || 0;
                        if (price > 0) {
                            window.showToast(`💳 This recording requires payment. Price: ₦${price.toLocaleString()}`, true);
                            const paymentSection = document.getElementById('paymentSection');
                            if (paymentSection) {
                                paymentSection.scrollIntoView({ behavior: 'smooth' });
                            }
                        } else {
                            window.showToast('🔒 Please enroll in this class to access this recording', true);
                        }
                        return;
                    }
                    
                    console.log('Recording card clicked, URL:', recordingUrl);
                    
                    if (!recordingUrl) {
                        window.showToast('Video URL not available', true);
                        return;
                    }
                    
                    if (muxStatus === 'preparing' || muxStatus === 'uploading') {
                        window.showToast('⏳ This video is still processing. Please wait a few minutes.', true);
                    }
                    
                    this.playRecording(recordingUrl, card);
                });
            });
        }
    }

    playVideo(videoIndex) {
        const video = this.videos[videoIndex];
        if (!video) {
            console.error('Video not found at index:', videoIndex);
            return;
        }

        console.log('Playing video:', video);

        const modal = document.getElementById('videoModal');
        const videoPlayer = document.getElementById('videoPlayer');
        const videoTitle = document.getElementById('videoTitle');
        const videoDescription = document.getElementById('videoDescription');
        
        const videoUrl = video.playbackUrl || video.url || video.videoUrl || 
            (video.muxPlaybackId ? `https://stream.mux.com/${video.muxPlaybackId}.m3u8` : null);
        
        if (!videoUrl) {
            window.showToast('Video URL not available', true);
            return;
        }
        
        const title = video.videoDetails?.title || video.title || 'Video';
        const description = video.videoDetails?.description || video.description || '';
        
        this.setupVideoPlayer(videoPlayer, videoUrl, title, description, modal);
        this.restoreProgress(videoPlayer, videoIndex);
        this.trackProgress(videoPlayer, videoIndex);

        modal.style.display = 'flex';
        
        const closeModal = () => {
            modal.style.display = 'none';
            videoPlayer.pause();
            videoPlayer.currentTime = 0;
            if (this.progressInterval) clearInterval(this.progressInterval);
            if (this.hlsInstance) {
                this.hlsInstance.destroy();
                this.hlsInstance = null;
            }
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

    playRecording(videoUrl, cardElement) {
        const title = cardElement.querySelector('h4')?.textContent || 'Recording';
        const description = cardElement.querySelector('p')?.textContent || '';
        const muxPlaybackId = cardElement.dataset.muxPlaybackId;

        const modal = document.getElementById('videoModal');
        const videoPlayer = document.getElementById('videoPlayer');
        const videoTitle = document.getElementById('videoTitle');
        const videoDescription = document.getElementById('videoDescription');
        
        videoTitle.textContent = 'Loading video...';
        videoDescription.textContent = 'Please wait while the video loads...';
        
        videoPlayer.innerHTML = '';
        videoPlayer.removeAttribute('src');
        
        if (muxPlaybackId) {
            this.checkMuxStatus(muxPlaybackId, (isReady) => {
                if (!isReady) {
                    window.showToast('⏳ Video is still processing. It may take a few minutes to become available.', true);
                }
                this.setupVideoPlayer(videoPlayer, videoUrl, title, description, modal);
            });
        } else {
            this.setupVideoPlayer(videoPlayer, videoUrl, title, description, modal);
        }

        modal.style.display = 'flex';
        
        const closeModal = () => {
            modal.style.display = 'none';
            videoPlayer.pause();
            videoPlayer.currentTime = 0;
            if (this.progressInterval) clearInterval(this.progressInterval);
            if (this.hlsInstance) {
                this.hlsInstance.destroy();
                this.hlsInstance = null;
            }
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

    setupVideoPlayer(videoPlayer, videoUrl, title, description, modal) {
        document.getElementById('videoTitle').textContent = title;
        document.getElementById('videoDescription').textContent = description;
        
        videoPlayer.innerHTML = '';
        videoPlayer.removeAttribute('src');
        
        const isHLS = videoUrl && (videoUrl.includes('.m3u8') || videoUrl.includes('m3u8'));
        
        if (isHLS && typeof Hls !== 'undefined') {
            try {
                if (this.hlsInstance) {
                    this.hlsInstance.destroy();
                    this.hlsInstance = null;
                }
                
                const hls = new Hls({
                    enableWorker: true,
                    lowLatencyMode: true,
                    manifestLoadingMaxRetry: 5,
                    manifestLoadingRetryDelay: 1000,
                    levelLoadingMaxRetry: 5,
                    levelLoadingRetryDelay: 1000,
                    fragLoadingMaxRetry: 5,
                    fragLoadingRetryDelay: 1000,
                });
                
                this.hlsInstance = hls;
                
                hls.loadSource(videoUrl);
                hls.attachMedia(videoPlayer);
                
                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                    console.log('✅ HLS manifest parsed, playing video');
                    videoPlayer.play().catch(err => {
                        console.log('Auto-play prevented:', err);
                    });
                });
                
                hls.on(Hls.Events.ERROR, (event, data) => {
                    console.error('HLS Error:', data);
                    if (data.fatal) {
                        switch(data.type) {
                            case Hls.ErrorTypes.NETWORK_ERROR:
                                window.showToast('Network error loading video. Please try again.', true);
                                break;
                            case Hls.ErrorTypes.MEDIA_ERROR:
                                window.showToast('Media error loading video. Please try again.', true);
                                break;
                            default:
                                window.showToast('Error loading video. Please try again.', true);
                                break;
                        }
                    }
                });
            } catch (error) {
                console.error('HLS setup error:', error);
                videoPlayer.src = videoUrl;
                videoPlayer.load();
            }
        } else {
            videoPlayer.src = videoUrl;
            videoPlayer.load();
            videoPlayer.play().catch(() => {});
        }
    }

    async checkMuxStatus(playbackId, callback) {
        try {
            const thumbnailUrl = `https://image.mux.com/${playbackId}/thumbnail.jpg?time=5`;
            const response = await fetch(thumbnailUrl, { method: 'HEAD' });
            
            if (response.ok) {
                callback(true);
                return;
            }
            
            const statusResponse = await fetch(`https://fissk-backend.onrender.com/api/mux/asset-status/${playbackId}`);
            if (statusResponse.ok) {
                const data = await statusResponse.json();
                callback(data.ready || false);
                return;
            }
            
            callback(false);
        } catch (error) {
            console.error('Error checking Mux status:', error);
            callback(false);
        }
    }

    trackProgress(videoPlayer, videoIndex) {
        clearInterval(this.progressInterval);
        
        this.progressInterval = setInterval(() => {
            if (!videoPlayer.paused && !videoPlayer.ended && videoPlayer.currentTime) {
                localStorage.setItem(`video_progress_${this.classId}_${videoIndex}`, videoPlayer.currentTime.toString());
                
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

function initClassManager() {
    if (!classManagerInstance) {
        classManagerInstance = new ClassManager();
        window.classManager = classManagerInstance;
        console.log('✅ ClassManager initialized and exposed globally');
    }
    return classManagerInstance;
}

document.addEventListener('DOMContentLoaded', () => {
    initClassManager();
});

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
        document.body.style.overflow = 'auto';
    });
});

// ===== MAKE showToast GLOBAL =====
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