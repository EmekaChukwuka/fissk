// instructor-dashboard
 class InstructorDashboard {
  constructor() {
    this.currentUser = JSON.parse(localStorage.getItem('user'));
    this.init();
  }

  async init() {
    this.bindUI();
    await this.loadUserData();       // loads current user (from /register/user)
    await this.loadDashboardData();  // classes, stats, streams
    this.setupEventHandlers();
  }

  bindUI() {
    // quick DOM refs
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
      //  console.log(this.currentUser.firstname)
        document.getElementById('instructorName').textContent = (this.currentUser.firstname  );
      } else {
        // redirect to login if needed
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

  // fetch classes (uses session-based auth on backend)
  async loadInstructorClasses() {
    try {
      const res = await fetch('/register/instructor/classes', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id : this.currentUser.id })
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
      <div class="class-card instructor-class" data-id="${c.id}">
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
          <button class="btn btn-primary manage-class" data-id="${c.id}">Manage</button>
          <button class="btn btn-outline view-students" data-id="${c.id}">Students</button>
        </div>
      </div>
    `).join('');

   // this.el.recentActivities.style.display = "none";

    // attach actions
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
        // show students section
        this.switchSection('students');
        if (this.el.classFilter) this.el.classFilter.value = id;
      });
    });
  }

  populateClassSelects(classes) {
    // streamClass and classFilter
    if (this.el.streamClass) {
      this.el.streamClass.innerHTML = `<option value="">Choose a class...</option>` + classes.map(c => `<option value="${c.id}">${this.escapeHtml(c.title)}</option>`).join('');
    }
    if (this.el.classFilter) {
      this.el.classFilter.innerHTML = `<option value="">All Classes</option>` + classes.map(c => `<option value="${c.id}">${this.escapeHtml(c.title)}</option>`).join('');
      this.el.classFilter.addEventListener('change', () => {
        const v = this.el.classFilter.value;
        this.loadEnrollments(v || '');
      });
    }
  }

  async loadInstructorStats() {
    try {
      const id = this.currentUser.id;
      const res = await fetch('/register/instructor/stats', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id })
                });
      const json = await res.json();
    //  console.log(json)
      if (json) {
        const s = json;
        if (this.el.totalClasses) this.el.totalClasses.textContent = s.totalClasses || 0;
        if (this.el.totalStudents) this.el.totalStudents.textContent = s.totalStudents || 0;
        if (this.el.totalVideos) this.el.totalVideos.textContent = s.totalVideos || 0;
        if (this.el.avgRating) this.el.avgRating.textContent = (s.avgRating || 0).toFixed(1);
      }
      // recent activities
      if (json.recent && this.el.recentActivities) {
        this.el.recentActivities.innerHTML = json.recent.map(r => `<div class="activity">${this.escapeHtml(r)}</div>`).join('');
      }
    } catch (err) {
      console.error('loadInstructorStats error', err);
    }
  }

  async loadEnrollments(classId = '') {
    try {
      const url = `/register/instructor/enrollments`;
      const res = await fetch(`/register/instructor/enrollments`, {
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ instructorId: this.currentUser.id })
                });
      const json = await res.json();
      console.log(json)
      const enrollments = Array.isArray(json?.enrollments) ? json.enrollments : [];
      this.renderEnrollments(json);
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
console.log(items)
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

  // streams
  async loadInstructorStreams() {
    try {
      const res = await fetch('/register/instructor/streams', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id : this.currentUser.id })
                });
      const json = await res.json();
      console.log(json)
      const scheduled = Array.isArray(json?.scheduled) ? json.scheduled : [];
      const past = Array.isArray(json?.past) ? json.past : [];
      this.renderStreams(scheduled, past);
    } catch (err) {
      console.error('loadInstructorStreams error', err);
    }
  }

  renderStreams(scheduled, past) {
    if (this.el.scheduledStreams) {
      this.el.scheduledStreams.innerHTML = scheduled.length ? scheduled.map(s => `
        <div class="enrolled-class-card">
          <h4>${this.escapeHtml(s.title)}</h4>
          <p>${this.escapeHtml(s.description || '')}</p>
          <small>${s.scheduled_time}</small><br><br>
          <div><button class="btn btn-primary start-stream" data-id="${s.id}">Start</button></div>
        </div>
        <br>
      `).join('') : `<p>No scheduled streams</p>`;
    }

    if (this.el.pastStreams) {
      this.el.pastStreams.innerHTML = past.length ? past.map(s => `
        <div class="enrolled-class-card">
          <h4>${this.escapeHtml(s.title)}</h4>
          <p>${this.escapeHtml(s.description || '')}</p>
          <small>${s.recorded_at}</small><br><br>
          <div><a href="/class-details.html?id=${s.class_id}" class="btn btn-outline">View</a></div>
        </div><br>
      `).join('') : `<p>No past streams</p>`;
    }

    // attach start handlers
    (this.el.scheduledStreams || document).querySelectorAll?.('.start-stream').forEach(b => b.addEventListener('click', e => {
      const id = e.currentTarget.dataset.id;
      window.location.href = `newlivestream.html?streamId=${id}`;
    }));
  }

  setupEventHandlers() {
    // sidebar links (delegated)
    document.querySelectorAll('.sidebar-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const sec = link.dataset.section;
        this.switchSection(sec);
      });
    });

    // modals and forms
    document.querySelectorAll('.close-modal').forEach(el => el.addEventListener('click', () => el.closest('.modal').style.display = 'none'));
    if (this.el.createClassBtn) this.el.createClassBtn.addEventListener('click', () => document.getElementById('createClassModal').style.display = 'flex');
     if (this.el.createClassBtn2) this.el.createClassBtn2.addEventListener('click', () => document.getElementById('createClassModal').style.display = 'flex');
    if (this.el.btnNewClass) this.el.btnNewClass.addEventListener('click', () => document.getElementById('createClassModal').style.display = 'flex');
    if (this.el.btnSchedule) this.el.btnSchedule.addEventListener('click', () => document.getElementById('scheduleStreamModal').style.display = 'flex');
    if (this.el.startLiveBtn) this.el.startLiveBtn.addEventListener('click', () => window.location.href = 'newlivestream.html');
    if (this.el.scheduleLiveBtn) this.el.scheduleLiveBtn.addEventListener('click', () => document.getElementById('scheduleStreamModal').style.display = 'flex');
  if (this.el.scheduleLiveBtn2) this.el.scheduleLiveBtn2.addEventListener('click', () => document.getElementById('scheduleStreamModal').style.display = 'flex');

    // create class form
    const createForm = document.getElementById('createClassForm');
    if (createForm) createForm.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const data = Object.fromEntries(new FormData(createForm).entries());
      await this.apiCreateClass(data);
      document.getElementById('createClassModal').style.display = 'none';
      createForm.reset();
      await this.loadDashboardData();
    });

    // schedule stream form
    const scheduleForm = document.getElementById('scheduleStreamForm');
    if (scheduleForm) scheduleForm.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const data = Object.fromEntries(new FormData(scheduleForm).entries());
      await this.apiScheduleStream(data);
      document.getElementById('scheduleStreamModal').style.display = 'none';
      scheduleForm.reset();
      await this.loadInstructorStreams();
    });
  }

  // create class
  async apiCreateClass(payload) {
   console.log(payload)
    const email = this.currentUser.email;
    try {
      const res = await fetch('/register/create-class', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({payload, email})
      });
      const j = await res.json();
      if (!j.success) throw new Error(j.message || 'Failed to create class');
      this.showMessage('Class created', 'success');
    } catch (err) {
      this.showMessage(err.message, 'error');
    }
  }

  // schedule stream
  async apiScheduleStream(payload) {
    try {
      // normalize scheduledTime -> scheduled_at
      if (payload.scheduledTime) payload.scheduled_at = payload.scheduledTime;
      console.log(payload)
      const id = this.currentUser.id;
      const res = await fetch('/register/instructor/schedule-stream', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({payload, id})
      });
      const j = await res.json();
      if (!j.success) throw new Error(j.message || 'Failed to schedule stream');
      this.showMessage('Stream scheduled', 'success');
    } catch (err) {
      this.showMessage(err.message, 'error');
    }
  }

  // utilities
  escapeHtml(s) { if (!s) return ''; return String(s).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[ch]); }

   showMessage(message, type) {
        const messageEl = document.createElement('div');
        messageEl.className = `message message-${type}`;
        messageEl.textContent = message;
        messageEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 10px;
            color: white;
            background: ${type === 'success' ?  '#F56565' :'#48BB78'};
            z-index: 10000;
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        `;

        document.body.appendChild(messageEl);

        setTimeout(() => {
            messageEl.remove();
        }, 3000);
    }

  switchSection(id) {
    document.querySelectorAll('.dashboard-section').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(id);
    if (target) target.classList.add('active');
    document.querySelectorAll('.sidebar-link').forEach(l => l.classList.toggle('active', l.dataset.section===id));
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.instructorDashboard = new InstructorDashboard();
});

// Mobile Navigation
const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');


if (hamburger) {
    hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('active');
        navMenu.classList.toggle('active');
        
        // Add mobile menu styles
        if (navMenu.classList.contains('active')) {
            navMenu.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        } else {
            navMenu.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    });
}

// Close mobile menu when clicking on links
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        navMenu.classList.remove('active');
        navMenu.style.display = 'none';
        document.body.style.overflow = 'auto';
    });
});



// Smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});


        async function logout() {
            localStorage.removeItem('user');
            window.location.href = "/";
        }
