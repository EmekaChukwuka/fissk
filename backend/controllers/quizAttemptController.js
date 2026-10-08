// backend/controllers/quizAttemptController.js
import mongoose from 'mongoose';
import Quiz from '../models/Quiz.js';
import QuizAttempt from '../models/QuizAttempt.js';
import QuizService from '../services/quizService.js';
import Enrollment from '../models/Enrollment.js';
import Class from '../models/Class.js';
import Stream from '../models/Stream.js';
import Assignment from '../models/Assignment.js';
import User from '../models/User.js';

// Get raw Mongoose models where needed
const StreamModel = mongoose.model('Stream');

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

    const quiz = await QuizService.validateAttempt(quizId, userId);

    const enrollment = await Enrollment.findOne({ userId, classId: quiz.classId });
    
    if (!enrollment) {
      return res.status(403).json({ 
        success: false, 
        message: 'You must be enrolled in this class to take the quiz' 
      });
    }

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

    const attemptsCount = await QuizAttempt.countDocuments({ quizId, userId });
    const attemptNumber = attemptsCount + 1;

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

    const answerIndex = attempt.answers.findIndex(a => a.questionIndex === questionIndex);
    if (answerIndex === -1) {
      return res.status(400).json({ success: false, message: 'Invalid question index' });
    }

    attempt.answers[answerIndex].answer = answer;
    attempt.answers[answerIndex].isCorrect = null;
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

    const timeSpent = Math.floor((Date.now() - new Date(attempt.startedAt).getTime()) / 1000);
    attempt.timeSpent = timeSpent;
    attempt.submittedAt = new Date();

    await attempt.save();

    const gradedAttempt = await QuizService.autoGradeAttempt(attempt._id);

    // ===== UPDATE CLASS STATS =====
    const quiz = await Quiz.findById(quizId);
    if (quiz) {
      await Class.findByIdAndUpdate(quiz.classId, {
        $inc: { quizCount: 1 }
      });
      
      const allAttempts = await QuizAttempt.find({ 
        classId: quiz.classId,
        status: { $in: ['completed', 'graded'] }
      });
      
      const scores = allAttempts.map(a => a.score || 0);
      const avgScore = scores.length > 0 
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) 
        : 0;
      
      await Class.findByIdAndUpdate(quiz.classId, {
        averageQuizScore: avgScore
      });
    }

    // ===== UPDATE ENROLLMENT QUIZ PROGRESS =====
    const enrollment = await Enrollment.findOne({
      userId: userId,
      classId: attempt.classId
    });

    if (enrollment) {
      if (!enrollment.quizProgress) {
        enrollment.quizProgress = [];
      }

      const existingIndex = enrollment.quizProgress.findIndex(
        q => q.quizId && q.quizId.toString() === quizId.toString()
      );
      
      const quizData = {
        quizId: quizId,
        attemptId: gradedAttempt._id,
        score: gradedAttempt.score,
        passed: gradedAttempt.passed,
        completedAt: new Date(),
        attemptNumber: enrollment.quizProgress.filter(
          q => q.quizId && q.quizId.toString() === quizId.toString()
        ).length + 1,
        timeSpent: gradedAttempt.timeSpent || 0
      };
      
      if (existingIndex !== -1) {
        const existing = enrollment.quizProgress[existingIndex];
        if (gradedAttempt.score > existing.score) {
          enrollment.quizProgress[existingIndex] = quizData;
        }
      } else {
        enrollment.quizProgress.push(quizData);
      }
      
      const completedQuizzes = enrollment.quizProgress.filter(q => q.completedAt);
      enrollment.totalQuizzesTaken = completedQuizzes.length;
      
      if (completedQuizzes.length > 0) {
        const quizScores = completedQuizzes.map(q => q.score);
        enrollment.averageQuizScore = Math.round(
          quizScores.reduce((a, b) => a + b, 0) / quizScores.length
        );
        enrollment.bestQuizScore = Math.max(...quizScores);
        enrollment.quizzesPassed = completedQuizzes.filter(q => q.passed).length;
      }
      
      await updateCourseProgress(enrollment._id);
      
      await enrollment.save();
    }

    // ===== UPDATE USER QUIZ STATS =====
    const user = await User.findById(userId);
    if (user) {
      const allAttempts = await QuizAttempt.find({ 
        userId: userId,
        status: { $in: ['completed', 'graded'] }
      });
      
      if (allAttempts.length > 0) {
        const scores = allAttempts.map(a => a.score || 0);
        const passed = allAttempts.filter(a => a.passed).length;
        
        user.quizStats = {
          totalQuizzesTaken: allAttempts.length,
          averageScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
          bestScore: Math.max(...scores),
          quizzesPassed: passed,
          totalQuizzesCreated: user.quizStats?.totalQuizzesCreated || 0
        };
        
        await user.save();
      }
    }

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

