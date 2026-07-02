import express from 'express';
const forumRouter = express.Router();

// Import Mongoose models
import User from '../models/User.js';
import ForumCategory from '../models/ForumCategory.js';
import ForumPost from '../models/ForumPost.js';
import Class from '../models/Class.js';
import Enrollment from '../models/Enrollment.js';

// Get single topic with details
forumRouter.get('/topics/:id', async (req, res) => {
  const postId = req.params.id;
  
  try {
    // Increment view count
    await ForumPost.findByIdAndUpdate(postId, { $inc: { views: 1 } });
    
    const post = await ForumPost.findById(postId)
      .populate('userId', 'firstName lastName')
      .lean();
    
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }
    
    const formattedPost = {
      ...post,
      author_name: post.userId ? `${post.userId.firstName} ${post.userId.lastName}` : 'Unknown'
    };
    
    res.json(formattedPost);
  } catch (err) {
    console.error('Get topic error:', err);
    res.status(500).json({ message: "Failed to load post" });
  }
});

// Create new topic
forumRouter.post('/topics', async (req, res) => {
  const { title, content, categoryId, userId } = req.body;
  
  try {
    const category = await ForumCategory.findById(categoryId);
    
    if (!category) {
      return res.status(400).json({ message: "Invalid category" });
    }
    
    const post = new ForumPost({
      userId,
      title,
      content,
      categoryId,
      replies: []
    });
    
    await post.save();
    
    res.json({ message: "Post created", postId: post._id });
  } catch (err) {
    console.error('Create post error:', err);
    res.status(500).json({ message: "Failed to create post" });
  }
});

// Get replies for a topic
forumRouter.get('/topics/:id/replies', async (req, res) => {
  const postId = req.params.id;
  
  try {
    const post = await ForumPost.findById(postId)
      .populate('replies.userId', 'firstName lastName')
      .lean();
    
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }
    
    const replies = post.replies.map(reply => ({
      ...reply,
      author_name: reply.userId ? `${reply.userId.firstName} ${reply.userId.lastName}` : 'Unknown'
    }));
    
    res.json(replies);
  } catch (err) {
    console.error('Get replies error:', err);
    res.status(500).json({ message: "Failed to load replies" });
  }
});

// Delete post
forumRouter.delete('/delete-post/:id', async (req, res) => {
  const postId = req.params.id;
  
  try {
    await ForumPost.findByIdAndDelete(postId);
    res.json({ message: "Post deleted" });
  } catch (err) {
    console.error('Delete post error:', err);
    res.status(500).json({ message: "Failed to delete post" });
  }
});

// Delete reply
forumRouter.delete('/delete-reply/:postId/:replyIndex', async (req, res) => {
  const { postId, replyIndex } = req.params;
  
  try {
    const post = await ForumPost.findById(postId);
    
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }
    
    // Remove reply by index
    post.replies.splice(parseInt(replyIndex), 1);
    await post.save();
    
    res.json({ message: "Reply deleted" });
  } catch (err) {
    console.error('Delete reply error:', err);
    res.status(500).json({ message: "Failed to delete reply" });
  }
});

// Mark reply as best answer
forumRouter.post('/replies/:postId/:replyIndex/best', async (req, res) => {
  const { postId, replyIndex } = req.params;
  
  try {
    const post = await ForumPost.findById(postId);
    
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }
    
    // Reset all replies isBestAnswer to false
    post.replies.forEach(reply => {
      reply.isBestAnswer = false;
    });
    
    // Set the selected reply as best answer
    if (post.replies[parseInt(replyIndex)]) {
      post.replies[parseInt(replyIndex)].isBestAnswer = true;
    }
    
    post.solved = true;
    await post.save();
    
    res.json({ message: "Best answer marked" });
  } catch (err) {
    console.error('Mark best answer error:', err);
    res.status(500).json({ message: "Failed to mark best answer" });
  }
});

