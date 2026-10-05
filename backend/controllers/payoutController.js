// backend/controllers/payoutController.js
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

        const instructor = await User.findById(instructorId);
        if (!instructor) {
            return res.status(404).json({
                success: false,
                message: 'Instructor not found'
            });
        }

        // Get all successful payments for this instructor
        const payments = await Payment.find({
            instructor: instructorId,
            status: 'success'
        })
            .populate('user', 'firstName lastName email')
            .populate('class', 'title')
            .sort({ paidAt: -1 })
            .limit(50);

        // Include BOTH pending AND processing withdrawals
        const pendingWithdrawals = await Withdrawal.find({
            instructor: instructorId,
            status: { $in: ['pending', 'processing'] }
        }).sort({ createdAt: -1 });

        // Get completed withdrawals
        const completedWithdrawals = await Withdrawal.find({
            instructor: instructorId,
            status: 'completed'
        }).sort({ createdAt: -1 });

        const totalWithdrawn = completedWithdrawals.reduce(
            (sum, w) => sum + (w.amount || 0), 0
        );

        const totalPending = pendingWithdrawals.reduce(
            (sum, w) => sum + (w.amount || 0), 0
        );

        const totalEarnings = instructor.totalRevenue || 0;
        const availableBalance = instructor.earnings || 0;

        res.json({
            success: true,
            earnings: {
                available: availableBalance,
                pending: totalPending,
                totalRevenue: totalEarnings,
                totalSales: instructor.totalSales || 0,
                totalWithdrawn: totalWithdrawn,
                pendingWithdrawals: pendingWithdrawals.length,
                transactions: payments,
                withdrawals: pendingWithdrawals
            },
            bankDetails: instructor.bankDetails || null,
            bankDetailsVerified: instructor.bankDetailsVerified || false
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

// ===== GET BANKS LIST =====
export const getBanks = async (req, res) => {
    try {
        const result = await payoutService.getBanks();

        if (!result.success) {
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch banks',
                error: result.error
            });
        }

        res.json({
            success: true,
            banks: result.banks
        });
    } catch (error) {
        console.error('Get banks error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get banks',
            error: error.message
        });
    }
};

// ===== VALIDATE BANK ACCOUNT =====
export const validateBankAccount = async (req, res) => {
    try {
        const { accountNumber, bankCode } = req.body;

        if (!accountNumber || !bankCode) {
            return res.status(400).json({
                success: false,
                message: 'Account number and bank code are required'
            });
        }

        const result = await payoutService.validateAccount(accountNumber, bankCode);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: result.error || 'Failed to validate account'
            });
        }

        res.json({
            success: true,
            accountName: result.accountName,
            accountNumber,
            bankCode
        });
    } catch (error) {
        console.error('Validate account error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to validate account',
            error: error.message
        });
    }
};

