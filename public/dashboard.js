    class DashboardManager {
        constructor() {
            this.user = this.getLocalUser();
            this.enrolledClasses = [];
            this.upcomingSessions = [];
            this.recordedSessions = [];
            this.init();
        }

        getLocalUser() {
            try {
                const user = JSON.parse(localStorage.getItem('user'));
                if (!user || !user.email) {
                    window.location.href = 'index.html';
                    return null;
                }
                return user;
            } catch (e) {
                window.location.href = 'index.html';
                return null;
            }
        }

        async init() {
            if (!this.user) return;
            this.setupEventListeners();
            this.updateDate();
            this.setupSectionNavigation();
            await this.loadDashboardData();
        }

        setupEventListeners() {
            document.querySelectorAll('.sidebar-link').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const section = e.target.dataset.section;
                    this.switchSection(section);
                });
            });

            document.querySelectorAll('.session-filter .filter-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    this.filterSessions(e.target.dataset.type);
                });
            });
        }

        switchSection(sectionName) {
            document.querySelectorAll('.sidebar-link').forEach(link => {
                link.classList.toggle('active', link.dataset.section === sectionName);
            });
            document.querySelectorAll('.content-section').forEach(section => {
                section.classList.toggle('active', section.id === sectionName);
            });
            this.currentSection = sectionName;
        }

        setupSectionNavigation() {
            const hash = window.location.hash.substring(1);
            if (hash && ['overview', 'classes', 'live'].includes(hash)) {
                this.switchSection(hash);
            }
        }

        updateDate() {
            const dateElement = document.getElementById('currentDate');
            if (dateElement) {
                const now = new Date();
                const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
                dateElement.textContent = now.toLocaleDateString('en-US', opts);
            }
        }

        async loadDashboardData() {
            try {
                this.updateUserName();
                await Promise.all([
                    this.loadEnrolledClasses(),
                    this.loadLiveSessions()
                ]);
            } catch (err) {
                console.error('Dashboard load error:', err);
                this.showError('Failed to load dashboard data. Please refresh the page.');
            }
        }

        updateUserName() {
            const name = this.user.firstname || this.user.email.split('@')[0] || 'Student';
            document.getElementById('name').textContent = name;
            document.getElementById('user-dropdown').innerHTML = `
                <img src="https://ui-avatars.com/api/?name=${this.user.firstname || ''}+${this.user.lastname || ''}&background=8B5FBF&color=fff" alt="User" class="user-avatar">
                <span>${name}</span>
                <div class="dropdown-content">
                    <a href="#" class="logout" onclick="logout()">Logout</a>
                </div>`;
        }

        async loadEnrolledClasses() {
            try {
                const response = await fetch('https://fissk-backend.onrender.com/register/get-user-classes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: this.user.email })
                });

                if (!response.ok) throw new Error('Failed to load classes');
                
                const data = await response.json();
                this.enrolledClasses = Array.isArray(data.classes) ? data.classes : [];
                
                this.updateStats();
                this.renderEnrolledClasses();
                this.renderContinueLearning();
                this.renderRecentActivity();
            } catch (error) {
                console.error('Load enrolled classes error:', error);
                this.showNoClassesMessage();
            }
        }

        async loadLiveSessions() {
            try {
                const response = await fetch('https://fissk-backend.onrender.com/register/dashboard/live-sessions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: this.user.id })
                });

                if (!response.ok) throw new Error('Failed to load live sessions');
                
                const data = await response.json();
                this.upcomingSessions = Array.isArray(data.upcoming) ? data.upcoming : [];
                this.recordedSessions = Array.isArray(data.recorded) ? data.recorded : [];
                
                document.getElementById('stat-upcoming').textContent = this.upcomingSessions.length;
                this.renderLiveSessions();
                this.renderOverviewLiveSessions();
            } catch (error) {
                console.error('Load live sessions error:', error);
                document.getElementById('stat-upcoming').textContent = '0';
                document.getElementById('liveSessionsGrid').innerHTML = '<p>No live sessions available.</p>';
            }
        }

        updateStats() {
            const enrolledCount = this.enrolledClasses.length;
            const avgProgress = enrolledCount > 0 
                ? Math.round(this.enrolledClasses.reduce((sum, c) => sum + (c.progress || 0), 0) / enrolledCount)
                : 0;
            
            document.getElementById('stat-enrolled').textContent = enrolledCount;
            document.getElementById('stat-avg-progress').textContent = avgProgress + '%';
        }

        renderEnrolledClasses() {
            const container = document.getElementById('enrolledClasses');
            const noClassesDiv = document.getElementById('noEnrolledClasses');
            
            if (!this.enrolledClasses.length) {
                container.style.display = 'none';
                noClassesDiv.style.display = 'block';
                return;
            }
            
            container.style.display = 'grid';
            noClassesDiv.style.display = 'none';
            
            container.innerHTML = this.enrolledClasses.map(classItem => `
                <div class="enrolled-class-card" data-class-id="${classItem.class_id || classItem._id}">
                    <div class="card-body">
                        <span class="class-category ${classItem.category || 'general'}">${(classItem.category || 'General').toUpperCase()}</span>
                        <h4>${this.escapeHtml(classItem.title)}</h4>
                        <div class="class-meta">
                            <span>🟢 ${classItem.level || 'Beginner'}</span>
                            <span>⏱️ ${classItem.duration || 'Self-paced'}</span>
                        </div>
                        <div class="class-progress">
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${classItem.progress || 0}%"></div>
                            </div>
                            <span>${classItem.progress || 0}% complete</span>
                        </div>
                        <div class="class-info">
                            <p><strong>Last accessed:</strong> ${classItem.last_accessed ? new Date(classItem.last_accessed).toLocaleDateString() : 'Not started'}</p>
                        </div>
                        <div class="class-actions">
                            <a href="class.html?id=${classItem.class_id || classItem._id}" class="btn btn-primary">Continue Learning</a>
                        </div>
                    </div>
                </div>
            `).join('');
        }

        renderContinueLearning() {
            const container = document.getElementById('continueClass');
            if (!container) return;
            
            const inProgress = this.enrolledClasses.filter(c => (c.progress || 0) < 100);
            if (!inProgress.length) {
                container.innerHTML = '<p>Great job! You\'ve completed all your classes. <a href="classes.html">Enroll in more</a></p>';
                return;
            }
            
            const nextClass = inProgress[0];
            container.innerHTML = `
                <div class="class-info">
                    <h4>${this.escapeHtml(nextClass.title)}</h4>
                    <p>${this.escapeHtml(nextClass.description || 'Continue where you left off')}</p>
                    <div class="progress-container">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${nextClass.progress || 0}%"></div>
                        </div>
                        <span>${nextClass.progress || 0}% complete</span>
                    </div>
                </div>
                <button class="btn btn-primary" onclick="location.href='class.html?id=${nextClass.class_id || nextClass._id}'">Continue</button>
            `;
        }

        renderRecentActivity() {
            const container = document.getElementById('recentActivity');
            if (!container) return;
            
            const recentClasses = [...this.enrolledClasses]
                .filter(c => c.last_accessed)
                .sort((a, b) => new Date(b.last_accessed) - new Date(a.last_accessed))
                .slice(0, 5);
            
            if (!recentClasses.length) {
                container.innerHTML = '<p>No recent activity. Start learning today!</p>';
                return;
            }
            
            container.innerHTML = recentClasses.map(classItem => `
                <div class="activity-item">
                    <div class="activity-icon">📚</div>
                    <div class="activity-details">
                        <strong>${this.escapeHtml(classItem.title)}</strong>
                        <p>Last accessed: ${new Date(classItem.last_accessed).toLocaleString()}</p>
                        <div class="progress-bar small">
                            <div class="progress-fill" style="width: ${classItem.progress || 0}%"></div>
                        </div>
                    </div>
                    <a href="class.html?id=${classItem.class_id || classItem._id}" class="btn btn-outline btn-small">Resume</a>
                </div>
            `).join('');
        }

