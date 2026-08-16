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
        this.quizzes = [];
        this.lessons = [];
        this.isEnrolled = false;
        this.isLoading = true;
        this.hlsInstance = null;
        this.enrollmentPaymentStatus = 'free';
        this.hasPaidAccess = false;
        this.token = localStorage.getItem('token');
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
            await this.loadClassData();
            
            await Promise.all([
                this.checkEnrollment(),
                this.loadClassVideos(),
                this.loadClassRecordings(),
                this.checkPaymentStatus(),
                this.loadQuizzes(),
                this.loadLessons()
            ]);
            
            this.renderClassData();
            this.renderVideos();
            this.renderRecordings();
            this.renderPriceAndPayment();
            this.renderQuizzes();
            this.renderLessons();
            this.renderClassReviews();
            this.setupEventListeners();
            
            // Check for payment verification callback
            this.checkPaymentVerification();
        } catch (error) {
            console.error('Initialization error:', error);
        } finally {
            this.isLoading = false;
            this.hideLoadingState();
        }
    }

    /**
     * Check if returning from payment gateway
     */
    checkPaymentVerification() {
        const urlParams = new URLSearchParams(window.location.search);
        const reference = urlParams.get('reference');
        const status = urlParams.get('status');
        
        if (reference && status) {
            console.log('Payment verification callback detected:', { reference, status });
            if (status === 'success') {
                // Refresh enrollment and payment status after successful payment
                this.refreshEnrollmentAndPayment();
            }
        }
    }

    /**
     * Refresh enrollment and payment status after payment
     */
    async refreshEnrollmentAndPayment() {
        try {
            console.log('Refreshing enrollment and payment status...');
            
            // Re-check enrollment
            await this.checkEnrollment();
            
            // Re-check payment status
            await this.checkPaymentStatus();
            
            // Re-render everything
            this.renderClassData();
            this.renderVideos();
            this.renderRecordings();
            this.renderPriceAndPayment();
            this.renderQuizzes();
            this.renderLessons();
            
            window.showToast('Payment verified! You now have full access to this class. 🎉', false);
        } catch (error) {
            console.error('Error refreshing status:', error);
            window.showToast('Payment successful! Please refresh the page to access content.', false);
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
            
            console.log('Enrollment status:', this.isEnrolled);
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
                // Update payment status from response
                if (data.hasAccess !== undefined) {
                    this.hasPaidAccess = data.hasAccess;
                    this.enrollmentPaymentStatus = data.accessType || 'none';
                }
            } else if (Array.isArray(data)) {
                allVideos = data;
            }
            
            this.recordings = allVideos.filter(video => 
                video.cloudinaryUrl || video.hlsUrl || video.url || video.muxPlaybackId
            );
            
            console.log('Recordings loaded:', this.recordings.length);
            console.log('Payment status from recordings:', this.enrollmentPaymentStatus, 'Has paid access:', this.hasPaidAccess);
        } catch (error) {
            console.error('Error loading class recordings:', error);
            this.recordings = [];
        }
    }

    async checkPaymentStatus() {
        if (!this.user || !this.user.id) {
            this.hasPaidAccess = false;
            this.enrollmentPaymentStatus = 'none';
            return;
        }
        
        try {
            // Check if class is free
            if (this.classData && (this.classData.isFree || this.classData.price === 0)) {
                this.enrollmentPaymentStatus = 'free';
                this.hasPaidAccess = true;
                console.log('Class is free - access granted');
                return;
            }
            
            // Check enrollment status with payment details
            if (this.isEnrolled) {
                const response = await fetch('https://fissk-backend.onrender.com/register/get-user-classes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: this.user.email })
                });
                
                if (response.ok) {
                    const data = await response.json();
                    console.log('User classes data:', data);
                    
                    if (data.classes && data.classes.length) {
                        const classEnrollment = data.classes.find(c => 
                            (c.class_id?.toString() === this.classId) || (c._id?.toString() === this.classId)
                        );
                        
                        if (classEnrollment) {
                            // Check multiple possible payment status fields
                            this.enrollmentPaymentStatus = classEnrollment.paymentStatus || 
                                                         classEnrollment.status || 
                                                         'free';
                            
                            // Check if payment is completed
                            const isPaid = this.enrollmentPaymentStatus === 'paid' || 
                                          this.enrollmentPaymentStatus === 'completed' ||
                                          classEnrollment.accessType === 'paid' ||
                                          classEnrollment.isPaid === true;
                            
                            this.hasPaidAccess = isPaid;
                            
                            console.log('Enrollment payment status:', this.enrollmentPaymentStatus);
                            console.log('Has paid access:', this.hasPaidAccess);
                        }
                    }
                }
            }
            
            // If not enrolled or no payment info, default to false
            if (!this.isEnrolled) {
                this.hasPaidAccess = false;
                this.enrollmentPaymentStatus = 'none';
            }
            
            console.log('Final payment status:', this.enrollmentPaymentStatus, 'Paid:', this.hasPaidAccess);
        } catch (error) {
            console.error('Check payment status error:', error);
            this.hasPaidAccess = false;
            this.enrollmentPaymentStatus = 'none';
        }
    }

    // ============================================================
    // QUIZ METHODS
    // ============================================================

    async loadQuizzes() {
    try {
        // Get fresh token
        const token = localStorage.getItem('token');
        
        if (!token) {
            console.log('No token found, skipping quiz load');
            this.quizzes = [];
            return;
        }

        console.log('Loading quizzes with token:', token.substring(0, 20) + '...');

        const response = await fetch(`https://fissk-backend.onrender.com/api/quizzes/class/${this.classId}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('Quiz load response status:', response.status);

        if (response.status === 401) {
            console.log('Token expired or invalid, clearing storage');
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            // Don't redirect immediately, just show toast
            window.showToast('Session expired. Please login again.', true);
            this.quizzes = [];
            return;
        }

        if (!response.ok) {
            throw new Error(`Failed to load quizzes: ${response.status}`);
        }

        const data = await response.json();
        this.quizzes = data.quizzes || [];
        console.log('Quizzes loaded:', this.quizzes.length);
        
    } catch (error) {
        console.error('Error loading quizzes:', error);
        this.quizzes = [];
    }
}

    renderQuizzes() {
        const container = document.getElementById('quizzesContainer');
        if (!container) return;
        
        if (!this.isEnrolled) {
            container.innerHTML = `
                <div class="access-locked">
                    <div class="lock-icon">🔒</div>
                    <h3>Enroll to Access Quizzes</h3>
                    <p>You need to be enrolled in this class to take quizzes.</p>
                    <button class="btn btn-primary" id="enrollForQuizzesBtn">Enroll Now</button>
                </div>
            `;
            const enrollBtn = container.querySelector('#enrollForQuizzesBtn');
            if (enrollBtn) {
                enrollBtn.addEventListener('click', () => {
                    this.handleEnrollment();
                });
            }
            return;
        }
        
        if (!this.quizzes || this.quizzes.length === 0) {
            container.innerHTML = `
                <div class="no-quizzes">
                    <p>📝 No quizzes available for this class yet.</p>
                    ${this.user?.user_type === 'instructor' ? 
                        `<a href="instructor/quizzes/create.html?classId=${this.classId}" class="btn btn-primary">Create First Quiz</a>` : 
                        '<p class="no-quizzes-sub">Check back later for new quizzes.</p>'
                    }
                </div>
            `;
            return;
        }
        
        container.innerHTML = `
            <div class="quizzes-grid">
                ${this.quizzes.map(quiz => this.renderQuizCard(quiz)).join('')}
            </div>
        `;
        
        container.querySelectorAll('.quiz-card .quiz-action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const quizId = btn.dataset.quizId;
                const action = btn.dataset.action;
                
                if (action === 'start' || action === 'resume') {
                    this.startQuiz(quizId);
                } else if (action === 'review') {
                    this.viewQuizResults(quizId);
                }
            });
        });
    }

    renderQuizCard(quiz) {
        const isCompleted = quiz.userAttempts > 0;
        const isInProgress = quiz.inProgress;
        const canAttempt = quiz.canAttempt;
        const status = isCompleted ? 'completed' : isInProgress ? 'in-progress' : 'available';
        
        let statusBadge = '';
        let actionButton = '';
        
        if (isCompleted) {
            statusBadge = `<span class="quiz-status completed">✅ Completed</span>`;
            actionButton = `<button class="btn btn-outline quiz-action-btn" data-quiz-id="${quiz._id}" data-action="review">📊 Review</button>`;
        } else if (isInProgress) {
            statusBadge = `<span class="quiz-status in-progress">⏳ In Progress</span>`;
            actionButton = `<button class="btn btn-primary quiz-action-btn" data-quiz-id="${quiz._id}" data-action="resume">▶️ Resume</button>`;
        } else if (canAttempt) {
            statusBadge = `<span class="quiz-status available">✅ Available</span>`;
            actionButton = `<button class="btn btn-primary quiz-action-btn" data-quiz-id="${quiz._id}" data-action="start">🚀 Start Quiz</button>`;
        } else {
            statusBadge = `<span class="quiz-status locked">🔒 Attempts Used</span>`;
            actionButton = `<button class="btn btn-secondary quiz-action-btn" disabled>Max Attempts Reached</button>`;
        }
        
        const timeLimit = quiz.settings?.timeLimit || 0;
        const timeDisplay = timeLimit > 0 ? `⏱️ ${timeLimit} min` : '⏱️ No time limit';
        const questionsCount = quiz.questionCount || 0;
        
        return `
            <div class="quiz-card ${status}">
                <div class="quiz-card-header">
                    <h3>${this.escapeHtml(quiz.title)}</h3>
                    ${statusBadge}
                </div>
                <div class="quiz-card-body">
                    <p>${this.escapeHtml(quiz.description || 'No description')}</p>
                    <div class="quiz-meta">
                        <span>📝 ${questionsCount} questions</span>
                        <span>${timeDisplay}</span>
                        ${quiz.totalPoints > 0 ? `<span>⭐ ${quiz.totalPoints} points</span>` : ''}
                        ${quiz.userScore !== null ? `<span>📊 Score: ${quiz.userScore}%</span>` : ''}
                    </div>
                </div>
                <div class="quiz-card-footer">
                    ${actionButton}
                    ${isCompleted ? `<span class="quiz-attempts">Attempts: ${quiz.userAttempts}</span>` : ''}
                </div>
            </div>
        `;
    }

    async startQuiz(quizId) {
        try {
            window.location.href = `quiz/take.html?quizId=${quizId}`;
        } catch (error) {
            console.error('Start quiz error:', error);
            window.showToast('Failed to start quiz. Please try again.', 'error');
        }
    }

    async viewQuizResults(quizId) {
        try {
            const response = await fetch(`https://fissk-backend.onrender.com/api/quizzes/${quizId}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            if (data.success && data.quiz && data.quiz.attemptId) {
                window.location.href = `quiz/results.html?attemptId=${data.quiz.attemptId}`;
            } else {
                window.showToast('No results available for this quiz.', 'info');
            }
        } catch (error) {
            console.error('View results error:', error);
            window.showToast('Failed to load results.', 'error');
        }
    }
    


    /**
 * Show lesson detail in a modal
 */
