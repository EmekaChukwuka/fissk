import express from 'express';
import { auth, isInstructor, isAdmin } from '../middleware/auth.js';
import {
  getEarnings,
  requestWithdrawal,
  processWithdrawal,
  updateBankDetails,
  getWithdrawalHistory,
  getPendingWithdrawals,
  finalizeWithdrawal
} from '../controllers/payoutController.js';

const payoutRouter = express.Router();

// ===== PROTECTED ROUTES (Instructor) =====
// Get earnings summary
payoutRouter.get('/earnings', auth, isInstructor, getEarnings);

// Request withdrawal
payoutRouter.post('/withdraw', auth, isInstructor, requestWithdrawal);

// Update bank details
payoutRouter.post('/bank-details', auth, isInstructor, updateBankDetails);

// Get withdrawal history
payoutRouter.get('/history', auth, isInstructor, getWithdrawalHistory);

// ===== ADMIN ROUTES =====
// Get pending withdrawals
payoutRouter.get('/pending', auth, isAdmin, getPendingWithdrawals);

// Process withdrawal (approve/reject)
payoutRouter.post('/process', auth, isAdmin, processWithdrawal);

// Finalize withdrawal (called after successful transfer)
payoutRouter.post('/finalize', auth, isAdmin, finalizeWithdrawal);

export default payoutRouter;