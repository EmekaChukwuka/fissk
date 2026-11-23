import express from 'express';
const forumRouter = express.Router();

import User from '../models/User.js';
import ForumCategory from '../models/ForumCategory.js';
import ForumPost from '../models/ForumPost.js';
import Class from '../models/Class.js';
import Enrollment from '../models/Enrollment.js';

// ============================================================
// HELPERS
// ============================================================

function safeSizeField(expr) {
  // $size crashes if the field is missing/null/non-array.
  // This produces 0 in those cases, the array length otherwise.
  return {
    $cond: {
      if: { $isArray: expr },
      then: { $size: expr },
      else: 0
    }
  };
}

// ============================================================
// GLOBAL FORUM — CATEGORIES
// ============================================================

forumRouter.get('/categories', async (req, res) => {
  try {
    const categories = await ForumCategory.aggregate([
      { $match: { isActive: true, classId: null, isClassCategory: { $ne: true } } },
      {
        $lookup: {
          from: 'forumposts',
          let: { catId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$categoryId', '$$catId'] } } },
            { $match: { $or: [{ isClassForum: { $ne: true } }, { isClassForum: { $exists: false } }] } },
            { $count: 'count' }
          ],
          as: 'postStats'
        }
      },
      {
        $addFields: {
          topic_count: {
            $ifNull: [{ $arrayElemAt: ['$postStats.count', 0] }, 0]
          }
        }
      },
      { $project: { postStats: 0 } },
      { $sort: { sortOrder: 1, name: 1 } }
    ]);

    res.json(categories);
  } catch (error) {
    console.error('Get forum categories error:', error);
    res.status(500).json({ message: 'Failed to load forum categories' });
  }
});

// ============================================================
// GLOBAL FORUM — TOPICS
// Returns only non-class (global) topics. Class forums are
// accessed via /class/:classId/topics and are private to enrollees.
// ============================================================

forumRouter.get('/topics', async (req, res) => {
  const { search, sort, category } = req.query;

  try {
    const query = {
      $and: [
        { $or: [{ isClassForum: { $ne: true } }, { isClassForum: { $exists: false } }] },
        { $or: [{ classId: null }, { classId: { $exists: false } }] }
      ]
    };

    if (category) {
      const categoryDoc = await ForumCategory.findOne({ slug: category, classId: null });
      if (categoryDoc) {
        query.categoryId = categoryDoc._id;
      } else {
        // Category slug didn't match anything — return empty rather than ignoring filter
        return res.json([]);
      }
    }

    if (search && search.trim().length > 0) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$and.push({
        $or: [
          { title: { $regex: escaped, $options: 'i' } },
          { content: { $regex: escaped, $options: 'i' } }
        ]
      });
    }

    let sortOption = { isPinned: -1, createdAt: -1 };
    if (sort === 'popular') {
      sortOption = { replyCount: -1, createdAt: -1 };
    } else if (sort === 'unanswered') {
      query.$and.push({
        $expr: { $eq: [safeSizeField('$replies'), 0] }
      });
      sortOption = { createdAt: -1 };
    }

    const topics = await ForumPost.aggregate([
      { $match: query },
      {
        $lookup: {
          from: 'forumcategories',
          localField: 'categoryId',
          foreignField: '_id',
          as: 'category'
        }
      },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'author'
        }
      },
      { $unwind: { path: '$author', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          replyCount: safeSizeField('$replies'),
          category_name: '$category.name',
          category_slug: '$category.slug',
          icon: '$category.icon',
          author_name: {
            $trim: {
              input: {
                $concat: [
                  { $ifNull: ['$author.firstName', ''] },
                  ' ',
                  { $ifNull: ['$author.lastName', ''] }
                ]
              }
            }
          }
        }
      },
      { $sort: sortOption },
      { $limit: 100 }
    ]);

    res.json(topics);
  } catch (err) {
    console.error('Get topics error:', err);
    res.status(500).json({ message: 'Failed to load topics', error: err.message });
  }
});

// ============================================================
// GLOBAL FORUM — STATS
// ============================================================

