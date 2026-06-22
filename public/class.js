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
        
        // Refresh recordings tab when switched to it
        if (tabName === 'recordings' && this.recordings.length === 0) {
            this.loadClassRecordings().then(() => this.renderRecordings());
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

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ClassManager();
});

// User dropdown and navigation
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

// Mobile Navigation
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

// Add CSS for loading states and recordings
const style = document.createElement('style');
style.textContent = `
    .loading-pulse {
        background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
        background-size: 200% 100%;
        animation: loadingPulse 1.5s infinite;
        border-radius: 4px;
        height: 24px;
        width: 200px;
    }
    
    @keyframes loadingPulse {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
    }
    
    .loading-skeleton {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 20px;
    }
    
    .skeleton-card {
        background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
        background-size: 200% 100%;
        animation: loadingPulse 1.5s infinite;
        height: 200px;
        border-radius: 8px;
    }
    
    .no-data {
        color: #666;
        text-align: center;
        padding: 20px;
        font-style: italic;
    }
    
    .btn.enrolled {
        background: #48BB78;
        cursor: default;
    }
    
    .recording-card {
        background: white;
        border-radius: 12px;
        overflow: hidden;
        cursor: pointer;
        transition: transform 0.2s, box-shadow 0.2s;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    
    .recording-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 8px 20px rgba(0,0,0,0.15);
    }
    
    .recordings-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
        gap: 24px;
        padding: 10px 0;
    }
    
    .video-thumbnail {
        height: 180px;
        background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
    }
    
    .play-icon {
        font-size: 48px;
        color: white;
        opacity: 0.9;
        text-shadow: 0 2px 4px rgba(0,0,0,0.3);
        transition: transform 0.2s;
    }
    
    .recording-card:hover .play-icon,
    .video-card:hover .play-icon {
        transform: scale(1.1);
    }
    
    .video-info {
        padding: 16px;
    }
    
    .video-info h4 {
        margin: 0 0 8px 0;
        font-size: 1rem;
        color: var(--text-dark);
    }
    
    .video-info p {
        margin: 0 0 12px 0;
        font-size: 0.85rem;
        color: var(--text-light);
        line-height: 1.4;
    }
    
    .video-meta {
        display: flex;
        gap: 12px;
        font-size: 0.75rem;
        color: var(--text-light);
    }
    
    .video-meta span {
        display: flex;
        align-items: center;
        gap: 4px;
    }
    
    .video-card {
        background: white;
        border-radius: 12px;
        overflow: hidden;
        cursor: pointer;
        transition: transform 0.2s, box-shadow 0.2s;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    
    .video-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 8px 20px rgba(0,0,0,0.15);
    }
`;
document.head.appendChild(style);