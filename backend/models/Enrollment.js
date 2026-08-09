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

// Sub‑schema for progress items (videos, lessons, and assignments)
const ProgressItemSchema = new mongoose.Schema({
  itemType: { 
    type: String, 
    enum: ['video', 'assignment', 'lesson'], 
    required: true 
  },
  itemId: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: true, 
    refPath: 'progressItems.itemTypeModel' 
  },
  itemTypeModel: {
    type: String,
    required: true,
    enum: ['Video', 'Assignment', 'Lesson']
  },
  completed: { type: Boolean, default: false },
  progressPercentage: { type: Number, default: 0 },
  timeSpentSeconds: { type: Number, default: 0 },
  lastAccessed: { type: Date, default: Date.now },
  completedAt: Date,
  submission: SubmissionSchema,
  // Lesson specific fields
  lessonIndex: { type: Number, default: 0 },
  contentItemsCompleted: { type: Number, default: 0 },
  totalContentItems: { type: Number, default: 0 }
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

// ===== LESSON PROGRESS SCHEMA =====
const LessonProgressSchema = new mongoose.Schema({
  lessonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' },
  completed: { type: Boolean, default: false },
  completedAt: Date,
  contentItemsCompleted: { type: Number, default: 0 },
  totalContentItems: { type: Number, default: 0 },
  progressPercentage: { type: Number, default: 0 },
  lastAccessed: { type: Date, default: Date.now }
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
  
  // ===== PROGRESS ITEMS (Videos, Assignments, Lessons) =====
  progressItems: [ProgressItemSchema],
  
  // ===== LESSON PROGRESS =====
  lessonProgress: [LessonProgressSchema],
  totalLessons: { type: Number, default: 0 },
  completedLessons: { type: Number, default: 0 },
  lessonProgressPercentage: { type: Number, default: 0 },
  
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
EnrollmentSchema.index({ userId: 1, 'lessonProgress.lessonId': 1 });
EnrollmentSchema.index({ totalQuizzesTaken: -1 });
EnrollmentSchema.index({ completedLessons: -1 });

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
    const existing = this.quizProgress[existingIndex];
    if (score > existing.score) {
      this.quizProgress[existingIndex] = quizData;
    }
  } else {
    this.quizProgress.push(quizData);
  }
  
  await this.updateQuizStats();
  await this.calculateOverallProgress();
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

// ===== LESSON PROGRESS METHODS =====

/**
 * Update lesson progress for this enrollment
 */
EnrollmentSchema.methods.updateLessonProgress = async function(lessonId, progressPercentage, contentItemsCompleted, totalContentItems) {
  const existingIndex = this.lessonProgress.findIndex(
    l => l.lessonId.toString() === lessonId.toString()
  );
  
  const isComplete = progressPercentage >= 100;
  
  const lessonData = {
    lessonId,
    completed: isComplete,
    completedAt: isComplete ? new Date() : null,
    contentItemsCompleted: contentItemsCompleted || 0,
    totalContentItems: totalContentItems || 0,
    progressPercentage: Math.min(progressPercentage || 0, 100),
    lastAccessed: new Date()
  };
  
  if (existingIndex !== -1) {
    this.lessonProgress[existingIndex] = lessonData;
  } else {
    this.lessonProgress.push(lessonData);
  }
  
  // Update lesson stats
  this.completedLessons = this.lessonProgress.filter(l => l.completed).length;
  this.totalLessons = this.lessonProgress.length;
  
  const totalProgress = this.lessonProgress.reduce((sum, l) => sum + l.progressPercentage, 0);
  this.lessonProgressPercentage = this.lessonProgress.length > 0 
    ? Math.round(totalProgress / this.lessonProgress.length) 
    : 0;
  
  await this.save();
  await this.calculateOverallProgress();
  return this;
};

/**
 * Get lesson progress for a specific lesson
 */
EnrollmentSchema.methods.getLessonProgress = function(lessonId) {
  const lesson = this.lessonProgress.find(
    l => l.lessonId.toString() === lessonId.toString()
  );
  return lesson || null;
};

/**
 * Check if a lesson is completed
 */
EnrollmentSchema.methods.isLessonCompleted = function(lessonId) {
  const lesson = this.lessonProgress.find(
    l => l.lessonId.toString() === lessonId.toString()
  );
  return lesson ? lesson.completed : false;
};

/**
 * Add a lesson to progress items (for overall progress tracking)
 */
EnrollmentSchema.methods.addLessonToProgress = async function(lessonId, completed = false) {
  // Check if already exists
  const existing = this.progressItems.find(
    item => item.itemType === 'lesson' && item.itemId.toString() === lessonId.toString()
  );
  
  if (!existing) {
    this.progressItems.push({
      itemType: 'lesson',
      itemId: lessonId,
      itemTypeModel: 'Lesson',
      completed: completed,
      progressPercentage: completed ? 100 : 0,
      completedAt: completed ? new Date() : null,
      lastAccessed: new Date()
    });
    await this.save();
  }
  
  return this;
};

/**
 * Calculate overall course progress including videos, quizzes, assignments, and lessons
 */
EnrollmentSchema.methods.calculateOverallProgress = async function() {
    const Class = mongoose.model('Class');
    const Stream = mongoose.model('Stream');
    const Quiz = mongoose.model('Quiz');
    const Assignment = mongoose.model('Assignment');
    const Lesson = mongoose.model('Lesson');
    
    const classData = await Class.findById(this.classId);
    if (!classData) return 0;
    
    let totalItems = 0;
    let completedItems = 0;
    
    // 1. Videos/Streams
    const streams = await Stream.find({ streamClass: this.classId });
    totalItems += streams.length;
    const completedVideos = this.progressItems.filter(
        item => item.itemType === 'video' && item.completed
    ).length;
    completedItems += completedVideos;
    
    // 2. Quizzes (published only)
    const quizzes = await Quiz.find({ 
        classId: this.classId, 
        status: 'published' 
    });
    totalItems += quizzes.length;
    const completedQuizzes = this.quizProgress.filter(q => q.completedAt).length;
    completedItems += completedQuizzes;
    
    // 3. Assignments
    const assignments = await Assignment.find({ classId: this.classId });
    totalItems += assignments.length;
    const completedAssignments = this.progressItems.filter(
        item => item.itemType === 'assignment' && item.completed
    ).length;
    completedItems += completedAssignments;
    
    // 4. Lessons (new)
    const lessons = await Lesson.find({ 
        classId: this.classId,
        isPublished: true 
    });
    totalItems += lessons.length;
    const completedLessons = this.lessonProgress.filter(l => l.completed).length;
    completedItems += completedLessons;
    
    // Calculate progress
    const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
    
    this.progress = Math.min(progress, 100);
    if (progress >= 100) {
        this.completed = true;
        this.completedAt = new Date();
    }
    
    await this.save();
    return this.progress;
};

/**
 * Get all progress data for dashboard
 */
EnrollmentSchema.methods.getProgressSummary = function() {
  return {
    overall: this.progress,
    completed: this.completed,
    videos: {
      total: this.progressItems.filter(i => i.itemType === 'video').length,
      completed: this.progressItems.filter(i => i.itemType === 'video' && i.completed).length
    },
    quizzes: {
      total: this.quizProgress.length,
      completed: this.quizProgress.filter(q => q.completedAt).length,
      averageScore: this.averageQuizScore,
      passed: this.quizzesPassed
    },
    lessons: {
      total: this.lessonProgress.length,
      completed: this.completedLessons,
      progress: this.lessonProgressPercentage
    },
    assignments: {
      total: this.progressItems.filter(i => i.itemType === 'assignment').length,
      completed: this.progressItems.filter(i => i.itemType === 'assignment' && i.completed).length
    }
  };
};

export default mongoose.model("Enrollment", EnrollmentSchema);