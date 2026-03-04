import mongoose from "mongoose";

const ReviewSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: String
}, { timestamps: true });

// Ensure one review per user per class
ReviewSchema.index({ userId: 1, classId: 1 }, { unique: true });
ReviewSchema.index({ classId: 1 });

export default mongoose.model("Review", ReviewSchema);