import mongoose from "mongoose";

const LiveSessionSchema = new mongoose.Schema({
  instructorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  title: { type: String, required: true },
  description: String,
  date: Date,
  duration: String,
  participants: { type: Number, default: 0 },
  sessionType: { type: String, enum: ['upcoming', 'live', 'recorded'], default: 'upcoming' },
  // Cloudinary specific fields
  cloudinaryUrl: { type: String },
  cloudinaryPublicId: { type: String },
  thumbnailUrl: { type: String },
  hlsUrl: { type: String },
  recordingStartedAt: Date,
  recordingEndedAt: Date,
  // Live stream settings
  streamKey: { type: String },
  streamStatus: { type: String, enum: ['scheduled', 'live', 'ended', 'recorded'], default: 'scheduled' }
}, { timestamps: true });

LiveSessionSchema.index({ instructorId: 1 });
LiveSessionSchema.index({ classId: 1 });
LiveSessionSchema.index({ streamStatus: 1 });

export default mongoose.model("LiveSession", LiveSessionSchema);