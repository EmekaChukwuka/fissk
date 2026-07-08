import mongoose from 'mongoose';

const AdminSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  role: {
    type: String,
    enum: ['super_admin', 'moderator', 'support'],
    default: 'moderator'
  },
  permissions: {
    manageUsers: { type: Boolean, default: false },
    manageClasses: { type: Boolean, default: false },
    managePayments: { type: Boolean, default: false },
    managePayouts: { type: Boolean, default: false },
    manageSettings: { type: Boolean, default: false },
    viewAnalytics: { type: Boolean, default: false }
  },
  lastLogin: { type: Date },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Indexes
AdminSchema.index({ userId: 1 }, { unique: true });
AdminSchema.index({ role: 1 });
AdminSchema.index({ isActive: 1 });

// Pre-save hook to set permissions based on role
AdminSchema.pre('save', async function(next) {
    try {
    if (this.isModified('role')) {
    const rolePermissions = {
      super_admin: {
        manageUsers: true,
        manageClasses: true,
        managePayments: true,
        managePayouts: true,
        manageSettings: true,
        viewAnalytics: true
      },
      moderator: {
        manageUsers: true,
        manageClasses: true,
        managePayments: false,
        managePayouts: false,
        manageSettings: false,
        viewAnalytics: true
      },
      support: {
        manageUsers: true,
        manageClasses: false,
        managePayments: false,
        managePayouts: false,
        manageSettings: false,
        viewAnalytics: false
      }
    };
    
    this.permissions = rolePermissions[this.role] || rolePermissions.moderator;
  }
  next();
   } catch (error) {
    next(error); // Pass error to next
  }
});

export default mongoose.model('Admin', AdminSchema);