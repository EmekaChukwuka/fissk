import mongoose from "mongoose";

const PaymentSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  class: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Class', 
    required: true 
  },
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
  status: { 
    type: String, 
    enum: ['pending', 'success', 'failed', 'refunded'], 
    default: 'pending' 
  },
  paystackData: { 
    type: Object, 
    default: {} 
  },
  platformFee: { 
    type: Number, 
    default: 0 
  },                           // 30% of amount
  instructorEarning: { 
    type: Number, 
    default: 0 
  },                           // 70% of amount
  paidAt: { 
    type: Date 
  },
  metadata: { 
    type: Object, 
    default: {} 
  }
}, { timestamps: true });

// Indexes
PaymentSchema.index({ reference: 1 }, { unique: true });
PaymentSchema.index({ user: 1 });
PaymentSchema.index({ class: 1 });
PaymentSchema.index({ instructor: 1 });
PaymentSchema.index({ status: 1 });
PaymentSchema.index({ paidAt: 1 });

export default mongoose.model("Payment", PaymentSchema);