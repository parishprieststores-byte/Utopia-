const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

const db = new Database(path.join(dataDir, 'utopia.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  is_dm INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS room_members (
  room_id INTEGER NOT NULL REFERENCES rooms(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  PRIMARY KEY (room_id, user_id)
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id INTEGER NOT NULL REFERENCES rooms(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  text TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room_id, id);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  socket_id TEXT,
  last_seen TEXT DEFAULT (datetime('now'))
);
`);

const stmts = {
  userByName: db.prepare('SELECT * FROM users WHERE username = ?'),
  userById: db.prepare('SELECT id, username FROM users WHERE id = ?'),
  insertUser: db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)'),
  allUsers: db.prepare('SELECT id, username FROM users ORDER BY username'),
  insertRoom: db.prepare('INSERT INTO rooms (name, is_dm) VALUES (?, ?)'),
  roomByName: db.prepare('SELECT * FROM rooms WHERE name = ?'),
  roomById: db.prepare('SELECT * FROM rooms WHERE id = ?'),
  addMember: db.prepare('INSERT OR IGNORE INTO room_members (room_id, user_id) VALUES (?, ?)'),
  isMember: db.prepare('SELECT 1 FROM room_members WHERE room_id = ? AND user_id = ?'),
  roomsForUser: db.prepare(`
    SELECT r.id, r.name, r.is_dm FROM rooms r
    JOIN room_members m ON m.room_id = r.id
    WHERE m.user_id = ? ORDER BY r.id`),
  members: db.prepare(`
    SELECT u.id, u.username FROM users u
    JOIN room_members m ON m.user_id = u.id WHERE m.room_id = ?`),
  saveMsg: db.prepare('INSERT INTO messages (room_id, user_id, text) VALUES (?, ?, ?)'),
  msgs: db.prepare(`
    SELECT m.id, m.room_id, m.user_id, u.username, m.text, m.created_at
    FROM messages m JOIN users u ON u.id = m.user_id
    WHERE m.room_id = ? ORDER BY m.id DESC LIMIT 100`),
  addSession: db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)'),
  delSession: db.prepare('DELETE FROM sessions WHERE token = ?'),
};

module.exports = {
  createUser(username, hash) {
    const info = stmts.insertUser.run(username, hash);
    return info.lastInsertRowid;
  },
  getUserByName: (n) => stmts.userByName.get(n),
  getUserById: (id) => stmts.userById.get(id),
  allUsers: () => stmts.allUsers.all(),
  createRoom(name) {
    stmts.insertRoom.run(name, 0);
    return stmts.roomByName.get(name);
  },
  roomByName: (name) => stmts.roomByName.get(name),
  ensureRoom(name) {
    let room = stmts.roomByName.get(name);
    if (!room) {
      stmts.insertRoom.run(name, 0);
      room = stmts.roomByName.get(name);
    }
    return room;
  },
  createDm(a, b) {
    const name = `dm:${[a, b].sort((x, y) => x - y).join(':')}`;
    let room = stmts.roomByName.get(name);
    if (!room) {
      stmts.insertRoom.run(name, 1);
      room = stmts.roomByName.get(name);
    }
    stmts.addMember.run(room.id, a);
    stmts.addMember.run(room.id, b);
    return room;
  },
  addMember: (roomId, userId) => stmts.addMember.run(roomId, userId),
  isMember: (roomId, userId) => !!stmts.isMember.get(roomId, userId),
  userRooms: (userId) => stmts.roomsForUser.all(userId),
  roomMembers: (roomId) => stmts.members.all(roomId),
  saveMessage(roomId, userId, text) {
    const info = stmts.saveMsg.run(roomId, userId, text);
    const user = stmts.userById.get(userId);
    return {
      id: info.lastInsertRowid,
      room_id: roomId,
      user_id: userId,
      username: user.username,
      text,
      created_at: new Date().toISOString(),
    };
  },
  roomMessages(roomId) {
    return stmts.msgs.all(roomId).reverse();
  },
  addSession: (token, userId) => stmts.addSession.run(token, userId),
  removeSession: (token) => stmts.delSession.run(token),
};