// Like a reply
forumRouter.post('/replies/:postId/:replyIndex/like', async (req, res) => {
  const { postId, replyIndex } = req.params;
  
  try {
    const post = await ForumPost.findById(postId);
    
    if (!post || !post.replies[parseInt(replyIndex)]) {
      return res.status(404).json({ message: "Reply not found" });
    }
    
    post.replies[parseInt(replyIndex)].likes += 1;
    await post.save();
    
    res.json({ message: "Liked" });
  } catch (err) {
    console.error('Like reply error:', err);
    res.status(500).json({ message: "Failed to like reply" });
  }
});

// Add reply to topic
forumRouter.post('/topics/:id/replies', async (req, res) => {
  const postId = req.params.id;
  const { content, userId } = req.body;
  
  try {
    const post = await ForumPost.findById(postId);
    
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }
    
    // Add reply
    post.replies.push({
      userId,
      content,
      createdAt: new Date(),
      likes: 0,
      isBestAnswer: false
    });
    
    await post.save();
    
    // Create notification for post author (if different from replier)
    if (post.userId.toString() !== userId) {
      // You'll need to create a Notification model
      // This is a placeholder
      console.log(`Notification: User ${userId} replied to your post`);
    }
    
    res.json({ message: "Reply added" });
  } catch (error) {
    console.error('Add reply error:', error);
    res.status(500).json({ message: "Could not post reply, please try again" });
  }
});

// Get notifications (placeholder)
forumRouter.post('/notifications', async (req, res) => {
  const { userId } = req.body;
  
  // Implement Notification model as needed
  const rows = []; // await Notification.find({ userId }).sort({ createdAt: -1 });
  
  res.json(rows);
});


// ===== CLASS-SPECIFIC FORUM ENDPOINTS =====

// Get categories for a specific class
forumRouter.get('/class/:classId/categories', async (req, res) => {
  const { classId } = req.params;
  
  try {
    // Get both global categories and class-specific categories
    const categories = await ForumCategory.find({
      $or: [
        { classId: null, isClassCategory: false },
        { classId: classId, isClassCategory: true }
      ],
      isActive: true
    }).sort({ sortOrder: 1, name: 1 });
    
    res.json(categories);
  } catch (error) {
    console.error('Get class categories error:', error);
    res.status(500).json({ message: 'Failed to load categories' });
  }
});

// ===== GET TOPICS FOR A SPECIFIC CLASS (FIXED) =====
forumRouter.get('/class/:classId/topics', async (req, res) => {
  const { classId } = req.params;
  const { search, sort, category } = req.query;
  
  try {
    // Check if class exists
    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({ message: 'Class not found' });
    }
    
    let query = { classId: classId, isClassForum: true };
    let sortOption = {};
    
    // Filter by category
    if (category) {
      const categoryDoc = await ForumCategory.findOne({ slug: category, classId: classId });
      if (categoryDoc) {
        query.categoryId = categoryDoc._id;
      }
    }
    
    // Search by title
    if (search) {
      query.title = { $regex: search, $options: 'i' };
    }
    
    // Sort options
    if (sort === "popular") {
      sortOption = { replyCount: -1 };
    } else if (sort === "unanswered") {
      query.$expr = { $eq: [{ $size: "$replies" }, 0] };
      sortOption = { createdAt: -1 };
    } else {
      sortOption = { isPinned: -1, createdAt: -1 };
    }
    
    // Use aggregation with proper population
    const topics = await ForumPost.aggregate([
      { $match: query },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "author"
        }
      },
      { $unwind: { path: "$author", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "forumcategories",
          localField: "categoryId",
          foreignField: "_id",
          as: "category"
        }
      },
      { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          replyCount: { $size: "$replies" },
          category_name: "$category.name",
          category_icon: "$category.icon",
          author_name: {
            $cond: {
              if: { $and: ["$author", "$author.firstName"] },
              then: { $concat: ["$author.firstName", " ", "$author.lastName"] },
              else: "Anonymous"
            }
          },
          author_id: "$author._id"
        }
      },
      { $sort: sortOption }
    ]);
    
    res.json(topics);
  } catch (err) {
    console.error('Get class topics error:', err);
    res.status(500).json({ message: "Failed to load topics", error: err.message });
  }
});

