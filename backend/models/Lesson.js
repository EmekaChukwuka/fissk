import mongoose from "mongoose";

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
  content: {
    type: String,
    default: '' // For text content, embed code, description
  },
  // Video specific
  videoUrl: {
    type: String,
    default: ''
  },
  muxPlaybackId: {
    type: String,
    default: ''
  },
  // Quiz specific
  quizId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quiz',
    default: null
  },
  // Material/File specific
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
  // Assignment specific
  assignmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Assignment',
    default: null
  },
  // Link specific
  linkUrl: {
    type: String,
    default: ''
  },
  linkTarget: {
    type: String,
    enum: ['_blank', '_self'],
    default: '_blank'
  },
  // Embed specific (YouTube, Vimeo, etc.)
  embedCode: {
    type: String,
    default: ''
  },
  // Duration in minutes
  duration: {
    type: Number,
    default: 0
  },
  // Sorting order
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
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  // Lesson content items
  contentItems: [ContentItemSchema],
  // Estimated time to complete in minutes
  estimatedTime: {
    type: Number,
    default: 0
  },
  // Order in the course
  order: {
    type: Number,
    default: 0
  },
  // Is this lesson free preview?
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

// Indexes
LessonSchema.index({ classId: 1, order: 1 });
LessonSchema.index({ instructorId: 1 });

// Virtual for total items count
LessonSchema.virtual('itemCount').get(function() {
  return this.contentItems ? this.contentItems.length : 0;
});

export default mongoose.model('Lesson', LessonSchema);