forumRouter.get('/stats', async (req, res) => {
  try {
    const globalFilter = {
      $and: [
        { $or: [{ isClassForum: { $ne: true } }, { isClassForum: { $exists: false } }] },
        { $or: [{ classId: null }, { classId: { $exists: false } }] }
      ]
    };

    const [totalTopics, totalUsers, solvedTopics] = await Promise.all([
      ForumPost.countDocuments(globalFilter),
      User.countDocuments(),
      ForumPost.countDocuments({ ...globalFilter, solved: true })
    ]);

    const repliesResult = await ForumPost.aggregate([
      { $match: globalFilter },
      { $project: { replyCount: safeSizeField('$replies') } },
      { $group: { _id: null, total: { $sum: '$replyCount' } } }
    ]);

    const totalReplies = repliesResult.length > 0 ? repliesResult[0].total : 0;

    res.json({ totalTopics, totalUsers, totalReplies, solvedTopics });
  } catch (err) {
    console.error('Get stats error:', err);
    res.status(500).json({ message: 'Failed to load stats', error: err.message });
  }
});

// ============================================================
// GLOBAL FORUM — SINGLE TOPIC + REPLIES
// ============================================================

forumRouter.get('/topics/:topicId', async (req, res) => {
  try {
    const { topicId } = req.params;

    await ForumPost.findByIdAndUpdate(topicId, { $inc: { views: 1 } });

    const topic = await ForumPost.findById(topicId)
      .populate('userId', 'firstName lastName profilePicture bio')
      .populate('categoryId', 'name slug')
      .populate('replies.userId', 'firstName lastName profilePicture')
      .lean();

    if (!topic) {
      return res.status(404).json({ message: 'Topic not found' });
    }

    const formattedReplies = (topic.replies || []).map(reply => ({
      ...reply,
      author_name: reply.userId
        ? `${reply.userId.firstName || ''} ${reply.userId.lastName || ''}`.trim()
        : 'Anonymous',
      author: reply.userId
        ? {
            first_name: reply.userId.firstName,
            last_name: reply.userId.lastName,
            profile_picture: reply.userId.profilePicture
          }
        : null
    }));

    const formattedTopic = {
      ...topic,
      author_name: topic.userId
        ? `${topic.userId.firstName || ''} ${topic.userId.lastName || ''}`.trim()
        : 'Anonymous',
      author: topic.userId
        ? {
            first_name: topic.userId.firstName,
            last_name: topic.userId.lastName,
            profile_picture: topic.userId.profilePicture,
            bio: topic.userId.bio
          }
        : null,
      category_name: topic.categoryId?.name,
      category_slug: topic.categoryId?.slug,
      replyCount: formattedReplies.length,
      replies: formattedReplies,
      subscribers_count: 0
    };

    res.json({ topic: formattedTopic, replies: formattedReplies });
  } catch (error) {
    console.error('Get topic error:', error);
    res.status(500).json({ message: 'Failed to load topic' });
  }
});

// ============================================================
// GLOBAL FORUM — CREATE TOPIC
// ============================================================

forumRouter.post('/topics', async (req, res) => {
  const { title, content, categoryId, userId, tags } = req.body;

  if (!title || !content || !userId) {
    return res.status(400).json({ message: 'title, content, and userId are required' });
  }

  try {
    let resolvedCategoryId = null;
    if (categoryId) {
      const category = await ForumCategory.findById(categoryId);
      if (!category) {
        return res.status(400).json({ message: 'Invalid category' });
      }
      resolvedCategoryId = category._id;
    }

    const post = new ForumPost({
      userId,
      title: title.trim(),
      content: content.trim(),
      categoryId: resolvedCategoryId,
      tags: Array.isArray(tags) ? tags : [],
      classId: null,
      isClassForum: false,
      replies: []
    });

    await post.save();
    res.json({ message: 'Post created', postId: post._id });
  } catch (err) {
    console.error('Create post error:', err);
    res.status(500).json({ message: 'Failed to create post' });
  }
});

// ============================================================
// GLOBAL FORUM — REPLIES
// ============================================================

forumRouter.get('/topics/:id/replies', async (req, res) => {
  try {
    const post = await ForumPost.findById(req.params.id)
      .populate('replies.userId', 'firstName lastName')
      .lean();

    if (!post) return res.status(404).json({ message: 'Post not found' });

    const replies = (post.replies || []).map(reply => ({
      ...reply,
      author_name: reply.userId
        ? `${reply.userId.firstName || ''} ${reply.userId.lastName || ''}`.trim()
        : 'Anonymous'
    }));

    res.json(replies);
  } catch (err) {
    console.error('Get replies error:', err);
    res.status(500).json({ message: 'Failed to load replies' });
  }
});

