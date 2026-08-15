import express from 'express';
import Lesson from '../models/Lesson.js';
import Class from '../models/Class.js';
import Enrollment from '../models/Enrollment.js';
import Stream from '../models/Stream.js';  // Wrapper class
import Quiz from '../models/Quiz.js';
import { auth } from '../middleware/auth.js';

// Get the Mongoose model from the wrapper class
// The wrapper class exports Stream as default, but we need the model
// We can use Stream.getClassVideos() which is a static method

const lessonRouter = express.Router();

// ============================================================
// STUDENT ENDPOINTS
// ============================================================

/**
 * Get all lessons for a class (Student view)
 * GET /api/lessons/class/:classId
 */
lessonRouter.get('/class/:classId', auth, async (req, res) => {
  try {
    const { classId } = req.params;
    const userId = req.user.id;

    console.log('========================================');
    console.log('📊 GET CLASS LESSONS DEBUG');
    console.log('========================================');
    console.log('classId:', classId);
    console.log('userId:', userId);
    console.log('user_type:', req.user.user_type);

    // Check if class exists
    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    console.log('✅ Class found:', classData.title);
    console.log('Class instructorId:', classData.instructorId);

    // ===== FIX: Compare ObjectIds safely =====
    let isInstructor = false;
    try {
      const instructorIdStr = classData.instructorId ? classData.instructorId.toString() : '';
      const userIdStr = userId ? userId.toString() : '';
      isInstructor = instructorIdStr === userIdStr;
      console.log('Is instructor?', isInstructor);
    } catch (err) {
      console.error('Error comparing IDs:', err);
      isInstructor = false;
    }

    // Check if admin (using user_type from token)
    const isAdmin = req.user.user_type === 'admin';
    console.log('Is admin?', isAdmin);

    // Check enrollment
    let enrollment = null;
    try {
      enrollment = await Enrollment.findOne({ userId, classId });
      console.log('Enrollment found:', !!enrollment);
    } catch (err) {
      console.error('Error checking enrollment:', err);
    }

    // If not instructor, not admin, and not enrolled, deny access
    if (!isInstructor && !isAdmin && !enrollment) {
      console.log('❌ Access denied - not instructor, not admin, not enrolled');
      return res.status(403).json({ 
        success: false, 
        message: 'You must be enrolled in this class to view lessons' 
      });
    }

    console.log('✅ User has access to lessons');

    // Build query - instructors and admins see all, students see only published
    const query = { classId };
    if (!isInstructor && !isAdmin) {
      query.isPublished = true;
      console.log('Student view - only showing published lessons');
    } else {
      console.log('Instructor/Admin view - showing all lessons');
    }

    const lessons = await Lesson.find(query)
      .sort({ order: 1 })
      .lean();

    console.log(`Found ${lessons.length} lessons for class ${classId}`);

    // Get user progress
    const lessonProgress = enrollment?.lessonProgress || [];

    const lessonsWithProgress = lessons.map(lesson => {
      const progress = lessonProgress.find(
        lp => lp.lessonId?.toString() === lesson._id.toString()
      );
      
      return {
        ...lesson,
        completed: progress?.completed || false,
        progressPercentage: progress?.progressPercentage || 0,
        completedAt: progress?.completedAt || null,
        isPublished: (isInstructor || isAdmin) ? lesson.isPublished : lesson.isPublished
      };
    });

    console.log('✅ Successfully returned lessons');
    console.log('========================================');

    res.json({
      success: true,
      lessons: lessonsWithProgress,
      totalLessons: lessons.length
    });

  } catch (error) {
    console.error('Get lessons error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Get a single lesson with full content
 * GET /api/lessons/:lessonId
 */
/**
 * Get a single lesson with full content
 * GET /api/lessons/:lessonId
 */
lessonRouter.get('/:lessonId', auth, async (req, res) => {
  try {
    const { lessonId } = req.params;
    const userId = req.user.id;

    console.log('=== GET LESSON ===');
    console.log('Lesson ID:', lessonId);
    console.log('User ID:', userId);

    const lesson = await Lesson.findById(lessonId).lean();

    if (!lesson) {
      return res.status(404).json({ success: false, message: 'Lesson not found' });
    }

    console.log('Lesson found:', lesson.title);

    // Check access
    const classData = await Class.findById(lesson.classId);
    
    let isInstructor = false;
    try {
      const instructorIdStr = classData.instructorId ? classData.instructorId.toString() : '';
      const userIdStr = userId ? userId.toString() : '';
      isInstructor = instructorIdStr === userIdStr;
    } catch (err) {
      isInstructor = false;
    }

    const isAdmin = req.user.user_type === 'admin';
    const enrollment = await Enrollment.findOne({ userId, classId: lesson.classId });

    console.log('Is instructor?', isInstructor);
    console.log('Is admin?', isAdmin);
    console.log('Is enrolled?', !!enrollment);
    console.log('Is free preview?', lesson.isFreePreview);

    // Allow if instructor, admin, enrolled student, or free preview
    if (!isInstructor && !isAdmin && !enrollment && !lesson.isFreePreview) {
      console.log('❌ Access denied');
      return res.status(403).json({ 
        success: false, 
        message: 'You do not have access to this lesson' 
      });
    }

    // If student and lesson is not published, deny access
    if (!isInstructor && !isAdmin && !lesson.isPublished) {
      console.log('❌ Lesson not published');
      return res.status(403).json({ 
        success: false, 
        message: 'This lesson is not published yet' 
      });
    }

    console.log('✅ Access granted');

    // Populate video and quiz details - FIX: Include the actual IDs
    const populatedContentItems = await Promise.all(
      lesson.contentItems.map(async (item) => {
        if (item.type === 'video' && item.contentId) {
          const video = await Stream.getById(item.contentId);
          console.log(video)
          return {
            ...item,
            // Keep the original contentId
            contentId: item.contentId,
            videoId: item.contentId,
            videoDetails: video ? {
              _id: video._id,
              muxPlaybackId: video.muxPlaybackId,
              playbackUrl: video.muxPlaybackId ? `https://stream.mux.com/${video.muxPlaybackId}.m3u8` : null,
              thumbnailUrl: video.muxPlaybackId ? `https://image.mux.com/${video.muxPlaybackId}/thumbnail.jpg?time=5` : null,
              duration: video.duration,
              filename: video.filename,
              title: video.classTitle || video.name
            } : null
          };
        }
        if (item.type === 'quiz' && item.contentId) {
          const quiz = await Quiz.findById(item.contentId)
            .select('_id title description questionCount totalPoints settings status')
            .lean();
          return {
            ...item,
            // KEEP the contentId - this is the quiz ID!
            contentId: item.contentId,
            quizId: item.contentId, // Also set quizId for frontend compatibility
            quizDetails: quiz ? {
              _id: quiz._id,
              title: quiz.title,
              description: quiz.description,
              questionCount: quiz.questionCount,
              totalPoints: quiz.totalPoints,
              status: quiz.status
            } : null
          };
        }
        return item;
      })
    );

    // Get user progress for this lesson
    const progress = enrollment?.lessonProgress?.find(
      lp => lp.lessonId.toString() === lessonId.toString()
    );

    console.log('Populated content items:', JSON.stringify(populatedContentItems, null, 2));

    res.json({
      success: true,
      lesson: {
        ...lesson,
        contentItems: populatedContentItems,
        completed: progress?.completed || false,
        progressPercentage: progress?.progressPercentage || 0,
        completedAt: progress?.completedAt || null
      }
    });

  } catch (error) {
    console.error('Get lesson error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Mark lesson as complete (Student)
 * POST /api/lessons/:lessonId/complete
 */
lessonRouter.post('/:lessonId/complete', auth, async (req, res) => {
  try {
    const { lessonId } = req.params;
    const userId = req.user.id;

    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      return res.status(404).json({ success: false, message: 'Lesson not found' });
    }

    // Check enrollment
    const enrollment = await Enrollment.findOne({ 
      userId, 
      classId: lesson.classId 
    });

    if (!enrollment) {
      return res.status(403).json({ 
        success: false, 
        message: 'You must be enrolled in this class' 
      });
    }

    // Calculate total required items
    const requiredItems = lesson.contentItems.filter(item => item.isRequired !== false);
    const totalRequired = requiredItems.length;

    // Update or create lesson progress
    const existingIndex = enrollment.lessonProgress.findIndex(
      lp => lp.lessonId.toString() === lessonId.toString()
    );

    const progressData = {
      lessonId: lesson._id,
      completed: true,
      completedAt: new Date(),
      contentItemsCompleted: totalRequired,
      totalContentItems: totalRequired,
      progressPercentage: 100,
      lastAccessed: new Date()
    };

    if (existingIndex !== -1) {
      enrollment.lessonProgress[existingIndex] = progressData;
    } else {
      enrollment.lessonProgress.push(progressData);
    }

    // Update lesson stats
    enrollment.completedLessons = enrollment.lessonProgress.filter(lp => lp.completed).length;
    enrollment.totalLessons = enrollment.lessonProgress.length;

    const totalProgress = enrollment.lessonProgress.reduce((sum, lp) => sum + lp.progressPercentage, 0);
    enrollment.lessonProgressPercentage = enrollment.lessonProgress.length > 0
      ? Math.round(totalProgress / enrollment.lessonProgress.length)
      : 0;

    // Also add to progressItems for overall course progress
    const existingProgressItem = enrollment.progressItems.find(
      item => item.itemType === 'lesson' && item.itemId.toString() === lessonId.toString()
    );

    if (existingProgressItem) {
      existingProgressItem.completed = true;
      existingProgressItem.completedAt = new Date();
      existingProgressItem.progressPercentage = 100;
    } else {
      enrollment.progressItems.push({
        itemType: 'lesson',
        itemId: lessonId,
        itemTypeModel: 'Lesson',
        completed: true,
        completedAt: new Date(),
        progressPercentage: 100,
        timeSpentSeconds: 0
      });
    }

    await enrollment.save();

    // Update overall course progress
    await updateOverallProgress(enrollment._id);

    res.json({
      success: true,
      message: 'Lesson marked as complete',
      progress: {
        lessonCompleted: true,
        lessonProgressPercentage: 100,
        overallProgress: enrollment.progress
      }
    });

  } catch (error) {
    console.error('Complete lesson error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================
// INSTRUCTOR ENDPOINTS
// ============================================================

/**
 * Get all lessons for a class (Instructor view - includes drafts)
 * GET /api/lessons/instructor/class/:classId
 */
lessonRouter.get('/instructor/class/:classId', auth, async (req, res) => {
  try {
    const { classId } = req.params;
    const userId = req.user.id;

    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    // ===== FIX: Compare ObjectIds safely =====
    let isInstructor = false;
    try {
      const instructorIdStr = classData.instructorId ? classData.instructorId.toString() : '';
      const userIdStr = userId ? userId.toString() : '';
      isInstructor = instructorIdStr === userIdStr;
    } catch (err) {
      isInstructor = false;
    }

    const isAdmin = req.user.user_type === 'admin';

    if (!isInstructor && !isAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: 'Only the class instructor or admin can access this' 
      });
    }

    const lessons = await Lesson.find({ classId })
      .sort({ order: 1 })
      .lean();

    res.json({
      success: true,
      lessons,
      totalLessons: lessons.length
    });

  } catch (error) {
    console.error('Get instructor lessons error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Get available videos for a class (for lesson builder)
 * GET /api/lessons/available-videos/:classId
 * 
 * FIXED: Using Stream.getClassVideos() which is a static method in the wrapper class
 */
lessonRouter.get('/available-videos/:classId', auth, async (req, res) => {
  try {
    const { classId } = req.params;
    const userId = req.user.id;

    console.log('========================================');
    console.log('🎬 GET AVAILABLE VIDEOS DEBUG');
    console.log('========================================');
    console.log('classId:', classId);
    console.log('userId:', userId);
    console.log('user_type:', req.user.user_type);

    // Check if class exists
    const classData = await Class.findById(classId);
    if (!classData) {
      console.log('❌ Class not found');
      return res.status(404).json({ 
        success: false, 
        message: 'Class not found' 
      });
    }

    console.log('✅ Class found:', classData.title);
    console.log('Class instructorId:', classData.instructorId);

    // ===== FIX: Compare ObjectIds safely =====
    let isInstructor = false;
    try {
      const instructorIdStr = classData.instructorId ? classData.instructorId.toString() : '';
      const userIdStr = userId ? userId.toString() : '';
      isInstructor = instructorIdStr === userIdStr;
      console.log('Is instructor?', isInstructor);
    } catch (err) {
      console.error('Error comparing IDs:', err);
      isInstructor = false;
    }

    const isAdmin = req.user.user_type === 'admin';
    console.log('Is admin?', isAdmin);

    // Check if user is instructor or admin
    if (!isInstructor && !isAdmin) {
      console.log('❌ Access denied - not instructor or admin');
      return res.status(403).json({ 
        success: false, 
        message: 'Only the class instructor can access this' 
      });
    }

    console.log('✅ Access granted');

    // ===== FIX: Use Stream.getClassVideos() which is a static method =====
    // This method returns an array of video objects with the proper structure
    const videos = await Stream.getClassVideos(classId);

    console.log(`Found ${videos.length} videos for class ${classId}`);
    console.log('========================================');

    res.json({
      success: true,
      videos: videos,
      count: videos.length
    });

  } catch (error) {
    console.error('Get available videos error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Get available quizzes for a class (for lesson builder)
 * GET /api/lessons/available-quizzes/:classId
 */
lessonRouter.get('/available-quizzes/:classId', auth, async (req, res) => {
  try {
    const { classId } = req.params;
    const userId = req.user.id;

    console.log('========================================');
    console.log('📝 GET AVAILABLE QUIZZES DEBUG');
    console.log('========================================');
    console.log('classId:', classId);
    console.log('userId:', userId);
    console.log('user_type:', req.user.user_type);

    // Check if class exists
    const classData = await Class.findById(classId);
    if (!classData) {
      console.log('❌ Class not found');
      return res.status(404).json({ 
        success: false, 
        message: 'Class not found' 
      });
    }

    console.log('✅ Class found:', classData.title);
    console.log('Class instructorId:', classData.instructorId);

    // ===== FIX: Compare ObjectIds safely =====
    let isInstructor = false;
    try {
      const instructorIdStr = classData.instructorId ? classData.instructorId.toString() : '';
      const userIdStr = userId ? userId.toString() : '';
      isInstructor = instructorIdStr === userIdStr;
      console.log('Is instructor?', isInstructor);
    } catch (err) {
      console.error('Error comparing IDs:', err);
      isInstructor = false;
    }

    const isAdmin = req.user.user_type === 'admin';
    console.log('Is admin?', isAdmin);

    // Check if user is instructor or admin
    if (!isInstructor && !isAdmin) {
      console.log('❌ Access denied - not instructor or admin');
      return res.status(403).json({ 
        success: false, 
        message: 'Only the class instructor can access this' 
      });
    }

    console.log('✅ Access granted');

    // Get all quizzes for this class (including drafts for instructor)
    const quizzes = await Quiz.find({ classId })
      .select('_id title description questionCount totalPoints status createdAt')
      .sort({ createdAt: -1 })
      .lean();

    console.log(`Found ${quizzes.length} quizzes for class ${classId}`);
    console.log('========================================');

    res.json({
      success: true,
      quizzes: quizzes,
      count: quizzes.length
    });

  } catch (error) {
    console.error('Get available quizzes error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Create a lesson
 * POST /api/lessons
 */
lessonRouter.post('/', auth, async (req, res) => {
  try {
    const { classId, title, description, contentItems, order, isFreePreview, isPublished } = req.body;
    const userId = req.user.id;

    console.log('========================================');
    console.log('📝 CREATE LESSON DEBUG');
    console.log('========================================');
    console.log('classId:', classId);
    console.log('userId:', userId);
    console.log('user_type:', req.user.user_type);
    console.log('title:', title);

    // Check if user is instructor of this class
    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    // ===== FIX: Compare ObjectIds safely =====
    let isInstructor = false;
    try {
      const instructorIdStr = classData.instructorId ? classData.instructorId.toString() : '';
      const userIdStr = userId ? userId.toString() : '';
      isInstructor = instructorIdStr === userIdStr;
    } catch (err) {
      isInstructor = false;
    }

    const isAdmin = req.user.user_type === 'admin';

    if (!isInstructor && !isAdmin) {
      console.log('❌ User is not instructor of this class');
      return res.status(403).json({ 
        success: false, 
        message: 'Only the class instructor can create lessons' 
      });
    }

    console.log('✅ User is instructor/admin');

    // Validate content items
    if (contentItems && contentItems.length > 0) {
      for (const item of contentItems) {
        // For videos, verify the video exists and belongs to this class
        if (item.type === 'video' && item.contentId) {
          const video = await Stream.getById(item.contentId);
          if (!video) {
            return res.status(400).json({
              success: false,
              message: `Video "${item.title}" not found or does not belong to this class`
            });
          }
          // Set duration from video
          item.duration = video.duration || 0;
        }
        // For quizzes, verify the quiz exists and belongs to this class
        if (item.type === 'quiz' && item.contentId) {
          const quiz = await Quiz.findOne({ 
            _id: item.contentId, 
            classId: classId 
          });
          if (!quiz) {
            return res.status(400).json({
              success: false,
              message: `Quiz "${item.title}" not found or does not belong to this class`
            });
          }
        }
      }
    }

    // Calculate estimated time
    let estimatedTime = 0;
    if (contentItems) {
      contentItems.forEach(item => {
        if (item.duration) estimatedTime += item.duration;
        // Text items add 1 minute per 100 words
        if (item.type === 'text' && item.content) {
          const wordCount = item.content.split(/\s+/).length;
          estimatedTime += Math.ceil(wordCount / 100);
        }
      });
    }

    const lesson = new Lesson({
      classId,
      instructorId: userId,
      title,
      description: description || '',
      contentItems: contentItems || [],
      estimatedTime,
      order: order || 0,
      isFreePreview: isFreePreview || false,
      isPublished: isPublished !== undefined ? isPublished : true
    });

    await lesson.save();

    console.log('✅ Lesson created:', lesson._id);
    console.log('========================================');

    res.status(201).json({
      success: true,
      message: 'Lesson created successfully',
      lesson
    });

  } catch (error) {
    console.error('Create lesson error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Update a lesson
 * PUT /api/lessons/:lessonId
 */
lessonRouter.put('/:lessonId', auth, async (req, res) => {
  try {
    const { lessonId } = req.params;
    const updates = req.body;
    const userId = req.user.id;

    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      return res.status(404).json({ success: false, message: 'Lesson not found' });
    }

    // ===== FIX: Compare ObjectIds safely =====
    let isInstructor = false;
    try {
      isInstructor = lesson.instructorId?.toString() === userId?.toString();
    } catch (err) {
      isInstructor = false;
    }

    const isAdmin = req.user.user_type === 'admin';

    if (!isInstructor && !isAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: 'Only the lesson instructor can update this lesson' 
      });
    }

    // Validate content items if being updated
    if (updates.contentItems) {
      for (const item of updates.contentItems) {
        if (item.type === 'video' && item.contentId) {
          const video = await Stream.getById(item.contentId);
          if (!video) {
            return res.status(400).json({
              success: false,
              message: `Video "${item.title}" not found or does not belong to this class`
            });
          }
          item.duration = video.duration || 0;
        }
        if (item.type === 'quiz' && item.contentId) {
          const quiz = await Quiz.findOne({ 
            _id: item.contentId, 
            classId: lesson.classId 
          });
          if (!quiz) {
            return res.status(400).json({
              success: false,
              message: `Quiz "${item.title}" not found or does not belong to this class`
            });
          }
        }
      }

      // Recalculate estimated time
      let estimatedTime = 0;
      updates.contentItems.forEach(item => {
        if (item.duration) estimatedTime += item.duration;
        if (item.type === 'text' && item.content) {
          const wordCount = item.content.split(/\s+/).length;
          estimatedTime += Math.ceil(wordCount / 100);
        }
      });
      updates.estimatedTime = estimatedTime;
    }

    const updatedLesson = await Lesson.findByIdAndUpdate(
      lessonId,
      { ...updates },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Lesson updated successfully',
      lesson: updatedLesson
    });

  } catch (error) {
    console.error('Update lesson error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Delete a lesson
 * DELETE /api/lessons/:lessonId
 */
lessonRouter.delete('/:lessonId', auth, async (req, res) => {
  try {
    const { lessonId } = req.params;
    const userId = req.user.id;

    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      return res.status(404).json({ success: false, message: 'Lesson not found' });
    }

    // ===== FIX: Compare ObjectIds safely =====
    let isInstructor = false;
    try {
      isInstructor = lesson.instructorId?.toString() === userId?.toString();
    } catch (err) {
      isInstructor = false;
    }

    const isAdmin = req.user.user_type === 'admin';

    if (!isInstructor && !isAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: 'Only the lesson instructor can delete this lesson' 
      });
    }

    // Remove lesson progress from enrollments
    await Enrollment.updateMany(
      { classId: lesson.classId },
      { 
        $pull: { 
          progressItems: { itemType: 'lesson', itemId: lessonId },
          lessonProgress: { lessonId: lessonId }
        } 
      }
    );

    await Lesson.findByIdAndDelete(lessonId);

    res.json({
      success: true,
      message: 'Lesson deleted successfully'
    });

  } catch (error) {
    console.error('Delete lesson error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Toggle lesson publish status
 * PATCH /api/lessons/:lessonId/publish
 */
lessonRouter.patch('/:lessonId/publish', auth, async (req, res) => {
  try {
    const { lessonId } = req.params;
    const { isPublished } = req.body;
    const userId = req.user.id;

    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      return res.status(404).json({ success: false, message: 'Lesson not found' });
    }

    // ===== FIX: Compare ObjectIds safely =====
    let isInstructor = false;
    try {
      isInstructor = lesson.instructorId?.toString() === userId?.toString();
    } catch (err) {
      isInstructor = false;
    }

    const isAdmin = req.user.user_type === 'admin';

    if (!isInstructor && !isAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: 'Only the lesson instructor can publish this lesson' 
      });
    }

    lesson.isPublished = isPublished !== undefined ? isPublished : !lesson.isPublished;
    await lesson.save();

    res.json({
      success: true,
      message: `Lesson ${lesson.isPublished ? 'published' : 'unpublished'} successfully`,
      isPublished: lesson.isPublished
    });

  } catch (error) {
    console.error('Toggle publish error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Reorder lessons
 * POST /api/lessons/reorder
 */
lessonRouter.post('/reorder', auth, async (req, res) => {
  try {
    const { classId, lessonOrders } = req.body;
    const userId = req.user.id;

    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    // ===== FIX: Compare ObjectIds safely =====
    let isInstructor = false;
    try {
      const instructorIdStr = classData.instructorId ? classData.instructorId.toString() : '';
      const userIdStr = userId ? userId.toString() : '';
      isInstructor = instructorIdStr === userIdStr;
    } catch (err) {
      isInstructor = false;
    }

    const isAdmin = req.user.user_type === 'admin';

    if (!isInstructor && !isAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: 'Only the class instructor can reorder lessons' 
      });
    }

    // Update each lesson's order
    for (const item of lessonOrders) {
      await Lesson.findByIdAndUpdate(item.id, { order: item.order });
    }

    res.json({
      success: true,
      message: 'Lessons reordered successfully'
    });

  } catch (error) {
    console.error('Reorder lessons error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Get lesson statistics for a class (Instructor only)
 * GET /api/lessons/stats/:classId
 */
lessonRouter.get('/stats/:classId', auth, async (req, res) => {
  try {
    const { classId } = req.params;
    const userId = req.user.id;

    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    // ===== FIX: Compare ObjectIds safely =====
    let isInstructor = false;
    try {
      const instructorIdStr = classData.instructorId ? classData.instructorId.toString() : '';
      const userIdStr = userId ? userId.toString() : '';
      isInstructor = instructorIdStr === userIdStr;
    } catch (err) {
      isInstructor = false;
    }

    const isAdmin = req.user.user_type === 'admin';

    if (!isInstructor && !isAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: 'Only the class instructor can access this' 
      });
    }

    const totalLessons = await Lesson.countDocuments({ classId });
    const publishedLessons = await Lesson.countDocuments({ classId, isPublished: true });
    const draftLessons = totalLessons - publishedLessons;

    // Get total content items
    const lessons = await Lesson.find({ classId }).lean();
    let totalContentItems = 0;
    let totalEstimatedTime = 0;

    lessons.forEach(lesson => {
      totalContentItems += lesson.contentItems?.length || 0;
      totalEstimatedTime += lesson.estimatedTime || 0;
    });

    // Get student completion stats
    const enrollments = await Enrollment.find({ classId });
    let totalStudents = enrollments.length;
    let completedLessonsCount = 0;

    enrollments.forEach(enrollment => {
      completedLessonsCount += enrollment.lessonProgress?.filter(lp => lp.completed).length || 0;
    });

    const avgCompletion = totalStudents > 0 ? Math.round((completedLessonsCount / (totalStudents * totalLessons)) * 100) : 0;

    res.json({
      success: true,
      stats: {
        totalLessons,
        publishedLessons,
        draftLessons,
        totalContentItems,
        totalEstimatedTime,
        totalStudents,
        avgCompletion,
        lessons: lessons.map(l => ({
          _id: l._id,
          title: l.title,
          isPublished: l.isPublished,
          itemCount: l.contentItems?.length || 0,
          estimatedTime: l.estimatedTime || 0
        }))
      }
    });

  } catch (error) {
    console.error('Get lesson stats error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Update overall course progress
 */
async function updateOverallProgress(enrollmentId) {
  const enrollment = await Enrollment.findById(enrollmentId);
  if (!enrollment) return;

  const classData = await Class.findById(enrollment.classId);
  if (!classData) return;

  let totalItems = 0;
  let completedItems = 0;

  // Videos - use Stream.getClassVideos to get videos
  const videos = await Stream.getClassVideos(enrollment.classId);
  totalItems += videos.length;
  const completedVideos = enrollment.progressItems.filter(
    item => item.itemType === 'video' && item.completed
  ).length;
  completedItems += completedVideos;

  // Quizzes
  const quizzes = await Quiz.find({
    classId: enrollment.classId,
    status: 'published'
  });
  totalItems += quizzes.length;
  const completedQuizzes = enrollment.quizProgress.filter(q => q.completedAt).length;
  completedItems += completedQuizzes;

  // Lessons
  const lessons = await Lesson.find({
    classId: enrollment.classId,
    isPublished: true
  });
  totalItems += lessons.length;
  const completedLessons = enrollment.lessonProgress.filter(lp => lp.completed).length;
  completedItems += completedLessons;

  const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  enrollment.progress = Math.min(progress, 100);
  if (progress >= 100) {
    enrollment.completed = true;
    enrollment.completedAt = new Date();
  }

  await enrollment.save();
  return enrollment.progress;
}

export default lessonRouter;