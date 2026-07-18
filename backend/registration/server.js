// backend/registration/server.js
import express from "express";
import bcrypt from "bcryptjs";
import cookieParser from "cookie-parser";
import session from "express-session";
import dotenv from "dotenv";
import jwt from 'jsonwebtoken';
import { generateToken } from '../middleware/auth.js';

// Import Mongoose models
import User from "../models/User.js";
import Class from "../models/Class.js";
import Enrollment from "../models/Enrollment.js";
import LiveSession from "../models/LiveSession.js";
import Assignment from "../models/Assignment.js";
import Quiz from "../models/Quiz.js";
import QuizAttempt from "../models/QuizAttempt.js";
import QuizService from "../services/quizService.js";

// Import Email Service
import emailService from "../services/emailService.js";

dotenv.config();

const Regisrouter = express.Router();
const saltRounds = 10;

// Session configuration
Regisrouter.use(session({
  secret: process.env.SESSION_SECRET || 'fissk',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
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

// ============================================================
// REGISTRATION ENDPOINTS
// ============================================================

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

    // ===== SEND WELCOME EMAIL TO INSTRUCTOR =====
    try {
      const fullName = `${firstName} ${lastName}`.trim();
      await emailService.sendInstructorWelcomeEmail(email, fullName);
      console.log(`✅ Welcome email sent to instructor: ${email}`);
    } catch (emailError) {
      console.error('❌ Failed to send instructor welcome email:', emailError.message);
    }

    // Store user in session
    const sessionUser = {
      id: user._id,
      firstname: user.firstName,
      lastname: user.lastName,
      email: user.email,
      user_type: user.userType
    };
    
    req.session.user = sessionUser;

    res.json({ 
      success: true, 
      message: 'Instructor registered successfully. Welcome email sent!',
      sessionUser
    });

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

    // ===== SEND WELCOME EMAIL TO STUDENT =====
    try {
      const fullName = `${firstName} ${lastName}`.trim();
      await emailService.sendStudentWelcomeEmail(email, fullName);
      console.log(`✅ Welcome email sent to student: ${email}`);
    } catch (emailError) {
      console.error('❌ Failed to send student welcome email:', emailError.message);
    }

    // Store user in session
    const sessionUser = {
      id: user._id,
      firstname: user.firstName,
      lastname: user.lastName,
      email: user.email,
      user_type: user.userType
    };
    
    req.session.user = sessionUser;

    res.json({ 
      success: true, 
      message: 'Student registered successfully. Welcome email sent!',
      sessionUser
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ===== UPDATE STUDENT LOGIN =====
Regisrouter.post('/student-login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email and password are required'
    });
  }

  try {
    const user = await User.findOne({ email,  userType: { $in: ['student', 'admin'] }});

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

    // ===== GENERATE JWT TOKEN =====
    const token = generateToken({
      _id: user._id,
      email: user.email,
      userType: user.userType
    });

    req.session.user = sessionUser;

    res.json({
      success: true,
      message: 'Login successful',
      sessionUser,
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ===== UPDATE INSTRUCTOR LOGIN =====
Regisrouter.post('/instructor-login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email and password are required'
    });
  }

  try {
    const user = await User.findOne({ email, userType: { $in: ['instructor', 'admin'] } });

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

    // ===== GENERATE JWT TOKEN =====
    const token = generateToken({
      _id: user._id,
      email: user.email,
      userType: user.userType
    });

    req.session.user = sessionUser;

    res.json({
      success: true,
      message: 'Login successful',
      sessionUser,
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ============================================================
// SESSION MANAGEMENT
// ============================================================

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

// ============================================================
// TEST EMAIL ENDPOINT
// ============================================================

Regisrouter.post('/test-email', async (req, res) => {
  const { email, name, type } = req.body;
  
  try {
    let result;
    if (type === 'instructor') {
      result = await emailService.sendInstructorWelcomeEmail(email, name || 'Instructor');
    } else {
      result = await emailService.sendStudentWelcomeEmail(email, name || 'Student');
    }
    
    if (result.success) {
      res.json({ success: true, message: 'Test email sent successfully' });
    } else {
      res.status(500).json({ success: false, message: result.error });
    }
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({ success: false, message: 'Failed to send test email' });
  }
});

// ============================================================
// CLASS MANAGEMENT (WITH PAYMENT)
// ============================================================

// Create a new class (with payment fields)
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

    // ===== NEW: Validate price =====
    let price = parseFloat(payload.price) || 0;
    let isFree = payload.isFree === true || payload.isFree === 'true' || price === 0;

    // If not marked as free, ensure minimum price
    if (!isFree && price < 1000) {
      return res.status(400).json({ 
        success: false, 
        message: 'Minimum price is ₦1,000',
        field: 'price'
      });
    }

    // If price is 0, mark as free
    if (price === 0) {
      isFree = true;
    }

    const newClass = new Class({
      title: payload.title,
      description: payload.description,
      category: payload.category,
      level: payload.level,
      duration: payload.duration,
      instructorId: user._id,
      price: price,
      isFree: isFree,
      currency: payload.currency || 'NGN',
      totalRevenue: 0,
      totalSales: 0,
      enrolledStudents: 0,
      quizCount: 0,
      totalQuizPoints: 0,
      averageQuizScore: 0
    });
    
    await newClass.save();
    
    res.json({ 
      success: true, 
      message: 'Class created successfully',
      class: {
        id: newClass._id,
        title: newClass.title,
        price: newClass.price,
        isFree: newClass.isFree,
        currency: newClass.currency
      }
    });
  } catch (error) {
    console.error('Course creation error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Join a class (with payment check)
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
      return res.status(404).json({ 
        success: false, 
        message: 'Class not found'
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

    // ===== NEW: Check if class requires payment =====
    let paidEnrollment = null;
    if (!classData.isFree && classData.price > 0) {
      paidEnrollment = await Enrollment.findOne({
        userId: user._id,
        classId: classData._id,
        paymentStatus: 'paid'
      });

      if (!paidEnrollment) {
        return res.status(402).json({ 
          success: false, 
          message: 'Payment required to enroll in this class',
          requiresPayment: true,
          price: classData.price,
          currency: classData.currency || 'NGN'
        });
      }
    }
    
    // Determine access type
    const accessType = classData.isFree || classData.price === 0 ? 'free' : 'paid';
    const paymentStatus = classData.isFree || classData.price === 0 ? 'free' : 'paid';
    
    // Create enrollment with quiz progress fields
    const enrollment = new Enrollment({
      userId: user._id,
      classId: classData._id,
      accessType: accessType,
      paymentStatus: paymentStatus,
      paymentReference: paidEnrollment?.paymentReference || null,
      amountPaid: accessType === 'paid' ? classData.price : 0,
      quizProgress: [],
      totalQuizzesTaken: 0,
      averageQuizScore: 0,
      quizzesPassed: 0,
      bestQuizScore: 0
    });
    
    await enrollment.save();

    // Update class enrollment count
    await Class.findByIdAndUpdate(classId, {
      $inc: { enrolledStudents: 1 }
    });

    res.json({ 
      success: true, 
      message: 'Class registered successfully',
      enrollment: {
        id: enrollment._id,
        accessType: enrollment.accessType,
        paymentStatus: enrollment.paymentStatus
      }
    });
  } catch (error) {
    console.error('Course enrollment error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get all classes (with payment info)
Regisrouter.get('/classes', async (req, res) => {
  try {
    const classes = await Class.find()
      .populate('instructorId', 'firstName lastName email')
      .sort({ createdAt: -1 });
    
    // Format classes with payment info
    const formattedClasses = classes.map(cls => ({
      _id: cls._id,
      title: cls.title,
      description: cls.description,
      category: cls.category,
      level: cls.level,
      duration: cls.duration,
      instructor: cls.instructorId ? {
        id: cls.instructorId._id,
        name: `${cls.instructorId.firstName} ${cls.instructorId.lastName}`,
        email: cls.instructorId.email
      } : null,
      price: cls.price || 0,
      isFree: cls.isFree !== undefined ? cls.isFree : true,
      currency: cls.currency || 'NGN',
      totalRevenue: cls.totalRevenue || 0,
      totalSales: cls.totalSales || 0,
      enrolledStudents: cls.enrolledStudents || 0,
      rating: cls.rating || 0,
      totalRatings: cls.totalRatings || 0,
      quizCount: cls.quizCount || 0,
      createdAt: cls.createdAt,
      thumbnailUrl: cls.thumbnailUrl
    }));
    
    res.json({
      success: true,
      classes: formattedClasses
    });
  } catch (error) {
    console.error('Get classes error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get classes for homepage (limited to 3)
Regisrouter.get('/classes-on-homepage', async (req, res) => {
  try {
    const classes = await Class.find()
      .populate('instructorId', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(3);
    
    const formattedClasses = classes.map(cls => ({
      _id: cls._id,
      title: cls.title,
      description: cls.description,
      category: cls.category,
      level: cls.level,
      instructor: cls.instructorId ? {
        name: `${cls.instructorId.firstName} ${cls.instructorId.lastName}`
      } : null,
      price: cls.price || 0,
      isFree: cls.isFree !== undefined ? cls.isFree : true,
      currency: cls.currency || 'NGN',
      enrolledStudents: cls.enrolledStudents || 0
    }));
    
    res.json({
      success: true,
      classes: formattedClasses
    });
  } catch (error) {
    console.error('Get classes error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get class by ID (with payment info)
Regisrouter.get('/class/:classId', async (req, res) => {
  const classId = req.params.classId;
  
  try {
    const classData = await Class.findById(classId)
      .populate('instructorId', 'firstName lastName email bio qualifications experienceYears');
    
    if (!classData) {
      return res.status(404).json({ 
        success: false, 
        message: 'Class not found' 
      });
    }
    
    // Format with payment info
    const formattedClass = {
      _id: classData._id,
      title: classData.title,
      description: classData.description,
      shortDescription: classData.shortDescription,
      category: classData.category,
      level: classData.level,
      duration: classData.duration,
      instructor: classData.instructorId ? {
        id: classData.instructorId._id,
        name: `${classData.instructorId.firstName} ${classData.instructorId.lastName}`,
        email: classData.instructorId.email,
        bio: classData.instructorId.bio,
        qualifications: classData.instructorId.qualifications,
        experienceYears: classData.instructorId.experienceYears
      } : null,
      price: classData.price || 0,
      isFree: classData.isFree !== undefined ? classData.isFree : true,
      currency: classData.currency || 'NGN',
      totalRevenue: classData.totalRevenue || 0,
      totalSales: classData.totalSales || 0,
      enrolledStudents: classData.enrolledStudents || 0,
      rating: classData.rating || 0,
      totalRatings: classData.totalRatings || 0,
      requirements: classData.requirements,
      learningOutcomes: classData.learningOutcomes,
      syllabus: classData.syllabus,
      thumbnailUrl: classData.thumbnailUrl,
      isActive: classData.isActive,
      maxStudents: classData.maxStudents,
      quizCount: classData.quizCount || 0,
      createdAt: classData.createdAt,
      updatedAt: classData.updatedAt
    };
    
    res.json({
      success: true,
      class: formattedClass
    });
  } catch (error) {
    console.error('Get class error:', error);
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
    
    // Format the response
    const classes = enrollments.map(enrollment => ({
      class_id: enrollment.classId._id,
      progress: enrollment.progress,
      completed: enrollment.completed,
      enrolled_at: enrollment.enrolledAt,
      last_accessed: enrollment.lastAccessed,
      paymentStatus: enrollment.paymentStatus,
      accessType: enrollment.accessType,
      quizProgress: enrollment.quizProgress || [],
      totalQuizzesTaken: enrollment.totalQuizzesTaken || 0,
      averageQuizScore: enrollment.averageQuizScore || 0,
      quizzesPassed: enrollment.quizzesPassed || 0,
      bestQuizScore: enrollment.bestQuizScore || 0,
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

// ============================================================
// QUIZ ENDPOINTS
// ============================================================

// Get quizzes for a class (Student)
Regisrouter.get('/quizzes/class/:classId', async (req, res) => {
  try {
    const { classId } = req.params;
    const userId = req.session.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Check enrollment
    const enrollment = await Enrollment.findOne({ userId, classId });
    if (!enrollment) {
      return res.status(403).json({ 
        success: false, 
        message: 'You must be enrolled in this class to view quizzes' 
      });
    }

    const quizzes = await Quiz.find({ classId, status: 'published' })
      .sort({ createdAt: -1 })
      .lean();

    // Get user's attempts for each quiz
    const quizzesWithStatus = await Promise.all(quizzes.map(async (quiz) => {
      const attempts = await QuizAttempt.find({ quizId: quiz._id, userId })
        .sort({ attemptNumber: -1 })
        .lean();

      const completedAttempts = attempts.filter(a => a.status === 'completed' || a.status === 'graded');
      const inProgressAttempt = attempts.find(a => a.status === 'in-progress');

      return {
        ...quiz,
        userAttempts: completedAttempts.length,
        userScore: completedAttempts.length > 0 ? completedAttempts[0].score : null,
        userPassed: completedAttempts.length > 0 ? completedAttempts[0].passed : false,
        canAttempt: inProgressAttempt ? true : completedAttempts.length < (quiz.settings?.maxAttempts || 1),
        inProgress: !!inProgressAttempt,
        attemptId: inProgressAttempt?._id || null,
        totalPoints: quiz.totalPoints || 0
      };
    }));

    res.json({
      success: true,
      quizzes: quizzesWithStatus
    });

  } catch (error) {
    console.error('Get class quizzes error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get single quiz details (Student)
Regisrouter.get('/quizzes/:quizId', async (req, res) => {
  try {
    const { quizId } = req.params;
    const userId = req.session.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const quiz = await Quiz.findById(quizId).lean();
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    // Check enrollment
    const enrollment = await Enrollment.findOne({ userId, classId: quiz.classId });
    if (!enrollment) {
      return res.status(403).json({ 
        success: false, 
        message: 'You must be enrolled in this class to view this quiz' 
      });
    }

    // Get user's attempts
    const attempts = await QuizAttempt.find({ quizId, userId })
      .sort({ attemptNumber: -1 })
      .lean();

    const completedAttempts = attempts.filter(a => a.status === 'completed' || a.status === 'graded');
    const inProgressAttempt = attempts.find(a => a.status === 'in-progress');

    res.json({
      success: true,
      quiz: {
        ...quiz,
        userAttempts: completedAttempts.length,
        userScore: completedAttempts.length > 0 ? completedAttempts[0].score : null,
        userPassed: completedAttempts.length > 0 ? completedAttempts[0].passed : false,
        canAttempt: inProgressAttempt ? true : completedAttempts.length < (quiz.settings?.maxAttempts || 1),
        inProgress: !!inProgressAttempt,
        attemptId: inProgressAttempt?._id || null,
        totalPoints: quiz.totalPoints || 0
      }
    });

  } catch (error) {
    console.error('Get quiz error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Start quiz attempt (Student)
Regisrouter.post('/quizzes/:quizId/start', async (req, res) => {
  try {
    const { quizId } = req.params;
    const userId = req.session.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Validate attempt
    const quiz = await QuizService.validateAttempt(quizId, userId);

    // Check enrollment
    const enrollment = await Enrollment.findOne({ userId, classId: quiz.classId });
    if (!enrollment) {
      return res.status(403).json({ 
        success: false, 
        message: 'You must be enrolled in this class to take the quiz' 
      });
    }

    // Check for existing in-progress attempt
    const existingAttempt = await QuizAttempt.findOne({
      quizId,
      userId,
      status: 'in-progress'
    });

    if (existingAttempt) {
      return res.json({
        success: true,
        attempt: existingAttempt,
        message: 'Resuming existing attempt'
      });
    }

    // Get attempt number
    const attemptsCount = await QuizAttempt.countDocuments({ quizId, userId });
    const attemptNumber = attemptsCount + 1;

    // Create new attempt
    const attempt = new QuizAttempt({
      quizId,
      userId,
      classId: quiz.classId,
      attemptNumber,
      answers: quiz.questions.map((_, index) => ({
        questionIndex: index,
        answer: null
      })),
      status: 'in-progress',
      startedAt: new Date()
    });

    await attempt.save();

    res.status(201).json({
      success: true,
      attempt,
      message: 'Quiz started successfully'
    });

  } catch (error) {
    console.error('Start attempt error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// Save answer (Student)
Regisrouter.put('/quizzes/:quizId/answer', async (req, res) => {
  try {
    const { quizId } = req.params;
    const { questionIndex, answer } = req.body;
    const userId = req.session.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const attempt = await QuizAttempt.findOne({
      quizId,
      userId,
      status: 'in-progress'
    });

    if (!attempt) {
      return res.status(404).json({ 
        success: false, 
        message: 'No active attempt found' 
      });
    }

    const answerIndex = attempt.answers.findIndex(a => a.questionIndex === questionIndex);
    if (answerIndex === -1) {
      return res.status(400).json({ success: false, message: 'Invalid question index' });
    }

    attempt.answers[answerIndex].answer = answer;
    attempt.answers[answerIndex].isCorrect = null;
    attempt.answers[answerIndex].pointsEarned = null;

    await attempt.save();

    res.json({
      success: true,
      message: 'Answer saved successfully'
    });

  } catch (error) {
    console.error('Save answer error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Submit quiz (Student)
Regisrouter.post('/quizzes/:quizId/submit', async (req, res) => {
  try {
    const { quizId } = req.params;
    const userId = req.session.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const attempt = await QuizAttempt.findOne({
      quizId,
      userId,
      status: 'in-progress'
    });

    if (!attempt) {
      return res.status(404).json({ 
        success: false, 
        message: 'No active attempt found' 
      });
    }

    // Calculate time spent
    const timeSpent = Math.floor((Date.now() - new Date(attempt.startedAt).getTime()) / 1000);
    attempt.timeSpent = timeSpent;
    attempt.submittedAt = new Date();

    await attempt.save();

    // Auto-grade the attempt
    const gradedAttempt = await QuizService.autoGradeAttempt(attempt._id);

    // ===== UPDATE CLASS STATS =====
    const quiz = await Quiz.findById(quizId);
    if (quiz) {
      // Update class quiz count
      await Class.findByIdAndUpdate(quiz.classId, {
        $inc: { quizCount: 1 }
      });
      
      // Update class average quiz score
      const allAttempts = await QuizAttempt.find({ 
        classId: quiz.classId,
        status: { $in: ['completed', 'graded'] }
      });
      
      const scores = allAttempts.map(a => a.score || 0);
      const avgScore = scores.length > 0 
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) 
        : 0;
      
      await Class.findByIdAndUpdate(quiz.classId, {
        averageQuizScore: avgScore
      });
    }

    // ===== UPDATE ENROLLMENT QUIZ PROGRESS =====
    const enrollment = await Enrollment.findOne({
      userId: userId,
      classId: attempt.classId
    });

    if (enrollment) {
      // Check if quiz already exists in progress
      const existingIndex = enrollment.quizProgress.findIndex(
        q => q.quizId.toString() === quizId.toString()
      );
      
      const quizData = {
        quizId: quizId,
        attemptId: gradedAttempt._id,
        score: gradedAttempt.score,
        passed: gradedAttempt.passed,
        completedAt: new Date(),
        attemptNumber: enrollment.quizProgress.filter(q => q.quizId.toString() === quizId.toString()).length + 1,
        timeSpent: gradedAttempt.timeSpent || 0
      };
      
      if (existingIndex !== -1) {
        const existing = enrollment.quizProgress[existingIndex];
        if (gradedAttempt.score > existing.score) {
          enrollment.quizProgress[existingIndex] = quizData;
        }
      } else {
        enrollment.quizProgress.push(quizData);
      }
      
      // Update enrollment quiz stats
      const completedQuizzes = enrollment.quizProgress.filter(q => q.completedAt);
      enrollment.totalQuizzesTaken = completedQuizzes.length;
      
      if (completedQuizzes.length > 0) {
        const scores = completedQuizzes.map(q => q.score);
        enrollment.averageQuizScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
        enrollment.bestQuizScore = Math.max(...scores);
        enrollment.quizzesPassed = completedQuizzes.filter(q => q.passed).length;
      }
      
      await enrollment.save();
    }

    // ===== UPDATE USER QUIZ STATS =====
    const user = await User.findById(userId);
    if (user) {
      const allAttempts = await QuizAttempt.find({ 
        userId: userId,
        status: { $in: ['completed', 'graded'] }
      });
      
      if (allAttempts.length > 0) {
        const scores = allAttempts.map(a => a.score || 0);
        const passed = allAttempts.filter(a => a.passed).length;
        
        user.quizStats = {
          totalQuizzesTaken: allAttempts.length,
          averageScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
          bestScore: Math.max(...scores),
          quizzesPassed: passed,
          totalQuizzesCreated: user.quizStats?.totalQuizzesCreated || 0
        };
        
        await user.save();
      }
    }

    res.json({
      success: true,
      message: 'Quiz submitted successfully',
      attempt: gradedAttempt,
      results: await QuizService.getDetailedResults(gradedAttempt._id)
    });

  } catch (error) {
    console.error('Submit attempt error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get attempt results (Student)
Regisrouter.get('/quizzes/attempt/:attemptId', async (req, res) => {
  try {
    const { attemptId } = req.params;
    const userId = req.session.user?.id;

    const attempt = await QuizAttempt.findById(attemptId).lean();
    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Attempt not found' });
    }

    if (attempt.userId.toString() !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: 'You do not have permission to view these results' 
      });
    }

    const results = await QuizService.getDetailedResults(attemptId);

    res.json({
      success: true,
      attempt,
      results
    });

  } catch (error) {
    console.error('Get attempt results error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get user's quiz attempts (Student)
Regisrouter.get('/quizzes/attempts/user', async (req, res) => {
  try {
    const userId = req.session.user?.id;
    const { classId } = req.query;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const query = { userId };
    if (classId) query.classId = classId;

    const attempts = await QuizAttempt.find(query)
      .populate('quizId', 'title description category')
      .sort({ submittedAt: -1 })
      .lean();

    res.json({
      success: true,
      attempts
    });

  } catch (error) {
    console.error('Get user attempts error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================
// LIVE SESSIONS - STUDENT DASHBOARD
// ============================================================

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

// ============================================================
// DASHBOARD STATS
// ============================================================

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

// Load dashboard stats (UPDATED with quiz stats)
Regisrouter.post('/dashboard/load-stats', async (req, res) => {
  const { id } = req.body;
  
  try {
    const notifications = [];
    
    // Get quiz stats
    const quizAttempts = await QuizAttempt.find({ 
      userId: id, 
      status: { $in: ['completed', 'graded'] } 
    });
    
    const quizStats = {
      totalQuizzes: quizAttempts.length,
      averageScore: quizAttempts.length > 0 
        ? Math.round(quizAttempts.reduce((sum, a) => sum + a.score, 0) / quizAttempts.length) 
        : 0,
      passedQuizzes: quizAttempts.filter(a => a.passed).length,
      bestScore: quizAttempts.length > 0 
        ? Math.max(...quizAttempts.map(a => a.score)) 
        : 0
    };
    
    // Get class progress
    const enrollments = await Enrollment.find({ userId: id });
    const totalProgress = enrollments.reduce((sum, e) => sum + e.progress, 0);
    const avgProgress = enrollments.length > 0 ? Math.round(totalProgress / enrollments.length) : 0;
    
    const stats = {
      notifications: notifications,
      quizStats,
      avgProgress,
      enrolledClasses: enrollments.length,
      completedClasses: enrollments.filter(e => e.completed).length
    };
    
    res.json(stats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching stats" });
  }
});

// ============================================================
// INSTRUCTOR MANAGEMENT (WITH PAYMENT)
// ============================================================

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

// Get instructor's classes (with payment stats and quiz count)
Regisrouter.post('/instructor/classes', async (req, res) => {
  const { id } = req.body;
  
  try {
    const classes = await Class.find({ instructorId: id })
      .sort({ createdAt: -1 })
      .lean();
    
    // Get enrollment counts and payment stats for each class
    const classesWithStats = await Promise.all(
      classes.map(async (cls) => {
        const enrolledStudents = await Enrollment.countDocuments({ classId: cls._id });
        const paidEnrollments = await Enrollment.countDocuments({ 
          classId: cls._id,
          paymentStatus: 'paid' 
        });
        const freeEnrollments = await Enrollment.countDocuments({ 
          classId: cls._id,
          paymentStatus: 'free' 
        });
        const enrollments = await Enrollment.find({ classId: cls._id });
        const avgProgress = enrollments.length > 0 
          ? enrollments.reduce((sum, e) => sum + e.progress, 0) / enrollments.length 
          : 0;
        
        // Get quiz count for this class
        const quizCount = await Quiz.countDocuments({ 
          classId: cls._id,
          status: 'published' 
        });
        
        return {
          ...cls,
          enrolled_students: enrolledStudents,
          paid_students: paidEnrollments,
          free_students: freeEnrollments,
          avg_progress: avgProgress,
          price: cls.price || 0,
          isFree: cls.isFree !== undefined ? cls.isFree : true,
          currency: cls.currency || 'NGN',
          totalRevenue: cls.totalRevenue || 0,
          totalSales: cls.totalSales || 0,
          quizCount: quizCount
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

// Get instructor's class details (with payment info)
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
    
    // Count enrolled students with payment status
    const studentCount = await Enrollment.countDocuments({ classId });
    const paidCount = await Enrollment.countDocuments({ 
      classId, 
      paymentStatus: 'paid' 
    });
    const freeCount = await Enrollment.countDocuments({ 
      classId, 
      paymentStatus: 'free' 
    });
    
    // Get quiz count
    const quizCount = await Quiz.countDocuments({ 
      classId, 
      status: 'published' 
    });
    
    const result = {
      ...classData.toObject(),
      student_count: studentCount,
      paid_count: paidCount,
      free_count: freeCount,
      price: classData.price || 0,
      isFree: classData.isFree !== undefined ? classData.isFree : true,
      totalRevenue: classData.totalRevenue || 0,
      totalSales: classData.totalSales || 0,
      quizCount: quizCount
    };
    
    res.json(result);
  } catch (error) {
    console.error('Get instructor class error:', error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Get students in a class (with payment info)
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
      last_accessed: e.lastAccessed,
      paymentStatus: e.paymentStatus,
      accessType: e.accessType,
      amountPaid: e.amountPaid || 0
    }));
    
    res.json(students);
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Get instructor stats (with earnings and quiz stats)
Regisrouter.post('/instructor/stats', async (req, res) => {
  const instructorId = req.body.id;
  
  try {
    const totalClasses = await Class.countDocuments({ instructorId });
    
    const classes = await Class.find({ instructorId });
    const classIds = classes.map(c => c._id);
    const totalStudents = await Enrollment.countDocuments({ classId: { $in: classIds } });
    
    const totalVideos = await LiveSession.countDocuments({ 
      instructorId, 
      sessionType: 'recorded' 
    });
    
    const classesWithRating = await Class.find({ 
      instructorId,
      rating: { $gt: 0 }
    });
    
    const avgRating = classesWithRating.length > 0
      ? classesWithRating.reduce((sum, c) => sum + c.rating, 0) / classesWithRating.length
      : 0;
    
    // Get instructor earnings
    const instructor = await User.findById(instructorId);
    
    // Get total quizzes created
    const totalQuizzes = await Quiz.countDocuments({ instructorId });
    
    const stats = {
      totalClasses,
      totalStudents,
      totalVideos,
      avgRating,
      earnings: instructor?.earnings || 0,
      totalRevenue: instructor?.totalRevenue || 0,
      totalSales: instructor?.totalSales || 0,
      totalQuizzes
    };
    
    res.json([stats]);
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ message: "Error fetching stats" });
  }
});

// Get all enrollments for instructor (with payment info)
Regisrouter.post('/instructor/enrollments', async (req, res) => {
  const { instructorId } = req.body;
  
  try {
    const classes = await Class.find({ instructorId });
    const classIds = classes.map(c => c._id);
    
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
      title: e.classId.title,
      paymentStatus: e.paymentStatus,
      accessType: e.accessType,
      amountPaid: e.amountPaid || 0
    }));
    
    res.json(formattedEnrollments);
  } catch (error) {
    console.error('Get enrollments error:', error);
    res.status(500).json({ message: "Failed to load enrollments" });
  }
});

// Get enrollments for a specific class (with payment info)
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
      last_accessed: e.lastAccessed,
      paymentStatus: e.paymentStatus,
      accessType: e.accessType,
      amountPaid: e.amountPaid || 0
    }));
    
    res.json(formattedEnrollments);
  } catch (error) {
    console.error('Get class enrollments error:', error);
    res.status(500).json({ message: "Failed to load enrollments" });
  }
});

// ============================================================
// UPDATE CLASS (with payment fields)
// ============================================================

Regisrouter.put('/instructor/classes/:id', async (req, res) => {
  const classId = req.params.id;
  const { id, payload } = req.body;
  
  if (!id) {
    return res.status(400).json({ 
      success: false, 
      message: "Instructor ID is required" 
    });
  }

  try {
    // Check if class exists and belongs to instructor
    const classData = await Class.findOne({ 
      _id: classId, 
      instructorId: id 
    });

    if (!classData) {
      return res.status(404).json({ 
        success: false, 
        message: "Class not found or you don't have permission to edit it" 
      });
    }

    // ===== NEW: Validate price if being updated =====
    let updateData = {
      title: payload.title,
      description: payload.description,
      category: payload.category,
      level: payload.level,
      duration: payload.duration,
    };

    // If price is being updated
    if (payload.price !== undefined) {
      let price = parseFloat(payload.price) || 0;
      let isFree = payload.isFree === true || payload.isFree === 'true' || price === 0;

      if (!isFree && price < 1000) {
        return res.status(400).json({ 
          success: false, 
          message: 'Minimum price is ₦1,000',
          field: 'price'
        });
      }

      if (price === 0) {
        isFree = true;
      }

      updateData.price = price;
      updateData.isFree = isFree;
      updateData.currency = payload.currency || 'NGN';
    }

    // Update the class
    const updatedClass = await Class.findByIdAndUpdate(
      classId,
      updateData,
      { new: true, runValidators: true }
    );

    res.json({ 
      success: true, 
      message: "Class updated successfully",
      class: updatedClass 
    });
  } catch (error) {
    console.error('Update class error:', error);
    res.status(500).json({ 
      success: false, 
      message: "Internal server error",
      error: error.message 
    });
  }
});

// ===== DELETE CLASS =====
Regisrouter.delete('/instructor/classes/:id', async (req, res) => {
  const classId = req.params.id;
  const { id } = req.body;
  
  if (!id) {
    return res.status(400).json({ 
      success: false, 
      message: "Instructor ID is required" 
    });
  }

  try {
    const classData = await Class.findOne({ 
      _id: classId, 
      instructorId: id 
    });

    if (!classData) {
      return res.status(404).json({ 
        success: false, 
        message: "Class not found or you don't have permission to delete it" 
      });
    }

    // Delete associated data
    await Enrollment.deleteMany({ classId: classId });
    await LiveSession.deleteMany({ classId: classId });
    await Quiz.deleteMany({ classId: classId });
    await QuizAttempt.deleteMany({ classId: classId });
    await Class.deleteOne({ _id: classId });
    
    res.json({ 
      success: true, 
      message: "Class and all associated data deleted successfully" 
    });
  } catch (error) {
    console.error('Delete class error:', error);
    res.status(500).json({ 
      success: false, 
      message: "Internal server error",
      error: error.message 
    });
  }
});

// ============================================================
// LIVE STREAMS - INSTRUCTOR
// ============================================================

// Get instructor's streams
Regisrouter.post('/instructor/streams', async (req, res) => {
  const instructorId = req.body.id;
  
  try {
    const pastStreamsData = await LiveSession.find({
      instructorId,
      $or: [
        { streamStatus: 'ended' },
        { sessionType: 'recorded' }
      ]
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
      recorded_at: `${r.date || ''} ${r.time || ''}`,
      class_id: r.classId?._id,
      recorded_at_full: r.createdAt
    }));
    
    const scheduledStreamsData = await LiveSession.find({
      instructorId,
      $or: [
        { streamStatus: 'scheduled' },
        { sessionType: 'upcoming' }
      ]
    })
      .populate('classId', 'title')
      .sort({ date: 1, time: 1 })
      .lean();
    
    const scheduledStreams = scheduledStreamsData.map(s => ({
      id: s._id,
      title: s.title,
      description: s.description,
      scheduled_time: `${s.date || ''} ${s.time || ''}`,
      meetingId: s.meetingId || null,
      joinUrl: s.joinUrl || null,
      classId: s.classId?._id || null,
      participants: s.participants || 0
    }));
    
    const liveStreamsData = await LiveSession.find({
      instructorId,
      $or: [
        { streamStatus: 'live' },
        { sessionType: 'live' }
      ],
      hostConnected: true
    })
      .populate('classId', 'title')
      .lean();
    
    const liveStreams = liveStreamsData.map(s => ({
      id: s._id,
      title: s.title,
      description: s.description,
      meetingId: s.meetingId || null,
      joinUrl: s.joinUrl || null,
      classId: s.classId?._id || null,
      participants: s.participants || 0
    }));
    
    res.json({
      past: pastStreams,
      scheduled: scheduledStreams,
      live: liveStreams
    });
    
  } catch (error) {
    console.error('Get streams error:', error);
    res.status(500).json({ message: "Failed to load streams" });
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
  
  console.log('Schedule stream payload:', payload);
  
  if (!payload) {
    return res.status(400).json({ success: false, message: "Payload is required" });
  }
  
  if (!payload.scheduledTime) {
    return res.status(400).json({ success: false, message: "scheduledTime is required" });
  }
  
  if (!payload.classId || payload.classId === 'undefined' || payload.classId === '') {
    return res.status(400).json({ success: false, message: "classId is required" });
  }
  
  const mongoose = await import('mongoose');
  if (!mongoose.Types.ObjectId.isValid(payload.classId)) {
    return res.status(400).json({ success: false, message: "Invalid classId format" });
  }

  const scheduledDate = new Date(payload.scheduledTime);
  if (isNaN(scheduledDate.getTime())) {
    return res.status(400).json({ success: false, message: "Invalid date format" });
  }
  
  const date = scheduledDate.toISOString().split('T')[0];
  const time = scheduledDate.toTimeString().split(' ')[0].substring(0, 5);
  
  try {
    const existing = await LiveSession.findOne({
      classId: payload.classId,
      streamStatus: 'scheduled',
      date: new Date(date)
    });
    
    if (existing) {
      return res.status(409).json({ 
        success: false,
        message: "A session is already scheduled for this class at this time" 
      });
    }
    
    const classData = await Class.findOne({ 
      _id: payload.classId, 
      instructorId: id 
    });
    
    if (!classData) {
      return res.status(403).json({ 
        success: false,
        message: "You don't have permission to schedule streams for this class" 
      });
    }
    
    const liveSession = new LiveSession({
      instructorId: id,
      classId: payload.classId,
      title: payload.title,
      description: payload.description || '',
      date: new Date(date),
      time: time,
      sessionType: 'upcoming',
      streamStatus: 'scheduled'
    });
    
    await liveSession.save();
    
    console.log(`✅ Stream scheduled: ${liveSession.meetingId} - ${payload.title}`);
    
    res.json({ 
      success: true,
      message: "Live stream scheduled successfully",
      meetingId: liveSession.meetingId,
      sessionId: liveSession._id
    });
  } catch (error) {
    console.error('Schedule stream error:', error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to schedule stream", 
      error: error.message 
    });
  }
});

// Delete video
Regisrouter.delete('/instructor/videos/:id', async (req, res) => {
  const { id } = req.body;
  
  if (!id) {
    return res.status(400).json({ 
      ok: false, 
      message: "Instructor ID is required" 
    });
  }

  try {
    const videoId = req.params.id;
    if (!videoId || videoId === 'undefined' || videoId === 'null') {
      return res.status(400).json({ 
        ok: false, 
        message: "Invalid video ID" 
      });
    }

    const video = await LiveSession.findOne({ 
      _id: videoId, 
      instructorId: id 
    });

    if (!video) {
      return res.status(404).json({ 
        ok: false, 
        message: "Video not found or you don't have permission to delete it" 
      });
    }

    await LiveSession.deleteOne({ _id: videoId });
    
    res.json({ ok: true, message: "Video deleted successfully" });
  } catch (error) {
    console.error('Delete video error:', error);
    res.status(500).json({ 
      ok: false, 
      message: "Internal server error",
      error: error.message 
    });
  }
});

// Delete stream
Regisrouter.delete('/instructor/streams/:id', async (req, res) => {
  const { id } = req.body;
  
  if (!id) {
    return res.status(400).json({ 
      ok: false, 
      message: "Instructor ID is required" 
    });
  }

  try {
    const streamId = req.params.id;
    if (!streamId || streamId === 'undefined' || streamId === 'null') {
      return res.status(400).json({ 
        ok: false, 
        message: "Invalid stream ID" 
      });
    }

    const stream = await LiveSession.findOne({ 
      _id: streamId, 
      instructorId: id 
    });

    if (!stream) {
      return res.status(404).json({ 
        ok: false, 
        message: "Stream not found or you don't have permission to delete it" 
      });
    }

    await LiveSession.deleteOne({ _id: streamId });
    
    res.json({ ok: true, message: "Stream deleted successfully" });
  } catch (error) {
    console.error('Delete stream error:', error);
    res.status(500).json({ 
      ok: false, 
      message: "Internal server error",
      error: error.message 
    });
  }
});

// ============================================================
// ASSIGNMENTS
// ============================================================

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

// Get assignments for a class (with instructor validation)
Regisrouter.get('/instructor/classes/:classId/assignment', async (req, res) => {
  const instructorId = req.body.id;
  const classId = req.params.classId;

  try {
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

// Create assignment
Regisrouter.post('/instructor/create-assignment', async (req, res) => {
  const instructorId = req.body.id;
  const { class_id, title, description, instructions, due_date, max_points } = req.body;

  try {
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

export default Regisrouter;