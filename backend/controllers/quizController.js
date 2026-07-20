import Quiz from '../models/Quiz.js';
import QuizAttempt from '../models/QuizAttempt.js';
import QuizService from '../services/quizService.js';
import Class from '../models/Class.js';
import Enrollment from '../models/Enrollment.js';

/**
 * Get all quizzes for a class
 */
export const getClassQuizzes = async (req, res) => {
  try {
    const { classId } = req.params;
    const userId = req.user?.id;

    console.log('Getting quizzes for class:', classId);

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Check if user is enrolled or is instructor
    const Enrollment = (await import('../models/Enrollment.js')).default;
    const Class = (await import('../models/Class.js')).default;
    
    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    // Check if user is enrolled OR is the instructor
    const isInstructor = classData.instructorId.toString() === userId;
    const enrollment = await Enrollment.findOne({ userId, classId });
    
    if (!isInstructor && !enrollment) {
      return res.status(403).json({ 
        success: false, 
        message: 'You must be enrolled in this class to view quizzes' 
      });
    }

    const Quiz = (await import('../models/Quiz.js')).default;
    
    // If user is instructor, show all quizzes; if student, show only published
    const query = { classId };
    if (!isInstructor) {
      query.status = 'published';
    }

    const quizzes = await Quiz.find(query)
      .sort({ createdAt: -1 })
      .lean();

    console.log(`Found ${quizzes.length} quizzes for class ${classId}`);

    // Get user's attempts for each quiz
    const QuizAttempt = (await import('../models/QuizAttempt.js')).default;
    
    const quizzesWithStatus = await Promise.all(quizzes.map(async (quiz) => {
      const attempts = await QuizAttempt.find({ quizId: quiz._id, userId })
        .sort({ attemptNumber: -1 })
        .lean();

      const completedAttempts = attempts.filter(a => a.status === 'completed' || a.status === 'graded');
      const inProgressAttempt = attempts.find(a => a.status === 'in-progress');

      return {
        ...quiz,
        userAttempts: completedAttempts.length,
        userScore: completedAttempts.length > 0 ? completedAttempts[0].score : null,
        userPassed: completedAttempts.length > 0 ? completedAttempts[0].passed : false,
        canAttempt: inProgressAttempt ? true : completedAttempts.length < (quiz.settings?.maxAttempts || 1),
        inProgress: !!inProgressAttempt,
        attemptId: inProgressAttempt?._id || null,
        totalPoints: quiz.totalPoints || 0
      };
    }));

    res.json({
      success: true,
      quizzes: quizzesWithStatus
    });

  } catch (error) {
    console.error('Get class quizzes error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get single quiz details
 */
export const getQuiz = async (req, res) => {
  try {
    const { quizId } = req.params;
    const userId = req.user?.id;

    const quiz = await Quiz.findById(quizId)
      .populate('instructorId', 'firstName lastName')
      .lean();

    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    // Check if user has access
    const enrollment = await Enrollment.findOne({ 
      userId, 
      classId: quiz.classId 
    });

    const isInstructor = quiz.instructorId._id.toString() === userId;

    if (!enrollment && !isInstructor) {
      return res.status(403).json({ 
        success: false, 
        message: 'You must be enrolled in this class to view the quiz' 
      });
    }

    // Get user's attempts
    let userAttempts = [];
    let canAttempt = false;

    if (userId) {
      userAttempts = await QuizAttempt.find({ quizId, userId })
        .sort({ attemptNumber: -1 })
        .lean();

      const attempts = userAttempts.filter(a => a.status !== 'in-progress').length;
      canAttempt = attempts < (quiz.settings?.maxAttempts || 1);
    }

    // If quiz is published or user is instructor, show full details
    const isPublished = quiz.status === 'published';
    const showDetails = isPublished || isInstructor;

    res.json({
      success: true,
      quiz: {
        ...quiz,
        questions: showDetails ? quiz.questions : undefined,
        questionCount: quiz.questions.length,
        userAttempts,
        canAttempt
      }
    });

  } catch (error) {
    console.error('Get quiz error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Create a new quiz
 */
export const createQuiz = async (req, res) => {
  try {
    const { 
      title, description, classId, category, 
      questions, settings, status = 'draft' 
    } = req.body;

    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized - User ID not found' });
    }

    console.log('========================================');
    console.log('📝 CREATE QUIZ DEBUG');
    console.log('========================================');
    console.log('userId (ObjectId):', userId);
    console.log('userId as string:', userId.toString());
    console.log('classId received:', classId);
    console.log('title:', title);
    console.log('questions count:', questions?.length || 0);

    // Validate required fields
    if (!title || !classId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Title and classId are required' 
      });
    }

    if (!questions || questions.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'At least one question is required' 
      });
    }

    // Check if class exists
    const Class = (await import('../models/Class.js')).default;
    const classData = await Class.findById(classId);
    
    if (!classData) {
      console.log('❌ Class not found for ID:', classId);
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    console.log('✅ Class found:', classData.title);
    console.log('Class instructorId (string):', classData.instructorId.toString());
    console.log('Current user ID (string):', userId.toString());
    
    // ===== FIX: Compare as strings =====
    const isInstructor = classData.instructorId.toString() === userId.toString();
    console.log('Are they the same?', isInstructor);

    // Verify the user is the instructor of this class
    if (!isInstructor) {
      console.log('❌ User is NOT the instructor of this class');
      console.log('   Class instructor:', classData.instructorId.toString());
      console.log('   Current user:', userId.toString());
      return res.status(403).json({ 
        success: false, 
        message: 'You can only create quizzes for your own classes' 
      });
    }

    console.log('✅ User IS the instructor of this class');

    // Calculate total points
    let totalPoints = 0;
    if (questions && questions.length > 0) {
      totalPoints = questions.reduce((sum, q) => sum + (q.points || 1), 0);
    }

    const Quiz = (await import('../models/Quiz.js')).default;
    
    const quiz = new Quiz({
      title,
      description: description || '',
      classId,
      instructorId: userId,
      category: category || 'practice',
      questions: questions || [],
      settings: settings || {},
      status,
      totalPoints,
      questionCount: questions ? questions.length : 0
    });

    await quiz.save();
    console.log('✅ Quiz created successfully:', quiz._id);
    console.log('========================================');

    res.status(201).json({
      success: true,
      message: 'Quiz created successfully',
      quiz
    });

  } catch (error) {
    console.error('Create quiz error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to create quiz' 
    });
  }
};

/**
 * Update a quiz
 */
export const updateQuiz = async (req, res) => {
  try {
    const { quizId } = req.params;
    const updates = req.body;
    const userId = req.user?.id;

    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    if (quiz.instructorId.toString() !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: 'Only the quiz creator can update this quiz' 
      });
    }

    // Recalculate total points
    if (updates.questions) {
      updates.totalPoints = updates.questions.reduce((sum, q) => sum + (q.points || 1), 0);
      updates.questionCount = updates.questions.length;
    }

    const updatedQuiz = await Quiz.findByIdAndUpdate(
      quizId,
      { ...updates },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Quiz updated successfully',
      quiz: updatedQuiz
    });

  } catch (error) {
    console.error('Update quiz error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Delete a quiz
 */
export const deleteQuiz = async (req, res) => {
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
        message: 'Only the quiz creator can delete this quiz' 
      });
    }

    // Delete all attempts for this quiz
    await QuizAttempt.deleteMany({ quizId });

    await Quiz.findByIdAndDelete(quizId);

    res.json({
      success: true,
      message: 'Quiz deleted successfully'
    });

  } catch (error) {
    console.error('Delete quiz error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Publish/Unpublish a quiz
 */
export const togglePublish = async (req, res) => {
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
        message: 'Only the quiz creator can publish/unpublish this quiz' 
      });
    }

    // Toggle status
    const newStatus = quiz.status === 'published' ? 'draft' : 'published';
    quiz.status = newStatus;
    await quiz.save();

    res.json({
      success: true,
      message: `Quiz ${newStatus === 'published' ? 'published' : 'unpublished'} successfully`,
      status: newStatus
    });

  } catch (error) {
    console.error('Toggle publish error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Duplicate a quiz
 */
export const duplicateQuiz = async (req, res) => {
  try {
    const { quizId } = req.params;
    const userId = req.user?.id;

    const original = await Quiz.findById(quizId);
    if (!original) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    const newQuiz = new Quiz({
      title: `${original.title} (Copy)`,
      description: original.description,
      classId: original.classId,
      instructorId: userId,
      category: original.category,
      questions: original.questions.map(q => ({ ...q })), // Deep copy
      settings: { ...original.settings },
      status: 'draft',
      totalPoints: original.totalPoints,
      questionCount: original.questionCount
    });

    await newQuiz.save();

    res.status(201).json({
      success: true,
      message: 'Quiz duplicated successfully',
      quiz: newQuiz
    });

  } catch (error) {
    console.error('Duplicate quiz error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get quiz analytics for instructor
 */
export const getQuizAnalytics = async (req, res) => {
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
        message: 'Only the quiz creator can view analytics' 
      });
    }

    const attempts = await QuizAttempt.find({ 
      quizId, 
      status: { $in: ['completed', 'graded'] } 
    }).populate('userId', 'firstName lastName email');

    // Calculate analytics
    const totalAttempts = attempts.length;
    const scores = attempts.map(a => a.score || 0);
    const passed = attempts.filter(a => a.passed).length;
    const averageTime = attempts.reduce((sum, a) => sum + (a.timeSpent || 0), 0) / (totalAttempts || 1);

    // Question analysis
    const questionAnalysis = quiz.questions.map((q, index) => {
      const questionAttempts = attempts.filter(a => a.answers[index]);
      const correctCount = questionAttempts.filter(a => a.answers[index]?.isCorrect === true).length;
      const avgPoints = questionAttempts.reduce((sum, a) => sum + (a.answers[index]?.pointsEarned || 0), 0) / (questionAttempts.length || 1);

      return {
        question: q.question,
        type: q.type,
        totalAttempts: questionAttempts.length,
        correctRate: questionAttempts.length > 0 ? Math.round((correctCount / questionAttempts.length) * 100) : 0,
        averagePoints: Math.round(avgPoints * 10) / 10,
        maxPoints: q.points || 1
      };
    });

    res.json({
      success: true,
      analytics: {
        totalAttempts,
        averageScore: totalAttempts > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / totalAttempts * 10) / 10 : 0,
        highestScore: totalAttempts > 0 ? Math.max(...scores) : 0,
        passRate: totalAttempts > 0 ? Math.round((passed / totalAttempts) * 100) : 0,
        averageTime: Math.round(averageTime),
        attempts: attempts.map(a => ({
          student: a.userId ? `${a.userId.firstName} ${a.userId.lastName}` : 'Unknown',
          score: a.score,
          passed: a.passed,
          timeSpent: a.timeSpent,
          submittedAt: a.submittedAt
        })),
        questionAnalysis
      }
    });

  } catch (error) {
    console.error('Get quiz analytics error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};