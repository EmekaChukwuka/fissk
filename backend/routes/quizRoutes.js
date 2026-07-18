import express from 'express';
import * as quizController from '../controllers/quizController.js';
import * as quizAttemptController from '../controllers/quizAttemptController.js';
import { authenticate } from '../middleware/auth.js';
import { checkEnrollment } from '../middleware/quizAuth.js';

const quizRouter = express.Router();

// ============================================================
// QUIZ MANAGEMENT (Instructor)
// ============================================================

// Get all quizzes for a class
quizRouter.get('/class/:classId', authenticate, quizController.getClassQuizzes);

// Get single quiz
quizRouter.get('/:quizId', authenticate, quizController.getQuiz);

// Create quiz
quizRouter.post('/', authenticate, quizController.createQuiz);

// Update quiz
quizRouter.put('/:quizId', authenticate, quizController.updateQuiz);

// Delete quiz
quizRouter.delete('/:quizId', authenticate, quizController.deleteQuiz);

// Toggle publish status
quizRouter.patch('/:quizId/publish', authenticate, quizController.togglePublish);

// Duplicate quiz
quizRouter.post('/:quizId/duplicate', authenticate, quizController.duplicateQuiz);

// ============================================================
// QUIZ ATTEMPTS (Student)
// ============================================================

// Start a quiz attempt
quizRouter.post('/:quizId/start', authenticate, quizAttemptController.startAttempt);

// Save an answer
quizRouter.put('/:quizId/answer', authenticate, quizAttemptController.saveAnswer);

// Submit quiz
quizRouter.post('/:quizId/submit', authenticate, quizAttemptController.submitAttempt);

// Get attempt results
quizRouter.get('/attempt/:attemptId', authenticate, quizAttemptController.getAttemptResults);

// Get user's attempts
quizRouter.get('/attempts/user', authenticate, quizAttemptController.getUserAttempts);

// ============================================================
// INSTRUCTOR SUBMISSION MANAGEMENT
// ============================================================

// Get all submissions for a quiz
quizRouter.get('/:quizId/submissions', authenticate, quizAttemptController.getQuizSubmissions);

// Grade essay question
quizRouter.post('/attempt/:attemptId/grade', authenticate, quizAttemptController.gradeEssay);

// ============================================================
// ANALYTICS
// ============================================================

// Get quiz analytics
quizRouter.get('/:quizId/analytics', authenticate, quizController.getQuizAnalytics);

export default quizRouter;