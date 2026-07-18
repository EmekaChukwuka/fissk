// instructor-dashboard.js - Complete with Payment Integration & Quiz Management
class InstructorDashboard {
  constructor() {
    this.currentUser = JSON.parse(localStorage.getItem('user'));
    this.token = localStorage.getItem('token');
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
      totalEarnings: document.getElementById('totalEarnings'),
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
      scheduleLiveBtn2: document.getElementById('scheduleLiveBtn2'),
      viewEarningsBtn: document.getElementById('viewEarningsBtn'),
      refreshPaymentsBtn: document.getElementById('refreshPaymentsBtn'),
      paymentHistoryContainer: document.getElementById('paymentHistoryContainer')
    };
  }

  // ===== HEADERS WITH TOKEN =====
  getHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };
    
    const token = this.token || localStorage.getItem('token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return headers;
  }

  async loadUserData() {
    if (this.currentUser) {
      document.getElementById('user-dropdown').innerHTML = `
        <img src="https://ui-avatars.com/api/?name=${this.currentUser.firstname}+${this.currentUser.lastname}&background=8B5FBF&color=fff" alt="User" class="user-avatar" id="user-avatar">
        <span id="instructorName">${this.currentUser.firstname}</span>
        <div class="dropdown-content">
          <a href="profile.html">Profile</a>
          <a href="settings.html">Settings</a>
          <a href="#" class="logout" onclick="logout()">Logout</a>
        </div>`;
    } else {
      window.location.href = 'login.html';
    }
  }

  async loadDashboardData() {
    const results = await Promise.allSettled([
      this.loadInstructorClasses(),
      this.loadInstructorStats(),
      this.loadInstructorStreams(),
      this.loadEnrollments(),
      this.loadEarnings(),
      this.loadPaymentHistory()
    ]);
    
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.log(`Task ${index} failed:`, result.reason);
      }
    });
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
      
      // Load quizzes for each class
      for (const cls of classes) {
        const quizzes = await this.loadClassQuizzes(cls._id);
        cls.quizzes = quizzes || [];
        cls.quizCount = quizzes ? quizzes.length : 0;
      }
      
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
          <span>📝 ${c.quizCount || 0} quizzes</span>
          <span>🕒 ${c.duration || '—'}</span>
          ${c.price > 0 ? `<span>💰 ₦${c.price.toLocaleString()}</span>` : '<span>🎓 FREE</span>'}
        </div>
        <div class="class-quizzes-section" id="quizzesContainer_${c._id}">
          <!-- Quizzes will be loaded here -->
        </div>
        <div class="class-actions">
          <button class="btn btn-primary manage-class" data-id="${c._id}">Manage</button>
          <button class="btn btn-outline view-students" data-id="${c._id}">Students</button>
          <button class="btn btn-outline manage-quizzes" data-id="${c._id}">📝 Quizzes</button>
        </div>
      </div>
    `).join('');

    // Load quizzes for each class card
    classes.forEach(c => {
      const container = document.getElementById(`quizzesContainer_${c._id}`);
      if (container) {
        this.renderClassQuizzes(container, c.quizzes || [], c._id);
      }
    });

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

    this.el.classesList.querySelectorAll('.manage-quizzes').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        window.location.href = `instructor/quizzes/create.html?classId=${id}`;
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
        if (this.el.totalEarnings && s.earnings !== undefined) {
          this.el.totalEarnings.textContent = `₦${(s.earnings || 0).toLocaleString()}`;
        }
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
          <tr><th>Student</th><th>Email</th><th>Joined</th><th>Progress</th><th>Class</th><th>Payment</th><th>Last Accessed</th></tr>
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
              <td>
                ${e.paymentStatus === 'paid' ? '✅ Paid' : 
                  e.paymentStatus === 'pending' ? '⏳ Pending' : 
                  e.paymentStatus === 'free' ? '🎓 Free' : '—'}
              </td>
              <td>${e.last_accessed ? new Date(e.last_accessed).toLocaleDateString() : 'Never'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  // ===== CREATE CLASS API WITH PRICE =====
  async apiCreateClass(data) {
    try {
      const submitBtn = document.querySelector('#createClassForm button[type="submit"]');
      const originalText = submitBtn.textContent;
      this.showButtonSpinner(submitBtn, 'Creating...');

      const isFree = document.getElementById('classFree').checked;
      let price = parseFloat(document.getElementById('classPrice').value) || 0;
      
      if (isFree) {
        price = 0;
      }
      
      if (!isFree && price > 0 && price < 1000) {
        this.showMessage('❌ Minimum price is ₦1,000', 'error');
        if (submitBtn) this.hideButtonSpinner(submitBtn, originalText);
        return;
      }

      const payload = {
        ...data,
        price: price,
        isFree: isFree || price === 0
      };

      const res = await fetch('https://fissk-backend.onrender.com/register/create-class', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: this.currentUser.email,
          payload: payload
        })
      });

      const json = await res.json();
      
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
      
      const submitBtn = document.querySelector('#createClassForm button[type="submit"]');
      if (submitBtn) {
        submitBtn.textContent = 'Create Class';
        submitBtn.disabled = false;
      }
    }
  }

  // ===== LOAD EARNINGS =====
  async loadEarnings() {
    try {
      const token = this.token || localStorage.getItem('token');
      
      if (!token) {
        console.log('No token found, skipping earnings');
        this.showMessage('Please login again to view earnings', 'warning');
        return;
      }

      const res = await fetch('https://fissk-backend.onrender.com/api/payout/earnings', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (res.status === 401) {
        localStorage.removeItem('token');
        this.showMessage('Session expired. Please login again.', 'error');
        setTimeout(() => {
          window.location.href = 'login.html';
        }, 2000);
        return;
      }
      
      if (!res.ok) {
        throw new Error('Failed to load earnings');
      }
      
      const data = await res.json();
      
      if (data.success) {
        this.renderEarnings(data.earnings);
        if (this.el.totalEarnings) {
          this.el.totalEarnings.textContent = `₦${(data.earnings.totalRevenue || 0).toLocaleString()}`;
        }
      }
    } catch (error) {
      console.error('Load earnings error:', error);
      this.renderEarningsFallback();
    }
  }

  renderEarningsFallback() {
    let earningsSection = document.getElementById('earningsSection');
    if (!earningsSection) {
      const overviewSection = document.getElementById('overview');
      if (overviewSection) {
        const activitiesDiv = overviewSection.querySelector('.recent-activities');
        if (activitiesDiv) {
          earningsSection = document.createElement('div');
          earningsSection.id = 'earningsSection';
          earningsSection.className = 'earnings-section';
          activitiesDiv.parentNode.insertBefore(earningsSection, activitiesDiv.nextSibling);
        }
      }
    }
    
    if (!earningsSection) return;
    
    earningsSection.innerHTML = `
      <div class="earnings-card">
        <h3>💰 Earnings Overview</h3>
        <div style="text-align: center; padding: 20px;">
          <p style="color: #6B7280;">Login required to view earnings</p>
          <button class="btn btn-primary" onclick="window.location.href='login.html'">Login</button>
        </div>
      </div>
    `;
  }

  renderEarnings(earnings) {
    let earningsSection = document.getElementById('earningsSection');
    if (!earningsSection) {
      const overviewSection = document.getElementById('overview');
      if (overviewSection) {
        const activitiesDiv = overviewSection.querySelector('.recent-activities');
        if (activitiesDiv) {
          earningsSection = document.createElement('div');
          earningsSection.id = 'earningsSection';
          earningsSection.className = 'earnings-section';
          activitiesDiv.parentNode.insertBefore(earningsSection, activitiesDiv.nextSibling);
        }
      }
    }
    
    if (!earningsSection) return;
    
    earningsSection.innerHTML = `
      <div class="earnings-card">
        <h3>💰 Earnings Overview</h3>
        <div class="earnings-grid">
          <div class="earning-item">
            <span class="label">Available Balance</span>
            <span class="value">₦${(earnings.available || 0).toLocaleString()}</span>
          </div>
          <div class="earning-item">
            <span class="label">Total Revenue</span>
            <span class="value">₦${(earnings.totalRevenue || 0).toLocaleString()}</span>
          </div>
          <div class="earning-item">
            <span class="label">Total Sales</span>
            <span class="value">${earnings.totalSales || 0}</span>
          </div>
          <div class="earning-item">
            <span class="label">Total Withdrawn</span>
            <span class="value">₦${(earnings.totalWithdrawn || 0).toLocaleString()}</span>
          </div>
        </div>
        <div class="earning-actions">
          ${earnings.available > 0 ? `
            <button class="btn btn-primary" onclick="window.instructorDashboard.requestWithdrawal()">
              💰 Request Withdrawal
            </button>
          ` : ''}
          <button class="btn btn-outline" onclick="window.instructorDashboard.showBankDetailsForm()">
            🏦 Update Bank Details
          </button>
          <button class="btn btn-outline" onclick="window.instructorDashboard.loadPaymentHistory()">
            📜 View Payment History
          </button>
        </div>
      </div>
    `;
  }

  // ===== LOAD PAYMENT HISTORY =====
  async loadPaymentHistory() {
    const container = this.el.paymentHistoryContainer;
    if (!container) return;

    try {
      const token = this.token || localStorage.getItem('token');
      
      if (!token) {
        container.innerHTML = `
          <div class="no-content" style="text-align: center; padding: 40px;">
            <p style="color: #6B7280;">🔒 Please login to view payment history</p>
            <button class="btn btn-primary" onclick="window.location.href='login.html'">Login</button>
          </div>
        `;
        return;
      }

      const res = await fetch('https://fissk-backend.onrender.com/api/payout/earnings', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (res.status === 401) {
        container.innerHTML = `
          <div class="no-content" style="text-align: center; padding: 40px;">
            <p style="color: #EF4444;">❌ Session expired. Please login again.</p>
            <button class="btn btn-primary" onclick="window.location.href='login.html'">Login</button>
          </div>
        `;
        return;
      }

      if (!res.ok) {
        throw new Error('Failed to load payment history');
      }

      const data = await res.json();

      if (!data.success || !data.earnings || !data.earnings.transactions) {
        container.innerHTML = `
          <div class="no-content" style="text-align: center; padding: 40px;">
            <p style="font-size: 1.2rem; color: #999;">💰 No payment transactions yet</p>
            <p style="color: #bbb;">Students will appear here once they purchase your courses</p>
          </div>
        `;
        return;
      }

      const transactions = data.earnings.transactions || [];

      if (transactions.length === 0) {
        container.innerHTML = `
          <div class="no-content" style="text-align: center; padding: 40px;">
            <p style="font-size: 1.2rem; color: #999;">💰 No payment transactions yet</p>
            <p style="color: #bbb;">Students will appear here once they purchase your courses</p>
          </div>
        `;
        return;
      }

      container.innerHTML = `
        <table class="payment-history-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Course</th>
              <th>Amount</th>
              <th>Your Earnings</th>
              <th>Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${transactions.map(t => `
              <tr>
                <td>${this.escapeHtml(t.user?.firstName || 'Anonymous')} ${this.escapeHtml(t.user?.lastName || '')}</td>
                <td>${this.escapeHtml(t.class?.title || 'Unknown')}</td>
                <td>₦${(t.amount || 0).toLocaleString()}</td>
                <td>₦${(t.instructorEarning || 0).toLocaleString()}</td>
                <td>${t.paidAt ? new Date(t.paidAt).toLocaleDateString() : '—'}</td>
                <td>
                  <span class="status-badge ${t.status === 'success' ? 'success' : t.status === 'pending' ? 'pending' : 'failed'}">
                    ${t.status || '—'}
                  </span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div style="margin-top: 16px; text-align: right; color: #6B7280; font-size: 0.85rem;">
          Total: ₦${(data.earnings.totalRevenue || 0).toLocaleString()} earned from ${transactions.length} transactions
        </div>
      `;
    } catch (error) {
      console.error('Load payment history error:', error);
      container.innerHTML = `
        <div class="no-content" style="text-align: center; padding: 40px;">
          <p style="color: #EF4444;">❌ Failed to load payment history</p>
          <button class="btn btn-outline" onclick="window.instructorDashboard.loadPaymentHistory()">Retry</button>
        </div>
      `;
    }
  }

  // ============================================================
  // QUIZ MANAGEMENT METHODS
  // ============================================================

  /**
   * Load quizzes for a class
   */
  async loadClassQuizzes(classId) {
    try {
      const token = this.token || localStorage.getItem('token');
      
      if (!token) {
        console.log('No token found, skipping quiz load');
        return [];
      }

      const res = await fetch(`https://fissk-backend.onrender.com/api/quizzes/class/${classId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (res.status === 401) {
        console.log('Unauthorized - token expired');
        return [];
      }

      if (!res.ok) {
        throw new Error('Failed to load quizzes');
      }

      const data = await res.json();
      return data.quizzes || [];
    } catch (error) {
      console.error('Load class quizzes error:', error);
      return [];
    }
  }

  /**
   * Render quizzes for a class in the class card
   */
  renderClassQuizzes(container, quizzes, classId) {
    if (!container) return;
    
    if (!quizzes || quizzes.length === 0) {
      container.innerHTML = `
        <div class="no-quizzes-small">
          <p>No quizzes yet</p>
          <button class="btn btn-sm btn-primary create-quiz-btn" data-class-id="${classId}">
            + Create Quiz
          </button>
        </div>
      `;
      // Add event listener for create quiz button
      const createBtn = container.querySelector('.create-quiz-btn');
      if (createBtn) {
        createBtn.addEventListener('click', () => {
          window.location.href = `instructor/quizzes/create.html?classId=${classId}`;
        });
      }
      return;
    }

    container.innerHTML = `
      <div class="class-quizzes-list">
        ${quizzes.map(quiz => `
          <div class="class-quiz-item">
            <span class="quiz-title">${this.escapeHtml(quiz.title)}</span>
            <span class="quiz-stats">
              ${quiz.questionCount || 0} questions • 
              ${quiz.userAttempts || 0} attempts
            </span>
            <span class="quiz-status-badge ${quiz.status || 'draft'}">${quiz.status || 'draft'}</span>
            <div class="quiz-actions">
              <button class="btn btn-sm btn-outline edit-quiz-btn" data-quiz-id="${quiz._id}">✏️ Edit</button>
              <button class="btn btn-sm btn-danger delete-quiz-btn" data-quiz-id="${quiz._id}">🗑️</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    // Add event listeners for quiz actions
    container.querySelectorAll('.edit-quiz-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const quizId = btn.dataset.quizId;
        window.location.href = `instructor/quizzes/edit.html?quizId=${quizId}`;
      });
    });

    container.querySelectorAll('.delete-quiz-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const quizId = btn.dataset.quizId;
        this.deleteQuiz(quizId);
      });
    });
  }

  /**
   * Delete a quiz
   */
  async deleteQuiz(quizId) {
    if (!confirm('Are you sure you want to delete this quiz? This action cannot be undone.')) {
      return;
    }

    try {
      const token = this.token || localStorage.getItem('token');
      
      if (!token) {
        alert('Please login to delete quizzes');
        return;
      }

      const res = await fetch(`https://fissk-backend.onrender.com/api/quizzes/${quizId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (res.status === 401) {
        alert('Session expired. Please login again.');
        window.location.href = 'login.html';
        return;
      }

      const data = await res.json();

      if (data.success) {
        this.showMessage('✅ Quiz deleted successfully!', 'success');
        await this.loadInstructorClasses();
      } else {
        this.showMessage('❌ ' + (data.message || 'Failed to delete quiz'), 'error');
      }
    } catch (error) {
      console.error('Delete quiz error:', error);
      this.showMessage('Failed to delete quiz', 'error');
    }
  }

  /**
   * Toggle quiz publish status
   */
  async toggleQuizPublish(quizId, currentStatus) {
    try {
      const token = this.token || localStorage.getItem('token');
      
      if (!token) {
        alert('Please login to publish/unpublish quizzes');
        return;
      }

      const newStatus = currentStatus === 'published' ? 'draft' : 'published';

      const res = await fetch(`https://fissk-backend.onrender.com/api/quizzes/${quizId}/publish`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (res.status === 401) {
        alert('Session expired. Please login again.');
        window.location.href = 'login.html';
        return;
      }

      const data = await res.json();

      if (data.success) {
        this.showMessage(`✅ Quiz ${newStatus === 'published' ? 'published' : 'unpublished'}!`, 'success');
        await this.loadInstructorClasses();
      } else {
        this.showMessage('❌ ' + (data.message || 'Failed to update quiz'), 'error');
      }
    } catch (error) {
      console.error('Toggle publish error:', error);
      this.showMessage('Failed to update quiz', 'error');
    }
  }

  // ===== REQUEST WITHDRAWAL =====
  async requestWithdrawal() {
    const amount = prompt('Enter amount to withdraw (₦):');
    if (!amount) return;
    
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    
    try {
      const token = this.token || localStorage.getItem('token');
      
      if (!token) {
        alert('Please login to request withdrawal');
        return;
      }

      const res = await fetch('https://fissk-backend.onrender.com/api/payout/withdraw', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ amount: numAmount })
      });
      
      const data = await res.json();
      
      if (data.success) {
        alert('✅ Withdrawal request submitted successfully!');
        await this.loadEarnings();
        await this.loadPaymentHistory();
      } else {
        alert('❌ ' + (data.message || 'Withdrawal failed'));
      }
    } catch (error) {
      console.error('Withdrawal error:', error);
      alert('Failed to request withdrawal. Please try again.');
    }
  }

  // ===== SHOW BANK DETAILS FORM =====
  showBankDetailsForm() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 500px;">
        <span class="close-modal" onclick="this.closest('.modal').remove()">&times;</span>
        <h2>🏦 Update Bank Details</h2>
        <form id="bankDetailsForm">
          <div class="form-group">
            <label>Bank Name *</label>
            <input type="text" id="bankName" placeholder="e.g., GTBank" required>
          </div>
          <div class="form-group">
            <label>Account Number *</label>
            <input type="text" id="accountNumber" placeholder="0123456789" required>
          </div>
          <div class="form-group">
            <label>Account Name *</label>
            <input type="text" id="accountName" placeholder="John Doe" required>
          </div>
          <div class="form-group">
            <label>Bank Code *</label>
            <input type="text" id="bankCode" placeholder="058 (for GTBank)" required>
          </div>
          <div class="form-actions" style="display: flex; gap: 12px; margin-top: 20px;">
            <button type="submit" class="btn btn-primary">Save Bank Details</button>
            <button type="button" class="btn btn-outline" onclick="this.closest('.modal').remove()">Cancel</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
    
    document.getElementById('bankDetailsForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const bankName = document.getElementById('bankName').value;
      const accountNumber = document.getElementById('accountNumber').value;
      const accountName = document.getElementById('accountName').value;
      const bankCode = document.getElementById('bankCode').value;
      
      try {
        const token = this.token || localStorage.getItem('token');
        
        if (!token) {
          alert('Please login to update bank details');
          return;
        }

        const res = await fetch('https://fissk-backend.onrender.com/api/payout/bank-details', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ bankName, accountNumber, accountName, bankCode })
        });
        
        const data = await res.json();
        
        if (data.success) {
          alert('✅ Bank details updated successfully!');
          modal.remove();
          await this.loadEarnings();
        } else {
          alert('❌ ' + (data.message || 'Failed to update bank details'));
        }
      } catch (error) {
        console.error('Bank details error:', error);
        alert('Failed to update bank details. Please try again.');
      }
    });
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

            this.el.scheduledStreams.querySelectorAll('.generate-link-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const streamId = e.currentTarget.dataset.streamId;
                    const streamTitle = e.currentTarget.dataset.streamTitle;
                    this.generateMeetingLink(streamId, streamTitle);
                });
            });

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
      const btn = document.querySelector(`.generate-link-btn[data-stream-id="${streamId}"]`);
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
      
      this.copyToClipboard(meetingUrl);
      this.showMessage(`✅ Meeting link generated and copied to clipboard!`, 'success');
      
      await this.loadInstructorStreams();
      
    } catch (err) {
      console.error('Generate meeting link error:', err);
      this.showMessage(`Failed to generate meeting link: ${err.message}`, 'error');
    } finally {
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
  async apiScheduleStream() {
    try {
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
      
      if (submitBtn) this.hideButtonSpinner(submitBtn, originalText);
      
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
      
      const submitBtn = document.querySelector('#scheduleStreamForm button[type="submit"]');
      if (submitBtn) {
        submitBtn.textContent = 'Schedule Stream';
        submitBtn.disabled = false;
      }
    }
  }

  setupEventHandlers() {
    // Navigation Links
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

    // Modal Close
    document.querySelectorAll('.close-modal').forEach(el => {
        el.addEventListener('click', () => el.closest('.modal').style.display = 'none');
    });
    
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    });

    // Create Class Buttons
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
    if (this.el.viewEarningsBtn) {
        this.el.viewEarningsBtn.addEventListener('click', () => {
            this.switchSection('payments');
        });
    }

    // Schedule Buttons
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

    // Refresh Payments
    if (this.el.refreshPaymentsBtn) {
        this.el.refreshPaymentsBtn.addEventListener('click', () => {
            this.loadPaymentHistory();
            this.showMessage('🔄 Payment history refreshed!', 'success');
        });
    }

    // Create Class Form
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

    // Schedule Stream Form
    const scheduleForm = document.getElementById('scheduleStreamForm');
    if (scheduleForm) {
        scheduleForm.addEventListener('submit', async (ev) => {
            ev.preventDefault();
            await this.apiScheduleStream();
        });
    }

    // Free checkbox toggle
    const freeCheckbox = document.getElementById('classFree');
    const priceInput = document.getElementById('classPrice');
    if (freeCheckbox && priceInput) {
        freeCheckbox.addEventListener('change', () => {
            if (freeCheckbox.checked) {
                priceInput.value = 0;
                priceInput.disabled = true;
                priceInput.placeholder = 'Free';
            } else {
                priceInput.disabled = false;
                priceInput.placeholder = '2500';
                priceInput.value = '';
            }
        });
    }
  }

  escapeHtml(s) {
    if (!s) return '';
    return String(s).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[ch]);
  }

  showMessage(message, type) {
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
      background: ${type === 'success' ? '#10B981' : type === 'error' ? '#EF4444' : type === 'warning' ? '#F59E0B' : '#6C3CE1'};
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
  localStorage.removeItem('token');
  window.location.href = '/';
}

