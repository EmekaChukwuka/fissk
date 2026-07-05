// instructor-dashboard.js
class InstructorDashboard {
  constructor() {
    this.currentUser = JSON.parse(localStorage.getItem('user'));
    this.init();
  }

  async init() {
    this.bindUI();
    await this.loadUserData();
    await this.loadDashboardData();
    this.setupEventHandlers();
  }

  bindUI() {
    this.el = {
      totalClasses: document.getElementById('totalClasses'),
      totalStudents: document.getElementById('totalStudents'),
      totalVideos: document.getElementById('totalVideos'),
      avgRating: document.getElementById('avgRating'),
      classesList: document.getElementById('classesList'),
      scheduledStreams: document.getElementById('scheduledStreams'),
      pastStreams: document.getElementById('pastStreams'),
      enrollmentsList: document.getElementById('enrollmentsList'),
      recentActivities: document.getElementById('recentActivities'),
      classFilter: document.getElementById('classFilter'),
      streamClass: document.getElementById('streamClass'),
      createClassBtn: document.getElementById('createClassBtn'),
      btnNewClass: document.getElementById('btnNewClass'),
      btnSchedule: document.getElementById('btnSchedule'),
      startLiveBtn: document.getElementById('startLiveBtn'),
      scheduleLiveBtn: document.getElementById('scheduleLiveBtn'),
      createClassBtn2: document.getElementById('createClassBtn2'),
      scheduleLiveBtn2: document.getElementById('scheduleLiveBtn2')
    };
  }

  async loadUserData() {
    if (this.currentUser) {
      document.getElementById('user-dropdown').innerHTML = `
        <img src="https://ui-avatars.com/api/?name=${this.currentUser.firstname}+${this.currentUser.lastname}&background=8B5FBF&color=fff" alt="User" class="user-avatar" id="user-avatar">
        <span id="instructorName"></span>
        <div class="dropdown-content">
          <a href="profile.html">Profile</a>
          <a href="settings.html">Settings</a>
          <a href="#" class="logout" onclick="logout()">Logout</a>
        </div>`;
      document.getElementById('instructorName').textContent = this.currentUser.firstname;
    } else {
      window.location.href = 'login.html';
    }
  }

  async loadDashboardData() {
    await Promise.all([
      this.loadInstructorClasses(),
      this.loadInstructorStats(),
      this.loadInstructorStreams(),
      this.loadEnrollments()
    ]);
  }

