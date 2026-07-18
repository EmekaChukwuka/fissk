import mongoose from "mongoose";

const ClassSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  shortDescription: String,
  category: {
    type: String,
    enum: ['french', 'english', 'mathematics', 'physics', 'chemistry', 'biology', 'other'],
    required: true
  },
  level: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced'],
    required: true
  },
  duration: String,
  instructorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  thumbnailUrl: { type: String, default: '/assets/default-class-thumbnail.jpg' },
  
  // ===== PAYMENT FIELDS =====
  price: { type: Number, default: 0 },           // 0 = free
  isFree: { type: Boolean, default: true },
  currency: { type: String, default: 'NGN' },
  totalRevenue: { type: Number, default: 0 },
  totalSales: { type: Number, default: 0 },
  minPrice: { type: Number, default: 1000 },     // Minimum price in NGN
  
  // ===== QUIZ FIELDS =====
  quizCount: { type: Number, default: 0 },          // Total published quizzes
  totalQuizPoints: { type: Number, default: 0 },    // Sum of all quiz points
  averageQuizScore: { type: Number, default: 0 },   // Average score across all quiz attempts
  
  // ===== OTHER FIELDS =====
  isActive: { type: Boolean, default: true },
  maxStudents: { type: Number, default: 100 },
  requirements: String,
  learningOutcomes: String,
  syllabus: mongoose.Schema.Types.Mixed,
  rating: { type: Number, default: 0.00 },
  totalRatings: { type: Number, default: 0 }
}, { timestamps: true });

// Indexes
ClassSchema.index({ category: 1 });
ClassSchema.index({ level: 1 });
ClassSchema.index({ instructorId: 1 });
ClassSchema.index({ isActive: 1 });
ClassSchema.index({ isFree: 1 });
ClassSchema.index({ price: 1 });
ClassSchema.index({ title: 'text', description: 'text', shortDescription: 'text' });
ClassSchema.index({ quizCount: 1 });

// ===== VIRTUAL FIELDS =====
ClassSchema.virtual('studentCount').get(function() {
  return this.enrolledStudents || 0;
});

// ===== METHODS =====
ClassSchema.methods.incrementQuizCount = async function() {
  this.quizCount += 1;
  return this.save();
};

ClassSchema.methods.updateQuizStats = async function(averageScore) {
  if (averageScore !== undefined) {
    this.averageQuizScore = averageScore;
  }
  return this.save();
};

export default mongoose.model("Class", ClassSchema);