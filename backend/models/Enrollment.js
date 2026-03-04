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
  progressPercentage: { type: Number, default: 0 }, // e.g., % watched
  timeSpentSeconds: { type: Number, default: 0 },
  lastAccessed: { type: Date, default: Date.now },
  completedAt: Date,
  submission: SubmissionSchema
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
  progressItems: [ProgressItemSchema]
}, { timestamps: true });

// Compound unique index to prevent duplicate enrollments
EnrollmentSchema.index({ userId: 1, classId: 1 }, { unique: true });
EnrollmentSchema.index({ classId: 1 });
EnrollmentSchema.index({ completed: 1 });

export default mongoose.model("Enrollment", EnrollmentSchema);