// ===== UPDATE BANK DETAILS =====
export const updateBankDetails = async (req, res) => {
    try {
        const { bankName, accountNumber, bankCode } = req.body;
        const instructorId = req.user.id;

        if (!bankName || !accountNumber || !bankCode) {
            return res.status(400).json({
                success: false,
                message: 'Bank name, account number, and bank code are required'
            });
        }

        if (!/^\d{10}$/.test(accountNumber)) {
            return res.status(400).json({
                success: false,
                message: 'Account number must be 10 digits'
            });
        }

        const validation = await payoutService.validateAccount(accountNumber, bankCode);

        if (!validation.success) {
            return res.status(400).json({
                success: false,
                message: 'Could not verify account. Please check your details.',
                error: validation.error
            });
        }

        // Use Paystack's verified name
        const verifiedAccountName = validation.accountName;

        const instructor = await User.findByIdAndUpdate(
            instructorId,
            {
                bankDetails: {
                    bankName,
                    accountNumber,
                    accountName: verifiedAccountName,
                    bankCode
                },
                bankDetailsVerified: true
            },
            { new: true }
        );

        if (!instructor) {
            return res.status(404).json({
                success: false,
                message: 'Instructor not found'
            });
        }

        res.json({
            success: true,
            message: 'Bank details saved successfully',
            bankDetails: instructor.bankDetails,
            bankDetailsVerified: instructor.bankDetailsVerified,
            verifiedName: verifiedAccountName
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

// ===== REQUEST WITHDRAWAL =====
export const requestWithdrawal = async (req, res) => {
    try {
        const { amount } = req.body;
        const instructorId = req.user.id;

        const numAmount = parseFloat(amount);
        if (!numAmount || numAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a valid amount'
            });
        }

        const instructor = await User.findById(instructorId);
        if (!instructor) {
            return res.status(404).json({
                success: false,
                message: 'Instructor not found'
            });
        }

        if (!instructor.bankDetails || !instructor.bankDetails.accountNumber) {
            return res.status(400).json({
                success: false,
                message: 'Please add your bank details before requesting a withdrawal',
                requiresBankDetails: true
            });
        }

        const availableBalance = instructor.earnings || 0;
        if (numAmount > availableBalance) {
            return res.status(400).json({
                success: false,
                message: `Insufficient balance. Available: ₦${availableBalance.toLocaleString()}`
            });
        }

        const existingPending = await Withdrawal.findOne({
            instructor: instructorId,
            status: { $in: ['pending', 'processing'] }
        });

        if (existingPending) {
            return res.status(400).json({
                success: false,
                message: 'You already have a pending withdrawal request. Please wait for it to be processed.'
            });
        }

        const reference = generateWithdrawalReference();

        const withdrawal = new Withdrawal({
            instructor: instructorId,
            amount: numAmount,
            reference,
            bankDetails: {
                bankName: instructor.bankDetails.bankName,
                accountNumber: instructor.bankDetails.accountNumber,
                accountName: instructor.bankDetails.accountName,
                bankCode: instructor.bankDetails.bankCode
            },
            status: 'pending'
        });

        await withdrawal.save();

        // Deduct from available earnings (hold in escrow)
        await User.findByIdAndUpdate(instructorId, {
            $inc: { earnings: -numAmount }
        });

        // ===== NOTIFY INSTRUCTOR =====
        try {
            if (emailService.sendWithdrawalRequestEmail) {
                await emailService.sendWithdrawalRequestEmail(
                    instructor.email,
                    `${instructor.firstName} ${instructor.lastName}`,
                    {
                        amount: numAmount,
                        reference,
                        bankDetails: instructor.bankDetails
                    }
                );
            }
        } catch (emailError) {
            console.error('Failed to send instructor email:', emailError);
        }

        // ===== NOTIFY ALL ADMINS =====
        try {
            const admins = await User.find({ 
                userType: 'admin'
            }).select('firstName lastName email phone');

            console.log(`📧 Sending withdrawal notification to ${admins.length} admin(s)`);

            if (emailService.sendAdminWithdrawalNotification) {
                await Promise.all(admins.map(admin => 
                    emailService.sendAdminWithdrawalNotification(
                        admin.email,
                        `${admin.firstName} ${admin.lastName}`,
                        {
                            amount: numAmount,
                            reference,
                            requestedAt: withdrawal.createdAt,
                            bankDetails: instructor.bankDetails
                        },
                        {
                            firstName: instructor.firstName,
                            lastName: instructor.lastName,
                            email: instructor.email,
                            phone: instructor.phone,
                            totalRevenue: instructor.totalRevenue,
                            totalSales: instructor.totalSales
                        }
                    ).catch(err => {
                        console.error(`Admin email failed: ${admin.email}`, err.message);
                        return { success: false };
                    })
                ));
            }
        } catch (adminEmailError) {
            console.error('Admin notification error:', adminEmailError);
        }

        res.json({
            success: true,
            message: 'Withdrawal request submitted successfully',
            withdrawal: {
                id: withdrawal._id,
                reference: withdrawal.reference,
                amount: withdrawal.amount,
                status: withdrawal.status,
                bankDetails: withdrawal.bankDetails
            }
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

// ===== GET WITHDRAWAL HISTORY =====
export const getWithdrawalHistory = async (req, res) => {
    try {
        const instructorId = req.user.id;

        const withdrawals = await Withdrawal.find({
            instructor: instructorId
        }).sort({ createdAt: -1 });

        res.json({
            success: true,
            withdrawals
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
// ===== ADMIN: GET PENDING WITHDRAWALS =====
export const getPendingWithdrawals = async (req, res) => {
    try {
        console.log('==============================================');
        console.log('🔍 getPendingWithdrawals called');

        // Test 1: Count ALL withdrawals
        const totalCount = await Withdrawal.countDocuments();
        console.log('📊 Total withdrawals in DB:', totalCount);

        // Test 2: List all statuses
        const allWithdrawals = await Withdrawal.find({}).select('_id status reference amount');
        console.log('📋 All withdrawals:', JSON.stringify(allWithdrawals, null, 2));

        // Test 3: Run the actual query
        const withdrawals = await Withdrawal.find({
            status: { $in: ['pending', 'processing'] }
        })
            .populate('instructor', 'firstName lastName email')
            .sort({ createdAt: 1 });

        console.log('✅ Query returned:', withdrawals.length, 'withdrawals');
        console.log('==============================================');

        res.json({
            success: true,
            withdrawals,
            // Temporary debug info
            _debug: {
                totalInDb: totalCount,
                allStatuses: allWithdrawals.map(w => w.status)
            }
        });

    } catch (error) {
        console.error('❌ Get pending withdrawals error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get pending withdrawals',
            error: error.message
        });
    }
};

// ===== ADMIN: PROCESS WITHDRAWAL =====
export const processWithdrawal = async (req, res) => {
    try {
        const { id } = req.params;
        const { action } = req.body;

        const withdrawal = await Withdrawal.findById(id)
            .populate('instructor', 'firstName lastName email');

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

        // ===== REJECT =====
        if (action === 'reject') {
            withdrawal.status = 'cancelled';
            withdrawal.failureReason = 'Rejected by admin';
            await withdrawal.save();

            // Refund back to instructor
            await User.findByIdAndUpdate(withdrawal.instructor._id, {
                $inc: { earnings: withdrawal.amount }
            });

            return res.json({
                success: true,
                message: 'Withdrawal rejected and funds returned to instructor',
                withdrawal
            });
        }

        // ===== APPROVE =====
        if (action === 'approve') {
            if (!withdrawal.bankDetails || !withdrawal.bankDetails.accountNumber) {
                withdrawal.status = 'failed';
                withdrawal.failureReason = 'Instructor bank details not found';
                await withdrawal.save();

                await User.findByIdAndUpdate(withdrawal.instructor._id, {
                    $inc: { earnings: withdrawal.amount }
                });

                return res.status(400).json({
                    success: false,
                    message: 'Instructor bank details not found'
                });
            }

            withdrawal.status = 'processing';
            withdrawal.processedBy = req.user.id;
            await withdrawal.save();

            res.json({
                success: true,
                message: 'Withdrawal approved. Please transfer the funds manually and mark as completed.',
                withdrawal
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

// ===== ADMIN: MARK WITHDRAWAL AS COMPLETED =====
export const completeWithdrawal = async (req, res) => {
    try {
        const { id } = req.params;
        const { transferReference, note } = req.body;

        const withdrawal = await Withdrawal.findById(id)
            .populate('instructor', 'firstName lastName email');

        if (!withdrawal) {
            return res.status(404).json({
                success: false,
                message: 'Withdrawal not found'
            });
        }

        if (withdrawal.status !== 'processing') {
            return res.status(400).json({
                success: false,
                message: `Withdrawal must be in 'processing' state. Current: ${withdrawal.status}`
            });
        }

        withdrawal.status = 'completed';
        withdrawal.completedAt = new Date();
        if (transferReference) withdrawal.paystackTransferId = transferReference;
        if (note) withdrawal.adminNote = note;
        await withdrawal.save();

        // Send success email
        try {
            if (emailService.sendWithdrawalSuccessEmail) {
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
            }
        } catch (emailError) {
            console.error('Failed to send success email:', emailError);
        }

        res.json({
            success: true,
            message: 'Withdrawal marked as completed',
            withdrawal
        });

    } catch (error) {
        console.error('Complete withdrawal error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to complete withdrawal',
            error: error.message
        });
    }
};