forumRouter.post('/topics/:id/replies', async (req, res) => {
  const { content, userId } = req.body;

  if (!content || !userId) {
    return res.status(400).json({ message: 'content and userId are required' });
  }

  try {
    const post = await ForumPost.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });

    post.replies.push({
      userId,
      content: content.trim(),
      createdAt: new Date(),
      likes: 0,
      isBestAnswer: false
    });

    await post.save();
    res.json({ message: 'Reply added' });
  } catch (error) {
    console.error('Add reply error:', error);
    res.status(500).json({ message: 'Could not post reply' });
  }
});

// ============================================================
// GLOBAL FORUM — ACTIONS ON REPLIES
// ============================================================

forumRouter.post('/replies/:postId/:replyIndex/like', async (req, res) => {
  const { postId, replyIndex } = req.params;
  try {
    const post = await ForumPost.findById(postId);
    const idx = parseInt(replyIndex, 10);
    if (!post || !post.replies[idx]) {
      return res.status(404).json({ message: 'Reply not found' });
    }
    post.replies[idx].likes = (post.replies[idx].likes || 0) + 1;
    await post.save();
    res.json({ message: 'Liked', likes: post.replies[idx].likes });
  } catch (err) {
    console.error('Like reply error:', err);
    res.status(500).json({ message: 'Failed to like reply' });
  }
});

forumRouter.post('/replies/:postId/:replyIndex/best', async (req, res) => {
  const { postId, replyIndex } = req.params;
  try {
    const post = await ForumPost.findById(postId);
    const idx = parseInt(replyIndex, 10);
    if (!post || !post.replies[idx]) {
      return res.status(404).json({ message: 'Reply not found' });
    }
    post.replies.forEach(r => { r.isBestAnswer = false; });
    post.replies[idx].isBestAnswer = true;
    post.solved = true;
    await post.save();
    res.json({ message: 'Best answer marked' });
  } catch (err) {
    console.error('Mark best answer error:', err);
    res.status(500).json({ message: 'Failed to mark best answer' });
  }
});

// ============================================================
// GLOBAL FORUM — DELETE
// ============================================================

forumRouter.delete('/delete-post/:id', async (req, res) => {
  try {
    await ForumPost.findByIdAndDelete(req.params.id);
    res.json({ message: 'Post deleted' });
  } catch (err) {
    console.error('Delete post error:', err);
    res.status(500).json({ message: 'Failed to delete post' });
  }
});

forumRouter.delete('/delete-reply/:postId/:replyIndex', async (req, res) => {
  const { postId, replyIndex } = req.params;
  try {
    const post = await ForumPost.findById(postId);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    post.replies.splice(parseInt(replyIndex, 10), 1);
    await post.save();
    res.json({ message: 'Reply deleted' });
  } catch (err) {
    console.error('Delete reply error:', err);
    res.status(500).json({ message: 'Failed to delete reply' });
  }
});

// ============================================================
// GLOBAL FORUM — ACTIVITY
// ============================================================

forumRouter.get('/activity/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const topics = await ForumPost.find({ userId, isClassForum: { $ne: true } })
      .populate('userId', 'firstName lastName profilePicture')
      .populate('categoryId', 'name slug')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    const postsWithUserReplies = await ForumPost.find({
      'replies.userId': userId,
      isClassForum: { $ne: true }
    })
      .select('title replies')
      .sort({ 'replies.createdAt': -1 })
      .limit(10)
      .lean();

    const replies = [];
    postsWithUserReplies.forEach(post => {
      post.replies
        .filter(r => r.userId && r.userId.toString() === userId)
        .forEach(reply => replies.push({ ...reply, topic_title: post.title }));
    });

    replies.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const formattedTopics = topics.map(topic => ({
      ...topic,
      author: topic.userId
        ? {
            first_name: topic.userId.firstName,
            last_name: topic.userId.lastName,
            profile_picture: topic.userId.profilePicture
          }
        : null,
      category_name: topic.categoryId?.name,
      category_slug: topic.categoryId?.slug
    }));

    res.json({ topics: formattedTopics, replies });
  } catch (error) {
    console.error('Get user activity error:', error);
    res.status(500).json({ message: 'Failed to get user activity' });
  }
});