// Create a class-specific topic
forumRouter.post('/class/:classId/topics', async (req, res) => {
  const { classId } = req.params;
  const { title, content, categoryId, userId } = req.body;
  
  try {
    // Check if user is enrolled in the class
    const enrollment = await Enrollment.findOne({ userId, classId });
    if (!enrollment) {
      return res.status(403).json({ message: "You must be enrolled in this class to post" });
    }
    
    // Check if category exists
    if (categoryId) {
      const category = await ForumCategory.findById(categoryId);
      if (!category) {
        return res.status(400).json({ message: "Invalid category" });
      }
    }
    
    const post = new ForumPost({
      userId,
      title,
      content,
      categoryId: categoryId || null,
      classId: classId,
      isClassForum: true,
      replies: []
    });
    
    await post.save();
    
    res.json({ message: "Post created", postId: post._id });
  } catch (err) {
    console.error('Create class post error:', err);
    res.status(500).json({ message: "Failed to create post" });
  }
});

// Get single class topic with details
forumRouter.get('/class/:classId/topics/:topicId', async (req, res) => {
  const { classId, topicId } = req.params;
  
  try {
    // Increment view count
    await ForumPost.findByIdAndUpdate(topicId, { $inc: { views: 1 } });
    
    const post = await ForumPost.findOne({ _id: topicId, classId: classId })
      .populate('userId', 'firstName lastName profilePicture')
      .populate('categoryId', 'name slug')
      .lean();
    
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }
    
    const formattedPost = {
      ...post,
      author_name: post.userId ? `${post.userId.firstName} ${post.userId.lastName}` : 'Unknown',
      category_name: post.categoryId?.name,
      category_slug: post.categoryId?.slug
    };
    
    res.json(formattedPost);
  } catch (err) {
    console.error('Get class topic error:', err);
    res.status(500).json({ message: "Failed to load post" });
  }
});

// Get replies for a class topic
forumRouter.get('/class/:classId/topics/:topicId/replies', async (req, res) => {
  const { classId, topicId } = req.params;
  
  try {
    const post = await ForumPost.findOne({ _id: topicId, classId: classId })
      .populate('replies.userId', 'firstName lastName')
      .lean();
    
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }
    
    const replies = post.replies.map(reply => ({
      ...reply,
      author_name: reply.userId ? `${reply.userId.firstName} ${reply.userId.lastName}` : 'Unknown'
    }));
    
    res.json(replies);
  } catch (err) {
    console.error('Get class replies error:', err);
    res.status(500).json({ message: "Failed to load replies" });
  }
});

// Add reply to class topic
forumRouter.post('/class/:classId/topics/:topicId/replies', async (req, res) => {
  const { classId, topicId } = req.params;
  const { content, userId } = req.body;
  
  try {
    // Check if user is enrolled in the class
    const enrollment = await Enrollment.findOne({ userId, classId });
    if (!enrollment) {
      return res.status(403).json({ message: "You must be enrolled in this class to reply" });
    }
    
    const post = await ForumPost.findOne({ _id: topicId, classId: classId });
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }
    
    post.replies.push({
      userId,
      content,
      createdAt: new Date(),
      likes: 0,
      isBestAnswer: false
    });
    
    await post.save();
    
    res.json({ message: "Reply added" });
  } catch (error) {
    console.error('Add class reply error:', error);
    res.status(500).json({ message: "Could not post reply" });
  }
});

// Pin/unpin class topic (instructor only)
forumRouter.post('/class/:classId/topics/:topicId/pin', async (req, res) => {
  const { classId, topicId } = req.params;
  const { userId } = req.body;
  
  try {
    // Check if user is instructor of this class
    const classData = await Class.findById(classId);
    if (!classData || classData.instructorId.toString() !== userId) {
      return res.status(403).json({ message: "Only instructors can pin topics" });
    }
    
    const post = await ForumPost.findOne({ _id: topicId, classId: classId });
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }
    
    post.isPinned = !post.isPinned;
    await post.save();
    
    res.json({ 
      message: post.isPinned ? "Topic pinned" : "Topic unpinned",
      isPinned: post.isPinned 
    });
  } catch (error) {
    console.error('Pin topic error:', error);
    res.status(500).json({ message: "Failed to pin topic" });
  }
});

