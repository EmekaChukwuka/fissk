import express from 'express';
const forumRouter = express.Router();
import mysql from "mysql2/promise";
// MySQL connection pool
const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root', // replace with your MySQL username
    password: '', // replace with your MySQL password
    database: 'fissk_online_academy',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Create users table if not exists
async function initializeDatabase() {
    try {
        const connection = await pool.getConnection();
        connection.release();
      //  console.log('Database initialized');
    } catch (error) {
        console.error('Database initialization failed:', error);
    }
}

initializeDatabase();

forumRouter.get('/topics/:id', async (req, res) => {
  const postId = req.params.id;
  try {
       // Increment view count
        await pool.execute(
            'UPDATE forum_posts SET views = views + 1 WHERE id = ?',
            [postId]
        );
    const [[post]] = await pool.query(`
      SELECT fp.*, CONCAT(u.first_name, ' ', u.last_name) AS author_name
      FROM forum_posts fp
      JOIN users u ON u.id = fp.user_id
      WHERE fp.id = ?
    `, [postId]);
    
    res.json(post);
  } catch (err) {
    res.status(500).json({ message: "Failed to load post" });
  }
});

forumRouter.post('/topics', async (req, res) => {
  const { title, content, categoryId, userId } = req.body; 
  try {
    const [category1] = await pool.execute(`
      SELECT name FROM forum_categories WHERE id = ?
      `, [categoryId]);
      const category = category1[0].name;
    await pool.query("INSERT INTO forum_posts (user_id, title, content, category) VALUES (?, ?, ?, ?)", [userId, title, content, category]);
    res.json({ message: "Post created" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create post" });
  }
});

forumRouter.get('/topics/:id/replies', async (req, res) => {
  const postId = req.params.id;
  try {
    const [rows] = await pool.query(`
      SELECT fr.*, CONCAT(u.first_name, ' ', u.last_name) AS author_name
      FROM forum_replies fr
      JOIN users u ON u.id = fr.user_id
      WHERE fr.post_id = ?
      ORDER BY fr.created_at ASC
    `, [postId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Failed to load replies" });
  }
});

forumRouter.get('/delete-post', async (req, res) => {
  const postId = req.params.id;
  try {
    await pool.query("DELETE FROM forum_posts WHERE id = ?", [postId]);
    res.json({ message: "Post deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete post" });
  }
});

forumRouter.get('/delete-reply', async (req, res) => {
  const replyId = req.params.id;
  try {
    await pool.query("DELETE FROM forum_replies WHERE id = ?", [replyId]);
    res.json({ message: "Reply deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete reply" });
  }
});

forumRouter.post('/replies/:id/best', async (req, res) => {
  const replyId = req.params.id;

  await pool.query(
    "UPDATE forum_replies SET is_best_answer = FALSE WHERE post_id = (SELECT post_id FROM forum_replies WHERE id = ?)",
    [replyId]
  );

  await pool.query(
    "UPDATE forum_replies SET is_best_answer = TRUE WHERE id = ?",
    [replyId]
  );

  res.json({ message: "Best answer marked" });
});

forumRouter.post('/replies/:id/like', async (req, res) => {
  const replyId = req.params.id;
  await pool.query(
    "UPDATE forum_replies SET likes = likes + 1 WHERE id = ?",
    [replyId]
  );
  res.json({ message: "Liked" });
});

forumRouter.post('/topics/:id/replies', async (req, res) => {
  const postId = req.params.id;
  const { content, userId } = req.body;
try{
  await pool.query(
    "INSERT INTO forum_replies (post_id, user_id, content) VALUES (?, ?, ?)",
    [postId, userId, content]
  );

  const [[post]] = await pool.query(
    "SELECT user_id FROM forum_posts WHERE id = ?",
    [postId]
  );

  if (post.user_id !== userId) {
    await pool.query(
      "INSERT INTO notifications (user_id, message, link) VALUES (?, ?, ?)",
      [
        post.user_id,
        "Someone replied to your forum post",
        `/forum-post.html?id=${postId}`,
      ]
    );
  }

  res.json({ message: "Reply added" });
}catch(error){
  console.log(error);
  res.json("Could not post reply, please try again")
}
});

forumRouter.post('/notifications', async (req, res) => {
  const { userId }  = req.body;
  const [rows] = await pool.query(
    "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC",
    [userId]
  );
  res.json(rows);
});

forumRouter.get('/topics', async (req, res) => {
  const { search, sort, category } = req.query;

  let sql = `
    SELECT fp.*, fc.name category_name, fc.icon,
    COUNT(fr.id) reply_count
    FROM forum_posts fp
    JOIN forum_categories fc ON fc.id = fp.category
    LEFT JOIN forum_replies fr ON fr.post_id = fp.id
  `;
  const params = [];

  if (category || search) {
    sql += " WHERE ";
    if (category) {
      sql += "fc.slug = ?";
      params.push(category);
    }
    if (search) {
      if (params.length) sql += " AND ";
      sql += "fp.title LIKE ?";
      params.push(`%${search}%`);
    }
  }

  sql += `
    GROUP BY fp.id
    ORDER BY
      ${sort === "popular" ? "reply_count DESC" :
        sort === "unanswered" ? "reply_count ASC" :
        "fp.created_at DESC"}
  `;

  const [topics] = await pool.query(sql, params);
  res.json(topics);
});

forumRouter.get('/categories', async (req, res) => {
    try {
        const [categories] = await pool.execute(`
            SELECT fc.*, 
                   COUNT(ft.id) as topic_count
            FROM forum_categories fc
            LEFT JOIN forum_posts ft ON fc.name = ft.category AND fc.is_active = TRUE
            WHERE fc.is_active = TRUE
            GROUP BY fc.id
            ORDER BY fc.sort_order, fc.name
        `);

        res.json(categories);
    } catch (error) {
        console.error('Get forum categories error:', error);
        res.status(500).json({ message: 'Failed to load forum categories' });
    }
});

forumRouter.get('/stats', async (req, res) => {
  const [[topics]] = await pool.query("SELECT COUNT(*) total FROM forum_posts");
  const [[users]] = await pool.query("SELECT COUNT(DISTINCT user_id) total FROM forum_posts");
  const [[replies]] = await pool.query("SELECT COUNT(*) total FROM forum_replies");
  const [[solved]] = await pool.query("SELECT COUNT(*) total FROM forum_posts WHERE solved = TRUE");

  res.json({
    totalTopics: topics.total,
    totalUsers: users.total,
    totalReplies: replies.total,
    solvedTopics: solved.total
  });
});

forumRouter.get('/topics/:topicId', async (req, res) => {
    try {
        const topicId = req.params.topicId;

        // Increment view count
        await pool.execute(
            'UPDATE forum_topics SET views_count = views_count + 1 WHERE id = ?',
            [topicId]
        );

        // Get topic details
        const [topics] = await pool.execute(`
            SELECT ft.*,
                   u.first_name, u.last_name, u.profile_picture, u.bio,
                   fc.name as category_name, fc.slug as category_slug,
                   (SELECT COUNT(*) FROM forum_subscriptions WHERE topic_id = ft.id) as subscribers_count
            FROM forum_topics ft
            JOIN users u ON ft.user_id = u.id
            JOIN forum_categories fc ON ft.category_id = fc.id
            WHERE ft.id = ?
        `, [topicId]);

        if (topics.length === 0) {
            return res.status(404).json({ message: 'Topic not found' });
        }

        // Get replies
        const [replies] = await pool.execute(`
             SELECT fr.*,
                   u.first_name, u.last_name, u.profile_picture
            FROM forum_replies fr
            JOIN users u ON fr.user_id = u.id
            WHERE fr.post_id = ?
            ORDER BY fr.is_best_answer DESC, fr.created_at ASC
     `, [topicId]);

    
        res.json({
            topic: topics[0],
            replies: replies.map(reply => ({
                ...reply
            }))
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
        const [topics] = await pool.execute(`
         SELECT ft.*, u.first_name, u.last_name, u.profile_picture,
                   fc.name as category_name, fc.slug as category_slug
            FROM forum_posts ft
            JOIN users u ON ft.user_id = u.id
            JOIN forum_categories fc ON ft.category = fc.name
            WHERE u.id = ?
        ORDER BY ft.created_at DESC
            LIMIT 10
                `, [userId]);

        const [replies] = await pool.execute(`
                SELECT fr.*, ft.title as topic_title
            FROM forum_replies fr
            JOIN forum_posts ft ON fr.post_id = ft.id
            WHERE fr.user_id = ?
            ORDER BY fr.created_at DESC
            LIMIT 10
    `, [userId]);

        res.json({ topics, replies });
    } catch (error) {
        console.error('Get user activity error:', error);
        res.status(500).json({ message: 'Failed to get user activity' });
    }
});
export default forumRouter;