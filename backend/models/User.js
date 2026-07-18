import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  phone: String,
  password: { type: String, required: true },
  profilePicture: String,
  userType: {
    type: String,
    enum: ['student', 'instructor', 'admin'],
    default: 'student'
  },
  isVerified: { type: Boolean, default: false },
  newsletterSubscribed: { type: Boolean, default: false },
  bio: String,
  qualifications: String,
  experienceYears: { type: Number, default: 0 },
  isApproved: {
    type: Boolean,
    default: false  // For instructors, admin needs to approve
  },
  approvedAt: { type: Date },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  // ===== PAYMENT FIELDS =====
  // For instructors
  earnings: { type: Number, default: 0 },          // Available balance
  totalRevenue: { type: Number, default: 0 },      // Total earned all time
  totalSales: { type: Number, default: 0 },        // Total number of sales
  
  // Bank details for payouts
  bankDetails: {
    bankName: { type: String },
    accountNumber: { type: String },
    accountName: { type: String },
    bankCode: { type: String }                     // Paystack bank code
  },
  bankDetailsVerified: { type: Boolean, default: false },
  
  // ===== QUIZ STATS =====
  quizStats: {
    totalQuizzesTaken: { type: Number, default: 0 },
    averageScore: { type: Number, default: 0 },
    bestScore: { type: Number, default: 0 },
    quizzesPassed: { type: Number, default: 0 },
    totalQuizzesCreated: { type: Number, default: 0 } // For instructors
  }
}, { timestamps: true });

// Indexes
UserSchema.index({ email: 1 });
UserSchema.index({ userType: 1 });
UserSchema.index({ 'quizStats.totalQuizzesTaken': -1 });

// ===== METHODS =====

/**
 * Update user's quiz statistics
 */
UserSchema.methods.updateQuizStats = async function() {
  const QuizAttempt = mongoose.model('QuizAttempt');
  const attempts = await QuizAttempt.find({ 
    userId: this._id, 
    status: { $in: ['completed', 'graded'] } 
  });
  
  if (attempts.length > 0) {
    const scores = attempts.map(a => a.score || 0);
    const passed = attempts.filter(a => a.passed).length;
    
    this.quizStats.totalQuizzesTaken = attempts.length;
    this.quizStats.averageScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    this.quizStats.bestScore = Math.max(...scores);
    this.quizStats.quizzesPassed = passed;
  } else {
    this.quizStats.totalQuizzesTaken = 0;
    this.quizStats.averageScore = 0;
    this.quizStats.bestScore = 0;
    this.quizStats.quizzesPassed = 0;
  }
  
  return this.save();
};

/**
 * Increment quizzes created (for instructors)
 */
UserSchema.methods.incrementQuizzesCreated = async function() {
  this.quizStats.totalQuizzesCreated += 1;
  return this.save();
};

export default mongoose.model("User", UserSchema);