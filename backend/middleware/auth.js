// backend/middleware/auth.js
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Admin from '../models/Admin.js';

// ===== JWT HELPER FUNCTIONS =====

// Generate JWT token for a user
export const generateToken = (user) => {
  const payload = {
    id: user._id || user.id,
    email: user.email,
    userType: user.userType || user.user_type
  };
  
  return jwt.sign(
    payload,
    process.env.JWT_SECRET || 'fissk-secret-key',
    { expiresIn: '7d' }
  );
};

// Generate refresh token (optional, for longer sessions)
export const generateRefreshToken = (user) => {
  const payload = {
    id: user._id || user.id,
    email: user.email
  };
  
  return jwt.sign(
    payload,
    process.env.JWT_REFRESH_SECRET || 'fissk-refresh-secret-key',
    { expiresIn: '30d' }
  );
};

// Verify JWT token
export const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fissk-secret-key');
    return { success: true, data: decoded };
  } catch (error) {
    return { 
      success: false, 
      error: error.message,
      expired: error.name === 'TokenExpiredError'
    };
  }
};

// ===== MIDDLEWARE =====

// Middleware to check if user is authenticated
export const auth = async (req, res, next) => {
  try {
    // Check session first (for backward compatibility)
    if (req.session && req.session.user) {
      req.user = req.session.user;
      return next();
    }
    
    // Check for token in Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required. No token provided.' 
      });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify token
    const result = verifyToken(token);
    
    if (!result.success) {
      if (result.expired) {
        return res.status(401).json({ 
          success: false, 
          message: 'Token expired. Please login again.',
          expired: true
        });
      }
      return res.status(401).json({ 
        success: false, 
        message: `Invalid token: ${result.error}` 
      });
    }
    
    // Get user from database to ensure they still exist
    const user = await User.findById(result.data.id).select('-password');
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not found. Please login again.' 
      });
    }
    
    // Attach user to request
    req.user = {
      id: user._id,
      firstname: user.firstName,
      lastname: user.lastName,
      email: user.email,
      user_type: user.userType
    };
    req.userData = user;
    req.token = token;
    
    next();
    
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Authentication error' 
    });
  }
};

// Optional: Middleware to check if user is authenticated (allows session or token)
export const optionalAuth = async (req, res, next) => {
  try {
    // Check session
    if (req.session && req.session.user) {
      req.user = req.session.user;
      return next();
    }
    
    // Check token
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const result = verifyToken(token);
      
      if (result.success) {
        const user = await User.findById(result.data.id).select('-password');
        if (user) {
          req.user = {
            id: user._id,
            firstname: user.firstName,
            lastname: user.lastName,
            email: user.email,
            user_type: user.userType
          };
          req.userData = user;
          req.token = token;
        }
      }
    }
    
    next();
    
  } catch (error) {
    console.error('Optional auth error:', error);
    next();
  }
};

// Middleware to check if user is instructor
export const isInstructor = async (req, res, next) => {
  try {
    // First ensure user is authenticated
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }
    
   // Check if user is either instructor or admin
if (!['instructor', 'admin'].includes(req.user.user_type)) {
    return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Instructor or Admin only.' 
    });
}

// Get full user details to double-check
const user = await User.findById(req.user.id);
if (!user || !['instructor', 'admin'].includes(user.userType)) {
    return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Instructor or Admin only.' 
    });
}
    
    req.userData = user;
    next();
    
  } catch (error) {
    console.error('Instructor check error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Authorization error' 
    });
  }
};

// ===== ADMIN MIDDLEWARE (FIXED) =====

// Middleware to check if user is admin
export const isAdmin = async (req, res, next) => {
  try {
    // First ensure user is authenticated
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }
    
    // Get full user details
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    // Check if user type is admin
    if (user.userType !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Admin only.' 
      });
    }
    
    // Check if admin record exists and is active
    const admin = await Admin.findOne({ 
      userId: user._id, 
      isActive: true 
    });
    
    if (!admin) {
      return res.status(403).json({ 
        success: false, 
        message: 'Admin account not found or inactive. Please contact support.' 
      });
    }
    
    // Attach admin data to request
    req.admin = admin;
    req.userData = user;
    
    next();
    
  } catch (error) {
    console.error('Admin check error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Authorization error' 
    });
  }
};

// ===== PERMISSION MIDDLEWARE =====

// Check specific admin permission
export const hasPermission = (permission) => {
  return async (req, res, next) => {
    try {
      if (!req.admin) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      const hasPerm = req.admin.permissions && req.admin.permissions[permission];
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

// ===== TOKEN REFRESH ENDPOINT HELPER =====
// This can be used in routes to refresh tokens
export const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token required'
      });
    }
    
    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'fissk-refresh-secret-key');
    
    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }
    
    // Get user
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Generate new tokens
    const newToken = generateToken(user);
    const newRefreshToken = generateRefreshToken(user);
    
    res.json({
      success: true,
      token: newToken,
      refreshToken: newRefreshToken
    });
    
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to refresh token'
    });
  }
};

// ===== LOG ACTIVITY HELPER =====
// This can be used in admin controllers to log actions
export const logAdminActivity = async (req, action, targetType, targetId, details = {}, targetName = null) => {
  try {
    // Import ActivityLog dynamically to avoid circular dependencies
    const ActivityLog = await import('../models/ActivityLog.js').then(m => m.default);
    
    const log = new ActivityLog({
      adminId: req.user.id,
      adminName: `${req.user.firstname || ''} ${req.user.lastname || ''}`.trim() || req.user.email,
      action,
      targetType,
      targetId,
      targetName,
      details,
      ipAddress: req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for'],
      userAgent: req.headers['user-agent']
    });
    await log.save();
    return { success: true };
  } catch (error) {
    console.error('Activity log error:', error);
    return { success: false, error: error.message };
  }
};