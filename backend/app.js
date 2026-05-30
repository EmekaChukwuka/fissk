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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// ===== MIDDLEWARE (Your original) =====
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
const LIVEKIT_WS_URL = process.env.LIVEKIT_WS_URL || 'wss://your-project.livekit.cloud';

// Track active LiveKit rooms
let activeLiveKitRooms = new Map();

// ===== LIVEKIT ENDPOINTS =====

// Generate token for LiveKit
app.post('/api/livekit/token', (req, res) => {
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
            roomPublish: isHost,
            roomSubscribe: true,
            canPublish: isHost,
            canSubscribe: true,
        });
        
        res.json({
            token: at.toJwt(),
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

// ===== ORIGINAL ROUTES (Keep these - they're your existing ones) =====
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