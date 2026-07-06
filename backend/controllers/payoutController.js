import User from '../models/User.js';
import Payment from '../models/Payment.js';
import Withdrawal from '../models/Withdrawal.js';
import payoutService from '../services/payoutService.js';
import emailService from '../services/emailService.js';

// ===== GENERATE WITHDRAWAL REFERENCE =====
function generateWithdrawalReference() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `WTH-${timestamp}-${random}`;
}

// ===== GET EARNINGS SUMMARY =====
export const getEarnings = async (req, res) => {
  try {
    const instructorId = req.user.id;

    // Get user with earnings
    const user = await User.findById(instructorId);

    // Get recent transactions
    const transactions = await Payment.find({
      instructor: instructorId,
      status: 'success'
    })
      .populate('user', 'firstName lastName email')
      .populate('class', 'title')
      .sort({ paidAt: -1 })
      .limit(50);

    // Get pending withdrawals
    const pendingWithdrawals = await Withdrawal.find({
      instructor: instructorId,
      status: 'pending'
    });

    // Get completed withdrawals
    const completedWithdrawals = await Withdrawal.find({
      instructor: instructorId,
      status: 'completed'
    });

    const totalWithdrawn = completedWithdrawals.reduce(
      (sum, w) => sum + w.amount, 0
    );

    // Calculate available balance
    const availableBalance = user.earnings || 0;

    res.json({
      success: true,
      earnings: {
        available: availableBalance,
        totalRevenue: user.totalRevenue || 0,
        totalSales: user.totalSales || 0,
        totalWithdrawn: totalWithdrawn,
        pendingWithdrawals: pendingWithdrawals.length,
        transactions: transactions
      }
    });

  } catch (error) {
    console.error('Get earnings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get earnings',
      error: error.message
    });
  }
};

// ===== REQUEST WITHDRAWAL =====
export const requestWithdrawal = async (req, res) => {
  try {
    const { amount } = req.body;
    const instructorId = req.user.id;

    // Get user
    const user = await User.findById(instructorId);

    // Validate amount
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount'
      });
    }

    // Check if user has bank details
    if (!user.bankDetails || !user.bankDetails.accountNumber) {
      return res.status(400).json({
        success: false,
        message: 'Please set up your bank details first'
      });
    }

    // Check available balance
    if (amount > user.earnings) {
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Available: ₦${user.earnings}`
      });
    }

    // Generate reference
    const reference = generateWithdrawalReference();

    // Create withdrawal record
    const withdrawal = new Withdrawal({
      instructor: instructorId,
      amount: amount,
      reference: reference,
      bankDetails: {
        bankName: user.bankDetails.bankName,
        accountNumber: user.bankDetails.accountNumber,
        accountName: user.bankDetails.accountName,
        bankCode: user.bankDetails.bankCode
      },
      status: 'pending'
    });

    await withdrawal.save();

    // Send notification to instructor
    try {
      await emailService.sendWithdrawalRequestEmail(
        user.email,
        `${user.firstName} ${user.lastName}`,
        {
          amount: amount,
          reference: reference,
          bankDetails: user.bankDetails
        }
      );
    } catch (emailError) {
      console.error('Failed to send withdrawal email:', emailError);
    }

    res.json({
      success: true,
      message: 'Withdrawal request submitted successfully',
      withdrawal: withdrawal
    });

  } catch (error) {
    console.error('Request withdrawal error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to request withdrawal',
      error: error.message
    });
  }
};

// ===== PROCESS WITHDRAWAL (Admin) =====
export const processWithdrawal = async (req, res) => {
  try {
    const { withdrawalId, action } = req.body; // action: 'approve' or 'reject'
    const adminId = req.user.id;

    const withdrawal = await Withdrawal.findById(withdrawalId)
      .populate('instructor');

    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: 'Withdrawal not found'
      });
    }

    if (withdrawal.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Withdrawal is already ${withdrawal.status}`
      });
    }

    if (action === 'reject') {
      withdrawal.status = 'cancelled';
      withdrawal.failureReason = 'Rejected by admin';
      await withdrawal.save();

      return res.json({
        success: true,
        message: 'Withdrawal rejected',
        withdrawal: withdrawal
      });
    }

    // Approve and process
    if (action === 'approve') {
      // Check if instructor has bank details
      const instructor = await User.findById(withdrawal.instructor._id);
      
      if (!instructor.bankDetails || !instructor.bankDetails.accountNumber) {
        withdrawal.status = 'failed';
        withdrawal.failureReason = 'Instructor bank details not found';
        await withdrawal.save();

        return res.status(400).json({
          success: false,
          message: 'Instructor bank details not found'
        });
      }

      // Create recipient if not exists
      let recipientCode = instructor.bankDetails.recipientCode;

      if (!recipientCode) {
        const recipientResult = await payoutService.createRecipient(
          instructor.bankDetails.accountName || `${instructor.firstName} ${instructor.lastName}`,
          instructor.bankDetails.accountNumber,
          instructor.bankDetails.bankCode
        );

        if (!recipientResult.success) {
          withdrawal.status = 'failed';
          withdrawal.failureReason = recipientResult.error;
          await withdrawal.save();

          return res.status(500).json({
            success: false,
            message: 'Failed to create recipient',
            error: recipientResult.error
          });
        }

        recipientCode = recipientResult.recipientCode;
        
        // Save recipient code to user
        await User.findByIdAndUpdate(instructor._id, {
          'bankDetails.recipientCode': recipientCode
        });
      }

      // Initiate transfer
      const transferResult = await payoutService.initiateTransfer(
        withdrawal.amount,
        recipientCode,
        `FISSK Course Earnings - ${withdrawal.reference}`
      );

      if (!transferResult.success) {
        withdrawal.status = 'failed';
        withdrawal.failureReason = transferResult.error;
        withdrawal.paystackTransferData = { error: transferResult.error };
        await withdrawal.save();

        return res.status(500).json({
          success: false,
          message: 'Failed to initiate transfer',
          error: transferResult.error
        });
      }

      // Update withdrawal
      withdrawal.status = 'processing';
      withdrawal.paystackTransferId = transferResult.transferId;
      withdrawal.paystackTransferData = transferResult.data;
      withdrawal.processedBy = adminId;
      await withdrawal.save();

      // Check if transfer is completed immediately (some transfers are instant)
      if (transferResult.status === 'success') {
        // Finalize withdrawal
        await finalizeWithdrawal(withdrawal._id);
      }

      res.json({
        success: true,
        message: 'Withdrawal processing started',
        withdrawal: withdrawal,
        transferStatus: transferResult.status
      });
    }

  } catch (error) {
    console.error('Process withdrawal error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process withdrawal',
      error: error.message
    });
  }
};

