import mongoose from "mongoose";

const QuestionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['multiple-choice', 'true-false', 'multiple-answer', 'fill-in', 'essay', 'matching', 'ordering'],
    required: true
  },
  question: {
    type: String,
    required: true
  },
  options: {
    type: [String],
    default: []
  },
  correctAnswer: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  points: {
    type: Number,
    default: 1,
    min: 0
  },
  explanation: {
    type: String,
    default: ''
  },
  imageUrl: {
    type: String,
    default: ''
  },
  matchingPairs: {
    type: Map,
    of: String,
    default: {}
  },
  correctOrder: {
    type: [String],
    default: []
  },
  rubric: {
    type: String,
    default: ''
  }
}, { _id: false });

const QuizSettingsSchema = new mongoose.Schema({
  timeLimit: {
    type: Number,
    default: 0,
    min: 0
  },
  passingScore: {
    type: Number,
    default: 70,
    min: 0,
    max: 100
  },
  randomizeQuestions: {
    type: Boolean,
    default: false
  },
  randomizeOptions: {
    type: Boolean,
    default: false
  },
  showResults: {
    type: Boolean,
    default: true
  },
  allowRetake: {
    type: Boolean,
    default: false
  },
  maxAttempts: {
    type: Number,
    default: 1,
    min: 1
  },
  opensAt: {
    type: Date,
    default: null
  },
  closesAt: {
    type: Date,
    default: null
  },
  showCorrectAnswers: {
    type: Boolean,
    default: true
  }
}, { _id: false });

const QuizStatsSchema = new mongoose.Schema({
  totalAttempts: {
    type: Number,
    default: 0
  },
  averageScore: {
    type: Number,
    default: 0
  },
  highestScore: {
    type: Number,
    default: 0
  },
  passRate: {
    type: Number,
    default: 0
  },
  averageTimeSpent: {
    type: Number,
    default: 0
  }
}, { _id: false });

const QuizSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true
  },
  instructorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  category: {
    type: String,
    enum: ['practice', 'exam', 'homework', 'project', 'other'],
    default: 'practice'
  },
  questions: [QuestionSchema],
  settings: {
    type: QuizSettingsSchema,
    default: () => ({})
  },
  stats: {
    type: QuizStatsSchema,
    default: () => ({})
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  },
  totalPoints: {
    type: Number,
    default: 0
  },
  questionCount: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

// Indexes for performance
QuizSchema.index({ classId: 1, status: 1 });
QuizSchema.index({ instructorId: 1, createdAt: -1 });
QuizSchema.index({ status: 1, 'settings.opensAt': 1 });

// Virtual for total points
QuizSchema.virtual('computedTotalPoints').get(function() {
  if (this.questions && this.questions.length > 0) {
    return this.questions.reduce((sum, q) => sum + (q.points || 1), 0);
  }
  return 0;
});

// ===== FIX: Pre-save middleware - Use regular function, not arrow function =====
// Arrow functions don't have access to 'this' and don't work with 'next'
QuizSchema.pre('save', async function() {
  if (this.questions && this.questions.length > 0) {
    this.totalPoints = this.questions.reduce((sum, q) => sum + (q.points || 1), 0);
    this.questionCount = this.questions.length;
  }
  return;
});

export default mongoose.model('Quiz', QuizSchema);