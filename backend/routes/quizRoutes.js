import express from 'express';
import * as quizController from '../controllers/quizController.js';
import * as quizAttemptController from '../controllers/quizAttemptController.js';
import { auth } from '../middleware/auth.js';
import { checkEnrollment } from '../middleware/quizAuth.js';

const quizRouter = express.Router();

// ============================================================
// QUIZ MANAGEMENT (Instructor)
// ============================================================

// Get all quizzes for a class
quizRouter.get('/class/:classId', auth, quizController.getClassQuizzes);

// Get single quiz
quizRouter.get('/:quizId', auth, quizController.getQuiz);

// Create quiz
quizRouter.post('/', auth, quizController.createQuiz);

// Update quiz
quizRouter.put('/:quizId', auth, quizController.updateQuiz);

// Delete quiz
quizRouter.delete('/:quizId', auth, quizController.deleteQuiz);

// Toggle publish status
quizRouter.patch('/:quizId/publish', auth, quizController.togglePublish);

// Duplicate quiz
quizRouter.post('/:quizId/duplicate', auth, quizController.duplicateQuiz);

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
// INSTRUCTOR SUBMISSION MANAGEMENT
// ============================================================

// Get all submissions for a quiz
quizRouter.get('/:quizId/submissions', auth, quizAttemptController.getQuizSubmissions);

// Grade essay question
quizRouter.post('/attempt/:attemptId/grade', auth, quizAttemptController.gradeEssay);

// ============================================================
// ANALYTICS
// ============================================================

// Get quiz analytics
quizRouter.get('/:quizId/analytics', auth, quizController.getQuizAnalytics);

export default quizRouter;