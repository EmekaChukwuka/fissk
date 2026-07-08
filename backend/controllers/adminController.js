import User from '../models/User.js';
import Admin from '../models/Admin.js';
import Class from '../models/Class.js';
import Enrollment from '../models/Enrollment.js';
import Payment from '../models/Payment.js';
import Withdrawal from '../models/Withdrawal.js';
import LiveSession from '../models/LiveSession.js';
import ActivityLog from '../models/ActivityLog.js';
import { logAdminActivity } from '../middleware/auth.js';
import mongoose from 'mongoose';

// ============================================================
// DASHBOARD STATS
// ============================================================

export const getDashboardStats = async (req, res) => {
  try {
    const [totalStudents, totalInstructors, totalClasses, totalEnrollments] = await Promise.all([
      User.countDocuments({ userType: 'student' }),
      User.countDocuments({ userType: 'instructor' }),
      Class.countDocuments(),
      Enrollment.countDocuments()
    ]);

    // Get pending instructor approvals
    const pendingInstructors = await User.countDocuments({
      userType: 'instructor',
      isApproved: false
    });

    // Get pending withdrawals
    const pendingWithdrawals = await Withdrawal.countDocuments({
      status: 'pending'
    });

    // Get total revenue (platform fees from successful payments)
    const revenueData = await Payment.aggregate([
      { $match: { status: 'success' } },
      { $group: { _id: null, total: { $sum: '$platformFee' } } }
    ]);
    const totalRevenue = revenueData[0]?.total || 0;

    // Get total instructor earnings (paid out)
    const earningsData = await Payment.aggregate([
      { $match: { status: 'success' } },
      { $group: { _id: null, total: { $sum: '$instructorEarning' } } }
    ]);
    const totalInstructorEarnings = earningsData[0]?.total || 0;

    // Get recent activity
    const recentActivity = await ActivityLog.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    // Get monthly revenue trend (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyRevenue = await Payment.aggregate([
      {
        $match: {
          status: 'success',
          paidAt: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$paidAt' },
            month: { $month: '$paidAt' }
          },
          total: { $sum: '$platformFee' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Get daily active users (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const dailyActive = await Enrollment.aggregate([
      {
        $match: {
          lastAccessed: { $gte: sevenDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$lastAccessed' },
            month: { $month: '$lastAccessed' },
            day: { $dayOfMonth: '$lastAccessed' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    res.json({
      success: true,
      stats: {
        totalStudents,
        totalInstructors,
        pendingInstructors,
        totalClasses,
        totalEnrollments,
        pendingWithdrawals,
        totalRevenue,
        totalInstructorEarnings,
        monthlyRevenue,
        dailyActive,
        recentActivity
      }
    });

  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to get dashboard stats' });
  }
};

// ============================================================
// USERS MANAGEMENT
// ============================================================

export const getUsers = async (req, res) => {
  try {
    const { type, status, search, page = 1, limit = 20 } = req.query;
    
    const query = {};
    if (type && type !== 'all') {
      query.userType = type;
    }
    if (status === 'active') {
      query.isActive = true;
    } else if (status === 'inactive') {
      query.isActive = false;
    }
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [users, total] = await Promise.all([
      User.find(query)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      User.countDocuments(query)
    ]);

    // Get additional info for users
    const usersWithData = await Promise.all(users.map(async (user) => {
      const userData = { ...user };
      
      if (user.userType === 'instructor') {
        const classes = await Class.countDocuments({ instructorId: user._id });
        const earnings = await Payment.aggregate([
          { $match: { instructor: user._id, status: 'success' } },
          { $group: { _id: null, total: { $sum: '$instructorEarning' } } }
        ]);
        userData.classCount = classes;
        userData.totalEarnings = earnings[0]?.total || 0;
        userData.isApproved = user.isApproved || false;
      }
      
      if (user.userType === 'student') {
        const enrollments = await Enrollment.countDocuments({ userId: user._id });
        userData.enrollmentCount = enrollments;
      }
      
      return userData;
    }));

    res.json({
      success: true,
      users: usersWithData,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ success: false, message: 'Failed to get users' });
  }
};

export const getUserDetails = async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findById(id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    let extraData = {};
    
    if (user.userType === 'instructor') {
      const classes = await Class.find({ instructorId: user._id });
      const earnings = await Payment.aggregate([
        { $match: { instructor: user._id, status: 'success' } },
        { $group: { _id: null, total: { $sum: '$instructorEarning' } } }
      ]);
      const studentCount = await Enrollment.countDocuments({ classId: { $in: classes.map(c => c._id) } });
      
      extraData = {
        classes: classes,
        classCount: classes.length,
        studentCount,
        totalEarnings: earnings[0]?.total || 0,
        isApproved: user.isApproved || false
      };
    }
    
    if (user.userType === 'student') {
      const enrollments = await Enrollment.find({ userId: user._id })
        .populate('classId', 'title price')
        .lean();
      
      extraData = {
        enrollments,
        enrollmentCount: enrollments.length
      };
    }

    // Check if user is admin
    const adminRecord = await Admin.findOne({ userId: user._id });
    if (adminRecord) {
      extraData.isAdmin = true;
      extraData.adminRole = adminRecord.role;
    }

    res.json({
      success: true,
      user,
      extraData
    });

  } catch (error) {
    console.error('Get user details error:', error);
    res.status(500).json({ success: false, message: 'Failed to get user details' });
  }
};

export const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive, reason } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Prevent admin from deactivating themselves
    if (user._id.toString() === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot deactivate your own account'
      });
    }

    user.isActive = isActive;
    await user.save();

    // Log activity
    await logAdminActivity(
      req,
      isActive ? 'user_activated' : 'user_suspended',
      'user',
      user._id,
      { reason, userId: user._id, email: user.email },
      `${user.firstName} ${user.lastName}`
    );

    res.json({
      success: true,
      message: `User ${isActive ? 'activated' : 'suspended'} successfully`,
      user
    });

  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({ success: false, message: 'Failed to update user status' });
  }
};

export const getPendingInstructors = async (req, res) => {
  try {
    const instructors = await User.find({
      userType: 'instructor',
      isApproved: false
    }).select('-password');

    res.json({
      success: true,
      instructors
    });

  } catch (error) {
    console.error('Get pending instructors error:', error);
    res.status(500).json({ success: false, message: 'Failed to get pending instructors' });
  }
};

export const approveInstructor = async (req, res) => {
  try {
    const { id } = req.params;
    const { approve } = req.body;

    const user = await User.findById(id);
    if (!user || user.userType !== 'instructor') {
      return res.status(404).json({ success: false, message: 'Instructor not found' });
    }

    user.isApproved = approve;
    if (approve) {
      user.approvedAt = new Date();
      user.approvedBy = req.user.id;
    }
    await user.save();

    // Log activity
    await logAdminActivity(
      req,
      approve ? 'instructor_approved' : 'instructor_rejected',
      'user',
      user._id,
      { instructorId: user._id, email: user.email },
      `${user.firstName} ${user.lastName}`
    );

    res.json({
      success: true,
      message: `Instructor ${approve ? 'approved' : 'rejected'} successfully`,
      user
    });

  } catch (error) {
    console.error('Approve instructor error:', error);
    res.status(500).json({ success: false, message: 'Failed to process instructor' });
  }
};

// ============================================================
// CLASSES MANAGEMENT
// ============================================================

export const getClasses = async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    
    const query = {};
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [classes, total] = await Promise.all([
      Class.find(query)
        .populate('instructorId', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Class.countDocuments(query)
    ]);

    // Get enrollment counts for each class
    const classesWithCounts = await Promise.all(classes.map(async (cls) => {
      const studentCount = await Enrollment.countDocuments({ classId: cls._id });
      const paidCount = await Enrollment.countDocuments({ 
        classId: cls._id, 
        paymentStatus: 'paid' 
      });
      return {
        ...cls,
        studentCount,
        paidCount,
        revenue: cls.totalRevenue || 0
      };
    }));

    res.json({
      success: true,
      classes: classesWithCounts,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Get classes error:', error);
    res.status(500).json({ success: false, message: 'Failed to get classes' });
  }
};

export const deleteClass = async (req, res) => {
  try {
    const { id } = req.params;

    const classData = await Class.findById(id);
    if (!classData) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    // Delete all related data
    await Enrollment.deleteMany({ classId: id });
    await LiveSession.deleteMany({ classId: id });
    await Class.deleteOne({ _id: id });

    // Log activity
    await logAdminActivity(
      req,
      'class_deleted',
      'class',
      classData._id,
      { classId: classData._id, title: classData.title },
      classData.title
    );

    res.json({
      success: true,
      message: 'Class deleted successfully'
    });

  } catch (error) {
    console.error('Delete class error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete class' });
  }
};

// ============================================================
// PAYMENTS & PAYOUTS
// ============================================================

export const getPayments = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    
    const query = {};
    if (status && status !== 'all') {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [payments, total] = await Promise.all([
      Payment.find(query)
        .populate('user', 'firstName lastName email')
        .populate('class', 'title')
        .populate('instructor', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Payment.countDocuments(query)
    ]);

    res.json({
      success: true,
      payments,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({ success: false, message: 'Failed to get payments' });
  }
};

export const getPendingPayouts = async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find({
      status: 'pending'
    })
      .populate('instructor', 'firstName lastName email phone bankDetails')
      .sort({ createdAt: 1 });

    res.json({
      success: true,
      withdrawals
    });

  } catch (error) {
    console.error('Get pending payouts error:', error);
    res.status(500).json({ success: false, message: 'Failed to get pending payouts' });
  }
};

export const processPayout = async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // 'approve' or 'reject'

    const withdrawal = await Withdrawal.findById(id)
      .populate('instructor', 'firstName lastName email');

    if (!withdrawal) {
      return res.status(404).json({ success: false, message: 'Withdrawal not found' });
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

      await logAdminActivity(
        req,
        'payout_rejected',
        'payout',
        withdrawal._id,
        { amount: withdrawal.amount, instructor: withdrawal.instructor.email },
        `Withdrawal ${withdrawal.reference}`
      );

      return res.json({
        success: true,
        message: 'Withdrawal rejected',
        withdrawal
      });
    }

    if (action === 'approve') {
      // Check if instructor has bank details
      if (!withdrawal.bankDetails || !withdrawal.bankDetails.accountNumber) {
        withdrawal.status = 'failed';
        withdrawal.failureReason = 'Instructor bank details not found';
        await withdrawal.save();

        return res.status(400).json({
          success: false,
          message: 'Instructor bank details not found'
        });
      }

      // Mark as processing
      withdrawal.status = 'processing';
      withdrawal.processedBy = req.user.id;
      await withdrawal.save();

      // Log activity
      await logAdminActivity(
        req,
        'payout_approved',
        'payout',
        withdrawal._id,
        { amount: withdrawal.amount, instructor: withdrawal.instructor.email },
        `Withdrawal ${withdrawal.reference}`
      );

      // TODO: Integrate Paystack Transfer API here
      // const transferResult = await payoutService.initiateTransfer(...);

      res.json({
        success: true,
        message: 'Withdrawal approved and processing',
        withdrawal
      });
    }

  } catch (error) {
    console.error('Process payout error:', error);
    res.status(500).json({ success: false, message: 'Failed to process payout' });
  }
};

// ============================================================
// SETTINGS
// ============================================================

export const getSettings = async (req, res) => {
  try {
    const settings = {
      platformName: process.env.PLATFORM_NAME || 'FISSK Online Academy',
      commissionRate: parseFloat(process.env.COMMISSION_RATE) || 30,
      currency: process.env.CURRENCY || 'NGN',
      emailNotifications: {
        welcomeEmail: true,
        paymentReceipt: true,
        classReminders: true
      },
      maintenanceMode: false,
      maxStudentsPerClass: 100,
      minPrice: 1000,
      platformFee: 30 // percentage
    };

    res.json({
      success: true,
      settings
    });

  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ success: false, message: 'Failed to get settings' });
  }
};

