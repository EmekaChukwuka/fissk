// ============================================================
// QUIZ SUBMISSIONS - View and Grade Student Submissions
// ============================================================

(function() {
    'use strict';

    const state = {
        quizId: null,
        submissions: [],
        filteredSubmissions: [],
        user: JSON.parse(localStorage.getItem('user')),
        token: localStorage.getItem('token')
    };

    const elements = {
        pageTitle: document.getElementById('pageTitle'),
        quizInfo: document.getElementById('quizInfo'),
        searchInput: document.getElementById('searchInput'),
        submissionsBody: document.getElementById('submissionsBody'),
        totalSubmissions: document.getElementById('totalSubmissions'),
        avgScore: document.getElementById('avgScore'),
        passedCount: document.getElementById('passedCount'),
        failedCount: document.getElementById('failedCount')
    };

    // ===== INIT =====
    async function init() {
        state.quizId = QuizUtils.getQueryParam('quizId');
        
        if (!state.quizId) {
            QuizUtils.showToast('No quiz specified', 'error');
            window.location.href = '../../instructor-dashboard.html';
            return;
        }

        if (!state.user || !state.token) {
            QuizUtils.showToast('Please login to view submissions', 'error');
            window.location.href = '../../login.html';
            return;
        }

        loadUserData();
        await loadQuizInfo();
        await loadSubmissions();
        setupEventListeners();
    }

    // ===== LOAD USER DATA =====
    function loadUserData() {
        const userDropdown = document.getElementById('user-dropdown');
        if (userDropdown && state.user) {
            userDropdown.innerHTML = `
                <img src="https://ui-avatars.com/api/?name=${state.user.firstname}+${state.user.lastname}&background=8B5FBF&color=fff" alt="User" class="user-avatar">
                <span>${state.user.firstname}</span>
                <div class="dropdown-content">
                    <a href="../../profile.html">Profile</a>
                    <a href="#" class="logout" onclick="logout()">Logout</a>
                </div>
            `;
        }
    }

    // ===== LOAD QUIZ INFO =====
    async function loadQuizInfo() {
        try {
            const response = await fetch(`https://fissk-backend.onrender.com/api/quizzes/${state.quizId}`, {
                headers: { 'Authorization': `Bearer ${state.token}` }
            });

            if (!response.ok) throw new Error('Failed to load quiz info');

            const data = await response.json();
            const quiz = data.quiz;

            elements.pageTitle.textContent = `📝 ${quiz.title} - Submissions`;
            elements.quizInfo.textContent = `${quiz.questionCount || 0} questions • ${quiz.totalPoints || 0} points`;
        } catch (error) {
            console.error('Load quiz info error:', error);
            elements.quizInfo.textContent = 'Failed to load quiz info';
        }
    }

    // ===== LOAD SUBMISSIONS =====
    async function loadSubmissions() {
        try {
            const response = await fetch(`https://fissk-backend.onrender.com/api/quizzes/${state.quizId}/submissions`, {
                headers: { 'Authorization': `Bearer ${state.token}` }
            });

            if (response.status === 403) {
                QuizUtils.showToast('You do not have permission to view these submissions', 'error');
                window.location.href = '../../instructor-dashboard.html';
                return;
            }

            if (!response.ok) throw new Error('Failed to load submissions');

            const data = await response.json();
            state.submissions = data.submissions || [];
            state.filteredSubmissions = [...state.submissions];
            
            renderStats();
            renderSubmissions();
        } catch (error) {
            console.error('Load submissions error:', error);
            elements.submissionsBody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 40px; color: #EF4444;">
                        ❌ Failed to load submissions: ${error.message}
                    </td>
                </tr>
            `;
        }
    }

    // ===== RENDER STATS =====
    function renderStats() {
        const subs = state.filteredSubmissions;
        const total = subs.length;
        const scores = subs.map(s => s.score || 0);
        const avg = total > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / total) : 0;
        const passed = subs.filter(s => s.passed).length;
        const failed = total - passed;

        elements.totalSubmissions.textContent = total;
        elements.avgScore.textContent = `${avg}%`;
        elements.passedCount.textContent = passed;
        elements.failedCount.textContent = failed;
    }

    // ===== RENDER SUBMISSIONS =====
    function renderSubmissions() {
        const subs = state.filteredSubmissions;
        
        if (subs.length === 0) {
            elements.submissionsBody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 40px; color: var(--text-light);">
                        <div class="no-submissions">
                            <span class="icon">📭</span>
                            <p>No submissions yet for this quiz.</p>
                            <p style="font-size: 0.85rem; color: var(--text-light);">Students will appear here once they submit the quiz.</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        elements.submissionsBody.innerHTML = subs.map(sub => {
            const status = sub.status || 'completed';
            const statusClass = status === 'graded' ? 'graded' : status === 'pending' ? 'pending' : 'completed';
            const studentName = sub.studentName || sub.userId?.firstName ? 
                `${sub.userId?.firstName || ''} ${sub.userId?.lastName || ''}`.trim() : 
                'Anonymous';
            
            return `
                <tr>
                    <td><strong>${escapeHtml(studentName)}</strong></td>
                    <td>
                        <span style="font-weight: 600; color: ${sub.score >= 70 ? '#10B981' : sub.score >= 40 ? '#F59E0B' : '#EF4444'};">
                            ${sub.score || 0}%
                        </span>
                    </td>
                    <td>
                        <span class="status-badge ${statusClass}">
                            ${status === 'graded' ? '✅ Graded' : status === 'pending' ? '⏳ Pending' : '📝 Completed'}
                        </span>
                    </td>
                    <td>${sub.attemptNumber || 1}</td>
                    <td>${formatTime(sub.timeSpent || 0)}</td>
                    <td>${sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString() : '—'}</td>
                    <td>
                        <button class="btn-sm btn-primary view-submission-btn" data-attempt-id="${sub._id}">
                            👁️ View
                        </button>
                        ${sub.status === 'pending' || sub.status === 'completed' ? `
                            <button class="btn-sm btn-success grade-btn" data-attempt-id="${sub._id}">
                                📝 Grade
                            </button>
                        ` : ''}
                    </td>
                </tr>
            `;
        }).join('');

        // Add event listeners
        document.querySelectorAll('.view-submission-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const attemptId = btn.dataset.attemptId;
                window.open(`../../quiz/results.html?attemptId=${attemptId}`, '_blank');
            });
        });

        document.querySelectorAll('.grade-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const attemptId = btn.dataset.attemptId;
                openGradingModal(attemptId);
            });
        });
    }

    // ===== OPEN GRADING MODAL =====
    async function openGradingModal(attemptId) {
        try {
            const response = await fetch(`https://fissk-backend.onrender.com/api/quizzes/attempt/${attemptId}`, {
                headers: { 'Authorization': `Bearer ${state.token}` }
            });

            if (!response.ok) throw new Error('Failed to load attempt');

            const data = await response.json();
            const attempt = data.attempt;
            const results = data.results;

            // Build essay questions HTML
            let essayQuestionsHTML = '';
            let hasEssayQuestions = false;

            if (results && results.questions) {
                results.questions.forEach((q, index) => {
                    if (q.type === 'essay') {
                        hasEssayQuestions = true;
                        essayQuestionsHTML += `
                            <div class="essay-grading-item" style="background: var(--gray-light); padding: 16px; border-radius: 12px; margin-bottom: 16px; border: 1px solid var(--border);">
                                <h4 style="margin-bottom: 8px;">Question ${index + 1}</h4>
                                <p style="color: var(--text-dark); margin-bottom: 12px;">${escapeHtml(q.question || '')}</p>
                                <div style="background: white; padding: 12px; border-radius: 8px; margin-bottom: 12px;">
                                    <strong>Student's Answer:</strong>
                                    <p style="margin-top: 4px; color: var(--text-dark); white-space: pre-wrap;">${escapeHtml(q.userAnswer || 'No answer provided')}</p>
                                </div>
                                <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
                                    <div style="flex: 1;">
                                        <label style="display: block; font-weight: 500; font-size: 0.85rem; color: var(--text-dark);">Points (0-${q.points || 1})</label>
                                        <input type="number" class="essay-points" data-index="${index}" value="${q.pointsEarned || 0}" min="0" max="${q.points || 1}" style="width: 80px; padding: 6px 10px; border: 1px solid var(--border); border-radius: 6px;">
                                    </div>
                                    <div style="flex: 2;">
                                        <label style="display: block; font-weight: 500; font-size: 0.85rem; color: var(--text-dark);">Feedback</label>
                                        <input type="text" class="essay-feedback" data-index="${index}" placeholder="Add feedback..." value="${escapeHtml(q.instructorFeedback || '')}" style="width: 100%; padding: 6px 10px; border: 1px solid var(--border); border-radius: 6px;">
                                    </div>
                                </div>
                            </div>
                        `;
                    }
                });
            }

            // Create modal
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.display = 'flex';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 700px; max-height: 90vh; overflow-y: auto;">
                    <span class="close-modal" onclick="this.closest('.modal').remove()">&times;</span>
                    <h2>📝 Grade Essay Questions</h2>
                    <p style="color: var(--text-light); margin-bottom: 20px;">
                        Student: <strong>${escapeHtml(attempt.userId?.firstName || 'Unknown')} ${escapeHtml(attempt.userId?.lastName || '')}</strong>
                    </p>
                    
                    <div id="essayQuestions">
                        ${essayQuestionsHTML || '<p style="text-align: center; padding: 20px; color: var(--text-light);">No essay questions to grade.</p>'}
                    </div>

                    <div class="form-actions" style="display: flex; gap: 12px; margin-top: 20px; justify-content: flex-end;">
                        <button class="btn btn-outline" onclick="this.closest('.modal').remove()">Cancel</button>
                        <button class="btn btn-primary" id="saveGradesBtn">💾 Save Grades</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            // Save grades button
            document.getElementById('saveGradesBtn').addEventListener('click', async () => {
                await saveGrades(attemptId);
                modal.remove();
            });

        } catch (error) {
            console.error('Open grading modal error:', error);
            QuizUtils.showToast('Failed to load attempt for grading: ' + error.message, 'error');
        }
    }

    // ===== SAVE GRADES =====
    async function saveGrades(attemptId) {
        try {
            const pointsInputs = document.querySelectorAll('.essay-points');
            const feedbackInputs = document.querySelectorAll('.essay-feedback');

            const grades = [];
            pointsInputs.forEach((input) => {
                const index = parseInt(input.dataset.index);
                const feedbackInput = document.querySelector(`.essay-feedback[data-index="${index}"]`);
                grades.push({
                    questionIndex: index,
                    points: parseInt(input.value) || 0,
                    feedback: feedbackInput ? feedbackInput.value : ''
                });
            });

            if (grades.length === 0) {
                QuizUtils.showToast('No essay questions to grade', 'info');
                return;
            }

            const btn = document.getElementById('saveGradesBtn');
            btn.disabled = true;
            btn.textContent = '⏳ Saving...';

            // Save each grade
            for (const grade of grades) {
                const response = await fetch(`https://fissk-backend.onrender.com/api/quizzes/attempt/${attemptId}/grade`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${state.token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        questionIndex: grade.questionIndex,
                        points: grade.points,
                        feedback: grade.feedback
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Failed to save grade');
                }
            }

            QuizUtils.showToast('✅ Grades saved successfully!', 'success');
            await loadSubmissions();

        } catch (error) {
            console.error('Save grades error:', error);
            QuizUtils.showToast('Failed to save grades: ' + error.message, 'error');
        } finally {
            const btn = document.getElementById('saveGradesBtn');
            if (btn) {
                btn.disabled = false;
                btn.textContent = '💾 Save Grades';
            }
        }
    }

    // ===== HELPERS =====
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function formatTime(seconds) {
        if (!seconds || seconds < 0) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    function logout() {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        window.location.href = '../../login.html';
    }

    // ===== EVENT LISTENERS =====
    function setupEventListeners() {
        // Search filter
        elements.searchInput.addEventListener('input', () => {
            const search = elements.searchInput.value.toLowerCase();
            state.filteredSubmissions = state.submissions.filter(sub => {
                const name = sub.studentName || sub.userId?.firstName || '';
                return name.toLowerCase().includes(search);
            });
            renderStats();
            renderSubmissions();
        });

        // Close modal on overlay click
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.remove();
            }
        });
    }

    // ===== START =====
    document.addEventListener('DOMContentLoaded', init);
})();