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
  size: { type: Number, required: true },
  comments: [CommentSchema],
  streamClass: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
  classTitle: String,
  classDescription: String,
  participants: { type: Number, default: 0 },
  duration: String,
  sessionType: { type: String, enum: ['live', 'recorded'], default: 'recorded' }
}, { timestamps: true });

StreamSchema.index({ userId: 1 });
StreamSchema.index({ createdAt: -1 });

const StreamModel = mongoose.model('Stream', StreamSchema);

// Wrapper class to maintain the same interface
class Stream {
  // Create a new stream and live session
  static async create({ userId, name, filename, size, streamClass, classTitle, classDescription, participants, duration }) {
    try {
      // Create the stream document
      const stream = await StreamModel.create({
        userId,
        name,
        filename,
        size,
        streamClass,
        classTitle,
        classDescription,
        participants: participants || 0,
        duration,
        sessionType: 'recorded',
        comments: []
      });

      // Create corresponding live session
      const LiveSession = mongoose.model('LiveSession');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      await LiveSession.create({
        instructorId: userId,
        classId: streamClass,
        title: classTitle || name,
        description: classDescription || '',
        date: today,
        time: new Date().toTimeString().split(' ')[0], // HH:MM:SS format
        duration: duration || '0:00',
        participants: participants || 0,
        sessionType: 'recorded'
      });

      // Return the MongoDB _id (converted to string for compatibility)
      return stream._id.toString();
    } catch (error) {
      console.error('Error creating stream:', error);
      throw error;
    }
  }

  // Get all streams
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

  // Get stream by ID
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

  // Update stream
  static async update(id, updateData) {
    try {
      return await StreamModel.findByIdAndUpdate(
        id, 
        updateData, 
        { new: true, runValidators: true }
      );
    } catch (error) {
      console.error('Error updating stream:', error);
      throw error;
    }
  }

  // Delete stream
  static async delete(id) {
    try {
      return await StreamModel.findByIdAndDelete(id);
    } catch (error) {
      console.error('Error deleting stream:', error);
      throw error;
    }
  }

  // Add comment to stream
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

  // Get streams by user
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
}

export default Stream;