export const updateSettings = async (req, res) => {
  try {
    const updates = req.body;
    
    // Validate commission rate
    if (updates.commissionRate !== undefined) {
      const rate = parseFloat(updates.commissionRate);
      if (isNaN(rate) || rate < 0 || rate > 100) {
        return res.status(400).json({
          success: false,
          message: 'Commission rate must be between 0 and 100'
        });
      }
    }

    // Validate min price
    if (updates.minPrice !== undefined) {
      const price = parseFloat(updates.minPrice);
      if (isNaN(price) || price < 0) {
        return res.status(400).json({
          success: false,
          message: 'Minimum price must be a positive number'
        });
      }
    }

    await logAdminActivity(
      req,
      'settings_updated',
      'settings',
      req.user.id,
      { updates },
      'Platform Settings'
    );

    res.json({
      success: true,
      message: 'Settings updated successfully',
      settings: updates
    });

  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ success: false, message: 'Failed to update settings' });
  }
};

// ============================================================
// ACTIVITY LOGS
// ============================================================

export const getActivityLogs = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [logs, total] = await Promise.all([
      ActivityLog.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      ActivityLog.countDocuments()
    ]);

    res.json({
      success: true,
      logs,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Get activity logs error:', error);
    res.status(500).json({ success: false, message: 'Failed to get activity logs' });
  }
};

// ============================================================
// ADMIN USER MANAGEMENT
// ============================================================

export const createAdmin = async (req, res) => {
  try {
    const { email, firstName, lastName, password, role } = req.body;

    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Create user
    const hashedPassword = await bcrypt.hash(password, 10);
    user = new User({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      userType: 'admin',
      isVerified: true,
      isActive: true
    });
    await user.save();

    // Create admin record
    const admin = new Admin({
      userId: user._id,
      role: role || 'moderator',
      isActive: true,
      createdBy: req.user.id
    });
    await admin.save();

    await logAdminActivity(
      req,
      'user_created',
      'user',
      user._id,
      { email, role: role || 'moderator' },
      `${firstName} ${lastName}`
    );

    res.json({
      success: true,
      message: 'Admin user created successfully',
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: admin.role
      }
    });

  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({ success: false, message: 'Failed to create admin' });
  }
};