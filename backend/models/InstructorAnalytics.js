import mongoose from "mongoose";

const InstructorAnalyticsSchema = new mongoose.Schema({
  instructorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  date: { type: Date, required: true }, // store only the date part (YYYY-MM-DD)
  enrollmentsCount: { type: Number, default: 0 },
  completionsCount: { type: Number, default: 0 },
  revenue: { type: Number, default: 0.00 },
  avgRating: { type: Number, default: 0.00 },
  videoViews: { type: Number, default: 0 },
  timeSpentTotal: { type: Number, default: 0 } // seconds
}, { timestamps: true });

// Unique compound index
InstructorAnalyticsSchema.index({ instructorId: 1, classId: 1, date: 1 }, { unique: true });
InstructorAnalyticsSchema.index({ instructorId: 1, date: 1 });

export default mongoose.model("InstructorAnalytics", InstructorAnalyticsSchema);