import Admin from '../models/Admin.js';
import ActivityLog from '../models/ActivityLog.js';

// Check if user has admin role
export const isAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Check if user is admin from User model
    if (req.user.user_type !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.'
      });
    }

    // Check if admin record exists and is active
    const admin = await Admin.findOne({ userId: req.user.id, isActive: true });
    if (!admin) {
      return res.status(403).json({
        success: false,
        message: 'Admin account not found or inactive'
      });
    }

    req.admin = admin;
    next();
  } catch (error) {
    console.error('Admin check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authorization error'
    });
  }
};

// Check specific permission
export const hasPermission = (permission) => {
  return async (req, res, next) => {
    try {
      if (!req.admin) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      const hasPerm = req.admin.permissions[permission];
      if (!hasPerm) {
        return res.status(403).json({
          success: false,
          message: `Permission denied: ${permission}`
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({
        success: false,
        message: 'Authorization error'
      });
    }
  };
};

// Log admin actions
export const logActivity = async (req, action, targetType, targetId, details = {}, targetName = null) => {
  try {
    const log = new ActivityLog({
      adminId: req.user.id,
      adminName: `${req.user.firstname || ''} ${req.user.lastname || ''}`.trim() || req.user.email,
      action,
      targetType,
      targetId,
      targetName,
      details,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    });
    await log.save();
  } catch (error) {
    console.error('Activity log error:', error);
  }
};