import express from 'express';
import * as quizController from '../controllers/quizController.js';
import * as quizAttemptController from '../controllers/quizAttemptController.js';
import { optionalAuth } from '../middleware/auth.js';
import { checkEnrollment } from '../middleware/quizAuth.js';

const quizRouter = express.Router();

// ============================================================
// QUIZ MANAGEMENT (Instructor)
// ============================================================

// Get all quizzes for a class
quizRouter.get('/class/:classId', optionalAuth, quizController.getClassQuizzes);

// Get single quiz
quizRouter.get('/:quizId', optionalAuth, quizController.getQuiz);

// Create quiz
quizRouter.post('/', optionalAuth, quizController.createQuiz);

// Update quiz
quizRouter.put('/:quizId', optionalAuth, quizController.updateQuiz);

// Delete quiz
quizRouter.delete('/:quizId', optionalAuth, quizController.deleteQuiz);

// Toggle publish status
quizRouter.patch('/:quizId/publish', optionalAuth, quizController.togglePublish);

// Duplicate quiz
quizRouter.post('/:quizId/duplicate', optionalAuth, quizController.duplicateQuiz);

// ============================================================
// QUIZ ATTEMPTS (Student)
// ============================================================

// Start a quiz attempt
quizRouter.post('/:quizId/start', optionalAuth, quizAttemptController.startAttempt);

// Save an answer
quizRouter.put('/:quizId/answer', optionalAuth, quizAttemptController.saveAnswer);

// Submit quiz
quizRouter.post('/:quizId/submit', optionalAuth, quizAttemptController.submitAttempt);

// Get attempt results
quizRouter.get('/attempt/:attemptId', optionalAuth, quizAttemptController.getAttemptResults);

// Get user's attempts
quizRouter.get('/attempts/user', optionalAuth, quizAttemptController.getUserAttempts);

// ============================================================
// INSTRUCTOR SUBMISSION MANAGEMENT
// ============================================================

// Get all submissions for a quiz
quizRouter.get('/:quizId/submissions', optionalAuth, quizAttemptController.getQuizSubmissions);

// Grade essay question
quizRouter.post('/attempt/:attemptId/grade', optionalAuth, quizAttemptController.gradeEssay);

// ============================================================
// ANALYTICS
// ============================================================

// Get quiz analytics
quizRouter.get('/:quizId/analytics', optionalAuth, quizController.getQuizAnalytics);

export default quizRouter;