// Mark class topic as solved
forumRouter.post('/class/:classId/topics/:topicId/solve', async (req, res) => {
  const { classId, topicId } = req.params;
  const { userId } = req.body;
  
  try {
    const post = await ForumPost.findOne({ _id: topicId, classId: classId });
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }
    
    // Only author or instructor can mark as solved
    const classData = await Class.findById(classId);
    const isInstructor = classData && classData.instructorId.toString() === userId;
    const isAuthor = post.userId.toString() === userId;
    
    if (!isAuthor && !isInstructor) {
      return res.status(403).json({ message: "Only the author or instructor can mark as solved" });
    }
    
    post.solved = !post.solved;
    await post.save();
    
    res.json({ 
      message: post.solved ? "Topic marked as solved" : "Topic unsolved",
      solved: post.solved 
    });
  } catch (error) {
    console.error('Solve topic error:', error);
    res.status(500).json({ message: "Failed to mark topic as solved" });
  }
});

// Delete class topic
forumRouter.delete('/class/:classId/topics/:topicId', async (req, res) => {
  const { classId, topicId } = req.params;
  const { userId } = req.body;
  
  try {
    const post = await ForumPost.findOne({ _id: topicId, classId: classId });
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }
    
    // Check if user is author or instructor
    const classData = await Class.findById(classId);
    const isInstructor = classData && classData.instructorId.toString() === userId;
    const isAuthor = post.userId.toString() === userId;
    
    if (!isAuthor && !isInstructor) {
      return res.status(403).json({ message: "Unauthorized to delete this topic" });
    }
    
    await ForumPost.findByIdAndDelete(topicId);
    res.json({ message: "Topic deleted" });
  } catch (error) {
    console.error('Delete class topic error:', error);
    res.status(500).json({ message: "Failed to delete topic" });
  }
});

// ===== EXISTING GLOBAL FORUM ENDPOINTS (Modified to exclude class posts) =====

// Get topics - exclude class-specific topics
forumRouter.get('/topics', async (req, res) => {
  const { search, sort, category } = req.query;
  
  try {
    let query = { 
      $or: [
        { isClassForum: { $ne: true } },
        { isClassForum: { $exists: false } }
      ]
    };
    let sortOption = {};
    
    if (category) {
      const categoryDoc = await ForumCategory.findOne({ slug: category, classId: null });
      if (categoryDoc) {
        query.categoryId = categoryDoc._id;
      }
    }
    
    if (search) {
      query.title = { $regex: search, $options: 'i' };
    }
    
    if (sort === "popular") {
      sortOption = { "replyCount": -1 };
    } else if (sort === "unanswered") {
      query.$expr = { $eq: [{ $size: "$replies" }, 0] };
      sortOption = { createdAt: -1 };
    } else {
      sortOption = { isPinned: -1, createdAt: -1 };
    }
    
    const topics = await ForumPost.aggregate([
      { $match: query },
      {
        $lookup: {
          from: "forumcategories",
          localField: "categoryId",
          foreignField: "_id",
          as: "category"
        }
      },
      { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          replyCount: { $size: "$replies" },
          category_name: "$category.name",
          icon: "$category.icon"
        }
      },
      { $sort: sortOption }
    ]);
    
    res.json(topics);
  } catch (err) {
    console.error('Get topics error:', err);
    res.status(500).json({ message: "Failed to load topics" });
  }
});

// Get forum categories - exclude class-specific
forumRouter.get('/categories', async (req, res) => {
  try {
    const categories = await ForumCategory.aggregate([
      { $match: { isActive: true, classId: null, isClassCategory: { $ne: true } } },
      {
        $lookup: {
          from: "forumposts",
          localField: "_id",
          foreignField: "categoryId",
          as: "posts"
        }
      },
      {
        $addFields: {
          topic_count: { $size: "$posts" }
        }
      },
      { $project: { posts: 0 } },
      { $sort: { sortOrder: 1, name: 1 } }
    ]);
    
    res.json(categories);
  } catch (error) {
    console.error('Get forum categories error:', error);
    res.status(500).json({ message: 'Failed to load forum categories' });
  }
});

