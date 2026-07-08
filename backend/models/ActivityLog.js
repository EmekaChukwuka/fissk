import mongoose from 'mongoose';

const ActivityLogSchema = new mongoose.Schema({
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  adminName: { type: String, required: true },
  action: {
    type: String,
    required: true,
    enum: [
      'user_created', 'user_updated', 'user_suspended', 'user_activated',
      'instructor_approved', 'instructor_rejected',
      'class_created', 'class_updated', 'class_deleted', 'class_featured',
      'payment_viewed', 'payment_processed',
      'payout_approved', 'payout_rejected', 'payout_processed',
      'settings_updated',
      'admin_login', 'admin_logout',
      'reported_content_reviewed'
    ]
  },
  targetType: {
    type: String,
    enum: ['user', 'class', 'payment', 'payout', 'settings'],
    required: true
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  targetName: { type: String },
  details: { type: Object, default: {} },
  ipAddress: { type: String },
  userAgent: { type: String },
  createdAt: { type: Date, default: Date.now }
});

// Indexes
ActivityLogSchema.index({ adminId: 1 });
ActivityLogSchema.index({ createdAt: -1 });
ActivityLogSchema.index({ action: 1 });

export default mongoose.model('ActivityLog', ActivityLogSchema);