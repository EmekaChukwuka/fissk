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
  
  // Mux fields
  muxAssetId: { type: String },
  muxPlaybackId: { type: String },
  muxStatus: { type: String, enum: ['preparing', 'ready', 'errored', 'deleted'], default: 'preparing' },
  muxDuration: { type: Number },
  
  recordingStartedAt: Date,
  recordingEndedAt: Date,
  
  // Live stream settings
  streamKey: { type: String },
  streamStatus: { type: String, enum: ['scheduled', 'live', 'ended', 'recorded'], default: 'scheduled' }
}, { timestamps: true });

// Virtual for playback URL
LiveSessionSchema.virtual('playbackUrl').get(function() {
  if (this.muxPlaybackId) {
    return `https://stream.mux.com/${this.muxPlaybackId}.m3u8`;
  }
  return null;
});

LiveSessionSchema.index({ instructorId: 1 });
LiveSessionSchema.index({ classId: 1 });
LiveSessionSchema.index({ streamStatus: 1 });
LiveSessionSchema.index({ muxAssetId: 1 });
LiveSessionSchema.index({ muxPlaybackId: 1 });

export default mongoose.model("LiveSession", LiveSessionSchema);