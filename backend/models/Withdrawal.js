import mongoose from "mongoose";

const WithdrawalSchema = new mongoose.Schema({
  instructor: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  amount: { 
    type: Number, 
    required: true 
  },
  currency: { 
    type: String, 
    default: 'NGN' 
  },
  reference: { 
    type: String, 
    unique: true, 
    required: true 
  },
  bankDetails: {
    bankName: { type: String, required: true },
    accountNumber: { type: String, required: true },
    accountName: { type: String, required: true },
    bankCode: { type: String }
  },
  status: { 
    type: String, 
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'], 
    default: 'pending' 
  },
  paystackTransferId: { 
    type: String 
  },
  paystackTransferData: { 
    type: Object, 
    default: {} 
  },
  completedAt: { 
    type: Date 
  },
  failureReason: { 
    type: String 
  },
  processedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }
}, { timestamps: true });

// Indexes
WithdrawalSchema.index({ instructor: 1 });
WithdrawalSchema.index({ reference: 1 }, { unique: true });
WithdrawalSchema.index({ status: 1 });
WithdrawalSchema.index({ createdAt: -1 });

export default mongoose.model("Withdrawal", WithdrawalSchema);