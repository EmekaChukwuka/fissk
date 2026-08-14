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

    const lessonProgress = enrollment?.lessonProgress || [];

    return lessons.map(lesson => {
      const progress = lessonProgress.find(
        lp => lp.lessonId?.toString() === lesson._id.toString()
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
    const lesson = await Lesson.findById(lessonId).lean();

    if (!lesson) {
      throw new Error('Lesson not found');
    }

    const classData = await Class.findById(lesson.classId);
    const isInstructor = classData.instructorId.toString() === userId;
    const enrollment = await Enrollment.findOne({ userId, classId: lesson.classId });

    if (!isInstructor && !enrollment && !lesson.isFreePreview) {
      throw new Error('You do not have access to this lesson');
    }

    // Populate video and quiz details
    const populatedContentItems = await Promise.all(
      lesson.contentItems.map(async (item) => {
        if (item.type === 'video' && item.videoId) {
          const video = await Stream.findById(item.videoId).lean();
          return {
            ...item,
            videoDetails: video ? {
              muxPlaybackId: video.muxPlaybackId,
              playbackUrl: video.muxPlaybackId ? `https://stream.mux.com/${video.muxPlaybackId}.m3u8` : null,
              thumbnailUrl: video.muxPlaybackId ? `https://image.mux.com/${video.muxPlaybackId}/thumbnail.jpg?time=5` : null,
              duration: video.duration,
              filename: video.filename
            } : null
          };
        }
        if (item.type === 'quiz' && item.quizId) {
          const quiz = await Quiz.findById(item.quizId)
            .select('title description questionCount totalPoints settings')
            .lean();
          return {
            ...item,
            quizDetails: quiz
          };
        }
        return item;
      })
    );

    return {
      ...lesson,
      contentItems: populatedContentItems
    };
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

    // Calculate total required items
    const requiredItems = lesson.contentItems.filter(item => item.isRequired);
    const totalRequired = requiredItems.length;

    // Update lesson progress
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

    // Add to progress items for overall progress
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
    await this.updateOverallProgress(enrollment._id);

    return { 
      success: true, 
      message: 'Lesson marked as complete',
      progress: {
        lessonCompleted: true,
        lessonProgressPercentage: 100,
        overallProgress: enrollment.progress
      }
    };
  }

  /**
   * Update overall course progress
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

  /**
   * Create a new lesson
   */
  static async createLesson(data, userId) {
    const { classId, title, description, contentItems, order, isFreePreview, isPublished } = data;

    const classData = await Class.findById(classId);
    if (!classData) {
      throw new Error('Class not found');
    }

    if (classData.instructorId.toString() !== userId) {
      throw new Error('Only the class instructor can create lessons');
    }

    // Validate and enrich content items
    if (contentItems && contentItems.length > 0) {
      for (const item of contentItems) {
        if (item.type === 'video' && item.videoId) {
          const video = await Stream.findOne({ 
            _id: item.videoId, 
            streamClass: classId 
          });
          if (!video) {
            throw new Error(`Video "${item.title}" not found or does not belong to this class`);
          }
          item.duration = video.duration || 0;
        }
        if (item.type === 'quiz' && item.quizId) {
          const quiz = await Quiz.findOne({ 
            _id: item.quizId, 
            classId: classId 
          });
          if (!quiz) {
            throw new Error(`Quiz "${item.title}" not found or does not belong to this class`);
          }
        }
      }
    }

    // Calculate estimated time
    let estimatedTime = 0;
    if (contentItems) {
      contentItems.forEach(item => {
        if (item.duration) estimatedTime += item.duration;
        if (item.type === 'text' && item.content) {
          const wordCount = item.content.split(/\s+/).length;
          estimatedTime += Math.ceil(wordCount / 100) * 2;
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
      for (const item of updates.contentItems) {
        if (item.type === 'video' && item.videoId) {
          const video = await Stream.findOne({ 
            _id: item.videoId, 
            streamClass: lesson.classId 
          });
          if (!video) {
            throw new Error(`Video "${item.title}" not found or does not belong to this class`);
          }
          item.duration = video.duration || 0;
        }
        if (item.type === 'quiz' && item.quizId) {
          const quiz = await Quiz.findOne({ 
            _id: item.quizId, 
            classId: lesson.classId 
          });
          if (!quiz) {
            throw new Error(`Quiz "${item.title}" not found or does not belong to this class`);
          }
        }
      }

      let estimatedTime = 0;
      updates.contentItems.forEach(item => {
        if (item.duration) estimatedTime += item.duration;
        if (item.type === 'text' && item.content) {
          const wordCount = item.content.split(/\s+/).length;
          estimatedTime += Math.ceil(wordCount / 100) * 2;
        }
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
      { 
        $pull: { 
          progressItems: { itemType: 'lesson', itemId: lessonId },
          lessonProgress: { lessonId: lessonId }
        } 
      }
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
   * Get available videos for a class
   */
  static async getAvailableVideos(classId, userId) {
    const classData = await Class.findById(classId);
    if (!classData || classData.instructorId.toString() !== userId) {
      throw new Error('Only the class instructor can access this');
    }

    const videos = await Stream.find({ streamClass: classId })
      .select('_id name filename classTitle muxPlaybackId muxStatus duration createdAt')
      .sort({ createdAt: -1 })
      .lean();

    return videos.filter(v => v.muxStatus === 'ready' && v.muxPlaybackId);
  }

  /**
   * Get available quizzes for a class
   */
  static async getAvailableQuizzes(classId, userId) {
    const classData = await Class.findById(classId);
    if (!classData || classData.instructorId.toString() !== userId) {
      throw new Error('Only the class instructor can access this');
    }

    const quizzes = await Quiz.find({ 
      classId,
      status: 'published'
    })
      .select('_id title description questionCount totalPoints createdAt')
      .sort({ createdAt: -1 })
      .lean();

    return quizzes;
  }

  /**
   * Get lesson progress for a student
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

    const lessonProgress = enrollment.lessonProgress || [];

    const lessonsWithProgress = lessons.map(lesson => {
      const progress = lessonProgress.find(
        lp => lp.lessonId?.toString() === lesson._id.toString()
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