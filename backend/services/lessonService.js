import Lesson from '../models/Lesson.js';
import Class from '../models/Class.js';
import Enrollment from '../models/Enrollment.js';
import Quiz from '../models/Quiz.js';
import Assignment from '../models/Assignment.js';
import Stream from '../models/Stream.js';

class LessonService {
  /**
   * Get all lessons for a class with student progress
   */
  static async getClassLessons(classId, userId) {
    const classData = await Class.findById(classId);
    if (!classData) {
      throw new Error('Class not found');
    }

    const isInstructor = classData.instructorId.toString() === userId;
    const enrollment = await Enrollment.findOne({ userId, classId });

    if (!isInstructor && !enrollment) {
      throw new Error('You must be enrolled in this class to view lessons');
    }

    const lessons = await Lesson.find({
      classId,
      isPublished: true
    })
      .sort({ order: 1 })
      .lean();

    const progressItems = enrollment?.lessonProgress || [];

    return lessons.map(lesson => {
      const progress = progressItems.find(
        item => item.lessonId?.toString() === lesson._id.toString()
      );
      return {
        ...lesson,
        completed: progress?.completed || false,
        progressPercentage: progress?.progressPercentage || 0,
        completedAt: progress?.completedAt || null,
        isFreePreview: isInstructor ? lesson.isFreePreview : lesson.isFreePreview || false
      };
    });
  }

  /**
   * Get a single lesson with access check
   */
  static async getLesson(lessonId, userId) {
    const lesson = await Lesson.findById(lessonId)
      .populate('contentItems.quizId', 'title questions')
      .lean();

    if (!lesson) {
      throw new Error('Lesson not found');
    }

    const classData = await Class.findById(lesson.classId);
    const isInstructor = classData.instructorId.toString() === userId;
    const enrollment = await Enrollment.findOne({ userId, classId: lesson.classId });

    if (!isInstructor && !enrollment && !lesson.isFreePreview) {
      throw new Error('You do not have access to this lesson');
    }

    return lesson;
  }

  /**
   * Mark lesson as complete
   */
  static async completeLesson(lessonId, userId) {
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      throw new Error('Lesson not found');
    }

    const enrollment = await Enrollment.findOne({
      userId,
      classId: lesson.classId
    });

    if (!enrollment) {
      throw new Error('You must be enrolled in this class');
    }

    // Update lesson progress
    const existingIndex = enrollment.lessonProgress.findIndex(
      l => l.lessonId.toString() === lessonId.toString()
    );

    if (existingIndex !== -1) {
      enrollment.lessonProgress[existingIndex].completed = true;
      enrollment.lessonProgress[existingIndex].completedAt = new Date();
      enrollment.lessonProgress[existingIndex].progressPercentage = 100;
    } else {
      enrollment.lessonProgress.push({
        lessonId,
        completed: true,
        completedAt: new Date(),
        progressPercentage: 100,
        totalContentItems: lesson.contentItems.length,
        contentItemsCompleted: lesson.contentItems.length
      });
    }

    // Update lesson stats
    enrollment.completedLessons = enrollment.lessonProgress.filter(l => l.completed).length;
    enrollment.totalLessons = enrollment.lessonProgress.length;

    const totalProgress = enrollment.lessonProgress.reduce((sum, l) => sum + l.progressPercentage, 0);
    enrollment.lessonProgressPercentage = enrollment.lessonProgress.length > 0
      ? Math.round(totalProgress / enrollment.lessonProgress.length)
      : 0;

    // Add to progress items for overall progress
    const existingProgress = enrollment.progressItems.find(
      item => item.itemType === 'lesson' && item.itemId.toString() === lessonId.toString()
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

    await enrollment.save();
    await this.updateOverallProgress(enrollment._id);

    return { success: true, message: 'Lesson marked as complete' };
  }

  /**
   * Update overall course progress including videos, quizzes, assignments, and lessons
   */
  static async updateOverallProgress(enrollmentId) {
    const enrollment = await Enrollment.findById(enrollmentId);
    if (!enrollment) return;

    const classData = await Class.findById(enrollment.classId);
    if (!classData) return;

    let totalItems = 0;
    let completedItems = 0;

    // Videos
    const streams = await Stream.find({ streamClass: enrollment.classId });
    totalItems += streams.length;
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

    // Assignments
    const assignments = await Assignment.find({ classId: enrollment.classId });
    totalItems += assignments.length;
    const completedAssignments = enrollment.progressItems.filter(
      item => item.itemType === 'assignment' && item.completed
    ).length;
    completedItems += completedAssignments;

    // Lessons
    const lessons = await Lesson.find({
      classId: enrollment.classId,
      isPublished: true
    });
    totalItems += lessons.length;
    const completedLessons = enrollment.lessonProgress.filter(l => l.completed).length;
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

  /**
   * Create a new lesson
   */
  static async createLesson(data, userId) {
    const { classId, title, description, contentItems, order, isFreePreview } = data;

    const classData = await Class.findById(classId);
    if (!classData) {
      throw new Error('Class not found');
    }

    if (classData.instructorId.toString() !== userId) {
      throw new Error('Only the class instructor can create lessons');
    }

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
    return lesson;
  }

  /**
   * Update a lesson
   */
  static async updateLesson(lessonId, updates, userId) {
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      throw new Error('Lesson not found');
    }

    if (lesson.instructorId.toString() !== userId) {
      throw new Error('Only the lesson instructor can update this lesson');
    }

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

    return updatedLesson;
  }

  /**
   * Delete a lesson
   */
  static async deleteLesson(lessonId, userId) {
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      throw new Error('Lesson not found');
    }

    if (lesson.instructorId.toString() !== userId) {
      throw new Error('Only the lesson instructor can delete this lesson');
    }

    // Remove lesson progress from enrollments
    await Enrollment.updateMany(
      { classId: lesson.classId },
      { $pull: { progressItems: { itemType: 'lesson', itemId: lessonId } } }
    );

    await Lesson.findByIdAndDelete(lessonId);
    return { success: true, message: 'Lesson deleted successfully' };
  }

  /**
   * Reorder lessons
   */
  static async reorderLessons(classId, lessonOrders, userId) {
    const classData = await Class.findById(classId);
    if (!classData) {
      throw new Error('Class not found');
    }

    if (classData.instructorId.toString() !== userId) {
      throw new Error('Only the class instructor can reorder lessons');
    }

    for (const item of lessonOrders) {
      await Lesson.findByIdAndUpdate(item.id, { order: item.order });
    }

    return { success: true, message: 'Lessons reordered successfully' };
  }

  /**
   * Get lesson progress summary for a student
   */
  static async getLessonProgress(classId, userId) {
    const enrollment = await Enrollment.findOne({ userId, classId });
    if (!enrollment) {
      return {
        totalLessons: 0,
        completedLessons: 0,
        progressPercentage: 0,
        lessons: []
      };
    }

    const lessons = await Lesson.find({
      classId,
      isPublished: true
    }).sort({ order: 1 }).lean();

    const progressItems = enrollment.lessonProgress || [];

    const lessonsWithProgress = lessons.map(lesson => {
      const progress = progressItems.find(
        item => item.lessonId?.toString() === lesson._id.toString()
      );
      return {
        ...lesson,
        completed: progress?.completed || false,
        progressPercentage: progress?.progressPercentage || 0,
        completedAt: progress?.completedAt || null
      };
    });

    return {
      totalLessons: lessons.length,
      completedLessons: lessonsWithProgress.filter(l => l.completed).length,
      progressPercentage: enrollment.lessonProgressPercentage || 0,
      lessons: lessonsWithProgress
    };
  }
}

export default LessonService;