// ============================================================
// CLASS FORUM
// ============================================================

forumRouter.get('/class/:classId/categories', async (req, res) => {
  const { classId } = req.params;
  try {
    const categories = await ForumCategory.find({
      $or: [
        { classId: null, isClassCategory: false },
        { classId, isClassCategory: true }
      ],
      isActive: true
    }).sort({ sortOrder: 1, name: 1 });
    res.json(categories);
  } catch (error) {
    console.error('Get class categories error:', error);
    res.status(500).json({ message: 'Failed to load categories' });
  }
});

forumRouter.get('/class/:classId/topics', async (req, res) => {
  const { classId } = req.params;
  const { search, sort, category } = req.query;

  try {
    const classData = await Class.findById(classId);
    if (!classData) return res.status(404).json({ message: 'Class not found' });

    const query = {
      $and: [
        { classId },
        { $or: [{ isClassForum: true }, { isClassForum: { $exists: false } }] }
      ]
    };

    if (category) {
      const categoryDoc = await ForumCategory.findOne({ slug: category, classId });
      if (categoryDoc) query.categoryId = categoryDoc._id;
      else return res.json([]);
    }

    if (search && search.trim().length > 0) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$and.push({ title: { $regex: escaped, $options: 'i' } });
    }

    let sortOption = { isPinned: -1, createdAt: -1 };
    if (sort === 'popular') sortOption = { replyCount: -1 };
    else if (sort === 'unanswered') {
      query.$and.push({ $expr: { $eq: [safeSizeField('$replies'), 0] } });
      sortOption = { createdAt: -1 };
    }

    const topics = await ForumPost.find(query)
      .populate('userId', 'firstName lastName')
      .populate('categoryId', 'name icon')
      .sort(sortOption)
      .lean();

    const formattedTopics = topics.map(topic => ({
      _id: topic._id,
      title: topic.title,
      content: topic.content,
      createdAt: topic.createdAt,
      views: topic.views || 0,
      isPinned: topic.isPinned || false,
      solved: topic.solved || false,
      replyCount: Array.isArray(topic.replies) ? topic.replies.length : 0,
      replies: topic.replies || [],
      category_name: topic.categoryId?.name || null,
      category_icon: topic.categoryId?.icon || null,
      author_name: topic.userId
        ? `${topic.userId.firstName || ''} ${topic.userId.lastName || ''}`.trim()
        : 'Anonymous',
      author_id: topic.userId?._id || null
    }));

    res.json(formattedTopics);
  } catch (err) {
    console.error('Get class topics error:', err);
    res.status(500).json({ message: 'Failed to load topics', error: err.message });
  }
});

forumRouter.post('/class/:classId/topics', async (req, res) => {
  const { classId } = req.params;
  const { title, content, categoryId, userId } = req.body;

  try {
    const enrollment = await Enrollment.findOne({ userId, classId });
    const classData = await Class.findById(classId);
    const isInstructor = classData && classData.instructorId?.toString() === userId?.toString();

    if (!enrollment && !isInstructor) {
      return res.status(403).json({ message: 'You must be enrolled in this class to post' });
    }

    if (categoryId) {
      const category = await ForumCategory.findById(categoryId);
      if (!category) return res.status(400).json({ message: 'Invalid category' });
    }

    const post = new ForumPost({
      userId,
      title,
      content,
      categoryId: categoryId || null,
      classId,
      isClassForum: true,
      replies: []
    });

    await post.save();
    res.json({ message: 'Post created', postId: post._id });
  } catch (err) {
    console.error('Create class post error:', err);
    res.status(500).json({ message: 'Failed to create post' });
  }
});

forumRouter.get('/class/:classId/topics/:topicId', async (req, res) => {
  const { classId, topicId } = req.params;
  try {
    await ForumPost.findByIdAndUpdate(topicId, { $inc: { views: 1 } });
    const post = await ForumPost.findOne({ _id: topicId, classId })
      .populate('userId', 'firstName lastName profilePicture')
      .populate('categoryId', 'name slug')
      .lean();

    if (!post) return res.status(404).json({ message: 'Post not found' });

    res.json({
      ...post,
      author_name: post.userId
        ? `${post.userId.firstName || ''} ${post.userId.lastName || ''}`.trim()
        : 'Anonymous',
      category_name: post.categoryId?.name,
      category_slug: post.categoryId?.slug
    });
  } catch (err) {
    console.error('Get class topic error:', err);
    res.status(500).json({ message: 'Failed to load post' });
  }
});

