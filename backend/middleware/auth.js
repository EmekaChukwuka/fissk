import User from '../models/User.js';

// Middleware to check if user is authenticated
export const auth = async (req, res, next) => {
  try {
    // Check session or token
    if (req.session && req.session.user) {
      req.user = req.session.user;
      return next();
    }
    
    // Check for token in header
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      // You can implement JWT verification here if needed
      // For now, we'll use session-based auth
    }
    
    return res.status(401).json({ 
      success: false, 
      message: 'Authentication required' 
    });
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Authentication error' 
    });
  }
};

// Middleware to check if user is instructor
export const isInstructor = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }
    
    if (req.user.user_type !== 'instructor') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Instructor only.' 
      });
    }
    
    // Get full user details
    const user = await User.findById(req.user.id);
    if (!user || user.userType !== 'instructor') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Instructor only.' 
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

// Middleware to check if user is admin
export const isAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }
    
    const user = await User.findById(req.user.id);
    if (!user || user.userType !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Admin only.' 
      });
    }
    
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