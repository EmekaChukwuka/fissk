// ============================================================
// QUIZ BUILDER - Create and Edit Quizzes (UPDATED + AI Generator)
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
        previewContent: document.getElementById('previewContent'),
        // Redesigned modal elements
        questionCountBadge: document.getElementById('questionCountBadge'),
        typeSelector: document.getElementById('questionTypeSelector'),
        optionsContainer: document.getElementById('optionsContainer'),
        addOptionBtn: document.getElementById('addOptionBtn'),
        cancelQuestionBtn: document.getElementById('cancelQuestionBtn')
    };

    // ===== OPTIONS MANAGEMENT =====
    function getOptionsFromUI() {
        const optionRows = elements.optionsContainer.querySelectorAll('.option-row');
        const options = [];
        optionRows.forEach(row => {
            const input = row.querySelector('.option-input');
            if (input && input.value.trim()) {
                options.push(input.value.trim());
            }
        });
        return options;
    }

    function getCorrectOptionIndex() {
        const checked = elements.optionsContainer.querySelector('input[name="correctOption"]:checked');
        if (checked) {
            return parseInt(checked.value);
        }
        return 0;
    }

    function setOptionsInUI(options, correctIndex) {
        const container = elements.optionsContainer;
        const addBtn = container.querySelector('.add-option-btn');
        container.querySelectorAll('.option-row').forEach(el => el.remove());

        options.forEach((opt, index) => {
            addOptionRow(opt, index, correctIndex === index);
        });

        container.appendChild(addBtn);
    }

    function addOptionRow(value = '', index = null, isCorrect = false) {
        const container = elements.optionsContainer;
        const addBtn = container.querySelector('.add-option-btn');

        const rows = container.querySelectorAll('.option-row');
        const idx = index !== null ? index : rows.length;
        const letter = String.fromCharCode(65 + idx);

        const row = document.createElement('div');
        row.className = 'option-row';
        row.dataset.optionIndex = idx;
        row.innerHTML = `
            <span class="option-letter">${letter}.</span>
            <input type="text" class="option-input" placeholder="Option ${idx + 1}" value="${QuizUtils.escapeHtml(value)}">
            <label class="option-correct">
                <input type="radio" name="correctOption" value="${idx}" ${isCorrect ? 'checked' : ''}> Correct
            </label>
            <button type="button" class="remove-option" title="Remove option">✕</button>
        `;

        container.insertBefore(row, addBtn);

        row.querySelector('.remove-option').addEventListener('click', function() {
            const rows = container.querySelectorAll('.option-row');
            if (rows.length <= 2) {
                alert('You need at least 2 options for multiple choice questions.');
                return;
            }
            row.remove();
            updateOptionLetters();
        });

        row.querySelector('.option-input').addEventListener('input', updateOptionLetters);

        updateOptionLetters();
        return row;
    }

    function updateOptionLetters() {
        const rows = elements.optionsContainer.querySelectorAll('.option-row');
        rows.forEach((row, index) => {
            const letter = String.fromCharCode(65 + index);
            row.querySelector('.option-letter').textContent = letter + '.';
            row.dataset.optionIndex = index;
            const radio = row.querySelector('input[name="correctOption"]');
            if (radio) radio.value = index;
        });
    }

    function resetOptionsUI() {
        const container = elements.optionsContainer;
        const addBtn = container.querySelector('.add-option-btn');
        container.querySelectorAll('.option-row').forEach(el => el.remove());

        for (let i = 0; i < 4; i++) {
            addOptionRow('', i, i === 0);
        }
        container.appendChild(addBtn);
    }

    // ===== QUESTION TYPE HANDLING =====
    function setupQuestionTypeSelector() {
        const buttons = elements.typeSelector.querySelectorAll('.question-type-btn');
        const optionsGroup = document.getElementById('optionsGroup');

        buttons.forEach(btn => {
            btn.addEventListener('click', function() {
                buttons.forEach(b => b.classList.remove('active'));
                this.classList.add('active');

                const type = this.dataset.type;
                elements.questionType.value = type;

                if (type === 'essay' || type === 'fill-in') {
                    optionsGroup.style.display = 'none';
                } else {
                    optionsGroup.style.display = 'block';
                }

                if (type === 'true-false') {
                    setOptionsInUI(['True', 'False'], 0);
                }
            });
        });
    }

    // ===== INITIALIZATION =====
    function init() {
        state.classId = QuizUtils.getQueryParam('classId');
        state.quizId = QuizUtils.getQueryParam('quizId');

        if (!state.classId && !state.quizId) {
            QuizUtils.showToast('No class specified', 'error');
            window.location.href = '../../instructor-dashboard.html';
            return;
        }

        if (!state.user || !state.token) {
            QuizUtils.showToast('Please login to create quizzes', 'error');
            window.location.href = '../../login.html';
            return;
        }

        loadUserData();
        setupEventListeners();
        setupQuestionTypeSelector();
        resetOptionsUI();

        if (state.quizId) {
            state.isEditing = true;
            loadQuizForEditing();
        }

        if (state.questions.length === 0) {
            renderQuestions();
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
            const response = await fetch(`https://fissk-iui2.onrender.com/api/quizzes/${state.quizId}`, {
                headers: { 'Authorization': `Bearer ${state.token}` }
            });

            if (!response.ok) throw new Error('Failed to load quiz');

            const data = await response.json();
            const quiz = data.quiz;

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

        elements.questionsList.innerHTML = state.questions.map((q, index) => {
            const typeLabel = q.type || 'multiple-choice';
            const typeClass = typeLabel.replace('-', '');
            return `
                <div class="question-item" data-index="${index}">
                    <div class="question-header">
                        <span class="q-number">Q${index + 1}</span>
                        <span class="q-type-badge ${typeClass}">${typeLabel}</span>
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
            `;
        }).join('');

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

        resetOptionsUI();

        const buttons = elements.typeSelector.querySelectorAll('.question-type-btn');
        buttons.forEach(b => b.classList.remove('active'));

        if (index !== null && state.questions[index]) {
            const q = state.questions[index];

            if (elements.questionModalTitle) elements.questionModalTitle.textContent = '✏️ Edit Question';
            if (elements.saveQuestionBtn) elements.saveQuestionBtn.textContent = '✅ Update Question';
            if (elements.questionCountBadge) elements.questionCountBadge.textContent = `Question ${index + 1}`;

            const typeBtn = elements.typeSelector.querySelector(`[data-type="${q.type}"]`);
            if (typeBtn) typeBtn.classList.add('active');
            if (elements.questionType) elements.questionType.value = q.type || 'multiple-choice';

            if (elements.questionText) elements.questionText.value = q.question || '';

            if (q.options && q.options.length > 0) {
                let correctIndex = 0;
                if (typeof q.correctAnswer === 'number') {
                    correctIndex = q.correctAnswer;
                } else if (Array.isArray(q.correctAnswer) && q.correctAnswer.length > 0) {
                    correctIndex = q.correctAnswer[0];
                }
                setOptionsInUI(q.options, correctIndex);
            }

            if (elements.questionPoints) elements.questionPoints.value = q.points || 1;
            if (elements.questionExplanation) elements.questionExplanation.value = q.explanation || '';

            const optionsGroup = document.getElementById('optionsGroup');
            if (q.type === 'essay' || q.type === 'fill-in') {
                if (optionsGroup) optionsGroup.style.display = 'none';
            } else {
                if (optionsGroup) optionsGroup.style.display = 'block';
            }
        } else {
            if (elements.questionModalTitle) elements.questionModalTitle.textContent = '✏️ Add Question';
            if (elements.saveQuestionBtn) elements.saveQuestionBtn.textContent = '✅ Add Question';
            if (elements.questionCountBadge) elements.questionCountBadge.textContent = `Question ${state.questions.length + 1}`;

            if (elements.questionForm) elements.questionForm.reset();
            if (elements.questionText) elements.questionText.value = '';
            if (elements.questionPoints) elements.questionPoints.value = 1;
            if (elements.questionExplanation) elements.questionExplanation.value = '';

            const defaultBtn = elements.typeSelector.querySelector('[data-type="multiple-choice"]');
            if (defaultBtn) defaultBtn.classList.add('active');
            if (elements.questionType) elements.questionType.value = 'multiple-choice';

            resetOptionsUI();

            const optionsGroup = document.getElementById('optionsGroup');
            if (optionsGroup) optionsGroup.style.display = 'block';
        }

        elements.questionModal.style.display = 'flex';
    }

    // ===== SAVE QUESTION =====
    function saveQuestion(e) {
        e.preventDefault();

        const type = elements.questionType ? elements.questionType.value : 'multiple-choice';
        const question = elements.questionText ? elements.questionText.value.trim() : '';
        const points = parseInt(elements.questionPoints ? elements.questionPoints.value : 1) || 1;
        const explanation = elements.questionExplanation ? elements.questionExplanation.value.trim() : '';

        if (!question) {
            alert('Please enter the question text');
            return;
        }

        let options = [];
        let correctAnswer = null;

        if (type === 'essay') {
            options = [];
            correctAnswer = null;
        } else if (type === 'true-false') {
            options = ['True', 'False'];
            const correctIndex = getCorrectOptionIndex();
            correctAnswer = correctIndex === 0 ? 0 : 1;
        } else if (type === 'fill-in') {
            const optionInputs = elements.optionsContainer.querySelectorAll('.option-input');
            if (optionInputs.length > 0 && optionInputs[0].value.trim()) {
                options = [optionInputs[0].value.trim()];
                correctAnswer = optionInputs[0].value.trim();
            } else {
                alert('Please enter the correct answer in the first option field');
                return;
            }
        } else {
            options = getOptionsFromUI();
            if (options.length < 2) {
                alert('Please enter at least 2 options');
                return;
            }

            const correctIndex = getCorrectOptionIndex();
            if (type === 'multiple-choice') {
                correctAnswer = correctIndex;
            } else if (type === 'multiple-answer') {
                const checkedOptions = elements.optionsContainer.querySelectorAll('input[name="correctOption"]:checked');
                correctAnswer = Array.from(checkedOptions).map(el => parseInt(el.value));
                if (correctAnswer.length === 0) {
                    alert('Please select at least one correct answer');
                    return;
                }
            }
        }

        const questionData = {
            type,
            question,
            options,
            correctAnswer,
            points,
            explanation
        };

        if (state.editingIndex !== null) {
            state.questions[state.editingIndex] = questionData;
        } else {
            state.questions.push(questionData);
        }

        elements.questionModal.style.display = 'none';
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
            ? `https://fissk-iui2.onrender.com/api/quizzes/${state.quizId}`
            : 'https://fissk-iui2.onrender.com/api/quizzes';
        const method = isEditing ? 'PUT' : 'POST';

        try {
            const btn = elements.saveBtn;
            if (btn) {
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
            const response = await fetch(`https://fissk-iui2.onrender.com/api/quizzes/${quizId}/publish`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${state.token}` }
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
        }
    }

    // ============================================================
    // ===== AI QUIZ GENERATOR =====
    // ============================================================

    function openAiQuizModal() {
        const modal = document.getElementById('aiQuizModal');
        if (!modal) return;
        const form = document.getElementById('aiQuizForm');
        if (form) form.reset();
        const countEl = document.getElementById('aiQuizCount');
        if (countEl) countEl.value = 5;
        const status = document.getElementById('aiQuizStatus');
        if (status) {
            status.style.display = 'none';
            status.textContent = '';
        }
        modal.style.display = 'flex';
    }

    function showAiQuizStatus(message, type = 'error') {
        const status = document.getElementById('aiQuizStatus');
        if (!status) return;
        const colors = {
            error:   { bg: '#fee2e2', color: '#991b1b' },
            success: { bg: '#d1fae5', color: '#065f46' },
            info:    { bg: '#dbeafe', color: '#1e40af' }
        };
        const c = colors[type] || colors.error;
        status.style.display = 'block';
        status.style.background = c.bg;
        status.style.color = c.color;
        status.textContent = message;
    }

    async function generateQuizWithAI() {
        const promptEl = document.getElementById('aiQuizPrompt');
        const prompt = (promptEl?.value || '').trim();
        const countEl = document.getElementById('aiQuizCount');
        const count = Math.min(Math.max(parseInt(countEl?.value) || 5, 1), 20);

        if (prompt.length < 10) {
            showAiQuizStatus('Please describe your questions in at least 10 characters.', 'error');
            return;
        }

        if (!state.classId) {
            showAiQuizStatus('No class selected. Please return to your dashboard.', 'error');
            return;
        }

        const submitBtn = document.getElementById('aiQuizSubmitBtn');
        const original = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-small"></span> Generating…';
        showAiQuizStatus('Generating your questions…', 'info');

        try {
            const response = await fetch('https://fissk-iui2.onrender.com/api/quizzes/generate', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${state.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    classId: state.classId,
                    prompt,
                    options: { count }
                })
            });

            if (response.status === 401) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = '../../login.html';
                return;
            }

            const data = await response.json().catch(() => ({}));

            if (!response.ok || !data.success) {
                showAiQuizStatus(data.message || 'Failed to generate questions. Please try again.', 'error');
                return;
            }

            applyAiQuestions(data.draft);

            const note = data.draft.rejectedCount > 0
                ? ` (${data.draft.rejectedCount} question(s) were dropped because the AI returned them in an invalid format.)`
                : '';
            showAiQuizStatus(
                `✨ Added ${data.draft.questions.length} question(s). Review and edit below, then save.${note}`,
                'success'
            );

            setTimeout(() => {
                const modal = document.getElementById('aiQuizModal');
                if (modal) modal.style.display = 'none';
            }, 900);

        } catch (error) {
            console.error('AI quiz generate error:', error);
            showAiQuizStatus('Network error. Please check your connection and try again.', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = original;
        }
    }

    function applyAiQuestions(draft) {
        if (!draft || !Array.isArray(draft.questions)) return;

        const newQuestions = draft.questions.map(q => ({
            type: q.type,
            question: q.question,
            options: q.options,
            correctAnswer: q.correctAnswer,
            points: q.points,
            explanation: q.explanation
        }));

        state.questions = state.questions.concat(newQuestions);
        renderQuestions();
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

        // Add option button
        if (elements.addOptionBtn) {
            elements.addOptionBtn.addEventListener('click', function() {
                addOptionRow('', null, false);
            });
        }

        // Cancel question button
        if (elements.cancelQuestionBtn) {
            elements.cancelQuestionBtn.addEventListener('click', () => {
                elements.questionModal.style.display = 'none';
            });
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

        // ===== AI QUIZ GENERATOR: listeners =====
        const aiGenerateQuizBtn = document.getElementById('aiGenerateQuizBtn');
        if (aiGenerateQuizBtn) {
            aiGenerateQuizBtn.addEventListener('click', openAiQuizModal);
        }

        const aiQuizForm = document.getElementById('aiQuizForm');
        if (aiQuizForm) {
            aiQuizForm.addEventListener('submit', (e) => {
                e.preventDefault();
                generateQuizWithAI();
            });
        }

        const aiQuizCancel = document.getElementById('aiQuizCancelBtn');
        if (aiQuizCancel) {
            aiQuizCancel.addEventListener('click', () => {
                document.getElementById('aiQuizModal').style.display = 'none';
            });
        }

        const closeAiQuiz = document.getElementById('closeAiQuizModal');
        if (closeAiQuiz) {
            closeAiQuiz.addEventListener('click', () => {
                document.getElementById('aiQuizModal').style.display = 'none';
            });
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