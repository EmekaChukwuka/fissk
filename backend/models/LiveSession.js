import mongoose from "mongoose";

const LiveSessionSchema = new mongoose.Schema({
  instructorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  title: { type: String, required: true },
  description: String,
  date: Date,      // store full date+time, or separate fields as below
  // Alternatively keep separate fields:
  // sessionDate: Date,
  // sessionTime: String,
  duration: String,
  participants: { type: Number, default: 0 },
  sessionType: { type: String, enum: ['upcoming', 'recorded'], default: 'upcoming' }
}, { timestamps: true });

LiveSessionSchema.index({ instructorId: 1 });
LiveSessionSchema.index({ classId: 1 });

export default mongoose.model("LiveSession", LiveSessionSchema);