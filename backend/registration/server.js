import express from "express";
import bcrypt from "bcryptjs";
const Regisrouter = express.Router();

import cookieParser from "cookie-parser";
import session from "express-session";

// Import Mongoose models
import User from "../models/User.js";
import Class from "../models/Class.js";
import Enrollment from "../models/Enrollment.js";
import LiveSession from "../models/LiveSession.js";
import Video from "../models/Video.js";
import Assignment from "../models/Assignment.js";

// Configuration
const saltRounds = 10; // For bcrypt hashing

Regisrouter.use(session({
  secret: 'fissk',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // set to true if using HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Middleware: check if user is instructor
function isInstructor(req, res, next) {
  if (!req.session.user || req.session.user.user_type !== 'instructor') {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }
  next();
}

// Registration endpoint for instructors
Regisrouter.post('/instructor-register', async (req, res) => {
  const { firstName, lastName, phone, email, password, bio, qualifications, experience_years } = req.body;
  
  const userData = {
    firstName,
    lastName,
    email,
    phone,
    userType: 'instructor',
    bio,
    qualifications,
    experienceYears: parseInt(experience_years) || 0
  };

  if (!firstName || !email || !password) {
    return res.status(400).json({
      success: false,
      message: 'All fields are required',
      field: !firstName ? 'name' : !email ? 'email' : 'password'
    });
  }

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered',
        field: 'email'
      });
    }

    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    const user = new User({
      ...userData,
      password: hashedPassword
    });
    
    await user.save();

    // Store user in session (excluding password)
    const sessionUser = {
      id: user._id,
      firstname: user.firstName,
      lastname: user.lastName,
      email: user.email,
      user_type: user.userType
    };
    
    req.session.user = sessionUser;

    res.json({ success: true, message: 'User registered successfully' });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Registration endpoint for students
Regisrouter.post('/student-register', async (req, res) => {
  const { firstName, lastName, phone, email, password } = req.body;

  if (!firstName || !email || !password) {
    return res.status(400).json({
      success: false,
      message: 'All fields are required',
      field: !firstName ? 'name' : !email ? 'email' : 'password'
    });
  }

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered',
        field: 'email'
      });
    }

    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    const user = new User({
      firstName,
      lastName,
      phone,
      email,
      password: hashedPassword,
      userType: 'student'
    });
    
    await user.save();

    // Store user in session
    const sessionUser = {
      id: user._id,
      firstname: user.firstName,
      lastname: user.lastName,
      email: user.email,
      user_type: user.userType
    };
    
    req.session.user = sessionUser;

    res.json({ success: true, message: 'User registered successfully' });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Student login
Regisrouter.post('/student-login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email and password are required'
    });
  }

  try {
    const user = await User.findOne({ email, userType: 'student' });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const sessionUser = {
      id: user._id,
      firstname: user.firstName,
      lastname: user.lastName,
      email: user.email,
      user_type: user.userType
    };

    res.json({
      success: true,
      message: 'Login successful',
      sessionUser
    });

    req.session.user = sessionUser;

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Instructor login
Regisrouter.post('/instructor-login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email and password are required'
    });
  }

  try {
    const user = await User.findOne({ email, userType: 'instructor' });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const sessionUser = {
      id: user._id,
      firstname: user.firstName,
      lastname: user.lastName,
      email: user.email,
      user_type: user.userType
    };

    res.json({
      success: true,
      message: 'Login successful',
      sessionUser
    });

    req.session.user = sessionUser;

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get session variables
Regisrouter.get('/session-variables', async (req, res) => {
  const user = req.session.user;
  res.send({ 
    success: true, 
    message: 'session successful',
    userData: user
  });
});

// Logout
Regisrouter.get('/logout', async (req, res) => {
  req.session.destroy();
  res.send("You are logged out");
});

// Get current user
Regisrouter.get('/user', async (req, res) => {
  return res.json({ 
    success: true, 
    message: 'session successful',
    userData: req.session.user
  });
});

// Create a new class
Regisrouter.post('/create-class', async (req, res) => {
  const { email, payload } = req.body;

  try {
    // Find user by email
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials'
      });
    }

    // Check if class already exists
    const existingClass = await Class.findOne({ title: payload.title });
    if (existingClass) {
      return res.status(400).json({ 
        success: false, 
        message: 'Class already created',
        field: 'class name'
      });
    }
    
    const newClass = new Class({
      title: payload.title,
      description: payload.description,
      category: payload.category,
      level: payload.level,
      duration: payload.duration,
      instructorId: user._id
    });
    
    await newClass.save();
    
    res.json({ success: true, message: 'Class created successfully' });
  } catch (error) {
    console.error('Course creation error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Join a class
Regisrouter.post('/join-class', async (req, res) => {
  const { email, classId } = req.body;

  try {
    // Find user by email
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials'
      });
    }
    
    const classData = await Class.findById(classId);
    
    if (!classData) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials'
      });
    }

    // Check if already enrolled
    const existingEnrollment = await Enrollment.findOne({
      userId: user._id,
      classId: classData._id
    });
    
    if (existingEnrollment) {
      return res.status(400).json({ 
        success: false, 
        message: 'Already enrolled in this class' 
      });
    }
    
    // Create enrollment
    const enrollment = new Enrollment({
      userId: user._id,
      classId: classData._id
    });
    
    await enrollment.save();

    res.json({ success: true, message: 'Class registered successfully' });
  } catch (error) {
    console.error('Course enrollment error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get all classes
Regisrouter.get('/classes', async (req, res) => {
  try {
    const classes = await Class.find().sort({ createdAt: -1 });
    res.json({
      success: true,
      classes
    });
  } catch (error) {
    console.error('Get classes error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get classes for homepage (limited to 3)
Regisrouter.get('/classes-on-homepage', async (req, res) => {
  try {
    const classes = await Class.find().sort({ createdAt: -1 }).limit(3);
    res.json({
      success: true,
      classes
    });
  } catch (error) {
    console.error('Get classes error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get user progress in a class
Regisrouter.post('/user-progress', async (req, res) => {
  const { userId, classId } = req.body;
  
  try {
    const enrollment = await Enrollment.findOne({ userId, classId });
    
    res.json({
      success: true,
      progress: enrollment ? [{ progress: enrollment.progress }] : [{ progress: 0 }]
    });
  } catch (error) {
    console.error('Get progress error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get user's enrolled classes
Regisrouter.post('/get-user-classes', async (req, res) => {
  const { email } = req.body;
  
  try {
    // Find user by email
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials'
      });
    }
    
    const enrollments = await Enrollment.find({ userId: user._id })
      .populate('classId')
      .lean();
    
    // Format the response to match the original structure
    const classes = enrollments.map(enrollment => ({
      class_id: enrollment.classId._id,
      progress: enrollment.progress,
      completed: enrollment.completed,
      enrolled_at: enrollment.enrolledAt,
      last_accessed: enrollment.lastAccessed,
      ...enrollment.classId
    }));
    
    res.json({
      success: true,
      classes
    });
  } catch (error) {
    console.error('Get user classes error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get live sessions for student dashboard
Regisrouter.post('/dashboard/live-sessions', async (req, res) => {
  const { id } = req.body;
  
  try {
    // Get user's enrollments
    const enrollments = await Enrollment.find({ userId: id }).populate('classId');
    const classIds = enrollments.map(e => e.classId._id);
    
    // Get upcoming sessions
    const upcoming = await LiveSession.find({
      classId: { $in: classIds },
      sessionType: 'upcoming',
      date: { $gte: new Date() }
    })
      .populate({
        path: 'classId',
        populate: { path: 'instructorId', select: 'firstName lastName' }
      })
      .sort({ date: 1, time: 1 })
      .lean();
    
    // Get recorded sessions
    const recorded = await LiveSession.find({
      classId: { $in: classIds },
      sessionType: 'recorded'
    })
      .populate({
        path: 'classId',
        populate: { path: 'instructorId', select: 'firstName lastName' }
      })
      .sort({ date: -1, time: -1 })
      .lean();
    
    // Format response
    const formattedUpcoming = upcoming.map(session => ({
      class_id: session.classId._id,
      class_title: session.classId.title,
      session_id: session._id,
      session_title: session.title,
      description: session.description,
      date: session.date,
      time: session.time,
      duration: session.duration,
      session_type: session.sessionType,
      instructor: `${session.classId.instructorId.firstName} ${session.classId.instructorId.lastName}`
    }));
    
    const formattedRecorded = recorded.map(session => ({
      class_id: session.classId._id,
      class_title: session.classId.title,
      session_id: session._id,
      session_title: session.title,
      description: session.description,
      date: session.date,
      time: session.time,
      duration: session.duration,
      session_type: session.sessionType,
      instructor: `${session.classId.instructorId.firstName} ${session.classId.instructorId.lastName}`
    }));
    
    return res.json({
      upcoming: formattedUpcoming,
      recorded: formattedRecorded
    });
    
  } catch (error) {
    console.error("Live session error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Get upcoming sessions for a specific class
Regisrouter.post('/class/upcoming', async (req, res) => {
  const { id } = req.body;
  
  try {
    const upcoming = await LiveSession.find({
      classId: id,
      sessionType: 'upcoming'
    }).sort({ date: 1, time: 1 }).lean();
    
    const formattedUpcoming = upcoming.map(session => ({
      session_id: session._id,
      session_title: session.title,
      description: session.description,
      date: session.date,
      time: session.time,
      duration: session.duration,
      session_type: session.sessionType
    }));
    
    return res.json({
      upcoming: formattedUpcoming
    });
    
  } catch (error) {
    console.error("Live session error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Get total learning time for a user
Regisrouter.post('/dashboard/learning-time', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    // Get user ID
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get all enrollments and sum time spent
    const enrollments = await Enrollment.find({ userId: user._id });
    
    let totalSeconds = 0;
    enrollments.forEach(enrollment => {
      enrollment.progressItems.forEach(item => {
        totalSeconds += item.timeSpentSeconds || 0;
      });
    });

    // Convert seconds → hours & minutes
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    
    return res.json({
      total_seconds: totalSeconds,
      readable: `${hours}h ${minutes}m`
    });
    
  } catch (error) {
    console.error("Learning time error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Load dashboard stats
Regisrouter.post('/dashboard/load-stats', async (req, res) => {
  const { id } = req.body;
  
  try {
    // Get notifications (you'll need to create a Notification model)
    // This is a placeholder - implement Notification model as needed
    const notifications = []; // await Notification.find({ userId: id });
    
    const stats = {
      notifications: notifications,
    };
    
    res.json(stats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching stats" });
  }
});

// Check instructor session
Regisrouter.get('/instructor/session', (req, res) => {
  if (!req.session.user || req.session.user.user_type !== "instructor") {
    return res.status(403).json({
      success: false,
      message: "Not logged in as instructor"
    });
  }

  res.json({
    success: true,
    instructor: req.session.user
  });
});

// Get instructor details
Regisrouter.post('/classes/instructor', async (req, res) => {
  const { instructor_id } = req.body;
  
  try {
    const instructor = await User.findOne({ 
      userType: "instructor", 
      _id: instructor_id 
    });
    
    if (!instructor) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials'
      });
    }
    
    res.json({
      success: true,
      instructorData: instructor
    });
  } catch (error) {
    console.error('Get instructor error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get class by ID
Regisrouter.get('/class/:classId', async (req, res) => {
  const classId = req.params.classId;
  
  try {
    const classData = await Class.findById(classId);
    
    res.json({
      success: true,
      classA: classData ? [classData] : []
    });
  } catch (error) {
    console.error('Get class error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get instructor's class details
Regisrouter.post('/instructor/classes/:id', async (req, res) => {
  const classId = req.params.id;
  const { id } = req.body;
  
  try {
    const classData = await Class.findOne({ 
      _id: classId, 
      instructorId: id 
    });
    
    if (!classData) {
      return res.status(404).json({ message: "Class not found" });
    }
    
    // Count enrolled students
    const studentCount = await Enrollment.countDocuments({ classId });
    
    const result = {
      ...classData.toObject(),
      student_count: studentCount
    };
    
    res.json(result);
  } catch (error) {
    console.error('Get instructor class error:', error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Get students in a class
Regisrouter.get('/instructor/classes/:id/students', async (req, res) => {
  try {
    const enrollments = await Enrollment.find({ classId: req.params.id })
      .populate('userId', 'firstName lastName email')
      .lean();
    
    const students = enrollments.map(e => ({
      first_name: e.userId.firstName,
      last_name: e.userId.lastName,
      email: e.userId.email,
      progress: e.progress,
      enrolled_at: e.enrolledAt,
      last_accessed: e.lastAccessed
    }));
    
    res.json(students);
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Get upcoming streams for a class
Regisrouter.get('/instructor/classes/:id/streams', async (req, res) => {
  try {
    const streams = await LiveSession.find({
      classId: req.params.id,
      sessionType: 'upcoming'
    }).sort({ date: 1, time: 1 }).lean();
    
    res.json(streams);
  } catch (error) {
    console.error('Get streams error:', error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Delete video
Regisrouter.delete('/instructor/videos/:id', async (req, res) => {
  const { id } = req.body;
  
  try {
    await LiveSession.deleteOne({ 
      _id: req.params.id, 
      instructorId: id 
    });
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Delete video error:', error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Delete stream (alias for video deletion)
Regisrouter.delete('/instructor/streams/:id', async (req, res) => {
  const { id } = req.body;
  
  try {
    await LiveSession.deleteOne({ 
      _id: req.params.id, 
      instructorId: id 
    });
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Delete stream error:', error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Get videos for a class
Regisrouter.get('/instructor/classes/:id/videos', async (req, res) => {
  try {
    const videos = await LiveSession.find({
      classId: req.params.id,
      sessionType: 'recorded'
    }).sort({ createdAt: 1 }).lean();
    
    res.json(videos);
  } catch (error) {
    console.error('Get videos error:', error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Get all sessions for a class
Regisrouter.get('/instructor/classes/:id/sessions', async (req, res) => {
  try {
    const sessions = await LiveSession.find({
      classId: req.params.id
    }).sort({ date: -1 }).lean();
    
    res.json(sessions);
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Get assignments for a class
Regisrouter.get('/instructor/classes/:id/assignments', async (req, res) => {
  try {
    const assignments = await Assignment.find({
      classId: req.params.id
    }).lean();
    
    res.json(assignments);
  } catch (error) {
    console.error('Get assignments error:', error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Get instructor's classes
Regisrouter.post('/instructor/classes', async (req, res) => {
  const { id } = req.body;
  
  try {
    const classes = await Class.find({ instructorId: id })
      .sort({ createdAt: -1 })
      .lean();
    
    // Get enrollment counts for each class
    const classesWithStats = await Promise.all(
      classes.map(async (cls) => {
        const enrolledStudents = await Enrollment.countDocuments({ classId: cls._id });
        const enrollments = await Enrollment.find({ classId: cls._id });
        const avgProgress = enrollments.length > 0 
          ? enrollments.reduce((sum, e) => sum + e.progress, 0) / enrollments.length 
          : 0;
        
        return {
          ...cls,
          enrolled_students: enrolledStudents,
          avg_progress: avgProgress
        };
      })
    );
    
    res.json({
      success: true,
      classes: classesWithStats
    });
  } catch (error) {
    console.error('Get instructor classes error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get all enrollments for instructor
Regisrouter.post('/instructor/enrollments', async (req, res) => {
  const { instructorId } = req.body;
  
  try {
    // Get all classes by this instructor
    const classes = await Class.find({ instructorId });
    const classIds = classes.map(c => c._id);
    
    // Get enrollments for those classes
    const enrollments = await Enrollment.find({ classId: { $in: classIds } })
      .populate('userId', 'firstName lastName email phone')
      .populate('classId', 'title')
      .lean();
    
    const formattedEnrollments = enrollments.map(e => ({
      first_name: e.userId.firstName,
      last_name: e.userId.lastName,
      email: e.userId.email,
      phone: e.userId.phone,
      progress: e.progress,
      enrolled_at: e.enrolledAt,
      last_accessed: e.lastAccessed,
      title: e.classId.title
    }));
    
    res.json(formattedEnrollments);
  } catch (error) {
    console.error('Get enrollments error:', error);
    res.status(500).json({ message: "Failed to load enrollments" });
  }
});

// Get enrollments for a specific class
Regisrouter.post('/instructor/enrollments/:classId', async (req, res) => {
  const classId = req.params.classId;
  
  try {
    const enrollments = await Enrollment.find({ classId })
      .populate('userId', 'firstName lastName email phone')
      .lean();
    
    const formattedEnrollments = enrollments.map(e => ({
      first_name: e.userId.firstName,
      last_name: e.userId.lastName,
      email: e.userId.email,
      phone: e.userId.phone,
      progress: e.progress,
      enrolled_at: e.enrolledAt,
      last_accessed: e.lastAccessed
    }));
    
    res.json(formattedEnrollments);
  } catch (error) {
    console.error('Get class enrollments error:', error);
    res.status(500).json({ message: "Failed to load enrollments" });
  }
});

// Get instructor stats
Regisrouter.post('/instructor/stats', async (req, res) => {
  const instructorId = req.body.id;
  
  try {
    // Get total classes
    const totalClasses = await Class.countDocuments({ instructorId });
    
    // Get total students
    const classes = await Class.find({ instructorId });
    const classIds = classes.map(c => c._id);
    const totalStudents = await Enrollment.countDocuments({ classId: { $in: classIds } });
    
    // Get total videos
    const totalVideos = await LiveSession.countDocuments({ 
      instructorId, 
      sessionType: 'recorded' 
    });
    
    // Get average rating
    const classesWithRating = await Class.find({ 
      instructorId,
      rating: { $gt: 0 }
    });
    
    const avgRating = classesWithRating.length > 0
      ? classesWithRating.reduce((sum, c) => sum + c.rating, 0) / classesWithRating.length
      : 0;
    
    const stats = {
      totalClasses,
      totalStudents,
      totalVideos,
      avgRating
    };
    
    res.json([stats]); // Wrap in array to match original format
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ message: "Error fetching stats" });
  }
});

// Update user progress
Regisrouter.post('/progress/update', async (req, res) => {
  const { classId, userId, progress } = req.body;
  
  try {
    await Enrollment.findOneAndUpdate(
      { userId, classId },
      { 
        progress,
        lastAccessed: new Date()
      }
    );
    
    res.json({ 
      success: true, 
      message: 'Progress updated successfully' 
    });
  } catch (error) {
    console.error('Progress update error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get instructor's scheduled sessions
Regisrouter.post('/instructor/scheduled-sessions', async (req, res) => {
  const { instructorId } = req.body;
  
  try {
    const streams = await LiveSession.find({
      instructorId,
      sessionType: 'upcoming'
    })
      .populate('classId', 'title')
      .sort({ date: 1, time: 1 })
      .lean();
    
    const formatted = streams.map(s => ({
      id: s._id,
      title: s.title,
      description: s.description,
      scheduled_time: `${s.date} ${s.time}`
    }));
    
    res.json(formatted);
  } catch (error) {
    console.error('Get scheduled sessions error:', error);
    res.status(500).json({ message: "Failed to load scheduled streams" });
  }
});

// Schedule a new stream
Regisrouter.post('/instructor/schedule-stream', async (req, res) => {
  const { payload, id } = req.body;
  
  if (!payload.scheduledTime) {
    return res.status(400).json({ message: "scheduledTime is required" });
  }

  const [date, time] = payload.scheduledTime.split("T");
  
  try {
    const liveSession = new LiveSession({
      instructorId: id,
      title: payload.title,
      description: payload.description,
      date: new Date(date),
      time: time,
      sessionType: 'upcoming',
      classId: payload.classId
    });
    
    await liveSession.save();
    
    res.json({ message: "Live stream scheduled successfully" });
  } catch (error) {
    console.error('Schedule stream error:', error);
    res.status(500).json({ message: "Failed to schedule stream" });
  }
});

// Get instructor's streams (both past and scheduled)
Regisrouter.post('/instructor/streams', async (req, res) => {
  const instructorId = req.body.id;
  
  try {
    // Get past streams (recorded)
    const pastStreamsData = await LiveSession.find({
      instructorId,
      sessionType: 'recorded'
    })
      .populate('classId', 'title')
      .sort({ date: -1, time: -1 })
      .lean();
    
    const pastStreams = pastStreamsData.map(r => ({
      id: r._id,
      title: r.title,
      description: r.description,
      class_title: r.classId?.title || 'Unknown',
      duration: r.duration,
      participants: r.participants,
      recorded_at: `${r.date} ${r.time}`,
      class_id: r.classId?._id
    }));
    
    // Get scheduled streams (upcoming)
    const scheduledStreamsData = await LiveSession.find({
      instructorId,
      sessionType: 'upcoming'
    })
      .populate('classId', 'title')
      .sort({ date: 1, time: 1 })
      .lean();
    
    const scheduledStreams = scheduledStreamsData.map(s => ({
      id: s._id,
      title: s.title,
      description: s.description,
      scheduled_time: `${s.date} ${s.time}`
    }));
    
    res.json({
      past: pastStreams,
      scheduled: scheduledStreams
    });
  } catch (error) {
    console.error('Get streams error:', error);
    res.status(500).json({ message: "Failed to load streams" });
  }
});

// Create assignment
Regisrouter.post('/instructor/create-assignment', async (req, res) => {
  const instructorId = req.body.id;
  const { class_id, title, description, instructions, due_date, max_points } = req.body;

  try {
    // Validate if class belongs to instructor
    const classData = await Class.findOne({ 
      _id: class_id, 
      instructorId 
    });

    if (!classData) {
      return res.status(403).json({ message: "You cannot add assignments to this class" });
    }

    const assignment = new Assignment({
      classId: class_id,
      title,
      description,
      instructions,
      dueDate: due_date,
      maxPoints: max_points
    });
    
    await assignment.save();

    res.json({ message: "Assignment created successfully" });
  } catch (error) {
    console.error('Create assignment error:', error);
    res.status(500).json({ message: "Failed to create assignment" });
  }
});

// Get assignments for a class
Regisrouter.get('/instructor/classes/:classId/assignment', async (req, res) => {
  const instructorId = req.body.id;
  const classId = req.params.classId;

  try {
    // Validate instructor owns this class
    const classData = await Class.findOne({ 
      _id: classId, 
      instructorId 
    });

    if (!classData) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const assignments = await Assignment.find({ classId })
      .sort({ createdAt: -1 })
      .lean();

    res.json(assignments);
  } catch (error) {
    console.error('Get assignments error:', error);
    res.status(500).json({ message: "Could not load assignments" });
  }
});

export default Regisrouter;