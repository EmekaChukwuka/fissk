import express from "express";
import multer from "multer";
import Stream from "../models/Stream.js";
import Comment from "../models/Comment.js";
import fs from 'fs';
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

const router = express.Router();

import path from "path";

const fileFilter = (req, file, cb) => {
  if(file.mimetype==='video/webm'){
    cb(null, true);
  }else{
    cb(new Error('Invalid file type, only webm is allowed!'),false);
  }
};

const storage = multer.diskStorage({ destination: 'uploads/', filename: function(req, file, cb) {
  cb(null, file.originalname);}});
const upload = multer({
   storage: storage,
   limits: {fileSize: 100000000}
  });

// Save recorded livestream
router.post('/save-stream', upload.single('video'), async (req, res) => {
  try {
    const { userId, streamName, streamClass, classTitle, classDescription, participants, duration} = req.body;
    const { filename, size} = req.file;

    const streamId = await Stream.create({
      userId,
      name: streamName,
      filename,
      size,
      streamClass,
      classTitle,
      classDescription,
      participants,
      duration
    });

    res.json({
      success: true,
      streamId,
      filename,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Get past streams
router.get('/past-streams', async (req, res) => {
  try {
    const streams = await Stream.getAll();
    res.json({ success: true, streams });
    
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get stream comments
router.get('/stream-comments', async (req, res) => {
  try {
    const { streamId } = req.query;
    if (!streamId) throw new Error('Stream ID required');

    const comments = await Comment.getByStreamId(streamId);
    res.json({ success: true, comments });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Add comment
router.post('/add-comment', async (req, res) => {
  try {
    const { streamId, userId, userName, message } = req.body;
    if (!streamId || !userId || !userName || !message) {
      throw new Error('Missing required fields');
    }

    await Comment.create({ streamId, userId, userName, message });
    res.json({ success: true, message: 'Comment added' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/get-offer', async (req, res) => {
  const offer = 'rtc';
  res.json({ type : offer, offer: 'success'});
});

router.post('/send-message-to-server', async (req, res) => {

});

// Get Videos by Filename Pattern
router.get('/by-class/:classId', async (req, res) => {
    try {
        const classId = req.params.classId;
        
        // Get class info to determine naming pattern
      const [classes] = await pool.execute(
            'SELECT * FROM classes WHERE id = ?',
            [classId]
        );
        
        const [sessions] = await pool.execute(
            'SELECT * FROM live_sessions WHERE class_id = ? AND session_type="recorded" ORDER BY id ASC',
            [classId]
        );
      // console.log(videoDetails)
        if (classes.length === 0) {
            return res.status(404).json({ message: 'Class not found' });
        }

        const classInfo = classes[0];
        const classPattern = classInfo.title;

        // Read uploads directory
        const uploadsDir = 'uploads/';
        const files = fs.readdirSync(uploadsDir);
        
        // Filter files that match the class pattern
        const classVideos = files.filter(file => {
            return file.startsWith(`${classPattern}_`) && file.endsWith('.webm');
        }).map(file => {
            const filePath = path.join(uploadsDir, file);
            const stats = fs.statSync(filePath);
          
                const matchedSession = sessions.find(s =>
                    file.toLowerCase().includes(s.title.toLowerCase())
                );
                const videoDetails = matchedSession || videoDetails[0]; // safe fallback
            return {
                filename: file,
                url: `/uploads/${file}`,
                uploadDate: stats.mtime,
                size: stats.size,
                classTitle: classInfo.title,
                category: classInfo.category,
                videoDetails
            };
        }).sort((a, b) => new Date(a.uploadDate) - new Date(b.uploadDate));

        if(!classVideos){
          res.json("No class videos available");
        }

      //  console.log(classVideos)
        res.json(classVideos);
    } catch (error) {
        console.error('Get videos by class error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

export default router;