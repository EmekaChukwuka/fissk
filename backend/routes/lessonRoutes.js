import express from 'express';
import Lesson from '../models/Lesson.js';
import Class from '../models/Class.js';
import Enrollment from '../models/Enrollment.js';
import { auth } from '../middleware/auth.js';

const lessonRouter = express.Router();

// ============================================================
// STUDENT ENDPOINTS
// ============================================================

// Get all lessons for a class (Student view)
lessonRouter.get('/class/:classId', auth, async (req, res) => {
  try {
    const { classId } = req.params;
    const userId = req.user.id;

    // Check if user is enrolled or is instructor
    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    const isInstructor = classData.instructorId.toString() === userId;
    const enrollment = await Enrollment.findOne({ userId, classId });

    if (!isInstructor && !enrollment) {
      return res.status(403).json({ 
        success: false, 
        message: 'You must be enrolled in this class to view lessons' 
      });
    }

    // Get lessons
    const lessons = await Lesson.find({ 
      classId, 
      isPublished: true 
    })
      .sort({ order: 1 })
      .lean();

    // For students, filter out free preview flag
    const filteredLessons = isInstructor ? lessons : lessons.map(lesson => ({
      ...lesson,
      isFreePreview: lesson.isFreePreview || false
    }));

    // Get user progress for each lesson
    const progressItems = enrollment?.progressItems || [];
    const lessonsWithProgress = filteredLessons.map(lesson => {
      const progress = progressItems.find(
        item => item.itemType === 'lesson' && item.itemId.toString() === lesson._id.toString()
      );
      return {
        ...lesson,
        completed: progress?.completed || false,
        progressPercentage: progress?.progressPercentage || 0,
        completedAt: progress?.completedAt || null
      };
    });

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

// Get a single lesson
lessonRouter.get('/:lessonId', auth, async (req, res) => {
  try {
    const { lessonId } = req.params;
    const userId = req.user.id;

    const lesson = await Lesson.findById(lessonId)
      .populate('contentItems.quizId', 'title questions')
      .lean();

    if (!lesson) {
      return res.status(404).json({ success: false, message: 'Lesson not found' });
    }

    // Check access
    const classData = await Class.findById(lesson.classId);
    const isInstructor = classData.instructorId.toString() === userId;
    const enrollment = await Enrollment.findOne({ userId, classId: lesson.classId });

    if (!isInstructor && !enrollment && !lesson.isFreePreview) {
      return res.status(403).json({ 
        success: false, 
        message: 'You do not have access to this lesson' 
      });
    }

    res.json({
      success: true,
      lesson
    });

  } catch (error) {
    console.error('Get lesson error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Mark lesson as complete (Student)
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

    // Check if lesson already completed
    const existingProgress = enrollment.progressItems.find(
      item => item.itemType === 'lesson' && item.itemId.toString() === lessonId
    );

    if (existingProgress) {
      existingProgress.completed = true;
      existingProgress.completedAt = new Date();
      existingProgress.progressPercentage = 100;
    } else {
      enrollment.progressItems.push({
        itemType: 'lesson',
        itemId: lessonId,
        itemTypeModel: 'Lesson',
        completed: true,
        completedAt: new Date(),
        progressPercentage: 100
      });
    }

    // Update overall progress
    await updateClassProgress(enrollment._id);

    await enrollment.save();

    res.json({
      success: true,
      message: 'Lesson marked as complete'
    });

  } catch (error) {
    console.error('Complete lesson error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================
// INSTRUCTOR ENDPOINTS
// ============================================================

// Create a lesson
lessonRouter.post('/', auth, async (req, res) => {
  try {
    const { classId, title, description, contentItems, order, isFreePreview } = req.body;
    const userId = req.user.id;

    // Check if user is instructor of this class
    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    if (classData.instructorId.toString() !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: 'Only the class instructor can create lessons' 
      });
    }

    // Calculate estimated time
    let estimatedTime = 0;
    if (contentItems) {
      contentItems.forEach(item => {
        if (item.duration) estimatedTime += item.duration;
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
      isFreePreview: isFreePreview || false
    });

    await lesson.save();

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

// Update a lesson
lessonRouter.put('/:lessonId', auth, async (req, res) => {
  try {
    const { lessonId } = req.params;
    const updates = req.body;
    const userId = req.user.id;

    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      return res.status(404).json({ success: false, message: 'Lesson not found' });
    }

    // Check permission
    if (lesson.instructorId.toString() !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: 'Only the lesson instructor can update this lesson' 
      });
    }

    // Recalculate estimated time
    if (updates.contentItems) {
      let estimatedTime = 0;
      updates.contentItems.forEach(item => {
        if (item.duration) estimatedTime += item.duration;
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

// Delete a lesson
lessonRouter.delete('/:lessonId', auth, async (req, res) => {
  try {
    const { lessonId } = req.params;
    const userId = req.user.id;

    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      return res.status(404).json({ success: false, message: 'Lesson not found' });
    }

    if (lesson.instructorId.toString() !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: 'Only the lesson instructor can delete this lesson' 
      });
    }

    // Remove lesson progress from enrollments
    await Enrollment.updateMany(
      { classId: lesson.classId },
      { $pull: { progressItems: { itemType: 'lesson', itemId: lessonId } } }
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

// Reorder lessons
lessonRouter.post('/reorder', auth, async (req, res) => {
  try {
    const { classId, lessonOrders } = req.body;
    const userId = req.user.id;

    // Check permission
    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    if (classData.instructorId.toString() !== userId) {
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

// Helper function to update class progress
async function updateClassProgress(enrollmentId) {
  const enrollment = await Enrollment.findById(enrollmentId);
  if (!enrollment) return;

  const lessons = await Lesson.find({ 
    classId: enrollment.classId,
    isPublished: true 
  });

  const totalItems = lessons.length;
  const completedItems = enrollment.progressItems.filter(
    item => item.itemType === 'lesson' && item.completed
  ).length;

  const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
  enrollment.progress = Math.min(progress, 100);

  if (progress >= 100) {
    enrollment.completed = true;
    enrollment.completedAt = new Date();
  }

  await enrollment.save();
}

export default lessonRouter;