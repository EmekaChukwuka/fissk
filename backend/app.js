import express from "express";
import cors from "cors";
import http from "http";
import bodyParser from "body-parser";
import router from "./routes/api.js";
import forumRouter from "./routes/forum.js";
import Regisrouter from "./registration/server.js";
import Dashboardrouter from "./routes/dashboard.js";
import connectDB from "./config/db.js";
const app = express();
const server = http.createServer(app);
import path from 'path';
import { fileURLToPath } from 'url';

//dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🔥 Serve uploads folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, '../public')));



// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use('/uploads', express.static('uploads'));
app.use(express.json());
app.use('/api',router);
app.use('/forum-api',forumRouter);
app.use('/users',Dashboardrouter);
app.use('/register',Regisrouter);

// WebSocket
import {WebSocketServer} from 'ws';

const wss = new WebSocketServer({server});

let streamActive = false;
let host = null;
const viewers = new Map();
const activeStreams = new Map();
let chatHistory = [];

wss.on('connection', (ws) => {
    ws.on('message', (message) => handleMessage(ws, message));
    ws.on('close', () => handleClose(ws));
    
    // Send current stream status to new connection
    ws.send(JSON.stringify({
        type: 'stream_status',
        active: streamActive
    }));
});

function handleMessage(ws, message) {
    const data = JSON.parse(message);
    console.log('SIGNAL RECV:', data);

    // required fields: data.type, data.userId (sender)
    switch (data.type) {
        case 'register_host':
            host = ws;
            ws.userId = data.userId;
            ws.isHost = true;
            streamActive = true;
            activeStreams.set(data.userId, {
                hostId: data.userId,
                startTime: Date.now()
            });

            // Notify all clients that stream has started
            broadcast({ type: 'stream_status', active: true });
            broadcast({ type: 'stream_started', hostId: data.userId });
            break;

        case 'register_viewer':
            ws.userId = data.userId;
            ws.userName = data.userName;
            ws.isHost = false;
            viewers.set(data.userId, {
                id: data.userId,
                name: data.userName,
                ws
            });
            broadcastViewerList();
            break;

        // Viewer -> Host (offer). Host -> Viewer (answer)
        case 'offer':
            // Expect: { type:'offer', userId: <viewerId>, offer: {...} }
            if (host && !ws.isHost) {
                // forward viewer offer to host, include sender id
                host.send(JSON.stringify({
                    type: 'offer',
                    userId: data.userId,    // viewer id (sender)
                    offer: data.offer
                }));
            } else {
                // If (unexpectedly) host sends an offer, forward only to the intended target (if any)
                if (data.targetId) {
                    const target = viewers.get(data.targetId);
                    if (target) {
                        target.ws.send(JSON.stringify({
                            type: 'offer',
                            userId: data.userId,   // host id
                            targetId: data.targetId,
                            offer: data.offer
                        }));
                    }
                }
            }
            break;

        case 'answer':
            // Expect: { type:'answer', userId: <hostId>, targetId: <viewerId>, answer: {...} }
            if (data.targetId) {
                const targetViewer = viewers.get(data.targetId);
                if (targetViewer) {
                    targetViewer.ws.send(JSON.stringify({
                        type: 'answer',
                        userId: data.userId,    // answerer (host)
                        targetId: data.targetId,
                        answer: data.answer
                    }));
                }
            } else {
                // fallback: if host wasn't providing targetId, send to all viewers (not recommended)
                viewers.forEach((v) => {
                    v.ws.send(JSON.stringify({
                        type: 'answer',
                        userId: data.userId,
                        answer: data.answer
                    }));
                });
            }
            break;

        case 'ice_candidate':
            // Expect shapes:
            // Viewer -> Host: { type:'ice_candidate', userId: <viewerId>, candidate: {...}, targetId: <hostId?> }
            // Host -> Viewer: { type:'ice_candidate', userId: <hostId>, candidate: {...}, targetId: <viewerId> }
            if (data.targetId) {
                // route directly to the target
                if (data.targetId === host?.userId) {
                    // to host
                    if (host && host.readyState === WebSocket.OPEN) {
                        host.send(JSON.stringify({
                            type: 'ice_candidate',
                            userId: data.userId,
                            targetId: data.targetId,
                            candidate: data.candidate
                        }));
                    }
                } else {
                    // to a viewer
                    const targetViewer = viewers.get(data.targetId);
                    if (targetViewer && targetViewer.ws.readyState === WebSocket.OPEN) {
                        targetViewer.ws.send(JSON.stringify({
                            type: 'ice_candidate',
                            userId: data.userId,
                            targetId: data.targetId,
                            candidate: data.candidate
                        }));
                    }
                }
            } else {
                // No explicit targetId: if sender is viewer -> send to host; if sender is host -> broadcast to viewers
                if (ws.isHost) {
                    viewers.forEach((v) => {
                        if (v.ws.readyState === WebSocket.OPEN) {
                            v.ws.send(JSON.stringify({
                                type: 'ice_candidate',
                                userId: data.userId,
                                candidate: data.candidate
                            }));
                        }
                    });
                } else {
                    if (host && host.readyState === WebSocket.OPEN) {
                        host.send(JSON.stringify({
                            type: 'ice_candidate',
                            userId: data.userId,
                            candidate: data.candidate
                        }));
                    }
                }
            }
            break;

        case 'chat_message':
            const chatMsg = { ...data, timestamp: new Date().toISOString() };
            chatHistory.push(chatMsg);
            broadcast(chatMsg);
            break;

        case 'join_stream':
            if (host && streamActive) {
                ws.userId = data.userId;
                ws.userName = data.userName;
                viewers.set(data.userId, {
                    id: data.userId,
                    name: data.userName,
                    ws
                });
                broadcastViewerList();
                host.send(JSON.stringify({
                    type: 'viewer_joined',
                    userId: data.userId,
                    userName: data.userName
                }));
            }
            break;

        case 'stream_ended':
            if (ws.isHost) {
                streamActive = false;
                activeStreams.delete(ws.userId);
                broadcast({ type: 'stream_ended' });
                broadcast({ type: 'stream_status', active: false });
                viewers.clear();
                chatHistory = [];
            }
            break;

        case 'request_viewer_list':
            broadcastViewerList();
            break;

        case 'request_stream_status':
            ws.send(JSON.stringify({ type: 'stream_status', active: streamActive }));
            break;

        default:
            console.warn('Unknown message type:', data.type);
            break;
    }
}