renderLiveSessions() {
    const container = document.getElementById('liveSessionsGrid');
    if (!container) return;
    
    const upcomingHtml = this.upcomingSessions.length > 0 
        ? this.upcomingSessions.map(s => {
            const sessionDate = new Date(s.date);
            const now = new Date();
            const timeDiff = sessionDate - now;
            const daysLeft = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
            
            let countdownHtml = '';
            if (daysLeft > 0 && daysLeft <= 7) {
                countdownHtml = `<span class="session-countdown">⏰ ${daysLeft} day${daysLeft > 1 ? 's' : ''} left</span>`;
            } else if (daysLeft === 0) {
                countdownHtml = `<span class="session-countdown" style="background:#e74c3c;color:white;">🔴 Today!</span>`;
            } else if (daysLeft < 0) {
                countdownHtml = `<span class="session-countdown" style="background:#48BB78;color:white;">✅ Passed</span>`;
            }
            
            return `
                <div class="session-card upcoming">
                    <div class="session-header">
                        <h4>${this.escapeHtml(s.class_title)}</h4>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <span class="session-badge live">LIVE</span>
                            ${countdownHtml}
                        </div>
                    </div>
                    <p>${this.escapeHtml(s.description || 'No description')}</p>
                    <div class="session-details">
                        <span>📅 ${new Date(s.date).toLocaleDateString()}</span>
                        <span>⏰ ${s.time || 'TBD'}</span>
                        <span>⏱️ ${s.duration || '1 hour'}</span>
                        <span>👤 ${this.escapeHtml(s.instructor)}</span>
                    </div>
                    <button class="btn btn-primary join-session" data-session-id="${s.session_id}">
                        ${daysLeft < 0 ? 'Watch Recording' : 'Join Session'} →
                    </button>
                </div>
            `;
        }).join('')
        : '<div class="no-sessions">No upcoming live sessions scheduled</div>';
    
    const recordedHtml = this.recordedSessions.length > 0
        ? this.recordedSessions.map(s => `
            <div class="session-card recorded">
                <div class="session-header">
                    <h4>${this.escapeHtml(s.class_title)}</h4>
                    <span class="session-badge recorded">RECORDED</span>
                </div>
                <p>${this.escapeHtml(s.description || 'No description')}</p>
                <div class="session-details">
                    <span>📅 ${new Date(s.date).toLocaleDateString()}</span>
                    <span>⏱️ ${s.duration || '1 hour'}</span>
                    <span>👤 ${this.escapeHtml(s.instructor)}</span>
                    <span>👥 ${s.participants || 0} viewed</span>
                </div>
                <button class="btn btn-primary watch-session" data-class-id="${s.class_id}">
                    📺 Watch Recording
                </button>
            </div>
        `).join('')
        : '<div class="no-sessions">No recorded sessions available</div>';
    
    container.innerHTML = `
        <div class="upcoming-sessions-section">
            <h3>Upcoming Live Sessions</h3>
            <div class="sessions-list">${upcomingHtml}</div>
        </div>
        <div class="recorded-sessions-section" style="margin-top: 30px;">
            <h3>Recorded Sessions</h3>
            <div class="sessions-list">${recordedHtml}</div>
        </div>
    `;
    
    // Add event listeners
    container.querySelectorAll('.join-session').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const sessionId = btn.dataset.sessionId;
            this.joinLiveSession(sessionId);
        });
    });
    container.querySelectorAll('.watch-session').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const classId = btn.dataset.classId;
            this.watchRecordedSession(classId);
        });
    });
}
       renderOverviewLiveSessions() {
    const container = document.getElementById('overviewLiveSessions');
    if (!container) return;
    
    if (!this.upcomingSessions.length) {
        container.innerHTML = '<div class="no-sessions" style="padding: 20px;">No upcoming live sessions. Check back later!</div>';
        return;
    }
    
    container.innerHTML = this.upcomingSessions.slice(0, 3).map(s => {
        const sessionDate = new Date(s.date);
        const today = new Date();
        const isToday = sessionDate.toDateString() === today.toDateString();
        
        return `
            <div class="session-item">
                <div class="session-time">
                    <span class="date">${new Date(s.date).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}</span>
                    <span class="time">${s.time || 'TBD'}</span>
                    ${isToday ? '<span class="recording-indicator">LIVE</span>' : ''}
                </div>
                <div class="session-details">
                    <h5>${this.escapeHtml(s.class_title)}</h5>
                    <p>${this.escapeHtml(s.description || '').substring(0, 60)}${(s.description || '').length > 60 ? '...' : ''}</p>
                </div>
                <button class="btn btn-outline btn-small" onclick="location.href='#live'">View Details →</button>
            </div>
        `;
    }).join('');
}

        // ===== QUIZ HISTORY =====
        async loadQuizHistory() {
            try {
                const token = localStorage.getItem('token');
                const response = await fetch('https://fissk-backend.onrender.com/api/quizzes/attempts/user', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!response.ok) throw new Error('Failed to load quiz history');

                const data = await response.json();
                const attempts = data.attempts || [];

                this.renderQuizHistory(attempts);
            } catch (error) {
                console.error('Load quiz history error:', error);
                // Silently fail - quiz history is optional
            }
        }

        renderQuizHistory(attempts) {
            const container = document.getElementById('quizHistoryContainer');
            if (!container) return;

            if (attempts.length === 0) {
                container.innerHTML = `
                    <div class="no-quiz-history">
                        <p style="color: var(--text-light); text-align: center; padding: 20px;">
                            📝 You haven't taken any quizzes yet. Start learning and test your knowledge!
                        </p>
                    </div>
                `;
                return;
            }

            container.innerHTML = attempts.slice(0, 5).map(attempt => {
                const quizTitle = attempt.quizId?.title || 'Unknown Quiz';
                const score = attempt.score || 0;
                const passed = attempt.passed ? '✅ Passed' : '❌ Failed';
                const date = attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleDateString() : 'Unknown';
                
                return `
                    <div class="quiz-history-item" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: var(--gray-light); border-radius: 10px; margin-bottom: 8px;">
                        <div>
                            <strong>${this.escapeHtml(quizTitle)}</strong>
                            <span style="font-size: 0.85rem; color: var(--text-light); margin-left: 12px;">${date}</span>
                        </div>
                        <div>
                            <span style="font-weight: 600; color: ${score >= 70 ? '#10B981' : score >= 40 ? '#F59E0B' : '#EF4444'}; margin-right: 12px;">${score}%</span>
                            <span style="font-size: 0.85rem; font-weight: 500; color: ${passed ? '#10B981' : '#EF4444'};">
                                ${passed}
                            </span>
                        </div>
                    </div>
                `;
            }).join('');

            if (attempts.length > 5) {
                container.innerHTML += `
                    <div style="text-align: center; margin-top: 12px;">
                        <a href="quiz/history.html" class="btn btn-outline" style="font-size: 0.85rem;">View All</a>
                    </div>
                `;
            }
        }

        filterSessions(type) {
            const upcomingSection = document.querySelector('.upcoming-sessions-section');
            const recordedSection = document.querySelector('.recorded-sessions-section');
            
            document.querySelectorAll('.session-filter .filter-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.type === type);
            });
            
            if (type === 'upcoming') {
                if (upcomingSection) upcomingSection.style.display = 'block';
                if (recordedSection) recordedSection.style.display = 'none';
            } else {
                if (upcomingSection) upcomingSection.style.display = 'none';
                if (recordedSection) recordedSection.style.display = 'block';
            }
        }

        joinLiveSession(sessionId) {
            window.open(`newlivestream.html?session=${sessionId}`, '_blank');
        }

        watchRecordedSession(classId) {
            if (classId) {
                window.location.href = `class.html?id=${classId}`;
            }
        }

        showNoClassesMessage() {
            const container = document.getElementById('enrolledClasses');
            const noClassesDiv = document.getElementById('noEnrolledClasses');
            if (container) container.style.display = 'none';
            if (noClassesDiv) noClassesDiv.style.display = 'block';
            document.getElementById('continueClass').innerHTML = '<p>You haven\'t enrolled in any classes yet. <a href="classes.html">Browse classes</a> to get started!</p>';
            document.getElementById('recentActivity').innerHTML = '<p>No recent activity. Enroll in a class to start learning!</p>';
        }

        showError(message) {
            const container = document.getElementById('recentActivity');
            if (container) container.innerHTML = `<p class="error">${message}</p>`;
        }

        escapeHtml(str) {
            if (!str) return '';
            return String(str).replace(/[&<>]/g, function(s) {
                return ({'&':'&amp;','<':'&lt;','>':'&gt;'})[s];
            });
        }
    }

    // Initialize dashboard
    document.addEventListener('DOMContentLoaded', () => {
        new DashboardManager();
    });
    
    async function logout() {
        localStorage.removeItem('user');
        window.location.href = "/";
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