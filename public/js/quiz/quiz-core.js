// ============================================================
// QUIZ CORE - Shared Utilities & API Calls
// ============================================================

const QUIZ_API = {
    base: '/api/quizzes',
    
    // ===== STUDENT ENDPOINTS =====
    getClassQuizzes: (classId) => `/api/quizzes/class/${classId}`,
    getQuiz: (quizId) => `/api/quizzes/${quizId}`,
    startAttempt: (quizId) => `/api/quizzes/${quizId}/start`,
    saveAnswer: (quizId) => `/api/quizzes/${quizId}/answer`,
    submitQuiz: (quizId) => `/api/quizzes/${quizId}/submit`,
    getAttemptResults: (attemptId) => `/api/quizzes/attempt/${attemptId}`,
    getUserAttempts: () => `/api/quizzes/attempts/user`,
    
    // ===== INSTRUCTOR ENDPOINTS =====
    createQuiz: () => `/api/quizzes`,
    updateQuiz: (quizId) => `/api/quizzes/${quizId}`,
    deleteQuiz: (quizId) => `/api/quizzes/${quizId}`,
    publishQuiz: (quizId) => `/api/quizzes/${quizId}/publish`,
    duplicateQuiz: (quizId) => `/api/quizzes/${quizId}/duplicate`,
    getSubmissions: (quizId) => `/api/quizzes/${quizId}/submissions`,
    getAnalytics: (quizId) => `/api/quizzes/${quizId}/analytics`,
    gradeEssay: (attemptId) => `/api/quizzes/attempt/${attemptId}/grade`
};

// ===== API HELPERS =====
function getHeaders() {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
    };
}

async function apiRequest(url, method = 'GET', data = null) {
    const options = {
        method,
        headers: getHeaders()
    };
    
    if (data) {
        options.body = JSON.stringify(data);
    }
    
    try {
        const response = await fetch(url, options);
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.message || 'API request failed');
        }
        
        return result;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// ===== QUIZ UTILITIES =====
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

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

function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 14px 24px;
        border-radius: 12px;
        background: ${type === 'success' ? '#10B981' : type === 'error' ? '#EF4444' : '#6C3CE1'};
        color: white;
        z-index: 10000;
        box-shadow: 0 4px 20px rgba(0,0,0,0.2);
        animation: slideIn 0.3s ease;
        max-width: 400px;
        font-weight: 500;
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ===== QUIZ STATE MANAGEMENT =====
class QuizState {
    constructor() {
        this.quizId = null;
        this.attemptId = null;
        this.questions = [];
        this.answers = {};
        this.currentQuestionIndex = 0;
        this.timeRemaining = 0;
        this.timerInterval = null;
        this.isSubmitted = false;
        this.isLoading = false;
        this.startTime = null;
    }
    
    reset() {
        this.quizId = null;
        this.attemptId = null;
        this.questions = [];
        this.answers = {};
        this.currentQuestionIndex = 0;
        this.timeRemaining = 0;
        this.isSubmitted = false;
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        this.startTime = null;
    }
}

// Export for use in other files
window.QuizUtils = {
    API: QUIZ_API,
    apiRequest,
    shuffleArray,
    escapeHtml,
    formatTime,
    getQueryParam,
    showToast,
    QuizState
};