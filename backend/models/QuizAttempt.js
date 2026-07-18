import mongoose from "mongoose";

const AnswerSchema = new mongoose.Schema({
  questionIndex: {
    type: Number,
    required: true
  },
  answer: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  isCorrect: {
    type: Boolean,
    default: null
  },
  pointsEarned: {
    type: Number,
    default: null
  },
  // For essay questions
  instructorFeedback: {
    type: String,
    default: ''
  },
  instructorPoints: {
    type: Number,
    default: null
  }
}, { _id: false });

const QuizAttemptSchema = new mongoose.Schema({
  quizId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quiz',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true
  },
  attemptNumber: {
    type: Number,
    default: 1
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  submittedAt: {
    type: Date,
    default: null
  },
  timeSpent: {
    type: Number,
    default: 0 // in seconds
  },
  answers: [AnswerSchema],
  score: {
    type: Number,
    default: 0 // percentage
  },
  totalPoints: {
    type: Number,
    default: 0
  },
  earnedPoints: {
    type: Number,
    default: 0
  },
  passed: {
    type: Boolean,
    default: false
  },
  feedback: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['in-progress', 'completed', 'graded', 'expired'],
    default: 'in-progress'
  }
}, { timestamps: true });

// Indexes for performance
QuizAttemptSchema.index({ quizId: 1, userId: 1 });
QuizAttemptSchema.index({ classId: 1, userId: 1 });
QuizAttemptSchema.index({ submittedAt: -1 });
QuizAttemptSchema.index({ status: 1 });

// Get user's attempts for a quiz
QuizAttemptSchema.statics.getUserAttempts = async function(quizId, userId) {
  return this.find({ quizId, userId })
    .sort({ attemptNumber: -1 })
    .lean();
};

// Check if user can retake quiz
QuizAttemptSchema.statics.canRetake = async function(quizId, userId, maxAttempts) {
  const attempts = await this.find({ quizId, userId });
  return attempts.length < maxAttempts;
};

export default mongoose.model('QuizAttempt', QuizAttemptSchema);