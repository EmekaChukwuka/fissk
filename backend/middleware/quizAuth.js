import Enrollment from '../models/Enrollment.js';
import Class from '../models/Class.js';

/**
 * Check if user is enrolled in the class
 */
export const checkEnrollment = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const classId = req.params.classId || req.body.classId;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (!classId) {
      return res.status(400).json({ success: false, message: 'Class ID required' });
    }

    // Check if user is the instructor
    const classData = await Class.findById(classId);
    if (classData && classData.instructorId.toString() === userId) {
      req.isInstructor = true;
      return next();
    }

    // Check enrollment
    const enrollment = await Enrollment.findOne({ userId, classId });
    if (!enrollment) {
      return res.status(403).json({ 
        success: false, 
        message: 'You must be enrolled in this class to access this resource' 
      });
    }

    req.isEnrolled = true;
    next();

  } catch (error) {
    console.error('Enrollment check error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Check if user is the quiz instructor
 */
export const isQuizInstructor = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const quizId = req.params.quizId || req.params.id || req.body.quizId;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const Quiz = (await import('../models/Quiz.js')).default;
    const quiz = await Quiz.findById(quizId);
    
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    if (quiz.instructorId.toString() !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: 'Only the quiz instructor can perform this action' 
      });
    }

    req.quiz = quiz;
    next();

  } catch (error) {
    console.error('Quiz instructor check error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Check if user can take the quiz
 */
export const canTakeQuiz = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const quizId = req.params.quizId;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const QuizService = (await import('../services/quizService.js')).default;
    await QuizService.validateAttempt(quizId, userId);

    next();

  } catch (error) {
    console.error('Can take quiz check error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};