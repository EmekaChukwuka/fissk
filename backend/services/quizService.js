import Quiz from '../models/Quiz.js';
import QuizAttempt from '../models/QuizAttempt.js';

class QuizService {
  /**
   * Auto-grade a quiz attempt
   */
  static async autoGradeAttempt(attemptId) {
    const attempt = await QuizAttempt.findById(attemptId);
    if (!attempt) throw new Error('Attempt not found');

    const quiz = await Quiz.findById(attempt.quizId);
    if (!quiz) throw new Error('Quiz not found');

    let totalPoints = 0;
    let earnedPoints = 0;
    const gradedAnswers = [];

    // Grade each answer
    for (const answer of attempt.answers) {
      const question = quiz.questions[answer.questionIndex];
      if (!question) continue;

      totalPoints += question.points || 1;

      // Skip if already manually graded (essay questions)
      if (answer.instructorPoints !== null && answer.instructorPoints !== undefined) {
        earnedPoints += answer.instructorPoints;
        gradedAnswers.push({
          ...answer.toObject(),
          isCorrect: answer.instructorPoints >= (question.points || 1) / 2,
          pointsEarned: answer.instructorPoints
        });
        continue;
      }

      // Auto-grade based on question type
      const result = this.gradeQuestion(question, answer.answer);
      earnedPoints += result.pointsEarned;
      
      gradedAnswers.push({
        ...answer.toObject(),
        isCorrect: result.isCorrect,
        pointsEarned: result.pointsEarned
      });
    }

    // Calculate score percentage
    const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
    const passed = score >= (quiz.settings?.passingScore || 70);

    // Update attempt
    attempt.answers = gradedAnswers;
    attempt.totalPoints = totalPoints;
    attempt.earnedPoints = earnedPoints;
    attempt.score = score;
    attempt.passed = passed;
    attempt.status = 'completed';

    await attempt.save();

    // Update quiz stats
    await this.updateQuizStats(quiz._id);

    return attempt;
  }

  /**
   * Grade a single question
   */
  static gradeQuestion(question, userAnswer) {
    const points = question.points || 1;
    let isCorrect = false;
    let pointsEarned = 0;

    switch (question.type) {
      case 'multiple-choice':
        isCorrect = userAnswer === question.correctAnswer;
        pointsEarned = isCorrect ? points : 0;
        break;

      case 'true-false':
        isCorrect = userAnswer === question.correctAnswer;
        pointsEarned = isCorrect ? points : 0;
        break;

      case 'multiple-answer':
        if (Array.isArray(userAnswer) && Array.isArray(question.correctAnswer)) {
          const correct = question.correctAnswer.sort().join(',');
          const user = [...userAnswer].sort().join(',');
          isCorrect = correct === user;
          pointsEarned = isCorrect ? points : 0;
        }
        break;

      case 'fill-in':
        if (typeof userAnswer === 'string' && typeof question.correctAnswer === 'string') {
          const normalizedUser = userAnswer.trim().toLowerCase();
          const normalizedCorrect = question.correctAnswer.trim().toLowerCase();
          isCorrect = normalizedUser === normalizedCorrect;
          pointsEarned = isCorrect ? points : 0;
        }
        break;

      case 'matching':
        if (question.matchingPairs && typeof userAnswer === 'object') {
          const correctPairs = Object.entries(question.matchingPairs);
          const userPairs = Object.entries(userAnswer);
          
          if (correctPairs.length === userPairs.length) {
            const matched = correctPairs.filter(([key, value]) => 
              userPairs.some(([k, v]) => k === key && v === value)
            );
            pointsEarned = Math.round((matched.length / correctPairs.length) * points);
            isCorrect = matched.length === correctPairs.length;
          }
        }
        break;

      case 'ordering':
        if (Array.isArray(userAnswer) && Array.isArray(question.correctOrder)) {
          const correct = question.correctOrder.join(',');
          const user = userAnswer.join(',');
          isCorrect = correct === user;
          pointsEarned = isCorrect ? points : 0;
        }
        break;

      case 'essay':
        // Essay questions need manual grading
        pointsEarned = null;
        isCorrect = null;
        break;

      default:
        pointsEarned = 0;
        isCorrect = false;
    }

    return { isCorrect, pointsEarned };
  }

