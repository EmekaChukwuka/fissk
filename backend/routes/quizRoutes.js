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
// QUIZ MANAGEMENT (Instructor only) - WITH DEBUG
// ============================================================

// Create quiz - INSTRUCTOR ONLY with custom check
quizRouter.post('/', auth, async (req, res, next) => {
  console.log('=== CREATE QUIZ REQUEST ===');
  console.log('req.user:', req.user);
  
  // Check if user is instructor
  const User = (await import('../models/User.js')).default;
  const user = await User.findById(req.user.id);
  console.log('User from DB for quiz creation:', user);
  console.log('User type:', user?.userType);
  
  if (!user || (user.userType !== 'instructor' && user.userType !== 'admin')) {
    console.log('❌ User is not instructor/admin');
    return res.status(403).json({ 
      success: false, 
      message: 'Only instructors can create quizzes' 
    });
  }
  
  console.log('✅ User is instructor/admin, proceeding');
  await quizController.createQuiz(req, res);
});

// Update quiz - INSTRUCTOR ONLY
quizRouter.put('/:quizId', auth, async (req, res, next) => {
  const User = (await import('../models/User.js')).default;
  const user = await User.findById(req.user.id);
  
  if (!user || (user.userType !== 'instructor' && user.userType !== 'admin')) {
    return res.status(403).json({ 
      success: false, 
      message: 'Only instructors can update quizzes' 
    });
  }
  
  await quizController.updateQuiz(req, res);
});

// Delete quiz - INSTRUCTOR ONLY
quizRouter.delete('/:quizId', auth, async (req, res, next) => {
  const User = (await import('../models/User.js')).default;
  const user = await User.findById(req.user.id);
  
  if (!user || (user.userType !== 'instructor' && user.userType !== 'admin')) {
    return res.status(403).json({ 
      success: false, 
      message: 'Only instructors can delete quizzes' 
    });
  }
  
  await quizController.deleteQuiz(req, res);
});

// Toggle publish status - INSTRUCTOR ONLY
quizRouter.patch('/:quizId/publish', auth, async (req, res, next) => {
  const User = (await import('../models/User.js')).default;
  const user = await User.findById(req.user.id);
  
  if (!user || (user.userType !== 'instructor' && user.userType !== 'admin')) {
    return res.status(403).json({ 
      success: false, 
      message: 'Only instructors can publish quizzes' 
    });
  }
  
  await quizController.togglePublish(req, res);
});

// Duplicate quiz - INSTRUCTOR ONLY
quizRouter.post('/:quizId/duplicate', auth, async (req, res, next) => {
  const User = (await import('../models/User.js')).default;
  const user = await User.findById(req.user.id);
  
  if (!user || (user.userType !== 'instructor' && user.userType !== 'admin')) {
    return res.status(403).json({ 
      success: false, 
      message: 'Only instructors can duplicate quizzes' 
    });
  }
  
  await quizController.duplicateQuiz(req, res);
});

// ============================================================
// QUIZ ATTEMPTS (Student)
// ============================================================

// Start a quiz attempt - STUDENTS only
quizRouter.post('/:quizId/start', auth, quizAttemptController.startAttempt);

// Save an answer - STUDENTS only
quizRouter.put('/:quizId/answer', auth, quizAttemptController.saveAnswer);

// Submit quiz - STUDENTS only
quizRouter.post('/:quizId/submit', auth, quizAttemptController.submitAttempt);

// Get attempt results - STUDENTS only
quizRouter.get('/attempt/:attemptId', auth, quizAttemptController.getAttemptResults);

// Get user's attempts - STUDENTS only
quizRouter.get('/attempts/user', auth, quizAttemptController.getUserAttempts);

// ============================================================
// INSTRUCTOR SUBMISSION MANAGEMENT (Instructor only)
// ============================================================

// Get all submissions for a quiz - INSTRUCTOR ONLY
quizRouter.get('/:quizId/submissions', auth, async (req, res, next) => {
  const User = (await import('../models/User.js')).default;
  const user = await User.findById(req.user.id);
  
  if (!user || (user.userType !== 'instructor' && user.userType !== 'admin')) {
    return res.status(403).json({ 
      success: false, 
      message: 'Only instructors can view submissions' 
    });
  }
  
  await quizAttemptController.getQuizSubmissions(req, res);
});

// Grade essay question - INSTRUCTOR ONLY
quizRouter.post('/attempt/:attemptId/grade', auth, async (req, res, next) => {
  const User = (await import('../models/User.js')).default;
  const user = await User.findById(req.user.id);
  
  if (!user || (user.userType !== 'instructor' && user.userType !== 'admin')) {
    return res.status(403).json({ 
      success: false, 
      message: 'Only instructors can grade essays' 
    });
  }
  
  await quizAttemptController.gradeEssay(req, res);
});

// ============================================================
// ANALYTICS (Instructor only)
// ============================================================

// Get quiz analytics - INSTRUCTOR ONLY
quizRouter.get('/:quizId/analytics', auth, async (req, res, next) => {
  const User = (await import('../models/User.js')).default;
  const user = await User.findById(req.user.id);
  
  if (!user || (user.userType !== 'instructor' && user.userType !== 'admin')) {
    return res.status(403).json({ 
      success: false, 
      message: 'Only instructors can view analytics' 
    });
  }
  
  await quizController.getQuizAnalytics(req, res);
});

export default quizRouter;