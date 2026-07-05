// instructor-class-details.js
class InstructorClassDetails {
    constructor() {
        // Get classId from URL
        const urlParams = new URLSearchParams(window.location.search);
        this.classId = urlParams.get('id');
        this.currentUser = JSON.parse(localStorage.getItem('user'));
        this.token = localStorage.getItem('token');
        this.currentVideoIndex = 0;
        this.videos = [];
        this.streams = [];
        this.baseUrl = 'https://fissk-backend.onrender.com'; // Your backend URL
        
        // Redirect if no user
        if (!this.currentUser) {
            window.location.href = 'login.html';
            return;
        }
        
        // Redirect if no class ID
        if (!this.classId || this.classId === 'undefined' || this.classId === 'null') {
            this.showMessage('❌ No class selected. Redirecting...', 'error');
            setTimeout(() => {
                window.location.href = 'instructor-dashboard.html';
            }, 2000);
            return;
        }
        
        this.init();
    }

    async init() {
        try {
            await this.loadClass();
            await this.loadVideos();
            await this.loadStudents();
            await this.loadStreams();
            this.bindTabs();
            this.setupEventHandlers();
        } catch (error) {
            console.error('Init error:', error);
            this.showMessage('❌ Failed to load class details', 'error');
        }
    }

    headers() {
        return {
            'Content-Type': 'application/json',
        };
    }

    // ===== SPINNER HELPERS =====
    showButtonSpinner(button, loadingText = 'Loading...') {
        if (!button) return;
        button.disabled = true;
        button.dataset.originalText = button.textContent;
        button.innerHTML = `
            <span class="spinner"></span>
            ${loadingText}
        `;
    }

    hideButtonSpinner(button, originalText = null) {
        if (!button) return;
        button.disabled = false;
        button.textContent = originalText || button.dataset.originalText || 'Submit';
    }