showLessonDetail(lesson) {
    // Create modal if it doesn't exist
    let modal = document.getElementById('lessonDetailModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'lessonDetailModal';
        modal.className = 'modal';
        modal.style.display = 'none';
        document.body.appendChild(modal);
    }

    // Build content items HTML
    let itemsHTML = '';
    let completedCount = 0;
    const totalItems = lesson.contentItems?.length || 0;

    if (lesson.contentItems && lesson.contentItems.length > 0) {
        itemsHTML = lesson.contentItems.map((item, index) => {
            const isCompleted = false;
            
            let itemContent = '';
            switch (item.type) {
                case 'text':
                    itemContent = `
                        <div class="item-text-content" style="color: rgba(255,255,255,0.9);">${this.escapeHtml(item.content || '')}</div>
                    `;
                    break;
                case 'video':
                    // Get the correct video ID - use contentId or videoId
                    const videoId = item.contentId || item.videoId;
                    const videoUrl = item.videoDetails?.playbackUrl || 
                                    (item.muxPlaybackId ? `https://stream.mux.com/${item.muxPlaybackId}.m3u8` : '');
                    itemContent = `
                        <div class="item-video-wrapper">
                            ${videoUrl ? `
                                <video controls style="max-width: 100%; border-radius: 8px;">
                                    <source src="${videoUrl}" type="application/x-mpegURL">
                                </video>
                            ` : '<p style="color: rgba(255,255,255,0.5);">Video not available</p>'}
                        </div>
                        ${item.content ? `<p style="margin-top: 8px; color: rgba(255,255,255,0.7);">${this.escapeHtml(item.content)}</p>` : ''}
                    `;
                    break;
                case 'quiz':
                    // FIX: Get the correct quiz ID - use contentId or quizId
                    const quizId = item.contentId || item.quizId?._id || item.quizId;
                    const quizDetails = item.quizDetails || {};
                    itemContent = `
                        <div class="item-quiz-wrapper">
                            ${quizId ? `
                                <a href="quiz/take.html?quizId=${quizId}" class="btn btn-primary" style="margin-right: 8px; background: #8B5FBF; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; display: inline-block;">
                                    📝 Take Quiz
                                </a>
                            ` : `
                                <span style="color: rgba(255,255,255,0.5);">Quiz not available</span>
                            `}
                            ${quizDetails.questionCount ? `<span style="color: rgba(255,255,255,0.5); font-size: 0.85rem; margin-left: 8px;">${quizDetails.questionCount} questions</span>` : ''}
                            ${item.content ? `<p style="margin-top: 8px; color: rgba(255,255,255,0.7);">${this.escapeHtml(item.content)}</p>` : ''}
                        </div>
                    `;
                    break;
                case 'material':
                    itemContent = `
                        <div class="item-material-wrapper">
                            ${item.fileUrl ? `
                                <a href="${item.fileUrl}" class="btn btn-outline" download style="margin-right: 8px; color: #8B5FBF; border: 1px solid #8B5FBF; padding: 8px 16px; border-radius: 8px; text-decoration: none; display: inline-block;">
                                    📥 Download ${item.fileName || 'File'}
                                </a>
                            ` : '<p style="color: rgba(255,255,255,0.5);">Material not available</p>'}
                            ${item.content ? `<p style="margin-top: 8px; color: rgba(255,255,255,0.7);">${this.escapeHtml(item.content)}</p>` : ''}
                        </div>
                    `;
                    break;
                case 'link':
                    itemContent = `
                        <div class="item-link-wrapper">
                            <a href="${item.linkUrl}" target="${item.linkTarget || '_blank'}" class="btn btn-outline" style="color: #8B5FBF; border: 1px solid #8B5FBF; padding: 8px 16px; border-radius: 8px; text-decoration: none; display: inline-block;">
                                🔗 ${this.escapeHtml(item.title || 'Open Link')}
                            </a>
                            ${item.content ? `<p style="margin-top: 8px; color: rgba(255,255,255,0.7);">${this.escapeHtml(item.content)}</p>` : ''}
                        </div>
                    `;
                    break;
                case 'embed':
                    itemContent = `
                        <div class="item-embed-wrapper">
                            ${item.embedCode ? item.embedCode : ''}
                            ${item.content ? `<p style="margin-top: 8px; color: rgba(255,255,255,0.7);">${this.escapeHtml(item.content)}</p>` : ''}
                        </div>
                    `;
                    break;
                default:
                    itemContent = `<p style="color: rgba(255,255,255,0.5);">Content type not supported</p>`;
            }

            const typeLabels = {
                'text': 'Text',
                'video': 'Video',
                'quiz': 'Quiz',
                'material': 'Material',
                'link': 'Link',
                'embed': 'Embed'
            };

            const typeColors = {
                'text': '#3B82F6',
                'video': '#EF4444',
                'quiz': '#F59E0B',
                'material': '#10B981',
                'link': '#8B5FBF',
                'embed': '#6B7280'
            };

            return `
                <div class="lesson-content-item" data-item-index="${index}" style="background: rgba(255,255,255,0.06); border-radius: 12px; padding: 20px; border-left: 4px solid ${typeColors[item.type] || '#8B5FBF'}; margin-bottom: 16px;">
                    <div class="item-header" style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                        <span class="item-type-badge ${item.type}" style="display: inline-block; padding: 2px 12px; border-radius: 20px; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; background: ${typeColors[item.type] || '#6B7280'}; color: white;">
                            ${typeLabels[item.type] || item.type}
                        </span>
                        ${item.isRequired ? '<span style="font-size: 0.7rem; color: rgba(255,255,255,0.3);">Required</span>' : '<span style="font-size: 0.7rem; color: rgba(255,255,255,0.3);">Optional</span>'}
                    </div>
                    ${item.title ? `<div class="item-title" style="font-size: 1rem; font-weight: 600; color: white;">${this.escapeHtml(item.title)}</div>` : ''}
                    ${itemContent}
                    <div class="item-footer" style="margin-top: 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                        ${item.duration ? `<span class="item-duration" style="font-size: 0.8rem; color: rgba(255,255,255,0.5);">⏱️ ${item.duration} min</span>` : ''}
                        <button class="item-complete-btn incomplete" data-item-index="${index}" style="padding: 4px 16px; border-radius: 20px; font-size: 0.8rem; border: none; cursor: pointer; background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.6); border: 1px solid rgba(255,255,255,0.2);">
                            Mark as Read
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    } else {
        itemsHTML = '<p style="color: rgba(255,255,255,0.5); text-align: center; padding: 20px;">No content items in this lesson.</p>';
    }

    // Calculate progress
    const progress = lesson.progressPercentage || 0;

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 800px; max-height: 90vh; overflow-y: auto; background: #1A1A2E; border-radius: 16px; padding: 32px; border: 1px solid rgba(255,255,255,0.1);">
            <span class="close-modal" onclick="document.getElementById('lessonDetailModal').style.display='none'" style="position: absolute; top: 15px; right: 20px; font-size: 2rem; cursor: pointer; color: rgba(255,255,255,0.6); transition: color 0.3s ease; z-index: 10;">&times;</span>
            
            <div style="margin-bottom: 16px;">
                <h2 style="color: white; margin: 0;">${this.escapeHtml(lesson.title)}</h2>
                ${lesson.description ? `<p style="color: rgba(255,255,255,0.6); margin-top: 4px;">${this.escapeHtml(lesson.description)}</p>` : ''}
            </div>

            <div class="lesson-progress-container" style="background: rgba(255,255,255,0.08); border-radius: 12px; padding: 16px 20px; margin-bottom: 20px;">
                <div class="progress-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                    <h4 style="color: white; font-size: 1rem; margin: 0;">📊 Lesson Progress</h4>
                    <span style="color: rgba(255,255,255,0.7); font-size: 0.9rem;">${progress}% complete</span>
                </div>
                <div class="progress-bar" style="height: 6px; background: rgba(255,255,255,0.1); border-radius: 4px; overflow: hidden; margin-top: 8px;">
                    <div class="progress-fill" style="width: ${progress}%; height: 100%; background: linear-gradient(90deg, #8B5FBF, #6C3CE1); border-radius: 4px; transition: width 0.5s ease;"></div>
                </div>
            </div>

            <div class="lesson-content-items" style="display: flex; flex-direction: column; gap: 16px;">
                ${itemsHTML}
            </div>

            <button class="mark-lesson-complete-btn ${lesson.completed ? 'completed' : 'available'}" 
                    id="markLessonCompleteBtn"
                    ${lesson.completed ? 'disabled' : ''}
                    style="padding: 12px 32px; border-radius: 10px; font-size: 1rem; font-weight: 600; border: none; cursor: pointer; transition: all 0.3s ease; width: 100%; margin-top: 20px; ${lesson.completed ? 'background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.6); cursor: default;' : 'background: #10B981; color: white;'}">
                ${lesson.completed ? '✅ Lesson Completed' : '✅ Mark Lesson as Complete'}
            </button>
        </div>
    `;

    // Show modal
    modal.style.display = 'flex';

    // Add event listener for mark complete button
    const completeBtn = document.getElementById('markLessonCompleteBtn');
    if (completeBtn && !lesson.completed) {
        completeBtn.addEventListener('click', () => {
            this.markLessonComplete(lesson._id);
        });
    }

    // Add event listeners for item complete buttons
    modal.querySelectorAll('.item-complete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const itemIndex = parseInt(btn.dataset.itemIndex);
            this.toggleItemComplete(lesson._id, itemIndex, btn);
        });
    });
}


    // ============================================================
    // LESSON METHODS
    // ============================================================

        async loadLessons() {
        try {
            // Get fresh token
            const token = localStorage.getItem('token');
            
            if (!token) {
                console.log('No token found, skipping lessons load');
                this.lessons = [];
                return;
            }

            console.log('Loading lessons with token:', token.substring(0, 20) + '...');

            const response = await fetch(`https://fissk-backend.onrender.com/api/lessons/class/${this.classId}`, {
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('Lessons load response status:', response.status);

            if (response.status === 401) {
                console.log('Token expired or invalid, clearing storage');
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.showToast('Session expired. Please login again.', true);
                this.lessons = [];
                return;
            }

            if (!response.ok) {
                throw new Error(`Failed to load lessons: ${response.status}`);
            }

            const data = await response.json();
            this.lessons = data.lessons || [];
            console.log('Lessons loaded:', this.lessons.length);

            // Update lesson progress in sidebar
            this.updateLessonProgressSidebar();

        } catch (error) {
            console.error('Error loading lessons:', error);
            this.lessons = [];
        }
    }

    renderLessons() {
        const container = document.getElementById('lessonsContainer');
        if (!container) return;

        if (!this.isEnrolled) {
            container.innerHTML = `
                <div class="access-locked">
                    <div class="lock-icon">🔒</div>
                    <h3>Enroll to Access Lessons</h3>
                    <p>You need to be enrolled in this class to view lessons.</p>
                    <button class="btn btn-primary" id="enrollForLessonsBtn">Enroll Now</button>
                </div>
            `;
            const enrollBtn = container.querySelector('#enrollForLessonsBtn');
            if (enrollBtn) {
                enrollBtn.addEventListener('click', () => {
                    this.handleEnrollment();
                });
            }
            return;
        }

        if (!this.lessons || this.lessons.length === 0) {
            container.innerHTML = `
                <div class="no-lessons">
                    <p>📚 No lessons available yet.</p>
                    ${this.user?.user_type === 'instructor' ? 
                        `<a href="instructor/lessons/create.html?classId=${this.classId}" class="btn btn-primary">Create First Lesson</a>` : 
                        '<p class="no-lessons-sub">Check back later for new lessons.</p>'
                    }
                </div>
            `;
            return;
        }

        const totalLessons = this.lessons.length;
        const completedLessons = this.lessons.filter(l => l.completed).length;
        const progress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

        container.innerHTML = `
            <div class="lessons-progress" style="margin-bottom: 20px; padding: 16px; background: var(--bg-secondary); border-radius: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                    <div>
                        <strong>Course Progress</strong>
                        <span style="color: var(--text-secondary); margin-left: 8px;">${completedLessons}/${totalLessons} lessons completed</span>
                    </div>
                    <span style="font-weight: 600; color: var(--accent-blue);">${progress}%</span>
                </div>
                <div class="progress-bar" style="margin-top: 8px; height: 6px; background: var(--bg-elevated); border-radius: 4px; overflow: hidden;">
                    <div class="progress-fill" style="width: ${progress}%; height: 100%; background: var(--accent-blue); border-radius: 4px; transition: width 0.3s ease;"></div>
                </div>
            </div>
            <div class="lessons-grid">
                ${this.lessons.map((lesson, index) => `
                    <div class="lesson-card ${lesson.completed ? 'completed' : ''}" 
                         onclick="window.location.href='lesson.html?classId=${this.classId}&lessonId=${lesson._id}'">
                        <div class="lesson-card-header">
                            <span class="lesson-number">Lesson ${index + 1}</span>
                            ${lesson.completed ? '<span class="completed-badge">✅ Completed</span>' : ''}
                        </div>
                        <h4>${this.escapeHtml(lesson.title)}</h4>
                        <p>${this.escapeHtml(lesson.description || '')}</p>
                        <div class="lesson-card-footer">
                            <span>⏱️ ${lesson.estimatedTime || 0} min</span>
                            <span>📝 ${lesson.contentItems?.length || 0} items</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
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
        
        if (tabName === 'quizzes') {
            if (!this.quizzes || this.quizzes.length === 0) {
                this.loadQuizzes().then(() => {
                    this.renderQuizzes();
                });
            } else {
                this.renderQuizzes();
            }
        }
        if (tabName === 'lessons') {
            if (!this.lessons || this.lessons.length === 0) {
                this.loadLessons().then(() => this.renderLessons());
            } else {
                this.renderLessons();
            }
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
                    enrollBtn.textContent = '✅ Already Enrolled';
                    enrollBtn.disabled = true;
                    enrollBtn.classList.add('enrolled');
                } else {
                    enrollBtn.textContent = '📝 Enroll Now';
                    enrollBtn.disabled = false;
                    enrollBtn.classList.remove('enrolled');
                }
            }

            if (this.classData.instructorId) {
                try {
                    const instructorNameEl = document.getElementById('instructorName');
                    const instructorBioEl = document.getElementById('instructorBio');
                    
                    if (this.classData.instructorId) {
                        if (typeof this.classData.instructorId === 'object' && this.classData.instructorId.firstName) {
                            const name = `${this.classData.instructorId.firstName || ''} ${this.classData.instructorId.lastName || ''}`.trim();
                            if (instructorNameEl) instructorNameEl.textContent = name || 'Staff';
                        } else {
                            const response = await fetch('https://fissk-backend.onrender.com/register/classes/instructor', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ instructor_id: this.classData.instructorId })
                            });
                            const dataA = await response.json();
                            if (instructorNameEl && dataA.instructorData) {
                                const name = `${dataA.instructorData.firstName || ''} ${dataA.instructorData.lastName || ''}`.trim();
                                instructorNameEl.textContent = name || 'Staff';
                            }
                        }
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

    /**
     * RENDER PRICE AND PAYMENT
     * - Hides payment section completely for enrolled students
     * - Shows free badge for free classes
     * - Shows buy button for paid classes (non-enrolled only)
     */
    renderPriceAndPayment() {
        const price = this.classData?.price || 0;
        const isFree = this.classData?.isFree !== undefined ? this.classData.isFree : true;
        const currency = this.classData?.currency || 'NGN';
        
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
        
        // ===== HIDE PAYMENT SECTION FOR ENROLLED STUDENTS =====
        if (this.isEnrolled) {
            paymentSection.className = 'payment-section payment-section-hidden';
            paymentSection.innerHTML = `
                <div class="payment-info already-enrolled-badge">
                    <span class="badge">✅ You are enrolled in this class</span>
                    <p>You have full access to all content. Enjoy learning! 🎓</p>
                </div>
            `;
            return;
        }
        
        // Show payment section for non-enrolled users
        paymentSection.className = 'payment-section';
        
        // Free class
        if (isFree || price === 0) {
            paymentSection.innerHTML = `
                <div class="payment-info free-badge">
                    <span class="badge">🎓 FREE CLASS</span>
                    <p>All content is available for free. No payment required.</p>
                    <button class="btn btn-primary" id="enrollFreeBtn" style="margin-top: 12px;">
                        📝 Enroll for Free
                    </button>
                </div>
            `;
            const freeEnrollBtn = document.getElementById('enrollFreeBtn');
            if (freeEnrollBtn) {
                freeEnrollBtn.addEventListener('click', () => {
                    this.handleEnrollment();
                });
            }
            return;
        }
        
        // Paid class - show buy button
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

    /**
     * INITIATE PAYMENT - FIXED JSON PARSING ERROR
     * - Checks enrollment status before allowing payment
     * - Handles API errors gracefully
     * - Properly parses JSON responses
     */
    async initiatePayment() {
        // Check if user is logged in
        if (!this.user) {
            window.showToast('Please login to purchase this course', true);
            window.location.href = 'login.html';
            return;
        }
        
        // Check if already enrolled
        if (this.isEnrolled) {
            window.showToast('You are already enrolled in this class!', false);
            this.renderPriceAndPayment();
            return;
        }
        
        const price = this.classData?.price || 0;
        if (price <= 0) {
            window.showToast('This course is free. Click Enroll for Free.', 'info');
            return;
        }
        
        const buyBtn = document.getElementById('buyCourseBtn');
        if (buyBtn) {
            buyBtn.disabled = true;
            buyBtn.textContent = '⏳ Processing...';
        }
        
        try {
            console.log('Initiating payment for class:', this.classId, 'User:', this.user.id);
            
            const response = await fetch('https://fissk-backend.onrender.com/api/payment/initialize', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    classId: this.classId,
                    userId: this.user.id,
                    email: this.user.email,
                    amount: price,
                    callbackUrl: window.location.href.split('?')[0] + '?payment=processing'
                })
            });
            
            console.log('Payment response status:', response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Payment error response:', errorText);
                throw new Error(`Payment request failed: ${response.status} ${response.statusText}`);
            }
            
            const responseText = await response.text();
            console.log('Payment response text:', responseText);
            
            if (!responseText || responseText.trim() === '') {
                throw new Error('Empty response from payment server');
            }
            
            let data;
            try {
                data = JSON.parse(responseText);
            } catch (parseError) {
                console.error('Failed to parse payment response:', parseError);
                throw new Error('Invalid response from payment server');
            }
            
            if (data.success && data.data && data.data.authorizationUrl) {
                // Store the class ID for callback handling
                localStorage.setItem('payment_pending_class', this.classId);
                // Redirect to payment gateway
                window.location.href = data.data.authorizationUrl;
            } else {
                throw new Error(data.message || 'Payment initialization failed');
            }
            
        } catch (error) {
            console.error('Payment error:', error);
            window.showToast(error.message || 'Failed to initialize payment. Please try again.', true);
            
            if (buyBtn) {
                buyBtn.disabled = false;
                const currency = this.classData?.currency || 'NGN';
                const price = this.classData?.price || 0;
                buyBtn.textContent = `💳 Buy Course - ${currency} ${price.toLocaleString()}`;
            }
        }
    }

    // ============================================================
    // FORUM METHODS
    // ============================================================

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

    // ============================================================
    // REVIEWS METHODS
    // ============================================================

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

    // ============================================================
    // VIDEO METHODS
    // ============================================================

    /**
     * Check if user has paid access to this class
     */
    hasPaidAccessToClass() {
        // If class is free, grant access
        if (this.classData && (this.classData.isFree || this.classData.price === 0)) {
            return true;
        }
        
        // If enrolled and payment status is paid or completed
        if (this.isEnrolled) {
            const paidStatuses = ['paid', 'completed', 'success', 'verified'];
            if (paidStatuses.includes(this.enrollmentPaymentStatus)) {
                return true;
            }
        }
        
        return false;
    }

    renderVideos() {
        const videosContainer = document.getElementById('videosContainer');
        const noVideos = document.getElementById('noVideos');

        if (!this.user) {
            if (videosContainer) {
                videosContainer.style.display = 'block';
                videosContainer.innerHTML = `
                    <div class="access-locked">
                        <div class="lock-icon">🔒</div>
                        <h3>Access Restricted</h3>
                        <p>Please <a href="login.html" class="btn-link">login</a> to view class videos.</p>
                        <a href="login.html" class="btn btn-primary">Login to Access</a>
                    </div>
                `;
            }
            if (noVideos) noVideos.style.display = 'none';
            return;
        }

        if (!this.isEnrolled) {
            if (videosContainer) {
                videosContainer.style.display = 'block';
                videosContainer.innerHTML = `
                    <div class="access-locked">
                        <div class="lock-icon">🔒</div>
                        <h3>Enroll to Access Videos</h3>
                        <p>You need to be enrolled in this class to view videos and materials.</p>
                        <button class="btn btn-primary" id="enrollForVideosBtn">Enroll Now</button>
                    </div>
                `;
                const enrollBtn = videosContainer.querySelector('#enrollForVideosBtn');
                if (enrollBtn) {
                    enrollBtn.addEventListener('click', () => {
                        this.handleEnrollment();
                    });
                }
            }
            if (noVideos) noVideos.style.display = 'none';
            return;
        }

        // Check if user has paid access
        const hasAccess = this.hasPaidAccessToClass();
        console.log('Has paid access in renderVideos:', hasAccess, 'Payment status:', this.enrollmentPaymentStatus);

        if (!hasAccess) {
            const price = this.classData?.price || 0;
            if (price > 0) {
                if (videosContainer) {
                    videosContainer.style.display = 'block';
                    videosContainer.innerHTML = `
                        <div class="access-locked">
                            <div class="lock-icon">💰</div>
                            <h3>Payment Required</h3>
                            <p>This class requires payment to access videos and materials.</p>
                            <div class="price-display-small">
                                <span class="price">₦${price.toLocaleString()}</span>
                                <span class="label">One-time payment • Lifetime access</span>
                            </div>
                            <button class="btn btn-primary" id="buyForVideosBtn">💳 Buy Course - ₦${price.toLocaleString()}</button>
                        </div>
                    `;
                    const buyBtn = videosContainer.querySelector('#buyForVideosBtn');
                    if (buyBtn) {
                        buyBtn.addEventListener('click', () => {
                            this.initiatePayment();
                        });
                    }
                }
                if (noVideos) noVideos.style.display = 'none';
                return;
            }
        }

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
                const isLocked = video.locked === true && !hasAccess;
                const title = video.videoDetails?.title || video.title || 'Untitled';
                const description = video.videoDetails?.description || video.description || 'No description';
                const duration = video.videoDetails?.duration || video.duration || 'Unknown';
                
                return `
                    <div class="video-card ${isLocked ? 'locked' : ''}" 
                         data-video-index="${index}" 
                         data-video-id="${video._id || video.id}"
                         data-locked="${isLocked}">
                        <div class="video-thumbnail" style="background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%); position: relative;">
                            <span class="play-icon">${isLocked ? '🔒' : '▶'}</span>
                            ${thumbnailUrl ? `<img src="${thumbnailUrl}" style="width: 100%; height: 100%; object-fit: cover; position: absolute; top: 0; left: 0; opacity: 0.5;" onerror="this.style.display='none'">` : ''}
                            ${isLocked ? '<div class="lock-overlay">🔒</div>' : ''}
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
                        window.showToast('🔒 Please purchase this class to access this video', true);
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

        if (!this.user) {
            if (recordingsContainer) {
                recordingsContainer.style.display = 'block';
                recordingsContainer.innerHTML = `
                    <div class="access-locked">
                        <div class="lock-icon">🔒</div>
                        <h3>Access Restricted</h3>
                        <p>Please <a href="login.html" class="btn-link">login</a> to view class recordings.</p>
                        <a href="login.html" class="btn btn-primary">Login to Access</a>
                    </div>
                `;
            }
            if (noRecordings) noRecordings.style.display = 'none';
            return;
        }

        if (!this.isEnrolled) {
            if (recordingsContainer) {
                recordingsContainer.style.display = 'block';
                recordingsContainer.innerHTML = `
                    <div class="access-locked">
                        <div class="lock-icon">🔒</div>
                        <h3>Enroll to Access Recordings</h3>
                        <p>You need to be enrolled in this class to view recordings and materials.</p>
                        <button class="btn btn-primary" id="enrollForRecordingsBtn">Enroll Now</button>
                    </div>
                `;
                const enrollBtn = recordingsContainer.querySelector('#enrollForRecordingsBtn');
                if (enrollBtn) {
                    enrollBtn.addEventListener('click', () => {
                        this.handleEnrollment();
                    });
                }
            }
            if (noRecordings) noRecordings.style.display = 'none';
            return;
        }

        // Check if user has paid access
        const hasAccess = this.hasPaidAccessToClass();
        console.log('Has paid access in renderRecordings:', hasAccess, 'Payment status:', this.enrollmentPaymentStatus);

        if (!hasAccess) {
            const price = this.classData?.price || 0;
            if (price > 0) {
                if (recordingsContainer) {
                    recordingsContainer.style.display = 'block';
                    recordingsContainer.innerHTML = `
                        <div class="access-locked">
                            <div class="lock-icon">💰</div>
                            <h3>Payment Required</h3>
                            <p>This class requires payment to access recordings and materials.</p>
                            <div class="price-display-small">
                                <span class="price">₦${price.toLocaleString()}</span>
                                <span class="label">One-time payment • Lifetime access</span>
                            </div>
                            <button class="btn btn-primary" id="buyForRecordingsBtn">💳 Buy Course - ₦${price.toLocaleString()}</button>
                        </div>
                    `;
                    const buyBtn = recordingsContainer.querySelector('#buyForRecordingsBtn');
                    if (buyBtn) {
                        buyBtn.addEventListener('click', () => {
                            this.initiatePayment();
                        });
                    }
                }
                if (noRecordings) noRecordings.style.display = 'none';
                return;
            }
        }

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
                const isLocked = recording.locked === true && !hasAccess;
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
                        window.showToast('🔒 Please purchase this class to access this recording', true);
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

    /**
     * Render lessons with detailed content
     * This is the main lesson viewer for students
     */
    renderLessons() {
        const container = document.getElementById('lessonsContainer');
        if (!container) return;

        if (!this.isEnrolled) {
            container.innerHTML = `
                <div class="access-locked">
                    <div class="lock-icon">🔒</div>
                    <h3>Enroll to Access Lessons</h3>
                    <p>You need to be enrolled in this class to view lessons and study materials.</p>
                    <button class="btn btn-primary" id="enrollForLessonsBtn">Enroll Now</button>
                </div>
            `;
            const enrollBtn = container.querySelector('#enrollForLessonsBtn');
            if (enrollBtn) {
                enrollBtn.addEventListener('click', () => {
                    this.handleEnrollment();
                });
            }
            return;
        }

        if (!this.lessons || this.lessons.length === 0) {
            container.innerHTML = `
                <div class="no-lessons" style="color:black;">
                    <p>📚 No lessons available yet.</p>
                    <p style="color: rgba(255,255,255,0.5); font-size: 0.9rem;">
                        Check back later for new lessons from your instructor.
                    </p>
                </div>
            `;
            return;
        }

        // Show lessons as cards with click to view full lesson
        container.innerHTML = `
            <div style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                <div>
                    <span style="color: rgba(255,255,255,0.6); font-size: 0.9rem;">
                        ${this.lessons.length} lessons available
                    </span>
                </div>
            </div>
            <div class="lessons-grid">
                ${this.lessons.map((lesson, index) => `
                    <div class="lesson-card ${lesson.completed ? 'completed' : ''}" 
                        data-lesson-id="${lesson._id}"
                        onclick="window.classManager.viewLesson('${lesson._id}')" style="color:black;">
                        <div class="lesson-number">Lesson ${index + 1}</div>
                        <h4>${this.escapeHtml(lesson.title)}</h4>
                        <p>${this.escapeHtml(lesson.description || 'No description')}</p>
                        <div class="lesson-meta">
                            <span>⏱️ ${lesson.estimatedTime || 0} min</span>
                            <span>📝 ${lesson.contentItems?.length || 0} items</span>
                            ${lesson.completed ? '<span class="completed-badge">✅ Completed</span>' : ''}
                        </div>
                        ${lesson.progressPercentage > 0 && !lesson.completed ? `
                            <div class="progress-bar" style="margin-top: 8px; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden;">
                                <div class="progress-fill" style="width: ${lesson.progressPercentage}%; height: 100%; background: linear-gradient(90deg, #8B5FBF, #6C3CE1); border-radius: 2px;"></div>
                            </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        `;
    }

  /**
 * View a specific lesson in detail
 */
async viewLesson(lessonId) {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            window.showToast('Please login to view lesson', true);
            window.location.href = 'login.html';
            return;
        }

        console.log('Viewing lesson:', lessonId);

        const response = await fetch(`https://fissk-backend.onrender.com/api/lessons/${lessonId}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.showToast('Session expired. Please login again.', true);
                window.location.href = 'login.html';
                return;
            }
            throw new Error('Failed to load lesson');
        }

        const data = await response.json();
        const lesson = data.lesson;

        console.log('Lesson data received:', lesson);
        console.log('Content items:', lesson.contentItems);

        // Ensure quiz and video items have proper IDs
        if (lesson.contentItems) {
            lesson.contentItems = lesson.contentItems.map(item => {
                if (item.type === 'quiz') {
                    const quizId = item.contentId || item.quizId || null;
                    console.log('Quiz item:', item, 'Quiz ID:', quizId);
                    return {
                        ...item,
                        contentId: quizId,
                        quizId: quizId,
                        quizDetails: {
                            ...item.quizDetails,
                            _id: quizId
                        }
                    };
                }
                if (item.type === 'video') {
                    // Ensure video has proper playback data
                    const playbackId = item.muxPlaybackId || item.videoDetails?.muxPlaybackId;
                    return {
                        ...item,
                        muxPlaybackId: playbackId,
                        videoDetails: {
                            ...item.videoDetails,
                            playbackUrl: playbackId ? `https://stream.mux.com/${playbackId}.m3u8` : null
                        }
                    };
                }
                return item;
            });
        }

        this.showLessonDetail(lesson);
    } catch (error) {
        console.error('View lesson error:', error);
        window.showToast('Failed to load lesson content', true);
    }
}
/**
 * Show lesson detail in a modal
 */
