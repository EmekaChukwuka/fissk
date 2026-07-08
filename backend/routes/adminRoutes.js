import express from 'express';
import { auth, isAdmin, hasPermission } from '../middleware/auth.js';
import {
  getDashboardStats,
  getUsers,
  getUserDetails,
  updateUserStatus,
  getPendingInstructors,
  approveInstructor,
  getClasses,
  deleteClass,
  getPayments,
  getPendingPayouts,
  processPayout,
  getSettings,
  updateSettings,
  getActivityLogs,
  createAdmin
} from '../controllers/adminController.js';

const adminRouter = express.Router();

// ===== AUTHENTICATION CHECK =====
// Apply auth and isAdmin middleware to all routes
adminRouter.use(auth, isAdmin);

// ===== DASHBOARD =====
adminRouter.get('/stats', hasPermission('viewAnalytics'), getDashboardStats);
adminRouter.get('/activity-logs', hasPermission('viewAnalytics'), getActivityLogs);

// ===== USERS =====
adminRouter.get('/users', hasPermission('manageUsers'), getUsers);
adminRouter.get('/users/:id', hasPermission('manageUsers'), getUserDetails);
adminRouter.put('/users/:id/status', hasPermission('manageUsers'), updateUserStatus);
adminRouter.get('/instructors/pending', hasPermission('manageUsers'), getPendingInstructors);
adminRouter.put('/instructors/:id/approve', hasPermission('manageUsers'), approveInstructor);

// ===== ADMIN CREATION =====
adminRouter.post('/admins', hasPermission('manageUsers'), createAdmin);

// ===== CLASSES =====
adminRouter.get('/classes', hasPermission('manageClasses'), getClasses);
adminRouter.delete('/classes/:id', hasPermission('manageClasses'), deleteClass);

// ===== PAYMENTS & PAYOUTS =====
adminRouter.get('/payments', hasPermission('managePayments'), getPayments);
adminRouter.get('/payouts/pending', hasPermission('managePayouts'), getPendingPayouts);
adminRouter.put('/payouts/:id/process', hasPermission('managePayouts'), processPayout);

// ===== SETTINGS =====
adminRouter.get('/settings', hasPermission('manageSettings'), getSettings);
adminRouter.put('/settings', hasPermission('manageSettings'), updateSettings);

export default adminRouter;