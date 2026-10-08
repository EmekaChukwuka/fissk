// ============================================================
// QUIZ RESULTS - Display Quiz Results (FIXED with Loading States)
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
    
    // ===== LOADING STATE HELPERS =====
    function showLoading() {
        const section = document.getElementById('resultsSection');
        const loading = document.getElementById('resultsLoading');
        const error = document.getElementById('resultsError');
        const summary = document.getElementById('resultsSummary');
        const questions = document.getElementById('resultsQuestions');
        const actions = document.getElementById('resultsActions');

        if (section) section.classList.remove('loaded');
        if (loading) loading.style.display = 'flex';
        if (error) error.style.display = 'none';
        if (summary) summary.style.display = 'none';
        if (questions) questions.style.display = 'none';
        if (actions) actions.style.display = 'none';
    }
    
    function showResults() {
        const section = document.getElementById('resultsSection');
        const loading = document.getElementById('resultsLoading');
        const error = document.getElementById('resultsError');
        const summary = document.getElementById('resultsSummary');
        const questions = document.getElementById('resultsQuestions');
        const actions = document.getElementById('resultsActions');

        if (loading) loading.style.display = 'none';
        if (error) error.style.display = 'none';
        if (summary) summary.style.display = 'block';
        if (questions) questions.style.display = 'block';
        if (actions) actions.style.display = 'flex';
        if (section) section.classList.add('loaded');
    }
    
    function showError(message) {
        const section = document.getElementById('resultsSection');
        const loading = document.getElementById('resultsLoading');
        const error = document.getElementById('resultsError');
        const summary = document.getElementById('resultsSummary');
        const questions = document.getElementById('resultsQuestions');
        const actions = document.getElementById('resultsActions');
        const errorMsg = document.getElementById('errorMessage');

        if (loading) loading.style.display = 'none';
        if (summary) summary.style.display = 'none';
        if (questions) questions.style.display = 'none';
        if (actions) actions.style.display = 'none';
        if (error) error.style.display = 'flex';
        if (errorMsg && message) errorMsg.textContent = message;
        if (section) section.classList.remove('loaded');
    }
    
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
        
        // ===== SHOW LOADING IMMEDIATELY =====
        showLoading();
        
        // Safety timeout: if results don't load in 15 seconds, show error
        const safetyTimeout = setTimeout(() => {
            const section = document.getElementById('resultsSection');
            if (section && !section.classList.contains('loaded')) {
                showError('Taking too long to load. Please check your connection and try again.');
            }
        }, 15000);
        
        try {
            await loadResults();
            
            // Clear the safety timeout since we loaded successfully
            clearTimeout(safetyTimeout);
            
            renderResults();
            setupEventListeners();
            
            // ===== HIDE LOADING, SHOW RESULTS =====
            showResults();
        } catch (error) {
            clearTimeout(safetyTimeout);
            console.error('Init error:', error);
            
            if (error.message === 'You do not have permission to view these results' ||
                error.message.includes('permission')) {
                // Show a friendly message in the error container
                showError(error.message || 'You do not have permission to view these results.');
            } else if (error.message.includes('login')) {
                QuizUtils.showToast(error.message, 'error');
                setTimeout(() => {
                    window.location.href = '../login.html';
                }, 1500);
            } else {
                showError(error.message || 'Failed to load quiz results');
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
            
            if (response.status === 404) {
                throw new Error('Quiz attempt not found. It may have been deleted.');
            }
            
            if (!response.ok) {
                throw new Error(`Failed to load results (${response.status})`);
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