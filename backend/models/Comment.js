import "../config/db.js";

class Comment {
  static async create({ streamId, userId, userName, message }) {
    await pool.query(
      'INSERT INTO comments (stream_id, user_id, user_name, message) VALUES (?, ?, ?, ?)',
      [streamId, userId, userName, message]
    );
  }

  static async getByStreamId(streamId) {
    const [rows] = await pool.query(
      'SELECT * FROM comments WHERE stream_id = ? ORDER BY created_at',
      [streamId]
    );
    return rows;
  }
}

export default Comment;