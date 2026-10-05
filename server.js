const path = require('path');
const http = require('http');
require('dotenv').config();

const express = require('express');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

const db = require('./db');
const authRoutes = require('./routes/auth');
const { authenticateSocket } = require('./auth/auth');

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---- REST API ----
app.use('/api', authRoutes);

// ---- Socket.IO ----
const online = new Set();
const userSockets = new Map(); // userId -> Set<socketId>

io.use(authenticateSocket);

io.on('connection', (socket) => {
  const userId = socket.data.userId;
  console.log(`[utopia] user ${userId} connected`);

  // auto-join every room this user belongs to
  db.userRooms(userId).forEach((r) => socket.join(String(r.id)));
  online.add(userId);
  if (!userSockets.has(userId)) userSockets.set(userId, new Set());
  userSockets.get(userId).add(socket.id);
  broadcastPresence();

  socket.on('chat message', ({ roomId, text }) => {
    if (!text || !roomId) return;
    const trimmed = String(text).slice(0, 4000);
    if (!db.isMember(roomId, userId)) return;
    const msg = db.saveMessage(roomId, userId, trimmed);
    // deliver to every current member's sockets (covers rooms joined late, e.g. new DMs)
    for (const m of db.roomMembers(roomId)) {
      const sids = userSockets.get(m.id);
      if (sids) for (const sid of sids) io.to(sid).emit('chat message', msg);
    }
  });

  socket.on('typing', ({ roomId }) => {
    if (!roomId || !db.isMember(roomId, userId)) return;
    socket.to(String(roomId)).emit('typing', { roomId, userId, username: socket.data.username });
  });

  socket.on('disconnect', () => {
    console.log(`[utopia] user ${userId} disconnected`);
    online.delete(userId);
    const sids = userSockets.get(userId);
    if (sids) { sids.delete(socket.id); if (!sids.size) userSockets.delete(userId); }
    broadcastPresence();
  });
});

function broadcastPresence() {
  io.emit('presence', [...online]);
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

server.listen(PORT, () => {
  console.log(`💬 Utopia is live on http://localhost:${PORT}`);
});
