// ============================================================
// QUIZ BUILDER - Create and Edit Quizzes
// ============================================================

(function() {
    'use strict';

    // ===== STATE =====
    const state = {
        classId: null,
        quizId: null,
        isEditing: false,
        questions: [],
        editingIndex: null,
        user: JSON.parse(localStorage.getItem('user')),
        token: localStorage.getItem('token')
    };

    // ===== DOM REFERENCES =====
    const elements = {
        title: document.getElementById('quizTitle'),
        description: document.getElementById('quizDescription'),
        category: document.getElementById('quizCategory'),
        timeLimit: document.getElementById('timeLimit'),
        passingScore: document.getElementById('passingScore'),
        maxAttempts: document.getElementById('maxAttempts'),
        allowRetake: document.getElementById('allowRetake'),
        randomizeQuestions: document.getElementById('randomizeQuestions'),
        showResults: document.getElementById('showResults'),
        questionsList: document.getElementById('questionsList'),
        addQuestionBtn: document.getElementById('addQuestionBtn'),
        saveBtn: document.getElementById('saveBtn'),
        previewBtn: document.getElementById('previewBtn'),
        discardBtn: document.getElementById('discardBtn'),
        questionModal: document.getElementById('questionModal'),
        questionModalTitle: document.getElementById('questionModalTitle'),
        questionForm: document.getElementById('questionForm'),
        questionType: document.getElementById('questionType'),
        questionText: document.getElementById('questionText'),
        questionOptions: document.getElementById('questionOptions'),
        correctAnswer: document.getElementById('correctAnswer'),
        questionPoints: document.getElementById('questionPoints'),
        questionExplanation: document.getElementById('questionExplanation'),
        saveQuestionBtn: document.getElementById('saveQuestionBtn'),
        previewModal: document.getElementById('previewModal'),
        previewContent: document.getElementById('previewContent')
    };

    // ===== INITIALIZATION =====
    function init() {
        state.classId = QuizUtils.getQueryParam('classId');
        state.quizId = QuizUtils.getQueryParam('quizId');

        if (!state.classId && !state.quizId) {
            QuizUtils.showToast('No class specified', 'error');
            window.location.href = '../../instructor-dashboard.html';
            return;
        }

        // Check authentication
        if (!state.user || !state.token) {
            QuizUtils.showToast('Please login to create quizzes', 'error');
            window.location.href = '../../login.html';
            return;
        }

        loadUserData();
        setupEventListeners();

        if (state.quizId) {
            state.isEditing = true;
            loadQuizForEditing();
        }

        // If no questions, show empty state
        if (state.questions.length === 0) {
            renderQuestions();
        }

        // Make sure preview modal elements exist
        if (!elements.previewModal) {
            console.warn('Preview modal not found, creating fallback');
        }
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

    // ===== LOAD QUIZ FOR EDITING =====
    async function loadQuizForEditing() {
        try {
            const response = await fetch(`https://fissk-backend.onrender.com/api/quizzes/${state.quizId}`, {
                headers: {
                    'Authorization': `Bearer ${state.token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load quiz');
            }

            const data = await response.json();
            const quiz = data.quiz;

            // Populate form
            if (elements.title) elements.title.value = quiz.title || '';
            if (elements.description) elements.description.value = quiz.description || '';
            if (elements.category) elements.category.value = quiz.category || 'practice';
            if (elements.timeLimit) elements.timeLimit.value = quiz.settings?.timeLimit || 30;
            if (elements.passingScore) elements.passingScore.value = quiz.settings?.passingScore || 70;
            if (elements.maxAttempts) elements.maxAttempts.value = quiz.settings?.maxAttempts || 1;
            if (elements.allowRetake) elements.allowRetake.checked = quiz.settings?.allowRetake || false;
            if (elements.randomizeQuestions) elements.randomizeQuestions.checked = quiz.settings?.randomizeQuestions || false;
            if (elements.showResults) elements.showResults.checked = quiz.settings?.showResults !== undefined ? quiz.settings.showResults : true;

            state.questions = quiz.questions || [];
            renderQuestions();

            const header = document.querySelector('.builder-header h1');
            if (header) header.textContent = '✏️ Edit Quiz';

        } catch (error) {
            console.error('Load quiz error:', error);
            QuizUtils.showToast('Failed to load quiz for editing', 'error');
        }
    }

    // ===== RENDER QUESTIONS =====
    function renderQuestions() {
        if (!elements.questionsList) return;
        
        if (state.questions.length === 0) {
            elements.questionsList.innerHTML = `
                <div class="empty-questions">
                    <p>📝 No questions added yet</p>
                    <p class="empty-sub">Click "Add Question" to start building your quiz</p>
                </div>
            `;
            return;
        }

        elements.questionsList.innerHTML = state.questions.map((q, index) => `
            <div class="question-item" data-index="${index}">
                <div class="question-header">
                    <span class="q-number">Q${index + 1}</span>
                    <span class="q-type">${q.type || 'multiple-choice'}</span>
                    <span class="q-points">${q.points || 1} pts</span>
                </div>
                <div class="question-preview">
                    <p>${QuizUtils.escapeHtml(q.question || '')}</p>
                </div>
                <div class="question-actions">
                    <button class="btn btn-sm btn-outline edit-question-btn" data-index="${index}">✏️ Edit</button>
                    <button class="btn btn-sm btn-danger delete-question-btn" data-index="${index}">🗑️</button>
                </div>
            </div>
        `).join('');

        // Add event listeners for question actions
        elements.questionsList.querySelectorAll('.edit-question-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const index = parseInt(this.dataset.index);
                openQuestionModal(index);
            });
        });

        elements.questionsList.querySelectorAll('.delete-question-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const index = parseInt(this.dataset.index);
                if (confirm('Delete this question?')) {
                    state.questions.splice(index, 1);
                    renderQuestions();
                }
            });
        });
    }

    // ===== OPEN QUESTION MODAL =====
    function openQuestionModal(index = null) {
        state.editingIndex = index;

        if (!elements.questionModal) {
            console.error('Question modal not found');
            return;
        }

        if (index !== null && state.questions[index]) {
            const q = state.questions[index];
            if (elements.questionModalTitle) elements.questionModalTitle.textContent = 'Edit Question';
            if (elements.saveQuestionBtn) elements.saveQuestionBtn.textContent = 'Update Question';
            if (elements.questionType) elements.questionType.value = q.type || 'multiple-choice';
            if (elements.questionText) elements.questionText.value = q.question || '';
            if (elements.questionOptions) elements.questionOptions.value = (q.options || []).join('\n');
            if (elements.correctAnswer) elements.correctAnswer.value = q.correctAnswer !== undefined && q.correctAnswer !== null ? q.correctAnswer : '';
            if (elements.questionPoints) elements.questionPoints.value = q.points || 1;
            if (elements.questionExplanation) elements.questionExplanation.value = q.explanation || '';
        } else {
            if (elements.questionModalTitle) elements.questionModalTitle.textContent = 'Add Question';
            if (elements.saveQuestionBtn) elements.saveQuestionBtn.textContent = 'Add Question';
            if (elements.questionForm) elements.questionForm.reset();
            if (elements.questionType) elements.questionType.value = 'multiple-choice';
            if (elements.questionOptions) elements.questionOptions.value = '';
            if (elements.questionPoints) elements.questionPoints.value = 1;
        }

        // Update options visibility based on question type
        toggleOptionsVisibility();

        elements.questionModal.style.display = 'flex';
    }

    // ===== TOGGLE OPTIONS VISIBILITY =====
    function toggleOptionsVisibility() {
        const type = elements.questionType ? elements.questionType.value : 'multiple-choice';
        const optionsGroup = document.getElementById('optionsGroup');
        const correctAnswerLabel = document.querySelector('label[for="correctAnswer"]');

        if (type === 'essay') {
            if (optionsGroup) optionsGroup.style.display = 'none';
            if (correctAnswerLabel) correctAnswerLabel.textContent = 'Rubric (optional)';
        } else if (type === 'true-false') {
            if (optionsGroup) {
                optionsGroup.style.display = 'block';
                const label = optionsGroup.querySelector('label');
                if (label) label.textContent = 'Options (leave as True/False)';
            }
            if (correctAnswerLabel) correctAnswerLabel.textContent = 'Correct Answer (true or false)';
        } else {
            if (optionsGroup) {
                optionsGroup.style.display = 'block';
                const label = optionsGroup.querySelector('label');
                if (label) label.textContent = 'Options (one per line) *';
            }
            if (correctAnswerLabel) correctAnswerLabel.textContent = 'Correct Answer *';
        }
    }

    // ===== SAVE QUESTION =====
    function saveQuestion(e) {
        e.preventDefault();

        const type = elements.questionType ? elements.questionType.value : 'multiple-choice';
        const question = elements.questionText ? elements.questionText.value.trim() : '';
        const optionsText = elements.questionOptions ? elements.questionOptions.value.trim() : '';
        let correctAnswer = elements.correctAnswer ? elements.correctAnswer.value.trim() : '';
        const points = parseInt(elements.questionPoints ? elements.questionPoints.value : 1) || 1;
        const explanation = elements.questionExplanation ? elements.questionExplanation.value.trim() : '';

        if (!question) {
            alert('Please enter the question text');
            return;
        }

        let options = [];
        let parsedCorrectAnswer = correctAnswer;

        if (type !== 'essay') {
            if (type === 'true-false') {
                options = ['True', 'False'];
                parsedCorrectAnswer = correctAnswer.toLowerCase() === 'true' ? 0 : 1;
            } else {
                options = optionsText.split('\n').filter(o => o.trim());
                if (options.length < 2) {
                    alert('Please enter at least 2 options');
                    return;
                }
                // For multiple choice, correct answer is the index
                if (type === 'multiple-choice') {
                    const index = parseInt(correctAnswer);
                    if (isNaN(index) || index < 0 || index >= options.length) {
                        alert(`Please enter a valid option number (0-${options.length - 1})`);
                        return;
                    }
                    parsedCorrectAnswer = index;
                }
                // For multiple-answer, correct answer is array of indices
                else if (type === 'multiple-answer') {
                    const indices = correctAnswer.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
                    if (indices.length === 0) {
                        alert('Please enter at least one correct answer index (e.g., 0,2)');
                        return;
                    }
                    const valid = indices.every(i => i >= 0 && i < options.length);
                    if (!valid) {
                        alert('One or more indices are out of range');
                        return;
                    }
                    parsedCorrectAnswer = indices;
                }
                // For fill-in, correct answer is the exact text
                else if (type === 'fill-in') {
                    if (!correctAnswer) {
                        alert('Please enter the correct answer');
                        return;
                    }
                }
            }
        }

        const questionData = {
            type,
            question,
            options,
            correctAnswer: parsedCorrectAnswer,
            points,
            explanation
        };

        if (state.editingIndex !== null) {
            state.questions[state.editingIndex] = questionData;
        } else {
            state.questions.push(questionData);
        }

        if (elements.questionModal) elements.questionModal.style.display = 'none';
        renderQuestions();
    }

    // ===== SAVE QUIZ =====
    async function saveQuiz() {
        const title = elements.title ? elements.title.value.trim() : '';
        const description = elements.description ? elements.description.value.trim() : '';
        const category = elements.category ? elements.category.value : 'practice';
        const timeLimit = parseInt(elements.timeLimit ? elements.timeLimit.value : 0) || 0;
        const passingScore = parseInt(elements.passingScore ? elements.passingScore.value : 70) || 70;
        const maxAttempts = parseInt(elements.maxAttempts ? elements.maxAttempts.value : 1) || 1;
        const allowRetake = elements.allowRetake ? elements.allowRetake.checked : false;
        const randomizeQuestions = elements.randomizeQuestions ? elements.randomizeQuestions.checked : false;
        const showResults = elements.showResults ? elements.showResults.checked : true;

        if (!title) {
            alert('Please enter a quiz title');
            return;
        }

        if (state.questions.length === 0) {
            alert('Please add at least one question');
            return;
        }

        const quizData = {
            title,
            description,
            classId: state.classId,
            category,
            questions: state.questions,
            settings: {
                timeLimit,
                passingScore,
                maxAttempts,
                allowRetake,
                randomizeQuestions,
                showResults
            },
            status: 'draft'
        };

        const isEditing = state.isEditing && state.quizId;
        const url = isEditing 
            ? `https://fissk-backend.onrender.com/api/quizzes/${state.quizId}`
            : 'https://fissk-backend.onrender.com/api/quizzes';
        const method = isEditing ? 'PUT' : 'POST';

        try {
            const btn = elements.saveBtn;
            if (btn) {
                const originalText = btn.textContent;
                btn.disabled = true;
                btn.textContent = '⏳ Saving...';
            }

            const response = await fetch(url, {
                method,
                headers: {
                    'Authorization': `Bearer ${state.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(quizData)
            });

            if (response.status === 401) {
                alert('Session expired. Please login again.');
                window.location.href = '../../login.html';
                return;
            }

            const data = await response.json();

            if (btn) {
                btn.disabled = false;
                btn.textContent = '💾 Save Quiz';
            }

            if (data.success) {
                QuizUtils.showToast(`✅ Quiz ${isEditing ? 'updated' : 'created'} successfully!`, 'success');
                
                // Ask if they want to publish
                if (confirm('Quiz saved! Would you like to publish it now?')) {
                    await publishQuiz(data.quiz?._id || state.quizId);
                }
                
                window.location.href = '../../instructor-dashboard.html#classes';
            } else {
                QuizUtils.showToast('❌ ' + (data.message || 'Failed to save quiz'), 'error');
            }
        } catch (error) {
            console.error('Save quiz error:', error);
            QuizUtils.showToast('Failed to save quiz', 'error');
            const btn = elements.saveBtn;
            if (btn) {
                btn.disabled = false;
                btn.textContent = '💾 Save Quiz';
            }
        }
    }

    // ===== PUBLISH QUIZ =====
    async function publishQuiz(quizId) {
        try {
            const response = await fetch(`https://fissk-backend.onrender.com/api/quizzes/${quizId}/publish`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${state.token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();
            if (data.success) {
                QuizUtils.showToast('✅ Quiz published! Students can now take it.', 'success');
            }
        } catch (error) {
            console.error('Publish error:', error);
        }
    }

    // ===== PREVIEW QUIZ =====
    function previewQuiz() {
        const title = elements.title ? elements.title.value.trim() || 'Untitled Quiz' : 'Untitled Quiz';
        const questions = state.questions;

        if (questions.length === 0) {
            alert('Add some questions first');
            return;
        }

        if (!elements.previewContent) {
            alert('Preview not available');
            return;
        }

        let previewHTML = `
            <div class="preview-header">
                <h3>${QuizUtils.escapeHtml(title)}</h3>
                <p>${elements.description ? QuizUtils.escapeHtml(elements.description.value.trim()) || '' : ''}</p>
                <div class="preview-stats">
                    <span>📝 ${questions.length} questions</span>
                    <span>⏱️ ${elements.timeLimit ? elements.timeLimit.value || 0 : 0} min</span>
                    <span>⭐ ${questions.reduce((sum, q) => sum + (q.points || 1), 0)} total points</span>
                </div>
            </div>
            <div class="preview-questions">
        `;

        questions.forEach((q, index) => {
            const options = q.options || [];
            previewHTML += `
                <div class="preview-question">
                    <div class="preview-q-header">
                        <span>Question ${index + 1}</span>
                        <span>${q.type || 'multiple-choice'}</span>
                        <span>${q.points || 1} pts</span>
                    </div>
                    <p>${QuizUtils.escapeHtml(q.question || '')}</p>
                    ${options.length > 0 ? `
                        <div class="preview-options">
                            ${options.map((opt, i) => `
                                <div class="preview-option">
                                    <input type="radio" name="preview_${index}" id="preview_${index}_${i}" disabled>
                                    <label for="preview_${index}_${i}">${QuizUtils.escapeHtml(opt)}</label>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                    ${q.explanation ? `<div class="preview-explanation">💡 ${QuizUtils.escapeHtml(q.explanation)}</div>` : ''}
                </div>
            `;
        });

        previewHTML += `
            </div>
            <div class="preview-footer">
                <p>This is a preview. Students will see an interactive version.</p>
            </div>
        `;

        elements.previewContent.innerHTML = previewHTML;
        
        if (elements.previewModal) {
            elements.previewModal.style.display = 'flex';
        } else {
            // Fallback: show preview in alert
            const previewWindow = window.open('', '_blank', 'width=600,height=400');
            if (previewWindow) {
                previewWindow.document.write(`
                    <html>
                        <head><title>Quiz Preview</title>
                        <style>
                            body { font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; }
                            .preview-header { margin-bottom: 20px; }
                            .preview-question { border: 1px solid #ddd; padding: 16px; margin-bottom: 12px; border-radius: 8px; }
                            .preview-q-header { font-size: 0.8rem; color: #666; margin-bottom: 6px; }
                            .preview-options { margin-top: 8px; }
                            .preview-option { padding: 4px 8px; }
                            .preview-explanation { margin-top: 8px; padding: 8px; background: #f0f4ff; border-radius: 4px; font-size: 0.9rem; }
                            .preview-footer { text-align: center; padding: 16px; color: #999; border-top: 1px solid #ddd; margin-top: 16px; }
                        </style>
                        </head>
                        <body>${previewHTML}</body>
                    </html>
                `);
                previewWindow.document.close();
            }
        }
    }

    // ===== DISCARD =====
    function discard() {
        if (confirm('Are you sure you want to discard this quiz? All progress will be lost.')) {
            window.location.href = '../../instructor-dashboard.html#classes';
        }
    }

    // ===== EVENT LISTENERS =====
    function setupEventListeners() {
        // Add question button
        if (elements.addQuestionBtn) {
            elements.addQuestionBtn.addEventListener('click', () => openQuestionModal(null));
        }

        // Question type change - update options visibility
        if (elements.questionType) {
            elements.questionType.addEventListener('change', toggleOptionsVisibility);
        }

        // Question form submit
        if (elements.questionForm) {
            elements.questionForm.addEventListener('submit', saveQuestion);
        }

        // Save quiz
        if (elements.saveBtn) {
            elements.saveBtn.addEventListener('click', saveQuiz);
        }

        // Preview
        if (elements.previewBtn) {
            elements.previewBtn.addEventListener('click', previewQuiz);
        }

        // Discard
        if (elements.discardBtn) {
            elements.discardBtn.addEventListener('click', discard);
        }

        // Modal close on overlay click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        });

        // Close modal on X click
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', function() {
                const modal = this.closest('.modal');
                if (modal) modal.style.display = 'none';
            });
        });

        // Make sure saveQuestionBtn works
        if (elements.saveQuestionBtn) {
            // Already handled by form submit
        }
    }

    // ===== LOGOUT =====
    window.logout = function() {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        window.location.href = '../../login.html';
    };

    // ===== START =====
    document.addEventListener('DOMContentLoaded', init);
})();