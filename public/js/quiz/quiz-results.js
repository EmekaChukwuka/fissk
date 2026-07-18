// ============================================================
// QUIZ RESULTS - Display Quiz Results
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
        retakeBtn: document.getElementById('retakeBtn')
    };
    
    // ===== INITIALIZATION =====
    async function init() {
        state.attemptId = QuizUtils.getQueryParam('attemptId');
        
        if (!state.attemptId) {
            QuizUtils.showToast('No results specified', 'error');
            window.location.href = '../classes.html';
            return;
        }
        
        try {
            await loadResults();
            renderResults();
            setupEventListeners();
        } catch (error) {
            console.error('Init error:', error);
            QuizUtils.showToast(error.message || 'Failed to load results', 'error');
        }
    }
    
    // ===== LOAD RESULTS =====
    async function loadResults() {
        const data = await QuizUtils.apiRequest(
            QuizUtils.API.getAttemptResults(state.attemptId)
        );
        
        if (!data.success) {
            throw new Error(data.message || 'Results not found');
        }
        
        state.results = data.results;
        state.attempt = data.attempt;
    }
    
    // ===== RENDER RESULTS =====
    function renderResults() {
        const { results, attempt } = state;
        
        // Title
        elements.title.textContent = attempt.quizId?.title || 'Quiz Results';
        elements.description.textContent = attempt.quizId?.description || '';
        
        // Score
        elements.scoreNumber.textContent = `${results.score || 0}%`;
        
        // Score circle color
        const score = results.score || 0;
        const circle = elements.scoreCircle;
        circle.className = 'score-circle';
        if (score >= 80) circle.classList.add('excellent');
        else if (score >= 60) circle.classList.add('good');
        else if (score >= 40) circle.classList.add('average');
        else circle.classList.add('poor');
        
        // Points
        elements.earnedPoints.textContent = `${results.earnedPoints || 0} / ${results.totalPoints || 0}`;
        
        // Status
        const passed = results.passed || false;
        elements.passStatus.textContent = passed ? '✅ Passed' : '❌ Failed';
        elements.passStatus.style.color = passed ? '#10B981' : '#EF4444';
        
        // Time spent
        elements.timeSpent.textContent = QuizUtils.formatTime(results.timeSpent || 0);
        
        // Attempt number
        elements.attemptNumber.textContent = attempt.attemptNumber || 1;
        
        // Show retake button if allowed
        const canRetake = attempt.quizId?.settings?.allowRetake || false;
        const maxAttempts = attempt.quizId?.settings?.maxAttempts || 1;
        if (canRetake && attempt.attemptNumber < maxAttempts) {
            elements.retakeBtn.style.display = 'inline-block';
        }
        
        // Render questions review
        renderQuestionsReview();
    }
    
    // ===== RENDER QUESTIONS REVIEW =====
    function renderQuestionsReview() {
        const { results } = state;
        const questions = results.questions || [];
        
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
            
            // Format answer display
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
        elements.retakeBtn.addEventListener('click', () => {
            const quizId = state.attempt?.quizId?._id;
            if (quizId) {
                window.location.href = `take.html?quizId=${quizId}`;
            }
        });
    }
    
    // ===== START =====
    document.addEventListener('DOMContentLoaded', init);
})();