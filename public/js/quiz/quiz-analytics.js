// ============================================================
// QUIZ ANALYTICS - View Quiz Performance
// ============================================================

(function() {
    'use strict';

    const state = {
        quizId: null,
        analytics: null,
        user: JSON.parse(localStorage.getItem('user')),
        token: localStorage.getItem('token')
    };

    const elements = {
        pageTitle: document.getElementById('pageTitle'),
        quizInfo: document.getElementById('quizInfo'),
        totalAttempts: document.getElementById('totalAttempts'),
        avgScore: document.getElementById('avgScore'),
        highestScore: document.getElementById('highestScore'),
        passRate: document.getElementById('passRate'),
        questionAnalysis: document.getElementById('questionAnalysis'),
        refreshBtn: document.getElementById('refreshBtn')
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
            QuizUtils.showToast('Please login to view analytics', 'error');
            window.location.href = '../../login.html';
            return;
        }

        loadUserData();
        await loadQuizInfo();
        await loadAnalytics();
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

            elements.pageTitle.textContent = `📊 ${quiz.title} - Analytics`;
            elements.quizInfo.textContent = `${quiz.questionCount || 0} questions • ${quiz.totalPoints || 0} points`;
        } catch (error) {
            console.error('Load quiz info error:', error);
            elements.quizInfo.textContent = 'Failed to load quiz info';
        }
    }

    // ===== LOAD ANALYTICS =====
    async function loadAnalytics() {
        try {
            const response = await fetch(`https://fissk-backend.onrender.com/api/quizzes/${state.quizId}/analytics`, {
                headers: { 'Authorization': `Bearer ${state.token}` }
            });

            if (response.status === 403) {
                QuizUtils.showToast('You do not have permission to view analytics', 'error');
                window.location.href = '../../instructor-dashboard.html';
                return;
            }

            if (!response.ok) throw new Error('Failed to load analytics');

            const data = await response.json();
            state.analytics = data.analytics;
            
            renderStats();
            renderQuestionAnalysis();
        } catch (error) {
            console.error('Load analytics error:', error);
            elements.questionAnalysis.innerHTML = `
                <p style="text-align: center; padding: 20px; color: #EF4444;">
                    ❌ Failed to load analytics: ${error.message}
                </p>
            `;
        }
    }

    // ===== RENDER STATS =====
    function renderStats() {
        const a = state.analytics;
        
        elements.totalAttempts.textContent = a.totalAttempts || 0;
        elements.avgScore.textContent = `${a.averageScore || 0}%`;
        elements.highestScore.textContent = `${a.highestScore || 0}%`;
        elements.passRate.textContent = `${a.passRate || 0}%`;
    }

    // ===== RENDER QUESTION ANALYSIS =====
    function renderQuestionAnalysis() {
        const questions = state.analytics?.questionAnalysis || [];
        
        if (questions.length === 0) {
            elements.questionAnalysis.innerHTML = `
                <p style="text-align: center; padding: 20px; color: var(--text-light);">
                    No question data available yet. Students need to take the quiz first.
                </p>
            `;
            return;
        }

        elements.questionAnalysis.innerHTML = questions.map((q, index) => {
            const correctRate = q.correctRate || 0;
            let rateClass = 'medium';
            if (correctRate >= 70) rateClass = 'high';
            else if (correctRate >= 40) rateClass = 'medium';
            else rateClass = 'low';

            return `
                <div class="question-item">
                    <span class="question-number">Q${index + 1}</span>
                    <span class="question-text">${escapeHtml(q.question || '')}</span>
                    <div class="question-stats">
                        <span>🎯 ${q.totalAttempts || 0} attempts</span>
                        <span class="correct-rate ${rateClass}">${correctRate}% correct</span>
                        <span>⭐ ${q.averagePoints || 0}/${q.maxPoints || 1} avg pts</span>
                        <div class="progress-bar-mini">
                            <div class="fill" style="width: ${correctRate}%; background: ${correctRate >= 70 ? '#10B981' : correctRate >= 40 ? '#F59E0B' : '#EF4444'};"></div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // ===== HELPERS =====
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function logout() {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        window.location.href = '../../login.html';
    }

    // ===== EVENT LISTENERS =====
    function setupEventListeners() {
        elements.refreshBtn.addEventListener('click', async () => {
            elements.refreshBtn.textContent = '⏳ Refreshing...';
            elements.refreshBtn.disabled = true;
            await loadAnalytics();
            elements.refreshBtn.textContent = '🔄 Refresh';
            elements.refreshBtn.disabled = false;
            QuizUtils.showToast('✅ Analytics refreshed!', 'success');
        });
    }

    // ===== START =====
    document.addEventListener('DOMContentLoaded', init);
})();