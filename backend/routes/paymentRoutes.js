import express from 'express';
import { auth } from '../middleware/auth.js';
import {
  initializePayment,
  verifyPayment,
  checkPaymentStatus,
  handleWebhook,
  getUserPayments
} from '../controllers/paymentController.js';

const paymentRouter = express.Router();

// ===== PUBLIC ROUTES =====
// Webhook (no auth - called by Paystack)
paymentRouter.post('/webhook', handleWebhook);

// ===== PROTECTED ROUTES =====
// Initialize payment
paymentRouter.post('/initialize', auth, initializePayment);

// Verify payment
paymentRouter.post('/verify', verifyPayment);

// Check payment status for a class
paymentRouter.get('/status/:classId', auth, checkPaymentStatus);

// Get user's payment history
paymentRouter.get('/my-payments', auth, getUserPayments);

export default paymentRouter;