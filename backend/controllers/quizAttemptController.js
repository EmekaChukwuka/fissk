import Quiz from '../models/Quiz.js';
import QuizAttempt from '../models/QuizAttempt.js';
import QuizService from '../services/quizService.js';
import Enrollment from '../models/Enrollment.js';

/**
 * Start a quiz attempt
 */
export const startAttempt = async (req, res) => {
  try {
    const { quizId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    console.log('=== START ATTEMPT ===');
    console.log('Quiz ID:', quizId);
    console.log('User ID:', userId);

    // Validate attempt - this will throw if not valid
    const quiz = await QuizService.validateAttempt(quizId, userId);

    // Check enrollment
    const Enrollment = (await import('../models/Enrollment.js')).default;
    const enrollment = await Enrollment.findOne({ userId, classId: quiz.classId });
    
    if (!enrollment) {
      return res.status(403).json({ 
        success: false, 
        message: 'You must be enrolled in this class to take the quiz' 
      });
    }

    // Check for existing in-progress attempt
    const QuizAttempt = (await import('../models/QuizAttempt.js')).default;
    const existingAttempt = await QuizAttempt.findOne({
      quizId,
      userId,
      status: 'in-progress'
    });

    if (existingAttempt) {
      console.log('Resuming existing attempt:', existingAttempt._id);
      return res.json({
        success: true,
        attempt: existingAttempt,
        message: 'Resuming existing attempt'
      });
    }

    // Get attempt number
    const attemptsCount = await QuizAttempt.countDocuments({ quizId, userId });
    const attemptNumber = attemptsCount + 1;

    // Create new attempt
    const attempt = new QuizAttempt({
      quizId,
      userId,
      classId: quiz.classId,
      attemptNumber,
      answers: quiz.questions.map((_, index) => ({
        questionIndex: index,
        answer: null
      })),
      status: 'in-progress',
      startedAt: new Date()
    });

    await attempt.save();
    console.log('✅ New attempt created:', attempt._id);

    res.status(201).json({
      success: true,
      attempt,
      message: 'Quiz started successfully'
    });

  } catch (error) {
    console.error('Start attempt error:', error);
    res.status(400).json({ 
      success: false, 
      message: error.message || 'Failed to start quiz' 
    });
  }
};

/**
 * Save an answer
 */
export const saveAnswer = async (req, res) => {
  try {
    const { quizId } = req.params;
    const { questionIndex, answer } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Find active attempt
    const attempt = await QuizAttempt.findOne({
      quizId,
      userId,
      status: 'in-progress'
    });

    if (!attempt) {
      return res.status(404).json({ 
        success: false, 
        message: 'No active attempt found. Please start the quiz first.' 
      });
    }

    // Update answer
    const answerIndex = attempt.answers.findIndex(a => a.questionIndex === questionIndex);
    if (answerIndex === -1) {
      return res.status(400).json({ success: false, message: 'Invalid question index' });
    }

    attempt.answers[answerIndex].answer = answer;
    attempt.answers[answerIndex].isCorrect = null; // Reset grading
    attempt.answers[answerIndex].pointsEarned = null;

    await attempt.save();

    res.json({
      success: true,
      message: 'Answer saved successfully'
    });

  } catch (error) {
    console.error('Save answer error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Submit quiz attempt
 */
export const submitAttempt = async (req, res) => {
  try {
    const { quizId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Find active attempt
    const attempt = await QuizAttempt.findOne({
      quizId,
      userId,
      status: 'in-progress'
    });

    if (!attempt) {
      return res.status(404).json({ 
        success: false, 
        message: 'No active attempt found' 
      });
    }

    // Check if all questions are answered (skip for essay questions)
    const quiz = await Quiz.findById(quizId);
    const unanswered = attempt.answers.filter((a, index) => {
      const question = quiz.questions[index];
      // Skip validation for essay questions (they can be blank)
      if (question?.type === 'essay') return false;
      return a.answer === null || a.answer === undefined || a.answer === '';
    });

    if (unanswered.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Please answer all questions before submitting. ${unanswered.length} question(s) remaining.`,
        unansweredCount: unanswered.length
      });
    }

    // Calculate time spent
    const timeSpent = Math.floor((Date.now() - new Date(attempt.startedAt).getTime()) / 1000);
    attempt.timeSpent = timeSpent;
    attempt.submittedAt = new Date();

    await attempt.save();

    // Auto-grade the attempt (essay questions will be marked for manual grading)
    const gradedAttempt = await QuizService.autoGradeAttempt(attempt._id);

    res.json({
      success: true,
      message: 'Quiz submitted successfully',
      attempt: gradedAttempt,
      results: await QuizService.getDetailedResults(gradedAttempt._id)
    });

  } catch (error) {
    console.error('Submit attempt error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
// backend/controllers/quizAttemptController.js

/**
 * Get attempt results
 */
export const getAttemptResults = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const userId = req.user?.id;

    console.log('=== GET ATTEMPT RESULTS ===');
    console.log('Attempt ID:', attemptId);
    console.log('User ID:', userId);

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const attempt = await QuizAttempt.findById(attemptId)
      .populate('quizId')
      .lean();

    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Attempt not found' });
    }

    console.log('Attempt found:', attempt._id);
    console.log('Attempt userId:', attempt.userId);
    console.log('Current userId:', userId);

    // ===== FIX: Compare as strings =====
    const isOwner = attempt.userId?.toString() === userId?.toString();
    console.log('Is owner?', isOwner);

    // Check if user is instructor of the class
    let isInstructor = false;
    try {
      const Quiz = (await import('../models/Quiz.js')).default;
      const quiz = await Quiz.findById(attempt.quizId);
      if (quiz) {
        isInstructor = quiz.instructorId?.toString() === userId?.toString();
        console.log('Is instructor?', isInstructor);
      }
    } catch (err) {
      console.error('Error checking instructor:', err);
    }

    if (!isOwner && !isInstructor) {
      console.log('❌ User does not have permission to view these results');
      return res.status(403).json({ 
        success: false, 
        message: 'You do not have permission to view these results' 
      });
    }

    console.log('✅ User has permission to view results');

    // Get detailed results
    const results = await QuizService.getDetailedResults(attemptId);

    res.json({
      success: true,
      attempt,
      results
    });

  } catch (error) {
    console.error('Get attempt results error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to load results' 
    });
  }
};

/**
 * Get user's quiz attempts
 */
export const getUserAttempts = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { classId } = req.query;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const query = { userId };
    if (classId) query.classId = classId;

    const attempts = await QuizAttempt.find(query)
      .populate('quizId', 'title description category')
      .sort({ submittedAt: -1 })
      .lean();

    res.json({
      success: true,
      attempts
    });

  } catch (error) {
    console.error('Get user attempts error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Grade essay questions (Instructor)
 */
export const gradeEssay = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const { questionIndex, points, feedback } = req.body;
    const userId = req.user?.id;

    const attempt = await QuizAttempt.findById(attemptId).populate('quizId');
    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Attempt not found' });
    }

    const quiz = attempt.quizId;
    
    // Check if user is instructor
    if (quiz.instructorId.toString() !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: 'Only the quiz instructor can grade essays' 
      });
    }

    // Update answer with instructor grading
    const answer = attempt.answers.find(a => a.questionIndex === questionIndex);
    if (!answer) {
      return res.status(400).json({ success: false, message: 'Invalid question index' });
    }

    const question = quiz.questions[questionIndex];
    if (!question || question.type !== 'essay') {
      return res.status(400).json({ success: false, message: 'This question is not an essay' });
    }

    const maxPoints = question.points || 1;
    const earnedPoints = Math.min(Math.max(points || 0, 0), maxPoints);

    answer.instructorPoints = earnedPoints;
    answer.instructorFeedback = feedback || '';
    answer.isCorrect = earnedPoints >= maxPoints / 2;
    answer.pointsEarned = earnedPoints;

    // Recalculate total score
    let totalPoints = 0;
    let earnedTotal = 0;

    attempt.answers.forEach((a, index) => {
      const q = quiz.questions[index];
      if (q) {
        totalPoints += q.points || 1;
        if (a.pointsEarned !== null && a.pointsEarned !== undefined) {
          earnedTotal += a.pointsEarned;
        } else if (a.instructorPoints !== null && a.instructorPoints !== undefined) {
          earnedTotal += a.instructorPoints;
        }
      }
    });

    attempt.totalPoints = totalPoints;
    attempt.earnedPoints = earnedTotal;
    attempt.score = totalPoints > 0 ? Math.round((earnedTotal / totalPoints) * 100) : 0;
    attempt.passed = attempt.score >= (quiz.settings?.passingScore || 70);
    attempt.status = 'graded';

    await attempt.save();

    // Update quiz stats
    await QuizService.updateQuizStats(quiz._id);

    res.json({
      success: true,
      message: 'Essay graded successfully',
      attempt
    });

  } catch (error) {
    console.error('Grade essay error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get all submissions for a quiz (Instructor)
 */
export const getQuizSubmissions = async (req, res) => {
  try {
    const { quizId } = req.params;
    const userId = req.user?.id;

    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    if (quiz.instructorId.toString() !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: 'Only the quiz instructor can view submissions' 
      });
    }

    const submissions = await QuizAttempt.find({ quizId })
      .populate('userId', 'firstName lastName email')
      .sort({ submittedAt: -1 })
      .lean();

    res.json({
      success: true,
      submissions: submissions.map(s => ({
        ...s,
        studentName: s.userId ? `${s.userId.firstName} ${s.userId.lastName}` : 'Unknown',
        studentEmail: s.userId?.email || 'Unknown'
      }))
    });

  } catch (error) {
    console.error('Get submissions error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};