import mongoose from "mongoose";
import crypto from "crypto";

// ===== Generate unique meeting ID =====
function generateMeetingId() {
  // Format: 3 groups of 4 alphanumeric chars (e.g., "abcd-efgh-ijkl")
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

// ===== Generate unique LiveKit room name =====
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
  
  // ===== NEW: Unique meeting ID =====
  meetingId: { 
    type: String, 
    unique: true, 
    required: true,
    index: true 
  },
  // ===== NEW: Room name for LiveKit =====
  livekitRoomName: { 
    type: String, 
    unique: true,
    index: true 
  },
  
  // Mux fields
  muxAssetId: { type: String },
  muxPlaybackId: { type: String },
  muxStatus: { type: String, enum: ['preparing', 'ready', 'errored', 'deleted'], default: 'preparing' },
  muxDuration: { type: Number },
  
  recordingStartedAt: Date,
  recordingEndedAt: Date,
  
  // Live stream settings
  streamKey: { type: String },
  streamStatus: { type: String, enum: ['scheduled', 'live', 'ended', 'recorded'], default: 'scheduled' },
  
  // ===== NEW: Host connection tracking =====
  hostConnected: { type: Boolean, default: false },
  hostConnectionTime: Date,
  
  // ===== NEW: Active participants tracking =====
  activeParticipants: [{ 
    userId: String,
    userName: String,
    joinedAt: Date,
    leftAt: Date,
    isStillActive: { type: Boolean, default: true }
  }]
}, { timestamps: true });

// ===== Pre-save hook to generate meetingId =====
LiveSessionSchema.pre('save', async function(next) {
  if (!this.meetingId) {
    let isUnique = false;
    let attempts = 0;
    while (!isUnique && attempts < 10) {
      const candidateId = generateMeetingId();
      const existing = await mongoose.model('LiveSession').findOne({ meetingId: candidateId });
      if (!existing) {
        this.meetingId = candidateId;
        this.livekitRoomName = generateLiveKitRoomName(candidateId);
        isUnique = true;
      }
      attempts++;
    }
    if (!isUnique) {
      // Fallback with timestamp
      this.meetingId = `${generateMeetingId()}-${Date.now().toString(36)}`;
      this.livekitRoomName = generateLiveKitRoomName(this.meetingId);
    }
  }
  next();
});

// ===== Virtual for join URL =====
LiveSessionSchema.virtual('joinUrl').get(function() {
  return `https://fissk.onrender.com/join/${this.meetingId}`;
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

export default mongoose.model("LiveSession", LiveSessionSchema);