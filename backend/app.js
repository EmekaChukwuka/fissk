import express from "express";
import cors from "cors";
import http from "http";
import bodyParser from "body-parser";
import router from "./routes/api.js";
import forumRouter from "./routes/forum.js";
import Regisrouter from "./registration/server.js";
import Dashboardrouter from "./routes/dashboard.js";
import connectDB from "./config/db.js";
import path from 'path';
import { fileURLToPath } from 'url';
import { AccessToken } from 'livekit-server-sdk';
import LiveSession from './models/LiveSession.js'; // Import LiveSession model

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// ===== MIDDLEWARE =====
app.use(cors());
app.use(bodyParser.json());
app.use('/uploads', express.static('uploads'));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, '../public')));
app.use('/api', router);
app.use('/forum-api', forumRouter);
app.use('/users', Dashboardrouter);
app.use('/register', Regisrouter);

// ===== LIVEKIT CONFIGURATION =====
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_WS_URL = process.env.LIVEKIT_URL;

// Track active LiveKit rooms (for backward compatibility)
let activeLiveKitRooms = new Map();

// ===== LIVEKIT ENDPOINTS =====

// Generate token for LiveKit
app.post('/api/livekit/token', async (req, res) => {
    const { roomName, participantName, isHost } = req.body;
    
    if (!roomName || !participantName) {
        return res.status(400).json({ error: 'Missing roomName or participantName' });
    }
    
    try {
        const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
            identity: participantName,
            ttl: '6h',
            name: participantName,
        });
        
        at.addGrant({
            roomJoin: true,
            room: roomName,
            canPublish: isHost,
            canSubscribe: true,
        });
        
        const token = await at.toJwt();

        res.json({
            token: token,
            url: LIVEKIT_WS_URL,
        });
    } catch (err) {
        console.error('Token generation error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Start LiveKit session
app.post('/api/livekit/start-session', (req, res) => {
    const { roomName, title, description, classId, userId } = req.body;
    
    activeLiveKitRooms.set(roomName, {
        hostId: userId,
        title,
        description,
        classId,
        startTime: Date.now(),
        participants: new Set()
    });
    
    res.json({ success: true, roomName });
});

// End LiveKit session
app.post('/api/livekit/end-session', (req, res) => {
    const { roomName } = req.body;
    activeLiveKitRooms.delete(roomName);
    res.json({ success: true });
});

// Get active stream info
app.get('/api/active-stream', (req, res) => {
    const activeRooms = Array.from(activeLiveKitRooms.entries()).map(([name, data]) => ({
        roomName: name,
        title: data.title,
        classId: data.classId,
        startTime: data.startTime
    }));
    
    res.json({
        isActive: activeLiveKitRooms.size > 0,
        streams: activeRooms
    });
});

// Stream status endpoint
app.get('/api/stream-status', (req, res) => {
    res.json({ active: activeLiveKitRooms.size > 0 });
});

// ===== NEW: MEETING ID ENDPOINTS =====

// ===== CREATE LIVESTREAM SESSION =====
app.post('/api/livekit/create-session', async (req, res) => {
  const { instructorId, classId, title, description, date, time, duration } = req.body;
  
  try {
    // Check if instructor already has a live session at this time
    const existing = await LiveSession.findOne({
      instructorId,
      streamStatus: 'scheduled',
      date: new Date(date)
    });
    
    if (existing) {
      return res.status(409).json({ 
        success: false, 
        message: 'You already have a session scheduled at this time' 
      });
    }
    
    // Create new session - meetingId will be auto-generated
    const session = new LiveSession({
      instructorId,
      classId,
      title,
      description,
      date: new Date(date),
      time: time || new Date().toLocaleTimeString(),
      duration: duration || '60 minutes',
      sessionType: 'upcoming',
      streamStatus: 'scheduled'
    });
    
    await session.save();
    
    console.log(`✅ Session created with meetingId: ${session.meetingId}`);
    
    res.json({
      success: true,
      session: {
        id: session._id,
        meetingId: session.meetingId,
        livekitRoomName: session.livekitRoomName,
        joinUrl: session.joinUrl,
        title: session.title,
        date: session.date,
        time: session.time
      }
    });
  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// START LIVESTREAM (Host joins)
app.post('/api/livekit/start-stream', async (req, res) => {
  const { meetingId, userId } = req.body;
  
  try {
    const session = await LiveSession.findOne({ meetingId });
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    
    // Check if it's the instructor
    if (session.instructorId.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Only the instructor can start this stream' });
    }
    
    // Update session status
    session.streamStatus = 'live';
    session.hostConnected = true;
    session.hostConnectionTime = new Date();
    await session.save();
    
    res.json({
      success: true,
      meetingId: session.meetingId,
      livekitRoomName: session.livekitRoomName,
      sessionId: session._id
    });
  } catch (error) {
    console.error('Start stream error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// END LIVESTREAM 
app.post('/api/livekit/end-stream', async (req, res) => {
  const { meetingId } = req.body;
  
  try {
    const session = await LiveSession.findOne({ meetingId });
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    
    // ===== FIX: Update both streamStatus and sessionType =====
    session.streamStatus = 'ended';
    session.sessionType = 'recorded';   // ← THIS WAS MISSING
    session.hostConnected = false;
    session.recordingEndedAt = new Date();
    
    await session.save();
    
    console.log(`✅ Stream ended: ${meetingId}, sessionType set to recorded`);
    
    res.json({ success: true });
  } catch (error) {
    console.error('End stream error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// JOIN LIVESTREAM (Student joins)
app.post('/api/livekit/join-stream', async (req, res) => {
  const { meetingId, userId, userName } = req.body;
  
  try {
    const session = await LiveSession.findOne({ meetingId });
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    
    // Check if stream is live
    if (session.streamStatus !== 'live') {
      return res.status(400).json({ 
        success: false, 
        message: 'This stream is not currently live',
        status: session.streamStatus 
      });
    }
    
    // Check if user already joined
    const existingParticipant = session.activeParticipants.find(
      p => p.userId === userId && p.isStillActive === true
    );
    
    if (!existingParticipant) {
      // Add participant
      session.activeParticipants.push({
        userId,
        userName: userName || 'Student',
        joinedAt: new Date(),
        isStillActive: true
      });
      session.participants += 1;
      await session.save();
    }
    
    res.json({
      success: true,
      meetingId: session.meetingId,
      livekitRoomName: session.livekitRoomName,
      sessionId: session._id
    });
  } catch (error) {
    console.error('Join stream error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== GET SESSION BY MEETING ID (FIXED) =====
app.get('/api/livekit/session/:meetingId', async (req, res) => {
  const { meetingId } = req.params;
  
  try {
    // Find session by meetingId
    const session = await LiveSession.findOne({ meetingId })
      .populate('instructorId', 'firstName lastName email')
      .populate('classId', 'title description');
    
    if (!session) {
      return res.status(404).json({ 
        success: false, 
        message: 'Session not found' 
      });
    }
    
    res.json({
      success: true,
      session: {
        id: session._id,
        meetingId: session.meetingId,
        livekitRoomName: session.livekitRoomName,
        title: session.title,
        description: session.description,
        instructor: session.instructorId ? `${session.instructorId.firstName} ${session.instructorId.lastName}` : 'Unknown',
        classTitle: session.classId?.title || 'Unknown',
        date: session.date,
        time: session.time,
        duration: session.duration,
        streamStatus: session.streamStatus,
        participants: session.participants || 0,
        hostConnected: session.hostConnected || false,
        joinUrl: session.joinUrl
      }
    });
    
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET ACTIVE SESSION FOR A CLASS
app.get('/api/livekit/class/:classId/active-session', async (req, res) => {
  const { classId } = req.params;
  
  try {
    const session = await LiveSession.findOne({
      classId,
      streamStatus: 'live',
      hostConnected: true
    }).sort({ createdAt: -1 });
    
    if (!session) {
      return res.json({ success: true, active: false });
    }
    
    res.json({
      success: true,
      active: true,
      meetingId: session.meetingId,
      title: session.title,
      sessionId: session._id,
      joinUrl: session.joinUrl
    });
  } catch (error) {
    console.error('Get active session error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== MEETING LINK ENDPOINTS =====

// Get meeting ID for a stream
app.get('/api/livekit/session/meeting/:streamId', async (req, res) => {
  const { streamId } = req.params;
  
  try {
    // First try to find by classId (since streamId might be classId)
    const session = await LiveSession.findOne({ 
      classId: streamId,
      streamStatus: 'scheduled'
    }).sort({ createdAt: -1 });
    
    if (session && session.meetingId) {
      return res.json({
        success: true,
        meetingId: session.meetingId,
        title: session.title,
        date: session.date,
        time: session.time,
        joinUrl: session.joinUrl
      });
    }
    
    // If not found by classId, try by _id
    const sessionById = await LiveSession.findById(streamId);
    if (sessionById && sessionById.meetingId) {
      return res.json({
        success: true,
        meetingId: sessionById.meetingId,
        title: sessionById.title,
        date: sessionById.date,
        time: sessionById.time,
        joinUrl: sessionById.joinUrl
      });
    }
    
    res.json({
      success: false,
      message: 'No meeting found for this stream'
    });
    
  } catch (error) {
    console.error('Get meeting error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===== CREATE MEETING FOR A STREAM =====
app.post('/api/livekit/session/create-meeting', async (req, res) => {
  const { instructorId, classId, title, description, date, time, duration } = req.body;
  
  try {
    // Check if there's already a meeting for this class
    const existing = await LiveSession.findOne({
      classId,
      streamStatus: 'scheduled',
      hostConnected: false
    }).sort({ createdAt: -1 });
    
    if (existing && existing.meetingId) {
      return res.json({
        success: true,
        session: {
          id: existing._id,
          meetingId: existing.meetingId,
          livekitRoomName: existing.livekitRoomName,
          joinUrl: existing.joinUrl,
          title: existing.title
        },
        message: 'Existing meeting found'
      });
    }
    
    // Create new meeting session - meetingId will be auto-generated
    const session = new LiveSession({
      instructorId,
      classId,
      title: title || 'Live Class',
      description: description || '',
      date: date || new Date(),
      time: time || new Date().toLocaleTimeString(),
      duration: duration || '60 minutes',
      sessionType: 'upcoming',
      streamStatus: 'scheduled'
    });
    
    await session.save();
    
    console.log(`✅ Meeting created: ${session.meetingId} for class ${classId}`);
    
    res.json({
      success: true,
      session: {
        id: session._id,
        meetingId: session.meetingId,
        livekitRoomName: session.livekitRoomName,
        joinUrl: session.joinUrl,
        title: session.title,
        date: session.date,
        time: session.time
      }
    });
    
  } catch (error) {
    console.error('Create meeting error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all scheduled meetings for an instructor
app.get('/api/livekit/instructor/meetings/:instructorId', async (req, res) => {
  const { instructorId } = req.params;
  
  try {
    const meetings = await LiveSession.find({
      instructorId,
      streamStatus: 'scheduled',
      hostConnected: false
    })
      .populate('classId', 'title')
      .sort({ date: 1, time: 1 })
      .lean();
    
    const formattedMeetings = meetings.map(m => ({
      id: m._id,
      meetingId: m.meetingId,
      livekitRoomName: m.livekitRoomName,
      title: m.title,
      description: m.description,
      classTitle: m.classId?.title || 'Unknown',
      date: m.date,
      time: m.time,
      duration: m.duration,
      joinUrl: m.joinUrl,
      participants: m.participants || 0
    }));
    
    res.json({
      success: true,
      meetings: formattedMeetings,
      count: formattedMeetings.length
    });
    
  } catch (error) {
    console.error('Get instructor meetings error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update existing endpoint to include meeting info
// Modify your existing /register/instructor/streams endpoint
// In server.js or registration/server.js

// This is a modified version of the existing streams endpoint
app.post('/register/instructor/streams-with-meetings', async (req, res) => {
  const instructorId = req.body.id;
  
  try {
    // Get past streams (recorded)
    const pastStreamsData = await LiveSession.find({
      instructorId,
      streamStatus: 'ended'
    })
      .populate('classId', 'title')
      .sort({ date: -1, time: -1 })
      .lean();
    
    const pastStreams = pastStreamsData.map(r => ({
      id: r._id,
      title: r.title,
      description: r.description,
      class_title: r.classId?.title || 'Unknown',
      duration: r.duration,
      participants: r.participants,
      recorded_at: `${r.date || ''} ${r.time || ''}`,
      class_id: r.classId?._id,
      recordingUrl: r.playbackUrl || null
    }));
    
    // Get scheduled streams (upcoming)
    const scheduledStreamsData = await LiveSession.find({
      instructorId,
      streamStatus: 'scheduled'
    })
      .populate('classId', 'title')
      .sort({ date: 1, time: 1 })
      .lean();
    
    const scheduledStreams = scheduledStreamsData.map(s => ({
      id: s._id,
      title: s.title,
      description: s.description,
      scheduled_time: `${s.date || ''} ${s.time || ''}`,
      meetingId: s.meetingId || null,
      joinUrl: s.joinUrl || null,
      classId: s.classId?._id || null,
      participants: s.participants || 0
    }));
    
    res.json({
      past: pastStreams,
      scheduled: scheduledStreams
    });
    
  } catch (error) {
    console.error('Get streams error:', error);
    res.status(500).json({ message: "Failed to load streams" });
  }
});

// ===== ORIGINAL ROUTES =====
app.get('/live/stream-info', (req, res) => {
    res.json({ isActive: activeLiveKitRooms.size > 0 });
});

app.get('/live/chat-history', (req, res) => {
    res.json({ messages: [] });
});

// ===== START SERVER =====
const PORT = process.env.PORT || 3000;
connectDB();

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`LiveKit configured with URL: ${LIVEKIT_WS_URL}`);
});