// ===== FINALIZE WITHDRAWAL =====
export const finalizeWithdrawal = async (withdrawalId) => {
  try {
    const withdrawal = await Withdrawal.findById(withdrawalId)
      .populate('instructor');

    if (!withdrawal) {
      throw new Error('Withdrawal not found');
    }

    // Update withdrawal
    withdrawal.status = 'completed';
    withdrawal.completedAt = new Date();
    await withdrawal.save();

    // Deduct from instructor earnings
    await User.findByIdAndUpdate(withdrawal.instructor._id, {
      $inc: { earnings: -withdrawal.amount }
    });

    // Send success email
    try {
      await emailService.sendWithdrawalSuccessEmail(
        withdrawal.instructor.email,
        `${withdrawal.instructor.firstName} ${withdrawal.instructor.lastName}`,
        {
          amount: withdrawal.amount,
          reference: withdrawal.reference,
          bankDetails: withdrawal.bankDetails,
          completedAt: withdrawal.completedAt
        }
      );
    } catch (emailError) {
      console.error('Failed to send withdrawal success email:', emailError);
    }

    return { success: true };

  } catch (error) {
    console.error('Finalize withdrawal error:', error);
    return { success: false, error: error.message };
  }
};

// ===== UPDATE BANK DETAILS =====
export const updateBankDetails = async (req, res) => {
  try {
    const { bankName, accountNumber, accountName, bankCode } = req.body;
    const instructorId = req.user.id;

    // Validate input
    if (!bankName || !accountNumber || !accountName || !bankCode) {
      return res.status(400).json({
        success: false,
        message: 'All bank details are required'
      });
    }

    // Verify account with Paystack
    const validation = await payoutService.validateAccount(accountNumber, bankCode);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid account details',
        error: validation.error
      });
    }

    // Check if account name matches
    if (validation.accountName.toLowerCase() !== accountName.toLowerCase()) {
      return res.status(400).json({
        success: false,
        message: 'Account name does not match the provided name',
        expected: validation.accountName,
        provided: accountName
      });
    }

    // Update user
    await User.findByIdAndUpdate(instructorId, {
      bankDetails: {
        bankName,
        accountNumber,
        accountName,
        bankCode
      },
      bankDetailsVerified: true
    });

    res.json({
      success: true,
      message: 'Bank details updated successfully',
      bankDetails: {
        bankName,
        accountNumber,
        accountName,
        bankCode
      }
    });

  } catch (error) {
    console.error('Update bank details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update bank details',
      error: error.message
    });
  }
};

// ===== GET WITHDRAWAL HISTORY =====
export const getWithdrawalHistory = async (req, res) => {
  try {
    const instructorId = req.user.id;

    const withdrawals = await Withdrawal.find({
      instructor: instructorId
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      withdrawals: withdrawals
    });

  } catch (error) {
    console.error('Get withdrawal history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get withdrawal history',
      error: error.message
    });
  }
};

// ===== GET PENDING WITHDRAWALS (Admin) =====
export const getPendingWithdrawals = async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find({
      status: 'pending'
    })
      .populate('instructor', 'firstName lastName email')
      .sort({ createdAt: 1 });

    res.json({
      success: true,
      withdrawals: withdrawals
    });

  } catch (error) {
    console.error('Get pending withdrawals error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get pending withdrawals',
      error: error.message
    });
  }
};