/**
 * Update overall course progress based on videos, assignments, and quizzes
 */
async function updateCourseProgress(enrollmentId) {
  const enrollment = await Enrollment.findById(enrollmentId);
  if (!enrollment) return;

  const classData = await Class.findById(enrollment.classId);
  if (!classData) return;

  let totalItems = 0;
  let completedItems = 0;

  // 1. Videos/Streams
  const streams = await StreamModel.find({ streamClass: enrollment.classId });
  totalItems += streams.length;
  
  const completedVideos = enrollment.progressItems.filter(
    item => item.itemType === 'video' && item.completed
  ).length;
  completedItems += completedVideos;

  // 2. Quizzes
  const quizzes = await Quiz.find({ 
    classId: enrollment.classId,
    status: 'published'
  });
  totalItems += quizzes.length;
  
  const completedQuizzes = enrollment.quizProgress 
    ? enrollment.quizProgress.filter(q => q.completedAt).length 
    : 0;
  completedItems += completedQuizzes;

  // 3. Assignments
  const assignments = await Assignment.find({ classId: enrollment.classId });
  totalItems += assignments.length;
  
  const completedAssignments = enrollment.progressItems.filter(
    item => item.itemType === 'assignment' && item.completed
  ).length;
  completedItems += completedAssignments;

  // Calculate progress percentage
  const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  enrollment.progress = Math.min(progress, 100);
  
  if (progress >= 100) {
    enrollment.completed = true;
    enrollment.completedAt = new Date();
  }

  await enrollment.save();
  console.log(`📊 Course progress updated: ${progress}% (${completedItems}/${totalItems} items)`);
}

/**
 * Get attempt results
 */
export const getAttemptResults = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const attempt = await QuizAttempt.findById(attemptId)
      .populate('quizId')
      .lean();

    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Attempt not found' });
    }

    const isOwner = attempt.userId?.toString() === userId?.toString();

    let isInstructor = false;
    try {
      const quiz = await Quiz.findById(attempt.quizId);
      if (quiz) {
        isInstructor = quiz.instructorId?.toString() === userId?.toString();
      }
    } catch (err) {
      console.error('Error checking instructor:', err);
    }

    if (!isOwner && !isInstructor) {
      return res.status(403).json({ 
        success: false, 
        message: 'You do not have permission to view these results' 
      });
    }

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
 * Grade essay question (Instructor)
 */
export const gradeEssay = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const { questionIndex, points, feedback } = req.body;
    const userId = req.user?.id;

    console.log('=== GRADE ESSAY ===');
    console.log('Attempt ID:', attemptId);
    console.log('User ID:', userId);

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const attempt = await QuizAttempt.findById(attemptId);
    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Attempt not found' });
    }

    const quiz = await Quiz.findById(attempt.quizId);
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    const isInstructor = quiz.instructorId?.toString() === userId?.toString();

    if (!isInstructor) {
      return res.status(403).json({ 
        success: false, 
        message: 'Only the quiz instructor can grade essays' 
      });
    }

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

    await QuizService.updateQuizStats(quiz._id);

    console.log('✅ Essay graded successfully');

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

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const quiz = await Quiz.findById(quizId);
    
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    const isInstructor = quiz.instructorId?.toString() === userId?.toString();
    console.log('Is instructor?', isInstructor);

    if (!isInstructor) {
      return res.status(403).json({ 
        success: false, 
        message: 'Only the quiz instructor can view submissions' 
      });
    }

    const submissions = await QuizAttempt.find({ quizId })
      .populate('userId', 'firstName lastName email')
      .sort({ submittedAt: -1 })
      .lean();

    console.log(`Found ${submissions.length} submissions`);

    const formattedSubmissions = submissions.map(sub => ({
      ...sub,
      studentName: sub.userId ? `${sub.userId.firstName} ${sub.userId.lastName}`.trim() : 'Anonymous',
      studentEmail: sub.userId?.email || 'Unknown'
    }));

    res.json({
      success: true,
      submissions: formattedSubmissions
    });

  } catch (error) {
    console.error('Get quiz submissions error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to load submissions' 
    });
  }
};