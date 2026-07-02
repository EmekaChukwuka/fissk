// models/Stream.js - FIXED
import mongoose from "mongoose";

const CommentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName: { type: String, required: true },
  message: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const StreamSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  filename: { type: String, required: true },
  size: { type: Number, default: 0 }, // ← CHANGED: made optional with default
  comments: [CommentSchema],
  streamClass: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
  classTitle: String,
  classDescription: String,
  participants: { type: Number, default: 0 },
  duration: String,
  sessionType: { type: String, enum: ['live', 'recorded'], default: 'recorded' },
  
  // Mux fields
  muxAssetId: { type: String, index: true },
  muxPlaybackId: { type: String, index: true },
  muxUploadId: { type: String }, // ← ADDED: track the upload ID
  muxStatus: { type: String, enum: ['preparing', 'ready', 'errored', 'deleted', 'uploading'], default: 'preparing' },
  muxDuration: { type: Number },
  
  viewCount: { type: Number, default: 0 }
}, { timestamps: true });

// Virtual for playback URL
StreamSchema.virtual('playbackUrl').get(function() {
  if (this.muxPlaybackId) {
    return `https://stream.mux.com/${this.muxPlaybackId}.m3u8`;
  }
  return null;
});

// Indexes
StreamSchema.index({ userId: 1 });
StreamSchema.index({ createdAt: -1 });
StreamSchema.index({ muxAssetId: 1 });
StreamSchema.index({ muxPlaybackId: 1 });
StreamSchema.index({ streamClass: 1 });

const StreamModel = mongoose.model('Stream', StreamSchema);

// Wrapper class
class Stream {
  static async create({ userId, name, filename, size, streamClass, classTitle, classDescription, participants, duration, muxAssetId, muxPlaybackId, muxUploadId }) {
    try {
      // Validate required fields
      if (!userId) throw new Error('userId is required');
      if (!name) throw new Error('name is required');
      if (!filename) throw new Error('filename is required');
      
      const stream = await StreamModel.create({
        userId,
        name,
        filename,
        size: size || 0,
        streamClass,
        classTitle: classTitle || name,
        classDescription: classDescription || '',
        participants: participants || 0,
        duration: duration || '0:00',
        sessionType: 'recorded',
        muxAssetId: muxAssetId || null,
        muxPlaybackId: muxPlaybackId || null,
        muxUploadId: muxUploadId || null,
        muxStatus: muxAssetId ? 'preparing' : null,
        comments: []
      });

      console.log(`✅ Stream created: ${stream._id}, title: ${classTitle || name}`);
      return stream._id.toString();
    } catch (error) {
      console.error('Error creating stream:', error);
      throw error;
    }
  }

  static async getAll() {
    try {
      const streams = await StreamModel.find()
        .populate('userId', 'firstName lastName email')
        .populate('streamClass', 'title')
        .sort({ createdAt: -1 })
        .lean();
      return streams;
    } catch (error) {
      console.error('Error fetching streams:', error);
      throw error;
    }
  }

  static async getById(id) {
    try {
      return await StreamModel.findById(id)
        .populate('userId', 'firstName lastName email')
        .populate('streamClass', 'title')
        .lean();
    } catch (error) {
      console.error('Error fetching stream:', error);
      throw error;
    }
  }

  static async getByMuxAssetId(assetId) {
    try {
      return await StreamModel.findOne({ muxAssetId: assetId }).lean();
    } catch (error) {
      console.error('Error fetching stream by Mux asset:', error);
      throw error;
    }
  }

  static async getByClass(classId) {
    try {
      return await StreamModel.find({ streamClass: classId })
        .sort({ createdAt: -1 })
        .lean();
    } catch (error) {
      console.error('Error fetching streams by class:', error);
      throw error;
    }
  }

  static async update(id, updateData) {
    try {
      return await StreamModel.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
    } catch (error) {
      console.error('Error updating stream:', error);
      throw error;
    }
  }

  static async delete(id) {
    try {
      return await StreamModel.findByIdAndDelete(id);
    } catch (error) {
      console.error('Error deleting stream:', error);
      throw error;
    }
  }

  static async addComment(streamId, userId, userName, message) {
    try {
      const stream = await StreamModel.findById(streamId);
      if (!stream) {
        throw new Error('Stream not found');
      }

      stream.comments.push({
        userId,
        userName,
        message,
        createdAt: new Date()
      });

      await stream.save();
      return stream.comments[stream.comments.length - 1];
    } catch (error) {
      console.error('Error adding comment:', error);
      throw error;
    }
  }

  static async getByUser(userId) {
    try {
      return await StreamModel.find({ userId })
        .sort({ createdAt: -1 })
        .lean();
    } catch (error) {
      console.error('Error fetching user streams:', error);
      throw error;
    }
  }

  static async incrementViewCount(streamId) {
    try {
      return await StreamModel.findByIdAndUpdate(
        streamId,
        { $inc: { viewCount: 1 } },
        { new: true }
      );
    } catch (error) {
      console.error('Error incrementing view count:', error);
    }
  }

  static async updateMuxStatus(assetId, status, playbackId = null, duration = null) {
    try {
      const updateData = { muxStatus: status };
      if (playbackId) updateData.muxPlaybackId = playbackId;
      if (duration) updateData.muxDuration = duration;
      
      return await StreamModel.findOneAndUpdate(
        { muxAssetId: assetId },
        updateData,
        { new: true }
      );
    } catch (error) {
      console.error('Error updating Mux status:', error);
      throw error;
    }
  }

  // NEW: Get all streams for a class with Mux data
  static async getClassVideos(classId) {
    try {
      const streams = await StreamModel.find({ 
        streamClass: classId,
        $or: [
          { muxAssetId: { $exists: true, $ne: null } },
          { muxPlaybackId: { $exists: true, $ne: null } }
        ]
      })
        .sort({ createdAt: -1 })
        .lean();
      
      return streams.map(stream => ({
        _id: stream._id,
        title: stream.classTitle || stream.name,
        description: stream.classDescription || '',
        filename: stream.filename,
        duration: stream.duration,
        participants: stream.participants,
        uploadDate: stream.createdAt,
        muxAssetId: stream.muxAssetId,
        muxPlaybackId: stream.muxPlaybackId,
        playbackUrl: stream.muxPlaybackId ? 
          `https://stream.mux.com/${stream.muxPlaybackId}.m3u8` : null,
        thumbnailUrl: stream.muxPlaybackId ?
          `https://image.mux.com/${stream.muxPlaybackId}/thumbnail.jpg?time=5` : null,
        muxStatus: stream.muxStatus,
      }));
    } catch (error) {
      console.error('Error getting class videos:', error);
      throw error;
    }
  }
}

export default Stream;