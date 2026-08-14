import mongoose from "mongoose";

/**
 * Content Item Schema - Each item within a lesson
 * Supports: text, video (existing), quiz (existing), material, link, embed
 */
const ContentItemSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['text', 'video', 'quiz', 'material', 'assignment', 'link', 'embed'],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  // For text type - the actual content/notes
  content: {
    type: String,
    default: ''
  },
  // For video type - reference to existing video (Stream model)
  videoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Stream',
    default: null
  },
  // For quiz type - reference to existing quiz
  quizId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quiz',
    default: null
  },
  // For material/file type
  fileUrl: {
    type: String,
    default: ''
  },
  fileName: {
    type: String,
    default: ''
  },
  fileSize: {
    type: Number,
    default: 0
  },
  // For assignment type
  assignmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Assignment',
    default: null
  },
  // For link type
  linkUrl: {
    type: String,
    default: ''
  },
  linkTarget: {
    type: String,
    enum: ['_blank', '_self'],
    default: '_blank'
  },
  // For embed type (YouTube, Vimeo, etc.)
  embedCode: {
    type: String,
    default: ''
  },
  // Duration in minutes (for videos)
  duration: {
    type: Number,
    default: 0
  },
  // Sorting order within the lesson
  order: {
    type: Number,
    default: 0
  },
  // Whether this item is required to complete the lesson
  isRequired: {
    type: Boolean,
    default: true
  }
}, { _id: false });

const LessonSchema = new mongoose.Schema({
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true
  },
  instructorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  // Array of content items (text, videos, quizzes, etc.)
  contentItems: [ContentItemSchema],
  // Estimated time to complete in minutes
  estimatedTime: {
    type: Number,
    default: 0
  },
  // Order in the course (for sequencing)
  order: {
    type: Number,
    default: 0
  },
  // Is this lesson a free preview?
  isFreePreview: {
    type: Boolean,
    default: false
  },
  // Is this lesson published?
  isPublished: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

// Indexes for performance
LessonSchema.index({ classId: 1, order: 1 });
LessonSchema.index({ instructorId: 1 });
LessonSchema.index({ isPublished: 1 });

// Virtual for total items count
LessonSchema.virtual('itemCount').get(function() {
  return this.contentItems ? this.contentItems.length : 0;
});

// Virtual for required items count
LessonSchema.virtual('requiredItemCount').get(function() {
  return this.contentItems ? this.contentItems.filter(item => item.isRequired).length : 0;
});

export default mongoose.model('Lesson', LessonSchema);