// Get forum stats
forumRouter.get('/stats', async (req, res) => {
  try {
    const totalTopics = await ForumPost.countDocuments();
    const totalUsers = await User.countDocuments();
    
    const repliesResult = await ForumPost.aggregate([
      { $project: { replyCount: { $size: "$replies" } } },
      { $group: { _id: null, total: { $sum: "$replyCount" } } }
    ]);
    
    const totalReplies = repliesResult.length > 0 ? repliesResult[0].total : 0;
    
    const solvedTopics = await ForumPost.countDocuments({ solved: true });
    
    res.json({
      totalTopics,
      totalUsers,
      totalReplies,
      solvedTopics
    });
  } catch (err) {
    console.error('Get stats error:', err);
    res.status(500).json({ message: "Failed to load stats" });
  }
});

// Get topic with details (alternative endpoint)
forumRouter.get('/topics/:topicId', async (req, res) => {
  try {
    const topicId = req.params.topicId;
    
    // Increment view count
    await ForumPost.findByIdAndUpdate(topicId, { $inc: { views: 1 } });
    
    // Get topic details with populated fields
    const topic = await ForumPost.findById(topicId)
      .populate('userId', 'firstName lastName profilePicture bio')
      .populate('categoryId', 'name slug')
      .populate('replies.userId', 'firstName lastName profilePicture')
      .lean();
    
    if (!topic) {
      return res.status(404).json({ message: 'Topic not found' });
    }
    
    // Format replies
    const formattedReplies = topic.replies.map(reply => ({
      ...reply,
      author: reply.userId ? {
        first_name: reply.userId.firstName,
        last_name: reply.userId.lastName,
        profile_picture: reply.userId.profilePicture
      } : null
    }));
    
    // Format response
    const formattedTopic = {
      ...topic,
      author: topic.userId ? {
        first_name: topic.userId.firstName,
        last_name: topic.userId.lastName,
        profile_picture: topic.userId.profilePicture,
        bio: topic.userId.bio
      } : null,
      category_name: topic.categoryId?.name,
      category_slug: topic.categoryId?.slug,
      replies: formattedReplies,
      subscribers_count: 0 // Implement if needed
    };
    
    res.json({
      topic: formattedTopic,
      replies: formattedReplies
    });
    
  } catch (error) {
    console.error('Get topic error:', error);
    res.status(500).json({ message: 'Failed to load topic' });
  }
});

// Get user's forum activity
forumRouter.get('/activity/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    // Get user's topics
    const topics = await ForumPost.find({ userId })
      .populate('userId', 'firstName lastName profilePicture')
      .populate('categoryId', 'name slug')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    
    // Get user's replies
    const postsWithUserReplies = await ForumPost.find({
      'replies.userId': userId
    })
      .select('title replies')
      .sort({ 'replies.createdAt': -1 })
      .limit(10)
      .lean();
    
    // Extract user's replies
    const replies = [];
    postsWithUserReplies.forEach(post => {
      const userReplies = post.replies.filter(r => 
        r.userId && r.userId.toString() === userId
      );
      
      userReplies.forEach(reply => {
        replies.push({
          ...reply,
          topic_title: post.title
        });
      });
    });
    
    // Sort replies by date
    replies.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Format topics
    const formattedTopics = topics.map(topic => ({
      ...topic,
      author: topic.userId ? {
        first_name: topic.userId.firstName,
        last_name: topic.userId.lastName,
        profile_picture: topic.userId.profilePicture
      } : null,
      category_name: topic.categoryId?.name,
      category_slug: topic.categoryId?.slug
    }));
    
    res.json({ topics: formattedTopics, replies });
  } catch (error) {
    console.error('Get user activity error:', error);
    res.status(500).json({ message: 'Failed to get user activity' });
  }
});

export default forumRouter;