  /**
   * Update quiz statistics
   */
  static async updateQuizStats(quizId) {
    const attempts = await QuizAttempt.find({ 
      quizId, 
      status: { $in: ['completed', 'graded'] } 
    });

    if (attempts.length === 0) {
      await Quiz.findByIdAndUpdate(quizId, {
        'stats.totalAttempts': 0,
        'stats.averageScore': 0,
        'stats.highestScore': 0,
        'stats.passRate': 0,
        'stats.averageTimeSpent': 0
      });
      return;
    }

    const totalAttempts = attempts.length;
    const scores = attempts.map(a => a.score || 0);
    const passed = attempts.filter(a => a.passed).length;
    const totalTime = attempts.reduce((sum, a) => sum + (a.timeSpent || 0), 0);

    const stats = {
      totalAttempts,
      averageScore: Math.round(scores.reduce((a, b) => a + b, 0) / totalAttempts * 10) / 10,
      highestScore: Math.max(...scores),
      passRate: Math.round((passed / totalAttempts) * 100),
      averageTimeSpent: Math.round(totalTime / totalAttempts)
    };

    await Quiz.findByIdAndUpdate(quizId, { 'stats': stats });
  }
// backend/services/quizService.js

/**
 * Validate quiz attempt
 */
static async validateAttempt(quizId, userId) {
    const Quiz = (await import('../models/Quiz.js')).default;
    const quiz = await Quiz.findById(quizId);
    if (!quiz) throw new Error('Quiz not found');

    // Check if quiz is published
    if (quiz.status !== 'published') {
        throw new Error('Quiz is not available. It has not been published yet.');
    }

    // Check if quiz is open
    const now = new Date();
    if (quiz.settings?.opensAt && new Date(quiz.settings.opensAt) > now) {
        throw new Error('Quiz has not opened yet');
    }
    if (quiz.settings?.closesAt && new Date(quiz.settings.closesAt) < now) {
        throw new Error('Quiz has closed');
    }

    // Check max attempts
    const QuizAttempt = (await import('../models/QuizAttempt.js')).default;
    const existingAttempts = await QuizAttempt.find({ quizId, userId });
    const completedAttempts = existingAttempts.filter(a => a.status !== 'in-progress');
    const maxAttempts = quiz.settings?.maxAttempts || 1;
    
    if (completedAttempts.length >= maxAttempts && !quiz.settings?.allowRetake) {
        throw new Error(`Maximum attempts (${maxAttempts}) reached.`);
    }

    return quiz;
}

  /**
   * Shuffle array (Fisher-Yates)
   */
  static shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Randomize quiz questions and options
   */
  static randomizeQuiz(quiz) {
    const questions = [...quiz.questions];
    
    if (quiz.settings?.randomizeQuestions) {
      return this.shuffleArray(questions);
    }
    
    return questions;
  }

  /**
   * Get quiz results with detailed breakdown
   */
  static async getDetailedResults(attemptId) {
    const attempt = await QuizAttempt.findById(attemptId)
      .populate('quizId')
      .lean();
    
    if (!attempt) throw new Error('Attempt not found');

    const quiz = attempt.quizId;
    const results = {
      score: attempt.score,
      passed: attempt.passed,
      totalPoints: attempt.totalPoints,
      earnedPoints: attempt.earnedPoints,
      timeSpent: attempt.timeSpent,
      submittedAt: attempt.submittedAt,
      questions: []
    };

    // Get question details with answers
    for (const answer of attempt.answers) {
      const question = quiz.questions[answer.questionIndex];
      if (!question) continue;

      results.questions.push({
        question: question.question,
        type: question.type,
        userAnswer: answer.answer,
        correctAnswer: question.correctAnswer,
        isCorrect: answer.isCorrect,
        points: question.points,
        pointsEarned: answer.pointsEarned || answer.instructorPoints || 0,
        explanation: question.explanation,
        instructorFeedback: answer.instructorFeedback || ''
      });
    }

    return results;
  }
}

export default QuizService;