function handleClose(ws) {
    if (ws.isHost) {
        // Host disconnected
        streamActive = false;
        activeStreams.delete(ws.userId);
        broadcast({
            type: 'stream_ended'
        });
        broadcast({
            type: 'stream_status',
            active: false
        });
        host = null;
        viewers.clear();
    } else if (ws.userId && viewers.has(ws.userId)) {
        // Viewer disconnected
        viewers.delete(ws.userId);
        broadcastViewerList();
        
        // Notify host about viewer leaving
        if (host) {
            host.send(JSON.stringify({
                type: 'viewer_left',
                userId: ws.userId
            }));
        }
    }
}

function broadcast(message) {
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    });
}

function broadcastViewerList() {
    const viewersList = Array.from(viewers.values()).map((v) => ({
        id: v.id,
        name: v.name,
    }));

    broadcast({
        type: 'viewer_list',
        viewers: viewersList,
    });
}

// HTTP endpoints
app.get('/live/stream-info', (req, res) => {
    if (host && streamActive) {
        const stream = activeStreams.get(host.userId);
        res.json({ 
            isActive: true,
            hostId: host.userId,
            duration: Math.floor((Date.now() - stream.startTime) / 1000)
        });
    } else {
        res.json({ isActive: false });
    }
});

app.get('/live/chat-history', (req, res) => {
    res.json({ messages: chatHistory });
});

app.get('/api/stream-status', (req, res) => {
    res.json({ active: streamActive });
});

// Start server
const PORT = process.env.PORT || 3000;
// Connect to MongoDB
connectDB();

server.listen(PORT, () => {
    console