showLessonDetail(lesson) {
    console.log('Showing lesson detail:', lesson);
    console.log('Content items:', lesson.contentItems);

    let modal = document.getElementById('lessonDetailModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'lessonDetailModal';
        modal.className = 'modal';
        modal.style.display = 'none';
        document.body.appendChild(modal);
    }

    let itemsHTML = '';
    const totalItems = lesson.contentItems?.length || 0;

    const getQuizId = (item) => {
        return item.contentId || item.quizId?._id || item.quizId || null;
    };

    if (lesson.contentItems && lesson.contentItems.length > 0) {
        itemsHTML = lesson.contentItems.map((item, index) => {
            let itemContent = '';
            
            console.log('Rendering item:', item.type, item);

            switch (item.type) {
                case 'text':
                    itemContent = `
                        <div class="item-text-content" style="color: rgba(255,255,255,0.9); white-space: pre-wrap;">${this.escapeHtml(item.content || '')}</div>
                    `;
                    break;
                case 'video':
                    // Get video URL from multiple possible sources
                    const videoUrl = item.videoDetails?.playbackUrl || 
                                    (item.muxPlaybackId ? `https://stream.mux.com/${item.muxPlaybackId}.m3u8` : null) ||
                                    (item.videoDetails?.muxPlaybackId ? `https://stream.mux.com/${item.videoDetails.muxPlaybackId}.m3u8` : null);
                    
                    const isReady = item.muxStatus === 'ready' || item.videoDetails?.muxStatus === 'ready';
                    const thumbnailUrl = item.thumbnailUrl || item.videoDetails?.thumbnailUrl;
                    
                    console.log('Video URL:', videoUrl);
                    console.log('Is ready:', isReady);
                    
                    itemContent = `
                        <div class="item-video-wrapper">
                            ${videoUrl && isReady ? `
                                <video controls style="max-width: 100%; border-radius: 8px; width: 100%;">
                                    <source src="${videoUrl}" type="application/x-mpegURL">
                                    Your browser does not support the video tag.
                                </video>
                            ` : `
                                <div style="background: rgba(255,255,255,0.05); padding: 30px; border-radius: 8px; text-align: center; color: rgba(255,255,255,0.5);">
                                    <span style="font-size: 2rem; display: block; margin-bottom: 8px;">🎬</span>
                                    <p>${videoUrl ? 'Video is processing...' : 'Video not available'}</p>
                                    ${item.title ? `<p style="font-size: 0.85rem; margin-top: 4px;">${this.escapeHtml(item.title)}</p>` : ''}
                                </div>
                            `}
                        </div>
                        ${item.content ? `<p style="margin-top: 8px; color: rgba(255,255,255,0.7);">${this.escapeHtml(item.content)}</p>` : ''}
                    `;
                    break;
                case 'quiz':
                    const quizId = getQuizId(item);
                    const quizDetails = item.quizDetails || {};
                    
                    console.log('Quiz item:', item);
                    console.log('Quiz ID:', quizId);
                    console.log('Quiz Details:', quizDetails);
                    
                    itemContent = `
                        <div class="item-quiz-wrapper">
                            ${quizId ? `
                                <a href="quiz/take.html?quizId=${quizId}" 
                                   class="btn btn-primary" 
                                   style="margin-right: 8px; background: #8B5FBF; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; display: inline-block;">
                                    📝 Take Quiz
                                </a>
                                <span style="color: rgba(255,255,255,0.4); font-size: 0.85rem; margin-left: 8px;">
                                    ${quizDetails.questionCount || 0} questions
                                </span>
                            ` : `
                                <div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 8px; text-align: center; color: rgba(255,255,255,0.4);">
                                    <span style="font-size: 1.5rem; display: block; margin-bottom: 4px;">📝</span>
                                    <p>Quiz not available</p>
                                </div>
                            `}
                            ${item.content ? `<p style="margin-top: 8px; color: rgba(255,255,255,0.7);">${this.escapeHtml(item.content)}</p>` : ''}
                        </div>
                    `;
                    break;
                case 'material':
                    itemContent = `
                        <div class="item-material-wrapper">
                            ${item.fileUrl ? `
                                <a href="${item.fileUrl}" class="btn btn-outline" download style="margin-right: 8px; color: #8B5FBF; border: 1px solid #8B5FBF; padding: 8px 16px; border-radius: 8px; text-decoration: none; display: inline-block;">
                                    📥 Download ${item.fileName || 'File'}
                                </a>
                            ` : '<p style="color: rgba(255,255,255,0.5);">Material not available</p>'}
                            ${item.content ? `<p style="margin-top: 8px; color: rgba(255,255,255,0.7);">${this.escapeHtml(item.content)}</p>` : ''}
                        </div>
                    `;
                    break;
                case 'link':
                    itemContent = `
                        <div class="item-link-wrapper">
                            <a href="${item.linkUrl}" target="${item.linkTarget || '_blank'}" class="btn btn-outline" style="color: #8B5FBF; border: 1px solid #8B5FBF; padding: 8px 16px; border-radius: 8px; text-decoration: none; display: inline-block;">
                                🔗 ${this.escapeHtml(item.title || 'Open Link')}
                            </a>
                            ${item.content ? `<p style="margin-top: 8px; color: rgba(255,255,255,0.7);">${this.escapeHtml(item.content)}</p>` : ''}
                        </div>
                    `;
                    break;
                case 'embed':
                    itemContent = `
                        <div class="item-embed-wrapper">
                            ${item.embedCode ? item.embedCode : ''}
                            ${item.content ? `<p style="margin-top: 8px; color: rgba(255,255,255,0.7);">${this.escapeHtml(item.content)}</p>` : ''}
                        </div>
                    `;
                    break;
                default:
                    itemContent = `<p style="color: rgba(255,255,255,0.5);">Content type not supported</p>`;
            }

            const typeLabels = {
                'text': 'Text',
                'video': 'Video',
                'quiz': 'Quiz',
                'material': 'Material',
                'link': 'Link',
                'embed': 'Embed'
            };

            const typeColors = {
                'text': '#3B82F6',
                'video': '#EF4444',
                'quiz': '#F59E0B',
                'material': '#10B981',
                'link': '#8B5FBF',
                'embed': '#6B7280'
            };

            return `
                <div class="lesson-content-item" data-item-index="${index}" style="background: rgba(255,255,255,0.06); border-radius: 12px; padding: 20px; border-left: 4px solid ${typeColors[item.type] || '#8B5FBF'}; margin-bottom: 16px;">
                    <div class="item-header" style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                        <span class="item-type-badge ${item.type}" style="display: inline-block; padding: 2px 12px; border-radius: 20px; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; background: ${typeColors[item.type] || '#6B7280'}; color: white;">
                            ${typeLabels[item.type] || item.type}
                        </span>
                        ${item.isRequired ? '<span style="font-size: 0.7rem; color: rgba(255,255,255,0.3);">Required</span>' : '<span style="font-size: 0.7rem; color: rgba(255,255,255,0.3);">Optional</span>'}
                    </div>
                    ${item.title ? `<div class="item-title" style="font-size: 1rem; font-weight: 600; color: white;">${this.escapeHtml(item.title)}</div>` : ''}
                    ${itemContent}
                    <div class="item-footer" style="margin-top: 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                        ${item.duration ? `<span class="item-duration" style="font-size: 0.8rem; color: rgba(255,255,255,0.5);">⏱️ ${item.duration} min</span>` : ''}
                        <button class="item-complete-btn incomplete" data-item-index="${index}" style="padding: 4px 16px; border-radius: 20px; font-size: 0.8rem; border: none; cursor: pointer; background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.6); border: 1px solid rgba(255,255,255,0.2);">
                            Mark as Read
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    } else {
        itemsHTML = '<p style="color: rgba(255,255,255,0.5); text-align: center; padding: 20px;">No content items in this lesson.</p>';
    }

    const progress = lesson.progressPercentage || 0;

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 800px; max-height: 90vh; overflow-y: auto; background: #1A1A2E; border-radius: 16px; padding: 32px; border: 1px solid rgba(255,255,255,0.1); position: relative;">
            <span class="close-modal" onclick="document.getElementById('lessonDetailModal').style.display='none'" style="position: absolute; top: 15px; right: 20px; font-size: 2rem; cursor: pointer; color: rgba(255,255,255,0.6); transition: color 0.3s ease; z-index: 10;">&times;</span>
            
            <div style="margin-bottom: 16px;">
                <h2 style="color: white; margin: 0;">${this.escapeHtml(lesson.title)}</h2>
                ${lesson.description ? `<p style="color: rgba(255,255,255,0.6); margin-top: 4px;">${this.escapeHtml(lesson.description)}</p>` : ''}
            </div>

            <div class="lesson-progress-container" style="background: rgba(255,255,255,0.08); border-radius: 12px; padding: 16px 20px; margin-bottom: 20px;">
                <div class="progress-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                    <h4 style="color: white; font-size: 1rem; margin: 0;">📊 Lesson Progress</h4>
                    <span style="color: rgba(255,255,255,0.7); font-size: 0.9rem;">${progress}% complete</span>
                </div>
                <div class="progress-bar" style="height: 6px; background: rgba(255,255,255,0.1); border-radius: 4px; overflow: hidden; margin-top: 8px;">
                    <div class="progress-fill" style="width: ${progress}%; height: 100%; background: linear-gradient(90deg, #8B5FBF, #6C3CE1); border-radius: 4px; transition: width 0.5s ease;"></div>
                </div>
            </div>

            <div class="lesson-content-items" style="display: flex; flex-direction: column; gap: 16px;">
                ${itemsHTML}
            </div>

            <button class="mark-lesson-complete-btn ${lesson.completed ? 'completed' : 'available'}" 
                    id="markLessonCompleteBtn"
                    ${lesson.completed ? 'disabled' : ''}
                    style="padding: 12px 32px; border-radius: 10px; font-size: 1rem; font-weight: 600; border: none; cursor: pointer; transition: all 0.3s ease; width: 100%; margin-top: 20px; ${lesson.completed ? 'background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.6); cursor: default;' : 'background: #10B981; color: white;'}">
                ${lesson.completed ? '✅ Lesson Completed' : '✅ Mark Lesson as Complete'}
            </button>
        </div>
    `;

    modal.style.display = 'flex';

    const completeBtn = document.getElementById('markLessonCompleteBtn');
    if (completeBtn && !lesson.completed) {
        completeBtn.addEventListener('click', () => {
            this.markLessonComplete(lesson._id);
        });
    }

    modal.querySelectorAll('.item-complete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const itemIndex = parseInt(btn.dataset.itemIndex);
            this.toggleItemComplete(lesson._id, itemIndex, btn);
        });
    });
}
    /**
     * Mark a lesson as complete
     */
    async markLessonComplete(lessonId) {
        try {
            const response = await fetch(`https://fissk-backend.onrender.com/api/lessons/${lessonId}/complete`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to mark lesson as complete');
            }

            const data = await response.json();
            window.showToast('✅ Lesson completed!', false);

            // Close modal and refresh
            const modal = document.getElementById('lessonDetailModal');
            if (modal) modal.style.display = 'none';

            // Refresh lessons
            await this.loadLessons();
            this.renderLessons();

        } catch (error) {
            console.error('Mark complete error:', error);
            window.showToast('Failed to mark lesson as complete', true);
        }
    }

    /**
     * Toggle individual item completion
     */
    async toggleItemComplete(lessonId, itemIndex, button) {
        try {
            // For now, just toggle the UI state
            // In a full implementation, you'd call an API to mark individual items
            const isCompleted = button.textContent.includes('Completed');
            if (isCompleted) {
                button.textContent = 'Mark as Read';
                button.className = 'item-complete-btn incomplete';
            } else {
                button.textContent = '✅ Completed';
                button.className = 'item-complete-btn completed';
            }

            // Show toast
            window.showToast('Item marked as read', false);

        } catch (error) {
            console.error('Toggle item error:', error);
            window.showToast('Failed to update item', true);
        }
    }

    /**
     * Load lessons with detailed content
     */
    async loadLessons() {
        try {
            const response = await fetch(`https://fissk-backend.onrender.com/api/lessons/class/${this.classId}`, {
                headers: { 
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load lessons');
            }

            const data = await response.json();
            this.lessons = data.lessons || [];
            console.log('Lessons loaded:', this.lessons.length);

            // Update lesson progress in sidebar
            this.updateLessonProgressSidebar();

        } catch (error) {
            console.error('Error loading lessons:', error);
            this.lessons = [];
        }
    }

    /**
     * Update lesson progress in sidebar
     */
    updateLessonProgressSidebar() {
        if (!this.lessons || this.lessons.length === 0) return;

        const completed = this.lessons.filter(l => l.completed).length;
        const total = this.lessons.length;
        const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

        const progressBar = document.getElementById('classProgress');
        const progressText = document.getElementById('progressText');

        if (progressBar && progressText) {
            // Don't override if we have better progress data
            const currentProgress = parseInt(progressBar.style.width) || 0;
            if (progress > currentProgress) {
                progressBar.style.width = `${progress}%`;
                progressText.textContent = `${progress}% Complete`;
            }
        }
    }

    // ============================================================
    // ENROLLMENT METHOD
    // ============================================================

    async handleEnrollment() {
        if (this.isEnrolled) {
            window.showToast('You are already enrolled in this class!', false);
            return;
        }

        if (!this.user || !this.user.email) {
            window.showToast('Please login to enroll in this class', true);
            window.location.href = 'login.html';
            return;
        }

        const enrollBtn = document.getElementById('enrollBtn');
        if (enrollBtn) {
            enrollBtn.disabled = true;
            enrollBtn.textContent = '⏳ Processing...';
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
                this.renderPriceAndPayment();
                window.showToast('Successfully enrolled in the class! 🎉', false);
                setTimeout(() => location.reload(), 1500);
            } else {
                const error = await response.json();
                throw new Error(error.message || 'Enrollment failed');
            }
        } catch (error) {
            console.error('Error enrolling in class:', error);
            window.showToast(error.message || 'Failed to enroll in class. Please try again.', true);
            if (enrollBtn) {
                enrollBtn.disabled = false;
                enrollBtn.textContent = '📝 Enroll Now';
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
            max-width: 90%;
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
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