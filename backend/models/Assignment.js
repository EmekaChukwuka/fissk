import mongoose from "mongoose";

const AssignmentSchema = new mongoose.Schema({
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  title: { type: String, required: true },
  description: String,
  instructions: String,
  dueDate: Date,
  maxPoints: { type: Number, default: 100 },
  assignmentFileUrl: String
}, { timestamps: true });

// Indexes
AssignmentSchema.index({ classId: 1 });
AssignmentSchema.index({ dueDate: 1 });

export default mongoose.model("Assignment", AssignmentSchema);