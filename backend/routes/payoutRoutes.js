// backend/routes/payoutRoutes.js
/*import express from 'express';
import { auth, isInstructor, isAdmin } from '../middleware/auth.js';
import {
    getEarnings,
    getBanks,
    validateBankAccount,
    updateBankDetails,
    requestWithdrawal,
    getWithdrawalHistory,
    getPendingWithdrawals,
    processWithdrawal,
    completeWithdrawal
} from '../controllers/payoutController.js';

const router = express.Router();

// ===== INSTRUCTOR ROUTES =====
router.get('/earnings', auth, isInstructor, getEarnings);
router.get('/banks', auth, isInstructor, getBanks);
router.post('/validate-account', auth, isInstructor, validateBankAccount);
router.post('/bank-details', auth, isInstructor, updateBankDetails);
router.post('/withdraw', auth, isInstructor, requestWithdrawal);
router.get('/history', auth, isInstructor, getWithdrawalHistory);

// ===== ADMIN ROUTES =====
router.get('/pending', auth, isAdmin, getPendingWithdrawals);
router.put('/:id/process', auth, isAdmin, processWithdrawal);
router.put('/:id/complete', auth, isAdmin, completeWithdrawal);

export default router;*/

// backend/routes/payoutRoutes.js
import express from 'express';
import { auth, isInstructor, isAdmin } from '../middleware/auth.js';
import {
    getEarnings,
    getBanks,
    validateBankAccount,
    updateBankDetails,
    requestWithdrawal,
    getWithdrawalHistory,
    getPendingWithdrawals,
    processWithdrawal,
    completeWithdrawal
} from '../controllers/payoutController.js';

const router = express.Router();

// ============================================================
// INSTRUCTOR ROUTES
// ============================================================

// Get instructor earnings + bank details + transactions
router.get('/earnings', auth, isInstructor, getEarnings);

// Get list of Nigerian banks from Paystack
router.get('/banks', auth, isInstructor, getBanks);

// Validate a bank account number with Paystack
router.post('/validate-account', auth, isInstructor, validateBankAccount);

// Save or update instructor bank details
router.post('/bank-details', auth, isInstructor, updateBankDetails);

// Request a withdrawal
router.post('/withdraw', auth, isInstructor, requestWithdrawal);

// Get instructor's own withdrawal history
router.get('/history', auth, isInstructor, getWithdrawalHistory);

// ============================================================
// ADMIN ROUTES
// ============================================================

// Get all pending + processing withdrawals (admin only)
router.get('/pending', auth, isAdmin, getPendingWithdrawals);

// Approve or reject a withdrawal
router.put('/:id/process', auth, isAdmin, processWithdrawal);

// Mark a processing withdrawal as completed
router.put('/:id/complete', auth, isAdmin, completeWithdrawal);

export default router;