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

export default router;