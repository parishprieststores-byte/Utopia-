# Utopia 💬

A full-stack real-time chat app. Channels, direct messages, typing indicators, online presence, persisted history, emoji and a responsive "Utopia"-branded UI.

## Stack

- **Node.js + Express** — REST API (register / login / rooms / history)
- **Socket.IO** — realtime messaging, typing, presence
- **SQLite (better-sqlite3)** — persisted users, rooms and messages
- **bcryptjs + JWT** — password hashing and auth
- **Vanilla HTML/CSS/JS** — single-page responsive frontend

## Run locally

```bash
cp .env.example .env      # edit JWT_SECRET
npm install
npm start
# open http://localhost:3000
```

## Run with Docker

```bash
docker build -t utopia .
docker run -p 3000:3000 -e JWT_SECRET=your-secret utopia
```

## Features

- Username / password auth (bcrypt hashing, JWT sessions)
- Public channels — create any number of rooms
- Direct messages between any two users
- Message history persisted in SQLite, loaded per room
- Typing indicators ("Alice is typing…")
- Online presence list, updates live
- Timestamps on every message, day dividers
- Emoji picker, Enter to send
- Responsive layout (desktop 3-pane, mobile stack)

## API

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | /api/register | – | create account |
| POST | /api/login | – | get JWT token |
| GET | /api/me | Bearer | current user |
| GET | /api/users | Bearer | list users |
| GET | /api/rooms | Bearer | user's channels + DMs |
| POST | /api/rooms | Bearer | create channel |
| POST | /api/dm | Bearer | get-or-create DM with `{ username }` |
| GET | /api/rooms/:id/messages | Bearer | last 100 messages |

## Socket events

- `chat message` `{ roomId, text }` → broadcast to room
- `typing` `{ roomId }` → broadcast "typing" to room
- `presence` → broadcast list of online user ids on connect/disconnect
