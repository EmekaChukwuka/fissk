import mongoose from "mongoose";

// Sub‑schema for assignment submission details
const SubmissionSchema = new mongoose.Schema({
  submissionFileUrl: String,
  submissionText: String,
  submittedAt: Date,
  grade: Number,
  feedback: String,
  gradedAt: Date,
  graderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { _id: false });

// Sub‑schema for progress items (videos and assignments)
const ProgressItemSchema = new mongoose.Schema({
  itemType: { type: String, enum: ['video', 'assignment'], required: true },
  itemId: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'progressItems.itemTypeModel' },
  itemTypeModel: {
    type: String,
    required: true,
    enum: ['Video', 'Assignment']
  },
  completed: { type: Boolean, default: false },
  progressPercentage: { type: Number, default: 0 },
  timeSpentSeconds: { type: Number, default: 0 },
  lastAccessed: { type: Date, default: Date.now },
  completedAt: Date,
  submission: SubmissionSchema
}, { _id: false });

// ===== QUIZ PROGRESS SCHEMA =====
const QuizProgressSchema = new mongoose.Schema({
  quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz' },
  attemptId: { type: mongoose.Schema.Types.ObjectId, ref: 'QuizAttempt' },
  score: { type: Number, default: 0 },
  passed: { type: Boolean, default: false },
  completedAt: Date,
  attemptNumber: { type: Number, default: 1 },
  timeSpent: { type: Number, default: 0 } // In seconds
}, { _id: false });

const EnrollmentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  enrolledAt: { type: Date, default: Date.now },
  lastAccessed: { type: Date, default: Date.now },
  progress: { type: Number, default: 0, min: 0, max: 100 },
  completed: { type: Boolean, default: false },
  completedAt: Date,
  certificateIssued: { type: Boolean, default: false },
  certificateUrl: String,
  progressItems: [ProgressItemSchema],
  
  // ===== QUIZ PROGRESS =====
  quizProgress: [QuizProgressSchema],
  totalQuizzesTaken: { type: Number, default: 0 },
  averageQuizScore: { type: Number, default: 0 },
  quizzesPassed: { type: Number, default: 0 },
  bestQuizScore: { type: Number, default: 0 },
  
  // ===== PAYMENT FIELDS =====
  paymentReference: { type: String, sparse: true },
  paymentStatus: { 
    type: String, 
    enum: ['pending', 'paid', 'free', 'failed'], 
    default: 'free' 
  },
  amountPaid: { type: Number, default: 0 },
  paidAt: { type: Date },
  accessType: { type: String, enum: ['free', 'paid'], default: 'free' }
}, { timestamps: true });

// Compound unique index to prevent duplicate enrollments
EnrollmentSchema.index({ userId: 1, classId: 1 }, { unique: true });
EnrollmentSchema.index({ classId: 1 });
EnrollmentSchema.index({ completed: 1 });
EnrollmentSchema.index({ paymentReference: 1 });
EnrollmentSchema.index({ paymentStatus: 1 });
EnrollmentSchema.index({ userId: 1, 'quizProgress.quizId': 1 });
EnrollmentSchema.index({ totalQuizzesTaken: -1 });

// ===== METHODS =====

/**
 * Update quiz statistics for this enrollment
 */
EnrollmentSchema.methods.updateQuizStats = async function() {
  const completedQuizzes = this.quizProgress.filter(q => q.completedAt);
  this.totalQuizzesTaken = completedQuizzes.length;
  
  if (completedQuizzes.length > 0) {
    const scores = completedQuizzes.map(q => q.score);
    this.averageQuizScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    this.bestQuizScore = Math.max(...scores);
    this.quizzesPassed = completedQuizzes.filter(q => q.passed).length;
  } else {
    this.averageQuizScore = 0;
    this.bestQuizScore = 0;
    this.quizzesPassed = 0;
  }
  
  return this.save();
};

/**
 * Add a quiz attempt to the enrollment progress
 */
EnrollmentSchema.methods.addQuizAttempt = async function(quizId, attemptId, score, passed, timeSpent) {
  // Check if this quiz already exists in progress
  const existingIndex = this.quizProgress.findIndex(
    q => q.quizId.toString() === quizId.toString()
  );
  
  const quizData = {
    quizId,
    attemptId,
    score,
    passed,
    completedAt: new Date(),
    attemptNumber: this.quizProgress.filter(q => q.quizId.toString() === quizId.toString()).length + 1,
    timeSpent: timeSpent || 0
  };
  
  if (existingIndex !== -1) {
    // Update existing entry (only if better score or newer attempt)
    const existing = this.quizProgress[existingIndex];
    if (score > existing.score) {
      this.quizProgress[existingIndex] = quizData;
    }
  } else {
    this.quizProgress.push(quizData);
  }
  
  await this.updateQuizStats();
  return this;
};

/**
 * Check if user has completed a specific quiz
 */
EnrollmentSchema.methods.hasCompletedQuiz = function(quizId) {
  return this.quizProgress.some(
    q => q.quizId.toString() === quizId.toString() && q.completedAt
  );
};

/**
 * Get quiz score for a specific quiz
 */
EnrollmentSchema.methods.getQuizScore = function(quizId) {
  const quiz = this.quizProgress.find(
    q => q.quizId.toString() === quizId.toString()
  );
  return quiz ? quiz.score : null;
};

export default mongoose.model("Enrollment", EnrollmentSchema);