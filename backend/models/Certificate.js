import mongoose from "mongoose";

const CertificateSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true
  },
  enrollmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Enrollment',
    required: true
  },
  
  // Certificate details
  certificateNumber: {
    type: String,
    required: true,
    unique: true
  },
  issueDate: {
    type: Date,
    default: Date.now
  },
  expiryDate: {
    type: Date,
    default: null // null = never expires
  },
  
  // Student info (denormalized for verification)
  studentName: {
    type: String,
    required: true
  },
  studentEmail: {
    type: String,
    required: true
  },
  
  // Course info (denormalized for verification)
  courseTitle: {
    type: String,
    required: true
  },
  courseLevel: {
    type: String,
    default: 'Beginner'
  },
  
  // Grade/Performance
  grade: {
    type: String,
    enum: ['Pass', 'Merit', 'Distinction'],
    default: 'Pass'
  },
  score: {
    type: Number,
    default: 0
  },
  
  // Certificate metadata
  certificateUrl: {
    type: String,
    default: ''
  },
  pdfData: {
    type: Buffer,
    default: null
  },
  isVerified: {
    type: Boolean,
    default: true
  },
  isDownloaded: {
    type: Boolean,
    default: false
  },
  downloadedAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

// Indexes
CertificateSchema.index({ userId: 1, classId: 1 }, { unique: true });
CertificateSchema.index({ certificateNumber: 1 });
CertificateSchema.index({ userId: 1 });
CertificateSchema.index({ classId: 1 });

// Generate certificate number
CertificateSchema.pre('save', function(next) {
  if (!this.certificateNumber) {
    const prefix = 'FISSK';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.certificateNumber = `${prefix}-${timestamp}-${random}`;
  }
  next();
});

export default mongoose.model('Certificate', CertificateSchema);