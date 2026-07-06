import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  phone: String,
  password: { type: String, required: true },
  profilePicture: String,
  userType: {
    type: String,
    enum: ['student', 'instructor', 'admin'],
    default: 'student'
  },
  isVerified: { type: Boolean, default: false },
  newsletterSubscribed: { type: Boolean, default: false },
  bio: String,
  qualifications: String,
  experienceYears: { type: Number, default: 0 },
  
  // ===== PAYMENT FIELDS =====
  // For instructors
  earnings: { type: Number, default: 0 },          // Available balance
  totalRevenue: { type: Number, default: 0 },      // Total earned all time
  totalSales: { type: Number, default: 0 },        // Total number of sales
  
  // Bank details for payouts
  bankDetails: {
    bankName: { type: String },
    accountNumber: { type: String },
    accountName: { type: String },
    bankCode: { type: String }                     // Paystack bank code
  },
  bankDetailsVerified: { type: Boolean, default: false }
}, { timestamps: true });

// Indexes
UserSchema.index({ email: 1 });
UserSchema.index({ userType: 1 });

export default mongoose.model("User", UserSchema);