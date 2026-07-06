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

export default mongoose.model("Class", ClassSchema);