// ============================================================
// QUIZ TAKE - Main Quiz Taking Logic
// ============================================================

(function() {
    'use strict';
    
    // ===== STATE =====
    const state = {
        quizId: null,
        attemptId: null,
        questions: [],
        currentIndex: 0,
        answers: {},
        timeLimit: 0,
        timeRemaining: 0,
        timerInterval: null,
        isSubmitted: false,
        isLoading: true,
        startTime: null,
        totalQuestions: 0
    };
    
    // ===== DOM REFERENCES =====
    const elements = {
        loading: document.getElementById('loadingState'),
        header: document.getElementById('quizHeader'),
        title: document.getElementById('quizTitle'),
        description: document.getElementById('quizDescription'),
        timer: document.getElementById('timerDisplay'),
        progressFill: document.getElementById('progressFill'),
        questionNumber: document.getElementById('questionNumber'),
        questionText: document.getElementById('questionText'),
        questionOptions: document.getElementById('questionOptions'),
        prevBtn: document.getElementById('prevBtn'),
        nextBtn: document.getElementById('nextBtn'),
        submitBtn: document.getElementById('submitQuizBtn'),
        submitInfo: document.getElementById('submitInfo'),
        answeredCount: document.getElementById('answeredCount'),
        totalCount: document.getElementById('totalCount'),
        questionCounter: document.getElementById('questionCounter'),
        answeredCounter: document.getElementById('answeredCounter'),
        confirmModal: document.getElementById('confirmModal'),
        confirmAnswered: document.getElementById('confirmAnswered'),
        confirmTotal: document.getElementById('confirmTotal'),
        confirmTime: document.getElementById('confirmTime'),
        cancelSubmit: document.getElementById('cancelSubmitBtn'),
        confirmSubmit: document.getElementById('confirmSubmitBtn')
    };
    
    // ===== INITIALIZATION =====
    async function init() {
        state.quizId = QuizUtils.getQueryParam('quizId');
        
        if (!state.quizId) {
            QuizUtils.showToast('No quiz specified', 'error');
            window.location.href = '../classes.html';
            return;
        }
        
        // Check for token
        const token = localStorage.getItem('token');
        if (!token) {
            QuizUtils.showToast('Please login to take this quiz', 'error');
            window.location.href = '../login.html';
            return;
        }
        
        try {
            await loadQuiz();
            await startAttempt();
            setupEventListeners();
            renderQuestion();
            state.isLoading = false;
            if (elements.loading) elements.loading.style.display = 'none';
        } catch (error) {
            console.error('Init error:', error);
            QuizUtils.showToast(error.message || 'Failed to load quiz', 'error');
            if (elements.loading) {
                elements.loading.innerHTML = `
                    <p style="color: #EF4444;">❌ ${error.message}</p>
                    <button class="btn btn-primary" onclick="location.reload()">Retry</button>
                `;
            }
        }
    }
    
    // ===== LOAD QUIZ =====
    async function loadQuiz() {
        try {
            console.log('Loading quiz:', state.quizId);
            const data = await QuizUtils.apiRequest(
                QuizUtils.API.getQuiz(state.quizId)
            );
            
            if (!data.success || !data.quiz) {
                throw new Error('Quiz not found');
            }
            
            const quiz = data.quiz;
            state.questions = quiz.questions || [];
            state.totalQuestions = state.questions.length;
            state.timeLimit = quiz.settings?.timeLimit || 0;
            state.timeRemaining = state.timeLimit * 60; // Convert to seconds
            
            if (elements.title) elements.title.textContent = quiz.title || 'Untitled Quiz';
            if (elements.description) elements.description.textContent = quiz.description || '';
            if (elements.totalCount) elements.totalCount.textContent = state.totalQuestions;
            if (elements.confirmTotal) elements.confirmTotal.textContent = state.totalQuestions;
            
            document.title = `${quiz.title} - FISSK Quiz`;
            
            // Check if there's an in-progress attempt
            if (quiz.attemptId) {
                state.attemptId = quiz.attemptId;
                state.answers = quiz.answers || {};
                // Calculate answered count
                const answered = Object.keys(state.answers).length;
                if (elements.answeredCount) elements.answeredCount.textContent = answered;
                if (elements.confirmAnswered) elements.confirmAnswered.textContent = answered;
                if (elements.answeredCounter) elements.answeredCounter.textContent = `${answered} answered`;
            }
            
            // Update question counter
            updateQuestionCounter();
        } catch (error) {
            console.error('Load quiz error:', error);
            throw new Error(error.message || 'Failed to load quiz');
        }
    }
    
    // ===== START ATTEMPT =====
    async function startAttempt() {
        try {
            const data = await QuizUtils.apiRequest(
                QuizUtils.API.startAttempt(state.quizId),
                'POST'
            );
            
            if (!data.success) {
                throw new Error(data.message || 'Failed to start quiz');
            }
            
            state.attemptId = data.attempt._id;
            state.startTime = new Date();
            
            // Start timer
            if (state.timeLimit > 0) {
                startTimer();
            } else if (elements.timer) {
                elements.timer.textContent = '∞';
            }
        } catch (error) {
            console.error('Start attempt error:', error);
            throw new Error(error.message || 'Failed to start quiz attempt');
        }
    }
    
    // ===== TIMER =====
    function startTimer() {
        updateTimerDisplay();
        state.timerInterval = setInterval(() => {
            state.timeRemaining--;
            updateTimerDisplay();
            
            // Warning at 25%
            if (state.timeRemaining === Math.floor(state.timeLimit * 60 * 0.25)) {
                QuizUtils.showToast('⏰ 25% of time remaining!', 'warning');
            }
            
            // Auto-submit when time runs out
            if (state.timeRemaining <= 0) {
                clearInterval(state.timerInterval);
                QuizUtils.showToast('⏰ Time is up! Submitting quiz...', 'error');
                submitQuiz();
            }
        }, 1000);
    }
    
    function updateTimerDisplay() {
        if (!elements.timer) return;
        elements.timer.textContent = QuizUtils.formatTime(state.timeRemaining);
        
        // Color change based on time remaining
        const percent = state.timeRemaining / (state.timeLimit * 60);
        if (percent < 0.1) {
            elements.timer.style.color = '#EF4444';
        } else if (percent < 0.25) {
            elements.timer.style.color = '#F59E0B';
        } else {
            elements.timer.style.color = '#10B981';
        }
    }
    
    // ===== RENDER QUESTION =====
    function renderQuestion() {
        const index = state.currentIndex;
        const question = state.questions[index];
        
        if (!question) {
            if (elements.questionText) elements.questionText.textContent = 'No questions available';
            if (elements.questionOptions) elements.questionOptions.innerHTML = '';
            return;
        }
        
        // Question number
        if (elements.questionNumber) {
            elements.questionNumber.textContent = `Question ${index + 1} of ${state.totalQuestions}`;
        }
        
        // Question text
        if (elements.questionText) {
            elements.questionText.textContent = question.question || 'Question text missing';
            if (question.imageUrl) {
                elements.questionText.innerHTML += `<br><img src="${question.imageUrl}" alt="Question image" class="question-image">`;
            }
        }
        
        // Options
        renderOptions(question, index);
        
        // Update navigation buttons
        if (elements.prevBtn) elements.prevBtn.disabled = index === 0;
        if (elements.nextBtn) {
            elements.nextBtn.textContent = index === state.totalQuestions - 1 ? '📝 Review' : 'Next →';
        }
        
        // Update progress
        const progress = ((index + 1) / state.totalQuestions) * 100;
        if (elements.progressFill) {
            elements.progressFill.style.width = `${Math.min(progress, 100)}%`;
        }
        
        // Update question counter
        updateQuestionCounter();
        
        // Scroll to top of question
        const container = document.querySelector('.quiz-question-container');
        if (container) container.scrollIntoView({ behavior: 'smooth' });
    }
    
    // ===== RENDER OPTIONS =====
    function renderOptions(question, index) {
        const container = elements.questionOptions;
        if (!container) return;
        container.innerHTML = '';
        
        if (!question.options || question.options.length === 0) {
            if (question.type === 'essay') {
                renderEssayOption(container, index);
                return;
            }
            container.innerHTML = '<p>No options available</p>';
            return;
        }
        
        const selected = state.answers[index];
        
        question.options.forEach((option, optionIndex) => {
            const label = document.createElement('label');
            label.className = `option-label ${selected === optionIndex ? 'selected' : ''}`;
            
            let input;
            if (question.type === 'multiple-answer') {
                input = document.createElement('input');
                input.type = 'checkbox';
                input.name = `question_${index}`;
                input.value = optionIndex;
                input.checked = selected && selected.includes(optionIndex);
                input.addEventListener('change', () => handleOptionChange(index, optionIndex, true));
            } else {
                input = document.createElement('input');
                input.type = 'radio';
                input.name = `question_${index}`;
                input.value = optionIndex;
                input.checked = selected === optionIndex;
                input.addEventListener('change', () => handleOptionChange(index, optionIndex, false));
            }
            
            label.appendChild(input);
            label.appendChild(document.createTextNode(` ${QuizUtils.escapeHtml(option)}`));
            
            container.appendChild(label);
        });
    }
    
    // ===== RENDER ESSAY OPTION =====
    function renderEssayOption(container, index) {
        const textarea = document.createElement('textarea');
        textarea.className = 'essay-input';
        textarea.rows = 6;
        textarea.placeholder = 'Write your answer here...';
        textarea.value = state.answers[index] || '';
        textarea.addEventListener('input', () => {
            state.answers[index] = textarea.value;
            saveAnswer(index, textarea.value);
            updateAnsweredCount();
        });
        container.appendChild(textarea);
    }
    
    // ===== HANDLE OPTION CHANGE =====
    function handleOptionChange(questionIndex, optionIndex, isMultiple) {
        if (isMultiple) {
            if (!state.answers[questionIndex]) {
                state.answers[questionIndex] = [];
            }
            const current = state.answers[questionIndex];
            const idx = current.indexOf(optionIndex);
            if (idx > -1) {
                current.splice(idx, 1);
            } else {
                current.push(optionIndex);
            }
            // Sort for consistency
            state.answers[questionIndex].sort();
        } else {
            state.answers[questionIndex] = optionIndex;
        }
        
        saveAnswer(questionIndex, state.answers[questionIndex]);
        updateAnsweredCount();
        renderQuestion();
    }
    
    // ===== SAVE ANSWER =====
    async function saveAnswer(questionIndex, answer) {
        try {
            await QuizUtils.apiRequest(
                QuizUtils.API.saveAnswer(state.quizId),
                'PUT',
                {
                    questionIndex: questionIndex,
                    answer: answer
                }
            );
        } catch (error) {
            console.error('Save answer error:', error);
            // Don't show error to user - auto-save silently
        }
    }
    
    // ===== UPDATE UI COUNTERS =====
    function updateAnsweredCount() {
        const answered = Object.keys(state.answers).filter(
            key => state.answers[key] !== null && state.answers[key] !== undefined && state.answers[key] !== ''
        ).length;
        
        if (elements.answeredCount) elements.answeredCount.textContent = answered;
        if (elements.confirmAnswered) elements.confirmAnswered.textContent = answered;
        if (elements.answeredCounter) elements.answeredCounter.textContent = `${answered} answered`;
    }
    
    function updateQuestionCounter() {
        const total = state.totalQuestions;
        const current = state.currentIndex + 1;
        const answered = Object.keys(state.answers).filter(
            key => state.answers[key] !== null && state.answers[key] !== undefined && state.answers[key] !== ''
        ).length;
        
        if (elements.questionCounter) elements.questionCounter.textContent = `${current} / ${total}`;
        if (elements.answeredCounter) elements.answeredCounter.textContent = `${answered} answered`;
    }
    
    // ===== NAVIGATION =====
    function goToPrevious() {
        if (state.currentIndex > 0) {
            state.currentIndex--;
            renderQuestion();
        }
    }
    
    function goToNext() {
        if (state.currentIndex < state.totalQuestions - 1) {
            state.currentIndex++;
            renderQuestion();
        } else {
            // On last question, show submit confirmation
            showSubmitConfirmation();
        }
    }
    
    // ===== SUBMIT CONFIRMATION =====
    function showSubmitConfirmation() {
        const answered = Object.keys(state.answers).filter(
            key => state.answers[key] !== null && state.answers[key] !== undefined && state.answers[key] !== ''
        ).length;
        
        if (elements.confirmAnswered) elements.confirmAnswered.textContent = answered;
        if (elements.confirmTotal) elements.confirmTotal.textContent = state.totalQuestions;
        
        const timeSpent = Math.floor((Date.now() - state.startTime.getTime()) / 1000);
        if (elements.confirmTime) elements.confirmTime.textContent = QuizUtils.formatTime(timeSpent);
        
        if (elements.confirmModal) elements.confirmModal.style.display = 'flex';
    }
    
    // ===== SUBMIT QUIZ =====
    async function submitQuiz() {
        if (state.isSubmitted) return;
        state.isSubmitted = true;
        
        if (elements.confirmModal) elements.confirmModal.style.display = 'none';
        if (elements.submitBtn) {
            elements.submitBtn.disabled = true;
            elements.submitBtn.textContent = '⏳ Submitting...';
        }
        
        try {
            const data = await QuizUtils.apiRequest(
                QuizUtils.API.submitQuiz(state.quizId),
                'POST'
            );
            
            if (data.success) {
                QuizUtils.showToast('✅ Quiz submitted successfully!', 'success');
                // Redirect to results
                window.location.href = `results.html?attemptId=${data.attempt._id}`;
            } else {
                throw new Error(data.message || 'Submission failed');
            }
        } catch (error) {
            console.error('Submit error:', error);
            QuizUtils.showToast(error.message || 'Failed to submit quiz', 'error');
            state.isSubmitted = false;
            if (elements.submitBtn) {
                elements.submitBtn.disabled = false;
                elements.submitBtn.textContent = '📤 Submit Quiz';
            }
        }
    }
    
    // ===== EVENT LISTENERS =====
    function setupEventListeners() {
        if (elements.prevBtn) elements.prevBtn.addEventListener('click', goToPrevious);
        if (elements.nextBtn) elements.nextBtn.addEventListener('click', goToNext);
        if (elements.submitBtn) elements.submitBtn.addEventListener('click', showSubmitConfirmation);
        if (elements.cancelSubmit) {
            elements.cancelSubmit.addEventListener('click', () => {
                if (elements.confirmModal) elements.confirmModal.style.display = 'none';
            });
        }
        if (elements.confirmSubmit) elements.confirmSubmit.addEventListener('click', submitQuiz);
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft' && state.currentIndex > 0) {
                goToPrevious();
            } else if (e.key === 'ArrowRight' && state.currentIndex < state.totalQuestions - 1) {
                goToNext();
            } else if (e.key === 'Enter' && elements.confirmModal && elements.confirmModal.style.display === 'flex') {
                submitQuiz();
            }
        });
        
        // Close modal on click outside
        if (elements.confirmModal) {
            elements.confirmModal.addEventListener('click', (e) => {
                if (e.target === elements.confirmModal) {
                    elements.confirmModal.style.display = 'none';
                }
            });
        }
    }
    
    // ===== START =====
    document.addEventListener('DOMContentLoaded', init);
})();