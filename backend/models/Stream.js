
import mysql from "mysql2/promise";


const pool = mysql.createPool({
  host: '127.0.0.1',
  user: 'root',
  password: '',
  database: 'fissk_online_academy',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

class Stream {
  static async create({ userId, name, filename, size, streamClass, classTitle, classDescription, participants, duration }) {
    const [result] = await pool.query(
      'INSERT INTO streams (user_id, name, filename, size) VALUES (?, ?, ?, ?)',
      [userId, name, filename, size]
    );
    const time = new Date();
    const time2 = Date.now();
    const today = time.getFullYear()+'-'+(time.getMonth() + 1)+'-'+time.getDate();
    console.log(today);
    console.log(streamClass);
    const [result2] = await pool.query(
      'INSERT INTO live_sessions (instructor_id, title, description, date, time, duration, participants, session_type, class_id) VALUES (?, ?, ?, ?, NOW(), ?, ?, ?, ?)',
      [userId, classTitle, classDescription, today, duration, participants, 'recorded', streamClass]
    );
    return result.insertId;
  }

  static async getAll() {
    const [rows] = await pool.query('SELECT * FROM streams ORDER BY created_at DESC');
    return rows;
  }
}

export default Stream;