// Add spinner CSS
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

  .status-badge {
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 0.75rem;
    font-weight: 600;
  }
  .status-badge.success { background: #d4edda; color: #155724; }
  .status-badge.pending { background: #fff3cd; color: #856404; }
  .status-badge.failed { background: #f8d7da; color: #721c24; }
  .status-badge.refunded { background: #e2e3e5; color: #383d41; }

  /* Quiz styles for class cards */
  .class-quizzes-section {
    margin: 12px 0;
    padding: 12px;
    background: #f8f9fa;
    border-radius: 8px;
  }
  .no-quizzes-small {
    text-align: center;
    padding: 8px;
    color: #6B7280;
    font-size: 0.85rem;
  }
  .class-quizzes-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .class-quiz-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    background: white;
    border-radius: 6px;
    font-size: 0.85rem;
    flex-wrap: wrap;
  }
  .class-quiz-item .quiz-title {
    font-weight: 500;
    color: #1A1A2E;
    flex: 1;
    min-width: 100px;
  }
  .class-quiz-item .quiz-stats {
    color: #6B7280;
    font-size: 0.75rem;
  }
  .class-quiz-item .quiz-status-badge {
    padding: 2px 10px;
    border-radius: 12px;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
  }
  .class-quiz-item .quiz-status-badge.published {
    background: #d4edda;
    color: #155724;
  }
  .class-quiz-item .quiz-status-badge.draft {
    background: #fff3cd;
    color: #856404;
  }
  .class-quiz-item .quiz-status-badge.archived {
    background: #e2e3e5;
    color: #383d41;
  }
  .class-quiz-item .quiz-actions {
    display: flex;
    gap: 4px;
  }
  .class-quiz-item .btn-sm {
    padding: 2px 8px;
    font-size: 0.7rem;
  }
  .btn-sm {
    padding: 4px 12px;
    font-size: 0.8rem;
    border-radius: 6px;
  }
`;
document.head.appendChild(spinnerStyle);