  async loadInstructorClasses() {
    try {
      const res = await fetch('https://fissk-backend.onrender.com/register/instructor/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: this.currentUser.id })
      });
      const json = await res.json();
      const classes = Array.isArray(json?.classes) ? json.classes : [];
      this.renderClasses(classes);
      this.populateClassSelects(classes);
    } catch (err) {
      console.error('loadInstructorClasses error', err);
    }
  }

  renderClasses(classes) {
    if (!this.el.classesList) return;
    if (!classes || classes.length === 0) {
      this.el.classesList.innerHTML = `<div class="no-content"><p>No classes yet.</p></div>`;
      return;
    }
    
    this.el.totalClasses.innerHTML = classes.length;

    this.el.classesList.innerHTML = classes.map(c => `
      <div class="class-card instructor-class" data-id="${c._id}">
        <div class="class-header">
          <span class="class-category ${c.category}">${(c.category||'').toUpperCase()}</span>
          <span class="class-level">${c.level||'—'}</span>
        </div>
        <h3>${this.escapeHtml(c.title)}</h3>
        <p>${this.escapeHtml(c.short_description || c.description || '')}</p>
        <div class="class-stats">
          <span>👥 ${c.enrolled_students || 0} students</span>
          <span>🎥 ${c.video_count || 0} videos</span>
          <span>🕒 ${c.duration || '—'}</span>
        </div>
        <div class="class-actions">
          <button class="btn btn-primary manage-class" data-id="${c._id}">Manage</button>
          <button class="btn btn-outline view-students" data-id="${c._id}">Students</button>
        </div>
      </div>
    `).join('');

    this.el.classesList.querySelectorAll('.manage-class').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        window.location.href = `instructor-class-details.html?id=${id}`;
      });
    });

    this.el.classesList.querySelectorAll('.view-students').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        this.loadEnrollments(id);
        this.switchSection('students');
        if (this.el.classFilter) this.el.classFilter.value = id;
      });
    });
  }

  populateClassSelects(classes) {
    if (this.el.streamClass) {
        this.el.streamClass.innerHTML = `<option value="">Choose a class...</option>` + 
            classes.map(c => {
                const classId = c._id || c.id;
                return `<option value="${classId}">${this.escapeHtml(c.title)}</option>`;
            }).join('');
    }
    
    if (this.el.classFilter) {
        this.el.classFilter.innerHTML = `<option value="">All Classes</option>` + 
            classes.map(c => {
                const classId = c._id || c.id;
                return `<option value="${classId}">${this.escapeHtml(c.title)}</option>`;
            }).join('');
        this.el.classFilter.addEventListener('change', () => {
            const v = this.el.classFilter.value;
            this.loadEnrollments(v || '');
        });
    }
  }

  async loadInstructorStats() {
    try {
      const id = this.currentUser.id;
      const res = await fetch('https://fissk-backend.onrender.com/register/instructor/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const json = await res.json();
      if (json) {
        const s = json;
        if (this.el.totalClasses) this.el.totalClasses.textContent = s.totalClasses || 0;
        if (this.el.totalStudents) this.el.totalStudents.textContent = s.totalStudents || 0;
        if (this.el.totalVideos) this.el.totalVideos.textContent = s.totalVideos || 0;
        if (this.el.avgRating) this.el.avgRating.textContent = (s.avgRating || 0).toFixed(1);
      }
      if (json.recent && this.el.recentActivities) {
        this.el.recentActivities.innerHTML = json.recent.map(r => `<div class="activity">${this.escapeHtml(r)}</div>`).join('');
      }
    } catch (err) {
      console.error('loadInstructorStats error', err);
    }
  }

  async loadEnrollments(classId = '') {
    try {
      const res = await fetch(`https://fissk-backend.onrender.com/register/instructor/enrollments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instructorId: this.currentUser.id })
      });
      const json = await res.json();
      const enrollments = Array.isArray(json?.enrollments) ? json.enrollments : [];
      this.renderEnrollments(enrollments);
    } catch (err) {
      console.error('loadEnrollments error', err);
    }
  }

  renderEnrollments(items) {
    const container = this.el.enrollmentsList;
    if (!container) return;
    if (!items || items.length === 0) {
      container.innerHTML = `<div class="no-content"><p>No students enrolled yet.</p></div>`;
      return;
    }

    container.innerHTML = `
      <table class="enrollments-table">
        <thead>
          <tr><th>Student</th><th>Email</th><th>Joined</th><th>Progress</th><th>Class</th><th>Last Accessed</th></tr>
        </thead>
        <tbody>
          ${items.map(e => `
            <tr>
              <td>${this.escapeHtml(e.name|| (e.first_name + ' ' + e.last_name) || '—')}</td>
              <td>${this.escapeHtml(e.email || '—')}</td>
              <td>${e.enrolled_at ? new Date(e.enrolled_at).toLocaleDateString() : '—'}</td>
              <td>
                <div class="progress-bar small"><div class="progress-fill" style="width:${e.progress||0}%"></div></div>
                <span>${e.progress||0}%</span>
              </td>
              <td>${e.title}</td>
              <td>${e.last_accessed ? new Date(e.last_accessed).toLocaleDateString() : 'Never'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  // ===== CREATE CLASS API =====
  async apiCreateClass(data) {
    try {
      // Show spinner on button
      const submitBtn = document.querySelector('#createClassForm button[type="submit"]');
      const originalText = submitBtn.textContent;
      this.showButtonSpinner(submitBtn, 'Creating...');

      const res = await fetch('https://fissk-backend.onrender.com/register/create-class', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: this.currentUser.email,
          payload: data
        })
      });

      const json = await res.json();
      
      // Reset button
      this.hideButtonSpinner(submitBtn, originalText);

      if (json.success) {
        this.showMessage('✅ Class created successfully!', 'success');
        await this.loadDashboardData();
      } else {
        this.showMessage('❌ ' + (json.message || 'Failed to create class'), 'error');
      }
    } catch (err) {
      console.error('apiCreateClass error:', err);
      this.showMessage('❌ Error creating class', 'error');
      
      // Reset button
      const submitBtn = document.querySelector('#createClassForm button[type="submit"]');
      if (submitBtn) {
        submitBtn.textContent = 'Create Class';
        submitBtn.disabled = false;
      }
    }
  }

  // ===== STREAMS WITH MEETING URL =====
  async loadInstructorStreams() {
    try {
      const res = await fetch('https://fissk-backend.onrender.com/register/instructor/streams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: this.currentUser.id })
      });
      const json = await res.json();
      console.log('Streams data:', json);
      
      const scheduled = Array.isArray(json?.scheduled) ? json.scheduled : [];
      const past = Array.isArray(json?.past) ? json.past : [];
      
      const scheduledWithMeetingIds = await Promise.all(scheduled.map(async (s) => {
        try {
          const meetingRes = await fetch(`https://fissk-backend.onrender.com/api/livekit/session/meeting/${s.id}`);
          const meetingData = await meetingRes.json();
          if (meetingData.success && meetingData.meetingId) {
            return { ...s, meetingId: meetingData.meetingId };
          }
          return { ...s, meetingId: null };
        } catch (err) {
          return { ...s, meetingId: null };
        }
      }));
      
      this.renderStreams(scheduledWithMeetingIds, past);
    } catch (err) {
      console.error('loadInstructorStreams error', err);
    }
  }

  renderStreams(scheduled, past) {
    // Scheduled Streams
    if (this.el.scheduledStreams) {
        if (scheduled && scheduled.length > 0) {
            this.el.scheduledStreams.innerHTML = scheduled.map(s => `
                <div class="enrolled-class-card scheduled-stream">
                    <div class="stream-header">
                        <h4>${this.escapeHtml(s.title)}</h4>
                        <span class="stream-status scheduled">⏳ Scheduled</span>
                    </div>
                    <p>${this.escapeHtml(s.description || '')}</p>
                    <div class="stream-details">
                        <span>📅 ${s.scheduled_time || 'TBD'}</span>
                        ${s.meetingId ? `<span>🔑 ${s.meetingId}</span>` : ''}
                    </div>
                    ${s.meetingId ? `
                        <div class="meeting-link-container">
                            <div class="meeting-url">
                                <input type="text" class="meeting-url-input" value="https://fissk-online-academy.onrender.com/newlivestream.html?meetingId=${s.meetingId}" readonly>
                                <button class="btn btn-sm btn-copy" onclick="window.instructorDashboard.copyToClipboard('https://fissk-online-academy.onrender.com/newlivestream.html?meetingId=${s.meetingId}')">📋 Copy</button>
                                <a href="newlivestream.html?meetingId=${s.meetingId}" class="btn btn-sm btn-primary" target="_blank">🎥 Join</a>
                            </div>
                        </div>
                    ` : `
                        <div class="meeting-link-container">
                            <button class="btn btn-sm btn-primary generate-link-btn" data-stream-id="${s.id}" data-stream-title="${this.escapeHtml(s.title)}">
                                🔗 Generate Shareable Link
                            </button>
                        </div>
                    `}
                    <div class="stream-actions">
                        <button class="btn btn-primary start-stream" data-id="${s.id}">▶ Start Stream</button>
                    </div>
                </div>
            `).join('');

            // Add event listeners for generate link buttons
            this.el.scheduledStreams.querySelectorAll('.generate-link-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const streamId = e.currentTarget.dataset.streamId;
                    const streamTitle = e.currentTarget.dataset.streamTitle;
                    this.generateMeetingLink(streamId, streamTitle);
                });
            });

            // Add event listeners for start stream buttons
            this.el.scheduledStreams.querySelectorAll('.start-stream').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.currentTarget.dataset.id;
                    window.location.href = `newlivestream.html?sessionId=${id}`;
                });
            });

        } else {
            this.el.scheduledStreams.innerHTML = `<p class="no-data">No scheduled streams</p>`;
        }
    }

    // Past Streams
    if (this.el.pastStreams) {
        if (past && past.length > 0) {
            this.el.pastStreams.innerHTML = past.map(s => `
                <div class="enrolled-class-card past-stream">
                    <div class="stream-header">
                        <h4>📹 ${this.escapeHtml(s.title)}</h4>
                        <span class="stream-status ended">✅ Ended</span>
                    </div>
                    <p>${this.escapeHtml(s.description || 'No description')}</p>
                    <div class="stream-details">
                        <span>📅 ${s.recorded_at || 'Unknown date'}</span>
                        <span>👥 ${s.participants || 0} participants</span>
                        <span>⏱️ ${s.duration || 'Unknown'}</span>
                    </div>
                    <div class="stream-actions">
                        <a href="/class-details.html?id=${s.class_id}" class="btn btn-outline">📹 View Recording</a>
                        ${s.id ? `<a href="newlivestream.html?streamId=${s.id}" class="btn btn-outline">🔗 Replay</a>` : ''}
                    </div>
                </div>
            `).join('');
        } else {
            this.el.pastStreams.innerHTML = `<p class="no-data">No past streams</p>`;
        }
    }
  }

  // ===== GENERATE MEETING LINK =====
  async generateMeetingLink(streamId, streamTitle) {
    try {
      // Show spinner on the button that was clicked
      const btn = document.querySelector(`.generate-link-btn[data-stream-id="${streamId}"]`);
      const originalText = btn ? btn.textContent : 'Generating...';
      if (btn) this.showButtonSpinner(btn, 'Generating...');

      this.showMessage('Generating meeting link...', 'success');
      
      const response = await fetch('https://fissk-backend.onrender.com/api/livekit/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instructorId: this.currentUser.id,
          classId: streamId,
          title: streamTitle || 'Live Class',
          description: 'Scheduled live session',
          date: new Date(),
          time: new Date().toLocaleTimeString(),
          duration: '60 minutes'
        })
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to generate meeting link');
      }
      
      const meetingId = data.session.meetingId;
      const meetingUrl = `https://fissk-online-academy.onrender.com/newlivestream.html?meetingId=${meetingId}`;
      
      // Copy to clipboard
      this.copyToClipboard(meetingUrl);
      this.showMessage(`✅ Meeting link generated and copied to clipboard!`, 'success');
      
      // Refresh the streams list to show the new link
      await this.loadInstructorStreams();
      
    } catch (err) {
      console.error('Generate meeting link error:', err);
      this.showMessage(`Failed to generate meeting link: ${err.message}`, 'error');
    } finally {
      // Reset button
      const btn = document.querySelector(`.generate-link-btn[data-stream-id="${streamId}"]`);
      if (btn) {
        btn.textContent = '🔗 Generate Shareable Link';
        btn.disabled = false;
      }
    }
  }

  // ===== COPY TO CLIPBOARD =====
  copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        this.showMessage('📋 Link copied to clipboard!', 'success');
      }).catch(() => {
        this.fallbackCopy(text);
      });
    } else {
      this.fallbackCopy(text);
    }
  }

  fallbackCopy(text) {
    const input = document.createElement('input');
    input.value = text;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
    this.showMessage('📋 Link copied to clipboard!', 'success');
  }

  // ===== BUTTON SPINNER HELPERS =====
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

  // ===== SCHEDULE STREAM =====
  async apiScheduleStream(payload) {
    try {
      // Show spinner on submit button
      const submitBtn = document.querySelector('#scheduleStreamForm button[type="submit"]');
      const originalText = submitBtn ? submitBtn.textContent : 'Schedule Stream';
      if (submitBtn) this.showButtonSpinner(submitBtn, 'Scheduling...');

      const classId = document.getElementById('streamClass')?.value;
      const title = document.getElementById('streamTitle')?.value;
      const description = document.getElementById('streamDescription')?.value;
      const scheduledTime = document.getElementById('streamDateTime')?.value;
      
      if (!classId || classId === 'undefined' || classId === '') {
        this.showMessage('Please select a valid class', 'error');
        if (submitBtn) this.hideButtonSpinner(submitBtn, originalText);
        return;
      }
      
      if (!title) {
        this.showMessage('Please enter a stream title', 'error');
        if (submitBtn) this.hideButtonSpinner(submitBtn, originalText);
        return;
      }
      
      if (!scheduledTime) {
        this.showMessage('Please select a date and time', 'error');
        if (submitBtn) this.hideButtonSpinner(submitBtn, originalText);
        return;
      }
      
      const payloadData = {
        classId: classId,
        title: title,
        description: description || '',
        scheduledTime: scheduledTime
      };
      
      console.log('Scheduling stream with payload:', payloadData);
      
      const id = this.currentUser.id;
      
      const res = await fetch('https://fissk-backend.onrender.com/register/instructor/schedule-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: payloadData, id })
      });
      
      const j = await res.json();
      
      if (!j.success) {
        throw new Error(j.message || 'Failed to schedule stream');
      }
      
      this.showMessage('✅ Stream scheduled successfully!', 'success');
      
      // Reset button
      if (submitBtn) this.hideButtonSpinner(submitBtn, originalText);
      
      // Close modal and refresh
      document.getElementById('scheduleStreamModal').style.display = 'none';
      document.getElementById('scheduleStreamForm').reset();
      
      setTimeout(async () => {
        await this.loadInstructorStreams();
        if (j.meetingId) {
          const meetingUrl = `https://fissk-online-academy.onrender.com/newlivestream.html?meetingId=${j.meetingId}`;
          this.copyToClipboard(meetingUrl);
          this.showMessage(`✅ Meeting link generated and copied to clipboard!`, 'success');
        }
      }, 1000);
      
    } catch (err) {
      console.error('Schedule stream error:', err);
      this.showMessage('❌ ' + (err.message || 'Failed to schedule stream'), 'error');
      
      // Reset button
      const submitBtn = document.querySelector('#scheduleStreamForm button[type="submit"]');
      if (submitBtn) {
        submitBtn.textContent = 'Schedule Stream';
        submitBtn.disabled = false;
      }
    }
  }

  setupEventHandlers() {
    // ===== NAVIGATION LINKS =====
    document.querySelectorAll('.sidebar-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const sec = link.dataset.section;
            this.switchSection(sec);
        });
    });

    document.querySelectorAll('.nav-link[data-section]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const sec = link.dataset.section;
            this.switchSection(sec);
            document.querySelectorAll('.sidebar-link').forEach(l => {
                l.classList.toggle('active', l.dataset.section === sec);
            });
            document.querySelectorAll('.nav-link[data-section]').forEach(l => {
                l.classList.toggle('active', l.dataset.section === sec);
            });
        });
    });

    // ===== MODAL CLOSE =====
    document.querySelectorAll('.close-modal').forEach(el => {
        el.addEventListener('click', () => el.closest('.modal').style.display = 'none');
    });
    
    // Click outside modal to close
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    });

    // ===== CREATE CLASS BUTTONS =====
    if (this.el.createClassBtn) {
        this.el.createClassBtn.addEventListener('click', () => {
            document.getElementById('createClassModal').style.display = 'flex';
        });
    }
    if (this.el.createClassBtn2) {
        this.el.createClassBtn2.addEventListener('click', () => {
            document.getElementById('createClassModal').style.display = 'flex';
        });
    }
    if (this.el.btnNewClass) {
        this.el.btnNewClass.addEventListener('click', () => {
            document.getElementById('createClassModal').style.display = 'flex';
        });
    }
    if (this.el.btnSchedule) {
        this.el.btnSchedule.addEventListener('click', () => {
            document.getElementById('scheduleStreamModal').style.display = 'flex';
        });
    }
    if (this.el.startLiveBtn) {
        this.el.startLiveBtn.addEventListener('click', () => {
            window.location.href = 'newlivestream.html';
        });
    }
    if (this.el.scheduleLiveBtn) {
        this.el.scheduleLiveBtn.addEventListener('click', () => {
            document.getElementById('scheduleStreamModal').style.display = 'flex';
        });
    }
    if (this.el.scheduleLiveBtn2) {
        this.el.scheduleLiveBtn2.addEventListener('click', () => {
            document.getElementById('scheduleStreamModal').style.display = 'flex';
        });
    }

    // ===== CREATE CLASS FORM =====
    const createForm = document.getElementById('createClassForm');
    if (createForm) {
        createForm.addEventListener('submit', async (ev) => {
            ev.preventDefault();
            const data = Object.fromEntries(new FormData(createForm).entries());
            await this.apiCreateClass(data);
            document.getElementById('createClassModal').style.display = 'none';
            createForm.reset();
            await this.loadDashboardData();
        });
    }

    // ===== SCHEDULE STREAM FORM =====
    const scheduleForm = document.getElementById('scheduleStreamForm');
    if (scheduleForm) {
        scheduleForm.addEventListener('submit', async (ev) => {
            ev.preventDefault();
            await this.apiScheduleStream();
        });
    }
  }

  escapeHtml(s) {
    if (!s) return '';
    return String(s).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[ch]);
  }

  showMessage(message, type) {
    // Remove existing messages
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

  switchSection(id) {
    document.querySelectorAll('.dashboard-section').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(id);
    if (target) target.classList.add('active');
    
    document.querySelectorAll('.sidebar-link').forEach(l => {
        l.classList.toggle('active', l.dataset.section === id);
    });
    
    document.querySelectorAll('.nav-link[data-section]').forEach(l => {
        l.classList.toggle('active', l.dataset.section === id);
    });
    
    if (history.pushState) {
        history.pushState(null, null, `#${id}`);
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.instructorDashboard = new InstructorDashboard();
});

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

async function logout() {
  localStorage.removeItem('user');
  window.location.href = '/';
}

// Add spinner CSS if not already in styles
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
`;
document.head.appendChild(spinnerStyle);