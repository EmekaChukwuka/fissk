import express from 'express';
import * as quizController from '../controllers/quizController.js';
import * as quizAttemptController from '../controllers/quizAttemptController.js';
import { auth, isInstructor } from '../middleware/auth.js';

const quizRouter = express.Router();

// ============================================================
// QUIZ MANAGEMENT (Student & Instructor)
// ============================================================

// Get all quizzes for a class - STUDENTS can view (with auth)
quizRouter.get('/class/:classId', auth, quizController.getClassQuizzes);

// Get single quiz - STUDENTS can view (with auth)
quizRouter.get('/:quizId', auth, quizController.getQuiz);

// ============================================================
// QUIZ MANAGEMENT (Instructor only)
// ============================================================

// Create quiz - INSTRUCTOR ONLY
quizRouter.post('/', auth, isInstructor, quizController.createQuiz);

// Update quiz - INSTRUCTOR ONLY
quizRouter.put('/:quizId', auth, isInstructor, quizController.updateQuiz);

// Delete quiz - INSTRUCTOR ONLY
quizRouter.delete('/:quizId', auth, isInstructor, quizController.deleteQuiz);

// Toggle publish status - INSTRUCTOR ONLY
quizRouter.patch('/:quizId/publish', auth, isInstructor, quizController.togglePublish);

// Duplicate quiz - INSTRUCTOR ONLY
quizRouter.post('/:quizId/duplicate', auth, isInstructor, quizController.duplicateQuiz);

// ============================================================
// QUIZ ATTEMPTS (Student)
// ============================================================

// Start a quiz attempt
quizRouter.post('/:quizId/start', auth, quizAttemptController.startAttempt);

// Save an answer
quizRouter.put('/:quizId/answer', auth, quizAttemptController.saveAnswer);

// Submit quiz
quizRouter.post('/:quizId/submit', auth, quizAttemptController.submitAttempt);

// Get attempt results
quizRouter.get('/attempt/:attemptId', auth, quizAttemptController.getAttemptResults);

// Get user's attempts
quizRouter.get('/attempts/user', auth, quizAttemptController.getUserAttempts);

// ============================================================
// INSTRUCTOR SUBMISSION MANAGEMENT (Instructor only)
// ============================================================

// Get all submissions for a quiz - INSTRUCTOR ONLY
quizRouter.get('/:quizId/submissions', auth, isInstructor, quizAttemptController.getQuizSubmissions);

// Grade essay question - INSTRUCTOR ONLY
quizRouter.post('/attempt/:attemptId/grade', auth, isInstructor, quizAttemptController.gradeEssay);

// ============================================================
// ANALYTICS (Instructor only)
// ============================================================

// Get quiz analytics - INSTRUCTOR ONLY
quizRouter.get('/:quizId/analytics', auth, isInstructor, quizController.getQuizAnalytics);

export default quizRouter;