    showMessage(message, type = 'success') {
        const existing = document.querySelector('.custom-toast');
        if (existing) existing.remove();

        const messageEl = document.createElement('div');
        messageEl.className = `custom-toast toast-${type}`;
        messageEl.textContent = message;
        messageEl.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            padding: 16px 24px;
            border-radius: 12px;
            color: white;
            background: ${type === 'success' ? '#10B981' : type === 'error' ? '#EF4444' : '#6C3CE1'};
            z-index: 10000;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            font-weight: 500;
            font-size: 0.95rem;
            max-width: 400px;
            animation: slideInRight 0.3s ease;
        `;
        document.body.appendChild(messageEl);
        
        setTimeout(() => {
            messageEl.style.opacity = '0';
            messageEl.style.transform = 'translateX(100px)';
            messageEl.style.transition = 'all 0.3s ease';
            setTimeout(() => messageEl.remove(), 300);
        }, 4000);
    }

    bindTabs() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
                const tabId = btn.dataset.tab + 'Tab';
                const tabContent = document.getElementById(tabId);
                if (tabContent) tabContent.classList.add('active');
            };
        });
    }

    setupEventHandlers() {
        // Upload Video Button
        const uploadBtn = document.getElementById('uploadVideoBtn');
        if (uploadBtn) {
            uploadBtn.addEventListener('click', () => {
                this.showMessage('📹 Please use the live stream recording feature to upload videos', 'info');
            });
        }

        // Schedule Stream Button
        const scheduleBtn = document.getElementById('scheduleStreamBtn');
        if (scheduleBtn) {
            scheduleBtn.addEventListener('click', () => {
                document.getElementById('scheduleStreamModal').style.display = 'flex';
            });
        }

        // Upload Material Button
        const materialBtn = document.getElementById('uploadMaterialBtn');
        if (materialBtn) {
            materialBtn.addEventListener('click', () => {
                this.showMessage('📚 Upload material feature coming soon!', 'info');
            });
        }

        // Edit Class Button
        const editBtn = document.getElementById('editClassBtn');
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                this.openEditModal();
            });
        }

        // Delete Class Button
        const deleteBtn = document.getElementById('deleteClassBtn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async () => {
                if (confirm('Are you sure you want to delete this class? This action cannot be undone and will delete all associated data.')) {
                    await this.deleteClass();
                }
            });
        }

        // Modal close
        document.querySelectorAll('.close-modal').forEach(el => {
            el.addEventListener('click', () => {
                const modal = el.closest('.modal');
                if (modal) modal.style.display = 'none';
            });
        });

        // Close modal on outside click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        });

        // ESC key to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal').forEach(modal => {
                    if (modal.style.display === 'flex') {
                        modal.style.display = 'none';
                        const videoPlayer = document.getElementById('videoPlayer');
                        if (videoPlayer) {
                            videoPlayer.pause();
                            videoPlayer.currentTime = 0;
                        }
                    }
                });
            }
        });

        // Schedule Stream Form
        const scheduleForm = document.getElementById('scheduleStreamForm');
        if (scheduleForm) {
            scheduleForm.addEventListener('submit', async (ev) => {
                ev.preventDefault();
                await this.scheduleStream();
            });
        }

        // Edit Class Form
        const editForm = document.getElementById('editClassForm');
        if (editForm) {
            editForm.addEventListener('submit', async (ev) => {
                ev.preventDefault();
                await this.updateClass();
            });
        }
    }

    // ===== LOAD CLASS DETAILS =====
    async loadClass() {
        try {
            const url = `${this.baseUrl}/register/instructor/classes/${this.classId}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: this.headers(),
                body: JSON.stringify({ id: this.currentUser.id })
            });
            
            if (!res.ok) {
                throw new Error('Failed to load class details');
            }
            
            const c = await res.json();

            document.getElementById('className').textContent = c.title || 'Untitled Class';
            document.getElementById('classDescription').textContent = c.description || 'No description available';
            document.getElementById('classCategory').textContent = c.category || 'General';
            document.getElementById('classLevel').textContent = c.level || 'Beginner';
            document.getElementById('classDuration').textContent = c.duration || 'Self-paced';
            document.getElementById('classStudents').textContent = `👥 ${c.student_count || 0} Students`;
            
            // Store for edit modal
            this.classData = c;
        } catch (error) {
            console.error('Load class error:', error);
            this.showMessage('❌ Failed to load class details', 'error');
        }
    }

    // ===== LOAD VIDEOS =====
    async loadVideos() {
        const container = document.getElementById('videosContainer');
        if (!container) return;

        try {
            // Use the /api/by-class/:classId endpoint
            const url = `${this.baseUrl}/api/by-class/${this.classId}`;
            const res = await fetch(url, {
                headers: this.headers()
            });
            
            if (!res.ok) {
                throw new Error('Failed to load videos');
            }
            
            const videos = await res.json();
            this.videos = Array.isArray(videos) ? videos : [];

            if (this.videos.length === 0) {
                container.innerHTML = `
                    <div class="no-content" style="grid-column: 1 / -1; text-align: center; padding: 40px;">
                        <p style="font-size: 1.2rem; color: #999;">🎥 No videos uploaded yet</p>
                        <p style="color: #bbb;">Record your live sessions to add videos here</p>
                    </div>
                `;
                return;
            }

            container.innerHTML = this.videos.map((video, index) => {
                const videoTitle = video.classTitle || video.videoDetails?.title || video.title || 'Untitled Video';
                const videoDesc = video.classDescription || video.videoDetails?.description || video.description || 'No description';
                const playbackId = video.muxPlaybackId || video.playbackId || video.videoDetails?.playbackId;
                const thumbnailUrl = playbackId ? `https://image.mux.com/${playbackId}/thumbnail.jpg?time=5` : null;
                const videoId = video._id || video.id || index;
                
                return `
                    <div class="video-card" data-video-index="${index}" data-video-id="${videoId}">
                        <div class="video-thumbnail" style="background: linear-gradient(135deg, #8B5FBF, #6C63FF); position: relative;">
                            ${thumbnailUrl ? 
                                `<img src="${thumbnailUrl}" alt="${videoTitle}" style="width:100%;height:100%;object-fit:cover;">` : 
                                `<span style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 3rem; color: rgba(255,255,255,0.5);">🎬</span>`
                            }
                            <span style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 2rem; color: white; opacity: 0.8;">▶</span>
                            ${video.muxStatus === 'preparing' ? 
                                `<span style="position: absolute; bottom: 10px; right: 10px; background: #F59E0B; color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.7rem;">⏳ Processing</span>` : 
                                `<span style="position: absolute; bottom: 10px; right: 10px; background: #10B981; color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.7rem;">✅ Ready</span>`
                            }
                        </div>
                        <div class="video-info">
                            <h4>${this.escapeHtml(videoTitle)}</h4>
                            <p>${this.escapeHtml(videoDesc)}</p>
                            <div class="video-meta" style="display: flex; gap: 12px; font-size: 0.8rem; color: #999; margin-top: 8px;">
                                <span>⏱️ ${video.duration || video.videoDetails?.duration || 'Unknown'}</span>
                                <span>📅 ${video.createdAt ? new Date(video.createdAt).toLocaleDateString() : video.videoDetails?.date ? new Date(video.videoDetails.date).toLocaleDateString() : 'Unknown date'}</span>
                                ${playbackId ? `<span>🔗 <a href="https://stream.mux.com/${playbackId}.m3u8" target="_blank" style="color: #8B5FBF;">HLS</a></span>` : ''}
                            </div>
                        </div>
                        <div style="padding: 0 15px 15px; display: flex; gap: 8px;">
                            ${playbackId ? `
                                <button class="btn btn-primary btn-sm play-video-btn" data-video-index="${index}" style="flex: 1; background: #8B5FBF; color: white; border: none; padding: 8px; border-radius: 8px; cursor: pointer;">
                                    ▶ Play
                                </button>
                            ` : ''}
                            <button class="btn btn-danger btn-sm delete-video-btn" data-video-id="${videoId}" style="flex: 1; background: #EF4444; color: white; border: none; padding: 8px; border-radius: 8px; cursor: pointer;">
                                🗑️ Delete
                            </button>
                        </div>
                    </div>
                `;
            }).join('');

            // Add click handlers for video playback
            container.querySelectorAll('.play-video-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const index = parseInt(btn.dataset.videoIndex);
                    this.playVideo(index);
                });
            });

            // Click on card to play
            container.querySelectorAll('.video-card').forEach(card => {
                card.addEventListener('click', (e) => {
                    if (e.target.closest('.delete-video-btn') || e.target.closest('.play-video-btn')) return;
                    const index = parseInt(card.dataset.videoIndex);
                    this.playVideo(index);
                });
            });

            // Add delete handlers
            container.querySelectorAll('.delete-video-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const videoId = btn.dataset.videoId;
                    if (confirm('Are you sure you want to delete this video?')) {
                        await this.deleteVideo(videoId);
                    }
                });
            });

        } catch (error) {
            console.error('Load videos error:', error);
            container.innerHTML = `
                <div class="no-content" style="grid-column: 1 / -1; text-align: center; padding: 40px;">
                    <p style="color: #EF4444;">❌ Failed to load videos</p>
                    <p style="color: #999; font-size: 0.9rem;">${error.message}</p>
                </div>
            `;
        }
    }

    // ===== PLAY VIDEO =====
    playVideo(videoIndex) {
        const video = this.videos[videoIndex];
        if (!video) {
            this.showMessage('❌ Video not found', 'error');
            return;
        }

        const playbackId = video.muxPlaybackId || video.playbackId || video.videoDetails?.playbackId;
        if (!playbackId) {
            this.showMessage('❌ Video playback URL not available', 'error');
            return;
        }

        const modal = document.getElementById('videoModal');
        const videoPlayer = document.getElementById('videoPlayer');
        const videoTitle = document.getElementById('videoTitle');
        const videoDescription = document.getElementById('videoDescription');
        
        if (!modal || !videoPlayer) {
            console.error('Video modal elements not found');
            return;
        }
        
        // Use HLS.js for Mux videos
        const hlsUrl = `https://stream.mux.com/${playbackId}.m3u8`;
        
        if (Hls && Hls.isSupported()) {
            const hls = new Hls();
            hls.loadSource(hlsUrl);
            hls.attachMedia(videoPlayer);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                videoPlayer.play().catch(() => {});
            });
            videoPlayer.hls = hls;
        } else if (videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
            videoPlayer.src = hlsUrl;
            videoPlayer.play().catch(() => {});
        } else {
            videoPlayer.src = hlsUrl;
            videoPlayer.play().catch(() => {});
        }
        
        videoTitle.textContent = video.classTitle || video.videoDetails?.title || video.title || 'Untitled Video';
        videoDescription.textContent = video.classDescription || video.videoDetails?.description || video.description || 'No description';

        modal.style.display = 'flex';

        const closeModal = () => {
            modal.style.display = 'none';
            if (videoPlayer.hls) {
                videoPlayer.hls.destroy();
            }
            videoPlayer.pause();
            videoPlayer.currentTime = 0;
            videoPlayer.src = '';
        };

        const closeBtn = modal.querySelector('.close-modal');
        if (closeBtn) {
            closeBtn.onclick = closeModal;
        }

        modal.onclick = (e) => {
            if (e.target === modal) closeModal();
        };
    }

    // ===== DELETE VIDEO =====
    async deleteVideo(videoId) {
        try {
            const btn = document.querySelector(`.delete-video-btn[data-video-id="${videoId}"]`);
            if (btn) this.showButtonSpinner(btn, 'Deleting...');

            if (!videoId || videoId === 'undefined' || videoId === 'null') {
                this.showMessage('❌ Invalid video ID', 'error');
                return;
            }

            if (!this.currentUser || !this.currentUser.id) {
                this.showMessage('❌ You must be logged in', 'error');
                return;
            }

            const url = `${this.baseUrl}/register/instructor/videos/${videoId}`;
            const res = await fetch(url, {
                method: 'DELETE',
                headers: this.headers(),
                body: JSON.stringify({ id: this.currentUser.id })
            });

            const data = await res.json();

            if (!res.ok || !data.ok) {
                throw new Error(data.message || 'Failed to delete video');
            }

            this.showMessage('✅ Video deleted successfully!', 'success');
            await this.loadVideos();

        } catch (error) {
            console.error('Delete video error:', error);
            this.showMessage('❌ ' + (error.message || 'Failed to delete video'), 'error');
        } finally {
            const btn = document.querySelector(`.delete-video-btn[data-video-id="${videoId}"]`);
            if (btn) this.hideButtonSpinner(btn, '🗑️ Delete');
        }
    }

    // ===== LOAD STUDENTS =====
    async loadStudents() {
        const container = document.getElementById('studentsContainer');
        if (!container) return;

        try {
            const url = `${this.baseUrl}/register/instructor/classes/${this.classId}/students`;
            const res = await fetch(url, {
                headers: this.headers()
            });
            
            if (!res.ok) {
                throw new Error('Failed to load students');
            }
            
            const students = await res.json();

            if (!students || students.length === 0) {
                container.innerHTML = `
                    <div class="no-content" style="text-align: center; padding: 40px;">
                        <p style="font-size: 1.2rem; color: #999;">👥 No students enrolled yet</p>
                        <p style="color: #bbb;">Share your class link to get started</p>
                    </div>
                `;
                return;
            }

            container.innerHTML = `
                <table class="enrollments-table" style="width: 100%; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06);">
                    <thead style="background: #f8f9fa;">
                        <tr>
                            <th style="padding: 16px; text-align: left; font-weight: 600; color: #2D3748;">Student</th>
                            <th style="padding: 16px; text-align: left; font-weight: 600; color: #2D3748;">Email</th>
                            <th style="padding: 16px; text-align: left; font-weight: 600; color: #2D3748;">Joined</th>
                            <th style="padding: 16px; text-align: left; font-weight: 600; color: #2D3748;">Progress</th>
                            <th style="padding: 16px; text-align: left; font-weight: 600; color: #2D3748;">Last Accessed</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${students.map(s => `
                            <tr style="border-bottom: 1px solid #f0f0f0;">
                                <td style="padding: 16px;">${this.escapeHtml(s.first_name || '')} ${this.escapeHtml(s.last_name || '')}</td>
                                <td style="padding: 16px;">${this.escapeHtml(s.email || '—')}</td>
                                <td style="padding: 16px;">${s.enrolled_at ? new Date(s.enrolled_at).toLocaleDateString() : '—'}</td>
                                <td style="padding: 16px;">
                                    <div style="display: flex; align-items: center; gap: 10px;">
                                        <div class="progress-bar" style="flex: 1; background: #e2e8f0; height: 8px; border-radius: 4px; overflow: hidden;">
                                            <div class="progress-fill" style="width: ${s.progress || 0}%; background: #8B5FBF; height: 100%; border-radius: 4px;"></div>
                                        </div>
                                        <span style="font-size: 0.85rem; color: #4a5568; min-width: 40px;">${s.progress || 0}%</span>
                                    </div>
                                </td>
                                <td style="padding: 16px;">${s.last_accessed ? new Date(s.last_accessed).toLocaleDateString() : 'Never'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } catch (error) {
            console.error('Load students error:', error);
            container.innerHTML = `
                <div class="no-content" style="text-align: center; padding: 40px;">
                    <p style="color: #EF4444;">❌ Failed to load students</p>
                </div>
            `;
        }
    }

    // ===== LOAD STREAMS =====
    async loadStreams() {
        const container = document.getElementById('streamsContainer');
        if (!container) return;

        try {
            const url = `${this.baseUrl}/register/instructor/classes/${this.classId}/streams`;
            const res = await fetch(url, {
                headers: this.headers()
            });
            
            if (!res.ok) {
                throw new Error('Failed to load streams');
            }
            
            const streams = await res.json();
            this.streams = Array.isArray(streams) ? streams : [];

            if (this.streams.length === 0) {
                container.innerHTML = `
                    <div class="no-content" style="text-align: center; padding: 40px;">
                        <p style="font-size: 1.2rem; color: #999;">📅 No scheduled streams</p>
                        <p style="color: #bbb;">Schedule your first live stream</p>
                    </div>
                `;
                return;
            }

            container.innerHTML = this.streams.map(s => `
                <div class="stream-card" style="background: white; padding: 20px; border-radius: 12px; margin-bottom: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.04); border: 1px solid #f0f0f0; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                    <div>
                        <h4 style="margin: 0 0 4px 0; color: #2D3748;">${this.escapeHtml(s.title)}</h4>
                        <p style="margin: 0; color: #718096; font-size: 0.9rem;">
                            📅 ${s.date ? new Date(s.date).toLocaleString() : 'TBD'}
                            ${s.time ? ` • ⏰ ${s.time}` : ''}
                        </p>
                        ${s.meetingId ? `<p style="margin: 4px 0 0 0; color: #8B5FBF; font-size: 0.8rem;">🔑 Meeting ID: ${s.meetingId}</p>` : ''}
                    </div>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        ${s.meetingId ? `
                            <button class="btn btn-sm btn-primary" onclick="window.open('newlivestream.html?meetingId=${s.meetingId}', '_blank')" style="background: #8B5FBF; color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer;">
                                🎥 Join
                            </button>
                        ` : ''}
                        <button class="btn btn-sm btn-danger cancel-stream-btn" data-stream-id="${s._id || s.id}" style="background: #EF4444; color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer;">
                            🗑️ Cancel
                        </button>
                    </div>
                </div>
            `).join('');

            container.querySelectorAll('.cancel-stream-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const streamId = btn.dataset.streamId;
                    if (confirm('Are you sure you want to cancel this stream?')) {
                        await this.cancelStream(streamId);
                    }
                });
            });

        } catch (error) {
            console.error('Load streams error:', error);
            container.innerHTML = `
                <div class="no-content" style="text-align: center; padding: 40px;">
                    <p style="color: #EF4444;">❌ Failed to load streams</p>
                </div>
            `;
        }
    }

    // ===== CANCEL STREAM =====
    async cancelStream(streamId) {
        try {
            const btn = document.querySelector(`.cancel-stream-btn[data-stream-id="${streamId}"]`);
            if (btn) this.showButtonSpinner(btn, 'Cancelling...');

            if (!streamId || streamId === 'undefined' || streamId === 'null') {
                this.showMessage('❌ Invalid stream ID', 'error');
                return;
            }

            if (!this.currentUser || !this.currentUser.id) {
                this.showMessage('❌ You must be logged in', 'error');
                return;
            }

            const url = `${this.baseUrl}/register/instructor/streams/${streamId}`;
            const res = await fetch(url, {
                method: 'DELETE',
                headers: this.headers(),
                body: JSON.stringify({ id: this.currentUser.id })
            });

            const data = await res.json();

            if (!res.ok || !data.ok) {
                throw new Error(data.message || 'Failed to cancel stream');
            }

            this.showMessage('✅ Stream cancelled successfully!', 'success');
            await this.loadStreams();

        } catch (error) {
            console.error('Cancel stream error:', error);
            this.showMessage('❌ ' + (error.message || 'Failed to cancel stream'), 'error');
        } finally {
            const btn = document.querySelector(`.cancel-stream-btn[data-stream-id="${streamId}"]`);
            if (btn) this.hideButtonSpinner(btn, '🗑️ Cancel');
        }
    }

    // ===== OPEN EDIT MODAL =====
    openEditModal() {
        if (!this.classData) {
            this.showMessage('❌ Class data not loaded', 'error');
            return;
        }

        document.getElementById('editClassModal').style.display = 'flex';
        document.getElementById('editClassName').value = this.classData.title || '';
        document.getElementById('editClassDescription').value = this.classData.description || '';
        document.getElementById('editClassCategory').value = this.classData.category || 'other';
        document.getElementById('editClassLevel').value = this.classData.level || 'beginner';
        document.getElementById('editClassDuration').value = this.classData.duration || '';
    }

    // ===== UPDATE CLASS =====
    async updateClass() {
        const editBtn = document.querySelector('#editClassForm button[type="submit"]');
        if (editBtn) this.showButtonSpinner(editBtn, 'Saving...');

        try {
            const payload = {
                title: document.getElementById('editClassName').value,
                description: document.getElementById('editClassDescription').value,
                category: document.getElementById('editClassCategory').value,
                level: document.getElementById('editClassLevel').value,
                duration: document.getElementById('editClassDuration').value,
            };

            if (!payload.title) {
                this.showMessage('❌ Class title is required', 'error');
                if (editBtn) this.hideButtonSpinner(editBtn, 'Save Changes');
                return;
            }

            const url = `${this.baseUrl}/register/instructor/classes/${this.classId}`;
            const res = await fetch(url, {
                method: 'PUT',
                headers: this.headers(),
                body: JSON.stringify({ 
                    id: this.currentUser.id,
                    payload: payload 
                })
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                throw new Error(data.message || 'Failed to update class');
            }

            this.showMessage('✅ Class updated successfully!', 'success');
            document.getElementById('editClassModal').style.display = 'none';
            
            // Reload class data
            await this.loadClass();

        } catch (error) {
            console.error('Update class error:', error);
            this.showMessage('❌ ' + (error.message || 'Failed to update class'), 'error');
        } finally {
            if (editBtn) this.hideButtonSpinner(editBtn, 'Save Changes');
        }
    }

    // ===== DELETE CLASS =====
    async deleteClass() {
        try {
            const deleteBtn = document.getElementById('deleteClassBtn');
            if (deleteBtn) this.showButtonSpinner(deleteBtn, 'Deleting...');

            if (!this.classId || this.classId === 'undefined' || this.classId === 'null') {
                this.showMessage('❌ Invalid class ID', 'error');
                return;
            }

            if (!this.currentUser || !this.currentUser.id) {
                this.showMessage('❌ You must be logged in', 'error');
                return;
            }

            const url = `${this.baseUrl}/register/instructor/classes/${this.classId}`;
            const res = await fetch(url, {
                method: 'DELETE',
                headers: this.headers(),
                body: JSON.stringify({ id: this.currentUser.id })
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                throw new Error(data.message || 'Failed to delete class');
            }

            this.showMessage('✅ ' + (data.message || 'Class deleted successfully!'), 'success');
            setTimeout(() => {
                window.location.href = 'instructor-dashboard.html';
            }, 1500);

        } catch (error) {
            console.error('Delete class error:', error);
            this.showMessage('❌ ' + (error.message || 'Failed to delete class'), 'error');
        } finally {
            const deleteBtn = document.getElementById('deleteClassBtn');
            if (deleteBtn) this.hideButtonSpinner(deleteBtn, 'Delete');
        }
    }

    // ===== SCHEDULE STREAM =====
    async scheduleStream() {
        const classId = document.getElementById('streamClass')?.value || this.classId;
        const title = document.getElementById('streamTitle')?.value;
        const description = document.getElementById('streamDescription')?.value;
        const scheduledTime = document.getElementById('streamDateTime')?.value;

        if (!title) {
            this.showMessage('Please enter a stream title', 'error');
            return;
        }

        if (!scheduledTime) {
            this.showMessage('Please select a date and time', 'error');
            return;
        }

        const submitBtn = document.querySelector('#scheduleStreamForm button[type="submit"]');
        if (submitBtn) this.showButtonSpinner(submitBtn, 'Scheduling...');

        try {
            const payload = {
                classId: this.classId,
                title: title,
                description: description || '',
                scheduledTime: scheduledTime
            };

            const url = `${this.baseUrl}/register/instructor/schedule-stream`;
            const res = await fetch(url, {
                method: 'POST',
                headers: this.headers(),
                body: JSON.stringify({
                    payload: payload,
                    id: this.currentUser.id
                })
            });

            const data = await res.json();

            if (!data.success) {
                throw new Error(data.message || 'Failed to schedule stream');
            }

            this.showMessage('✅ Stream scheduled successfully!', 'success');
            
            document.getElementById('scheduleStreamModal').style.display = 'none';
            document.getElementById('scheduleStreamForm').reset();
            
            await this.loadStreams();

        } catch (error) {
            console.error('Schedule stream error:', error);
            this.showMessage('❌ ' + (error.message || 'Failed to schedule stream'), 'error');
        } finally {
            if (submitBtn) this.hideButtonSpinner(submitBtn, 'Schedule Stream');
        }
    }

    // ===== UTILITY =====
    escapeHtml(s) {
        if (!s) return '';
        return String(s).replace(/[&<>"']/g, ch => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        })[ch]);
    }
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const classId = urlParams.get('id');
    
    if (!classId || classId === 'undefined' || classId === 'null') {
        const container = document.querySelector('.container');
        if (container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 80px 20px;">
                    <h2 style="color: #EF4444;">❌ No Class Selected</h2>
                    <p style="color: #666; margin: 20px 0;">Please select a class from your dashboard.</p>
                    <a href="instructor-dashboard.html" class="btn btn-primary" style="background: #8B5FBF; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none;">Go to Dashboard</a>
                </div>
            `;
        }
        return;
    }
    
    window.manager = new InstructorClassDetails();
});

// ===== ADD SPINNER STYLES =====
const spinnerStyle = document.createElement('style');
spinnerStyle.textContent = `
    .spinner {
        display: inline-block;
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255,255,255,0.3);
        border-radius: 50%;
        border-top-color: #fff;
        animation: spin 0.6s linear infinite;
        margin-right: 8px;
        vertical-align: middle;
    }
    
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
    
    @keyframes slideInRight {
        from { transform: translateX(100px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    .btn:disabled {
        opacity: 0.7;
        cursor: not-allowed;
    }
    
    .btn-danger:hover {
        opacity: 0.8;
        transform: translateY(-1px);
    }
    
    .video-card {
        cursor: pointer;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    
    .video-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 8px 30px rgba(0,0,0,0.1);
    }
    
    .video-thumbnail {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        min-height: 160px;
    }
    
    .video-thumbnail img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
    
    .no-content {
        grid-column: 1 / -1;
        text-align: center;
        padding: 60px 20px;
    }
    
    .modal {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        z-index: 9999;
        align-items: center;
        justify-content: center;
    }
    
    .modal.show {
        display: flex;
    }
    
    .modal-content {
        background: white;
        padding: 30px;
        border-radius: 16px;
        max-width: 800px;
        width: 90%;
        max-height: 90vh;
        overflow-y: auto;
        position: relative;
    }
    
    .video-modal video {
        width: 100%;
        border-radius: 8px;
        max-height: 70vh;
    }
    
    .close-modal {
        position: absolute;
        top: 15px;
        right: 20px;
        font-size: 2rem;
        cursor: pointer;
        color: #999;
        transition: color 0.3s ease;
        z-index: 10;
    }
    
    .close-modal:hover {
        color: #333;
    }

    .form-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 15px;
    }
    
    @media (max-width: 768px) {
        .form-row {
            grid-template-columns: 1fr;
        }
    }
`;
document.head.appendChild(spinnerStyle);