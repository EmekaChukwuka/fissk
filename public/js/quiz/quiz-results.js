// public/js/quiz/quiz-results.js

// ============================================================
// QUIZ RESULTS - Display Quiz Results (FIXED)
// ============================================================

(function() {
    'use strict';
    
    // ===== STATE =====
    const state = {
        attemptId: null,
        results: null,
        attempt: null
    };
    
    // ===== DOM REFERENCES =====
    const elements = {
        title: document.getElementById('quizTitle'),
        description: document.getElementById('quizDescription'),
        scoreNumber: document.getElementById('scoreNumber'),
        scoreCircle: document.getElementById('scoreCircle'),
        earnedPoints: document.getElementById('earnedPoints'),
        passStatus: document.getElementById('passStatus'),
        timeSpent: document.getElementById('timeSpent'),
        attemptNumber: document.getElementById('attemptNumber'),
        questionsReview: document.getElementById('questionsReview'),
        retakeBtn: document.getElementById('retakeBtn'),
        errorContainer: document.getElementById('resultsError')
    };
    
    // ===== INITIALIZATION =====
    async function init() {
        state.attemptId = QuizUtils.getQueryParam('attemptId');
        
        if (!state.attemptId) {
            QuizUtils.showToast('No results specified', 'error');
            window.location.href = '../classes.html';
            return;
        }
        
        // Check for token
        const token = localStorage.getItem('token');
        if (!token) {
            QuizUtils.showToast('Please login to view results', 'error');
            window.location.href = '../login.html';
            return;
        }
        
        try {
            await loadResults();
            renderResults();
            setupEventListeners();
        } catch (error) {
            console.error('Init error:', error);
            
            if (error.message === 'You do not have permission to view these results') {
                // Show a friendly message
                const container = document.querySelector('.results-section .container');
                if (container) {
                    container.innerHTML = `
                        <div class="error-container" style="text-align: center; padding: 60px 20px;">
                            <div style="font-size: 4rem; margin-bottom: 20px;">🔒</div>
                            <h2 style="color: #1A1A2E; margin-bottom: 12px;">Access Denied</h2>
                            <p style="color: #6B7280; font-size: 1.1rem; max-width: 500px; margin: 0 auto 24px;">
                                You don't have permission to view these results. 
                                ${error.message.includes('instructor') ? 'Only the quiz creator can view these results.' : 'Please make sure you are logged in as the correct user.'}
                            </p>
                            <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
                                <a href="../dashboard.html" class="btn btn-primary">Go to Dashboard</a>
                                <a href="../classes.html" class="btn btn-outline">Browse Classes</a>
                            </div>
                        </div>
                    `;
                }
            } else {
                QuizUtils.showToast(error.message || 'Failed to load results', 'error');
            }
        }
    }
    
    // ===== LOAD RESULTS =====
    async function loadResults() {
        try {
            const token = localStorage.getItem('token');
            console.log('Loading results for attempt:', state.attemptId);
            
            const response = await fetch(
                `https://fissk-backend.onrender.com/api/quizzes/attempt/${state.attemptId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            console.log('Response status:', response.status);
            
            if (response.status === 403) {
                const data = await response.json();
                throw new Error(data.message || 'You do not have permission to view these results');
            }
            
            if (response.status === 401) {
                throw new Error('Please login to view results');
            }
            
            if (!response.ok) {
                throw new Error('Failed to load results');
            }
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.message || 'Results not found');
            }
            
            state.results = data.results;
            state.attempt = data.attempt;
            
            console.log('Results loaded successfully');
        } catch (error) {
            console.error('Load results error:', error);
            throw error;
        }
    }
    
    // ===== RENDER RESULTS =====
    function renderResults() {
        const { results, attempt } = state;
        
        if (!results || !attempt) {
            throw new Error('No results data available');
        }
        
        // Title
        if (elements.title) {
            elements.title.textContent = attempt.quizId?.title || 'Quiz Results';
        }
        if (elements.description) {
            elements.description.textContent = attempt.quizId?.description || '';
        }
        
        // Score
        const score = results.score || 0;
        if (elements.scoreNumber) {
            elements.scoreNumber.textContent = `${score}%`;
        }
        
        // Score circle color
        const circle = elements.scoreCircle;
        if (circle) {
            circle.className = 'score-circle';
            if (score >= 80) circle.classList.add('excellent');
            else if (score >= 60) circle.classList.add('good');
            else if (score >= 40) circle.classList.add('average');
            else circle.classList.add('poor');
        }
        
        // Points
        if (elements.earnedPoints) {
            elements.earnedPoints.textContent = `${results.earnedPoints || 0} / ${results.totalPoints || 0}`;
        }
        
        // Status
        const passed = results.passed || false;
        if (elements.passStatus) {
            elements.passStatus.textContent = passed ? '✅ Passed' : '❌ Failed';
            elements.passStatus.style.color = passed ? '#10B981' : '#EF4444';
        }
        
        // Time spent
        if (elements.timeSpent) {
            elements.timeSpent.textContent = QuizUtils.formatTime(results.timeSpent || 0);
        }
        
        // Attempt number
        if (elements.attemptNumber) {
            elements.attemptNumber.textContent = attempt.attemptNumber || 1;
        }
        
        // Show retake button if allowed
        const canRetake = attempt.quizId?.settings?.allowRetake || false;
        const maxAttempts = attempt.quizId?.settings?.maxAttempts || 1;
        if (elements.retakeBtn && canRetake && attempt.attemptNumber < maxAttempts) {
            elements.retakeBtn.style.display = 'inline-block';
        }
        
        // Render questions review
        renderQuestionsReview();
    }
    
    // ===== RENDER QUESTIONS REVIEW =====
    function renderQuestionsReview() {
        const { results } = state;
        const questions = results.questions || [];
        
        if (!elements.questionsReview) return;
        
        if (questions.length === 0) {
            elements.questionsReview.innerHTML = '<p>No questions to review.</p>';
            return;
        }
        
        elements.questionsReview.innerHTML = questions.map((q, index) => {
            const isCorrect = q.isCorrect === true;
            const isIncorrect = q.isCorrect === false;
            const isEssay = q.type === 'essay';
            const isPending = q.isCorrect === null && isEssay;
            
            let statusIcon = '❓';
            let statusClass = 'pending';
            
            if (isCorrect) {
                statusIcon = '✅';
                statusClass = 'correct';
            } else if (isIncorrect) {
                statusIcon = '❌';
                statusClass = 'incorrect';
            } else if (isPending) {
                statusIcon = '⏳';
                statusClass = 'pending';
            }
            
            const userAnswer = q.userAnswer !== undefined && q.userAnswer !== null ? q.userAnswer : 'Not answered';
            const correctAnswer = q.correctAnswer !== undefined && q.correctAnswer !== null ? q.correctAnswer : 'N/A';
            
            const formatAnswer = (answer) => {
                if (Array.isArray(answer)) {
                    if (answer.length === 0) return 'None selected';
                    return answer.map(a => {
                        if (typeof a === 'number' && q.options && q.options[a]) {
                            return q.options[a];
                        }
                        return a;
                    }).join(', ');
                }
                if (typeof answer === 'number' && q.options && q.options[answer]) {
                    return q.options[answer];
                }
                if (typeof answer === 'string' && answer.length > 100) {
                    return answer.substring(0, 100) + '...';
                }
                return answer || 'Not answered';
            };
            
            const displayUserAnswer = formatAnswer(userAnswer);
            const displayCorrectAnswer = formatAnswer(correctAnswer);
            
            return `
                <div class="review-question ${statusClass}">
                    <div class="review-question-header">
                        <span class="question-status">${statusIcon}</span>
                        <span class="question-number">Question ${index + 1}</span>
                        <span class="question-type">${q.type || 'Unknown'}</span>
                        <span class="question-points">${q.pointsEarned || 0}/${q.points || 1} pts</span>
                    </div>
                    <div class="review-question-text">${QuizUtils.escapeHtml(q.question || '')}</div>
                    <div class="review-answer">
                        <div class="review-answer-row">
                            <span class="answer-label">Your Answer:</span>
                            <span class="answer-value ${isCorrect ? 'correct' : isIncorrect ? 'incorrect' : 'pending'}">
                                ${QuizUtils.escapeHtml(displayUserAnswer)}
                            </span>
                        </div>
                        ${(!isCorrect && !isPending) ? `
                            <div class="review-answer-row">
                                <span class="answer-label">Correct Answer:</span>
                                <span class="answer-value correct">
                                    ${QuizUtils.escapeHtml(displayCorrectAnswer)}
                                </span>
                            </div>
                        ` : ''}
                        ${q.explanation ? `
                            <div class="review-explanation">
                                <span class="explanation-label">💡 Explanation:</span>
                                <p>${QuizUtils.escapeHtml(q.explanation)}</p>
                            </div>
                        ` : ''}
                        ${q.instructorFeedback ? `
                            <div class="review-feedback">
                                <span class="feedback-label">📝 Instructor Feedback:</span>
                                <p>${QuizUtils.escapeHtml(q.instructorFeedback)}</p>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }
    
    // ===== EVENT LISTENERS =====
    function setupEventListeners() {
        if (elements.retakeBtn) {
            elements.retakeBtn.addEventListener('click', () => {
                const quizId = state.attempt?.quizId?._id;
                if (quizId) {
                    window.location.href = `take.html?quizId=${quizId}`;
                }
            });
        }
    }
    
    // ===== START =====
    document.addEventListener('DOMContentLoaded', init);
})();