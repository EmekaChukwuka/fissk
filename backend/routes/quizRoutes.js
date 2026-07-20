import express from 'express';
import * as quizController from '../controllers/quizController.js';
import * as quizAttemptController from '../controllers/quizAttemptController.js';
import { isInstructor } from '../middleware/auth.js';
import { checkEnrollment } from '../middleware/quizAuth.js';

const quizRouter = express.Router();

// ============================================================
// QUIZ MANAGEMENT (Instructor)
// ============================================================

// Get all quizzes for a class
quizRouter.get('/class/:classId', isInstructor, quizController.getClassQuizzes);

// Get single quiz
quizRouter.get('/:quizId', isInstructor, quizController.getQuiz);

// Create quiz
quizRouter.post('/', isInstructor, quizController.createQuiz);

// Update quiz
quizRouter.put('/:quizId', isInstructor, quizController.updateQuiz);

// Delete quiz
quizRouter.delete('/:quizId', isInstructor, quizController.deleteQuiz);

// Toggle publish status
quizRouter.patch('/:quizId/publish', isInstructor, quizController.togglePublish);

// Duplicate quiz
quizRouter.post('/:quizId/duplicate', isInstructor, quizController.duplicateQuiz);

// ============================================================
// QUIZ ATTEMPTS (Student)
// ============================================================

// Start a quiz attempt
quizRouter.post('/:quizId/start', isInstructor, quizAttemptController.startAttempt);

// Save an answer
quizRouter.put('/:quizId/answer', isInstructor, quizAttemptController.saveAnswer);

// Submit quiz
quizRouter.post('/:quizId/submit', isInstructor, quizAttemptController.submitAttempt);

// Get attempt results
quizRouter.get('/attempt/:attemptId', isInstructor, quizAttemptController.getAttemptResults);

// Get user's attempts
quizRouter.get('/attempts/user', isInstructor, quizAttemptController.getUserAttempts);

// ============================================================
// INSTRUCTOR SUBMISSION MANAGEMENT
// ============================================================

// Get all submissions for a quiz
quizRouter.get('/:quizId/submissions', isInstructor, quizAttemptController.getQuizSubmissions);

// Grade essay question
quizRouter.post('/attempt/:attemptId/grade', isInstructor, quizAttemptController.gradeEssay);

// ============================================================
// ANALYTICS
// ============================================================

// Get quiz analytics
quizRouter.get('/:quizId/analytics', isInstructor, quizController.getQuizAnalytics);

export default quizRouter;