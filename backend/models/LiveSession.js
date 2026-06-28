import mongoose from "mongoose";
import crypto from "crypto";

// ===== Generate unique meeting ID =====
function generateMeetingId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    if (i < 3) result += '-';
  }
  return result;
}

function generateLiveKitRoomName(meetingId) {
  return `meeting_${meetingId.replace(/-/g, '_')}`;
}

const LiveSessionSchema = new mongoose.Schema({
  instructorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  title: { type: String, required: true },
  description: String,
  date: Date,
  time: String,
  duration: String,
  participants: { type: Number, default: 0 },
  sessionType: { type: String, enum: ['upcoming', 'live', 'recorded'], default: 'upcoming' },
  
  // ===== Meeting ID - Required with default =====
  meetingId: { 
    type: String, 
    unique: true,
    required: true,
    default: function() {
      return generateMeetingId();
    }
  },
  
  livekitRoomName: { 
    type: String, 
    unique: true,
    default: function() {
      return generateLiveKitRoomName(this.meetingId || generateMeetingId());
    }
  },
  
  // Mux fields
  muxAssetId: { type: String },
  muxPlaybackId: { type: String },
  muxStatus: { type: String, enum: ['preparing', 'ready', 'errored', 'deleted'], default: 'preparing' },
  muxDuration: { type: Number },
  
  recordingStartedAt: Date,
  recordingEndedAt: Date,
  
  streamKey: { type: String },
  streamStatus: { type: String, enum: ['scheduled', 'live', 'ended', 'recorded'], default: 'scheduled' },
  
  hostConnected: { type: Boolean, default: false },
  hostConnectionTime: Date,
  
  activeParticipants: [{ 
    userId: String,
    userName: String,
    joinedAt: Date,
    leftAt: Date,
    isStillActive: { type: Boolean, default: true }
  }]
}, { timestamps: true });

// ===== Pre-save hook to ensure meetingId exists =====
LiveSessionSchema.pre('save', function(next) {
  // If meetingId is not set, generate one
  if (!this.meetingId) {
    let meetingId = generateMeetingId();
    // Simple uniqueness check (in case of collision, which is extremely unlikely)
    this.meetingId = meetingId;
  }
  
  // If livekitRoomName is not set, generate from meetingId
  if (!this.livekitRoomName && this.meetingId) {
    this.livekitRoomName = generateLiveKitRoomName(this.meetingId);
  }
  
  next();
});

// ===== Virtual for join URL =====
LiveSessionSchema.virtual('joinUrl').get(function() {
  if (this.meetingId) {
    return `https://fissk.onrender.com/newlivestream.html?meetingId=${this.meetingId}`;
  }
  return null;
});

// ===== Virtual for playback URL =====
LiveSessionSchema.virtual('playbackUrl').get(function() {
  if (this.muxPlaybackId) {
    return `https://stream.mux.com/${this.muxPlaybackId}.m3u8`;
  }
  return null;
});

// ===== Indexes =====
LiveSessionSchema.index({ meetingId: 1 });
LiveSessionSchema.index({ livekitRoomName: 1 });
LiveSessionSchema.index({ instructorId: 1 });
LiveSessionSchema.index({ classId: 1 });
LiveSessionSchema.index({ streamStatus: 1 });
LiveSessionSchema.index({ hostConnected: 1 });

// ===== Ensure virtuals are included in JSON =====
LiveSessionSchema.set('toJSON', { virtuals: true });
LiveSessionSchema.set('toObject', { virtuals: true });

export default mongoose.model("LiveSession", LiveSessionSchema);