forumRouter.get('/class/:classId/topics/:topicId/replies', async (req, res) => {
  const { classId, topicId } = req.params;
  try {
    const post = await ForumPost.findOne({ _id: topicId, classId })
      .populate('replies.userId', 'firstName lastName')
      .lean();

    if (!post) return res.status(404).json({ message: 'Post not found' });

    const replies = (post.replies || []).map(reply => ({
      ...reply,
      author_name: reply.userId
        ? `${reply.userId.firstName || ''} ${reply.userId.lastName || ''}`.trim()
        : 'Anonymous'
    }));

    res.json(replies);
  } catch (err) {
    console.error('Get class replies error:', err);
    res.status(500).json({ message: 'Failed to load replies' });
  }
});

forumRouter.post('/class/:classId/topics/:topicId/replies', async (req, res) => {
  const { classId, topicId } = req.params;
  const { content, userId } = req.body;

  try {
    const enrollment = await Enrollment.findOne({ userId, classId });
    if (!enrollment) {
      return res.status(403).json({ message: 'You must be enrolled in this class to reply' });
    }

    const post = await ForumPost.findOne({ _id: topicId, classId });
    if (!post) return res.status(404).json({ message: 'Post not found' });

    post.replies.push({
      userId,
      content,
      createdAt: new Date(),
      likes: 0,
      isBestAnswer: false
    });

    await post.save();
    res.json({ message: 'Reply added' });
  } catch (error) {
    console.error('Add class reply error:', error);
    res.status(500).json({ message: 'Could not post reply' });
  }
});

forumRouter.post('/class/:classId/topics/:topicId/pin', async (req, res) => {
  const { classId, topicId } = req.params;
  const { userId } = req.body;
  try {
    const classData = await Class.findById(classId);
    if (!classData || classData.instructorId?.toString() !== userId?.toString()) {
      return res.status(403).json({ message: 'Only instructors can pin topics' });
    }
    const post = await ForumPost.findOne({ _id: topicId, classId });
    if (!post) return res.status(404).json({ message: 'Post not found' });
    post.isPinned = !post.isPinned;
    await post.save();
    res.json({ message: post.isPinned ? 'Topic pinned' : 'Topic unpinned', isPinned: post.isPinned });
  } catch (error) {
    console.error('Pin topic error:', error);
    res.status(500).json({ message: 'Failed to pin topic' });
  }
});

forumRouter.post('/class/:classId/topics/:topicId/solve', async (req, res) => {
  const { classId, topicId } = req.params;
  const { userId } = req.body;
  try {
    const post = await ForumPost.findOne({ _id: topicId, classId });
    if (!post) return res.status(404).json({ message: 'Post not found' });
    const classData = await Class.findById(classId);
    const isInstructor = classData && classData.instructorId?.toString() === userId?.toString();
    const isAuthor = post.userId?.toString() === userId?.toString();
    if (!isAuthor && !isInstructor) {
      return res.status(403).json({ message: 'Only the author or instructor can mark as solved' });
    }
    post.solved = !post.solved;
    await post.save();
    res.json({ message: post.solved ? 'Topic marked as solved' : 'Topic unsolved', solved: post.solved });
  } catch (error) {
    console.error('Solve topic error:', error);
    res.status(500).json({ message: 'Failed to mark topic as solved' });
  }
});

forumRouter.delete('/class/:classId/topics/:topicId', async (req, res) => {
  const { classId, topicId } = req.params;
  const { userId } = req.body;
  try {
    const post = await ForumPost.findOne({ _id: topicId, classId });
    if (!post) return res.status(404).json({ message: 'Post not found' });
    const classData = await Class.findById(classId);
    const isInstructor = classData && classData.instructorId?.toString() === userId?.toString();
    const isAuthor = post.userId?.toString() === userId?.toString();
    if (!isAuthor && !isInstructor) {
      return res.status(403).json({ message: 'Unauthorized to delete this topic' });
    }
    await ForumPost.findByIdAndDelete(topicId);
    res.json({ message: 'Topic deleted' });
  } catch (error) {
    console.error('Delete class topic error:', error);
    res.status(500).json({ message: 'Failed to delete topic' });
  }
});

export default forumRouter;