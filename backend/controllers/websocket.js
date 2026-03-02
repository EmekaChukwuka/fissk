import WebSocket from 'ws';
class WebSocketServer {
  constructor(server) {
    this.wss = new WebSocket.Server({server});
    this.host = null;
    this.viewers = new Map();

    this.wss.on('connection', (ws) => {
      ws.on('message', (message) => this.handleMessage(ws, message));
      ws.on('close', () => this.handleClose(ws));
    });
  }

  handleMessage(ws, message) {
    const data = JSON.parse(message);

    switch (data.type) {
      case 'register_host':
        this.host = ws;
        ws.userId = data.userId;
        break;

      case 'register_viewer':
        ws.userId = data.userId;
        ws.userName = data.userName;
        this.viewers.set(data.userId, { id: data.userId, name: data.userName, ws });
        this.broadcastViewerList();
        break;

      case 'offer':
        if (this.host) this.host.send(message);
        break;

      case 'answer':
        const viewer = this.viewers.get(data.userId);
        if (viewer) viewer.ws.send(message);
        break;

      case 'ice_candidate':
        if (data.userId === this.host?.userId) {
          // Host → All viewers
          this.viewers.forEach((viewer) => viewer.ws.send(message));
        } else {
          // Viewer → Host
          if (this.host) this.host.send(message);
        }
        break;

      case 'chat_message':
        this.broadcast(message);
        break;

      case 'stream_ended':
        this.broadcast({ type: 'stream_ended' });
        this.viewers.clear();
        break;
    }
  }

  handleClose(ws) {
    if (this.host === ws) {
      this.broadcast({ type: 'stream_ended' });
      this.host = null;
      this.viewers.clear();
    } else if (ws.userId && this.viewers.has(ws.userId)) {
      this.viewers.delete(ws.userId);
      this.broadcastViewerList();
    }
  }

  broadcast(message) {
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }

  broadcastViewerList() {
    const viewersList = Array.from(this.viewers.values()).map((v) => ({
      id: v.id,
      name: v.name,
    }));

    this.broadcast({
      type: 'viewer_list',
      viewers: viewersList,
    });
  }
}

export default WebSocketServer;