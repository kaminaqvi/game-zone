require('dotenv').config();
const express  = require('express');
const http     = require('http');
const { Server } = require('socket.io');
const path     = require('path');
const session  = require('express-session');

const gm          = require('./gameManager');
const { initDB }  = require('./db/init');
const { router: authRouter, passport } = require('./routes/auth');
const usersRouter   = require('./routes/users');
const lbRouter      = require('./routes/leaderboard');
const friendsRouter = require('./routes/friends');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server);

const isProd = process.env.NODE_ENV === 'production';
if (isProd) app.set('trust proxy', 1); // trust reverse proxy (Apache/Nginx)

/* ── Session & auth middleware ────────────────────────────── */
app.use(session({
  secret:            process.env.SESSION_SECRET || 'gz-dev-secret-change-in-prod',
  resave:            false,
  saveUninitialized: false,
  cookie: { secure: isProd, maxAge: 1000 * 60 * 60 * 24 * 30 },
}));
app.use(passport.initialize());
app.use(passport.session());

/* ── Static files ─────────────────────────────────────────── */
app.use(express.static(path.join(__dirname, '../public')));

/* ── Page routes ─────────────────────────────────────────── */
app.get('/profile',     (_req, res) => res.sendFile(path.join(__dirname, '../public/profile.html')));
app.get('/leaderboard', (_req, res) => res.sendFile(path.join(__dirname, '../public/leaderboard.html')));
app.get('/u/:username', (_req, res) => res.sendFile(path.join(__dirname, '../public/profile.html')));

/* ── API routes ───────────────────────────────────────────── */
app.use('/api/auth',        authRouter);
app.use('/api/users',       usersRouter);
app.use('/api/leaderboard', lbRouter);
app.use('/api/friends',     friendsRouter);

/* ── Socket.io ────────────────────────────────────────────── */
const playerRooms = new Map();

io.on('connection', socket => {
  socket.on('create-room', ({ playerName }) => {
    const code = gm.createRoom(socket.id, playerName);
    playerRooms.set(socket.id, code);
    socket.join(code);
    const room = gm.getRoom(code);
    socket.emit('room-created', { roomCode: code, playerId: socket.id });
    io.to(code).emit('player-joined', { players: room.players, host: room.host });
  });

  socket.on('join-room', ({ roomCode, playerName }) => {
    const code = (roomCode || '').toUpperCase().trim();
    const room = gm.addPlayer(code, socket.id, playerName);
    if (!room) { socket.emit('join-error', { message: 'Room not found or game already started!' }); return; }
    playerRooms.set(socket.id, code);
    socket.join(code);
    socket.emit('room-joined', { roomCode: code, playerId: socket.id });
    io.to(code).emit('player-joined', { players: room.players, host: room.host });
  });

  socket.on('list-rooms', () => {
    const rooms = gm.listOpenRooms().map(r => ({
      code: r.code, playerCount: r.players.length, theme: r.theme, difficulty: r.difficulty,
    }));
    socket.emit('room-list', rooms);
  });

  socket.on('set-character', ({ charIndex }) => {
    const code = playerRooms.get(socket.id);
    if (!code) return;
    const room = gm.setCharacter(code, socket.id, charIndex);
    if (room) io.to(code).emit('character-updated', { players: room.players });
  });

  socket.on('toggle-ready', () => {
    const code = playerRooms.get(socket.id);
    if (!code) return;
    const room = gm.toggleReady(code, socket.id);
    if (room) io.to(code).emit('player-joined', { players: room.players, host: room.host });
  });

  socket.on('set-options', ({ theme, difficulty, roundType }) => {
    const code = playerRooms.get(socket.id);
    if (!code) return;
    gm.setOptions(code, theme, difficulty, roundType);
    const room = gm.getRoom(code);
    if (room) io.to(code).emit('options-updated', { theme: room.theme, difficulty: room.difficulty, roundType: room.roundType });
  });

  socket.on('start-game', () => {
    const code = playerRooms.get(socket.id);
    if (!code) return;
    const room = gm.getRoom(code);
    if (!room || room.host !== socket.id) return;
    const started = gm.startGame(code);
    if (!started) return;
    io.to(code).emit('game-starting', {
      words: started.words, theme: started.theme,
      difficulty: started.difficulty, players: started.players,
      roundType: started.roundType,
    });
    // game-start is now sent only after ALL players finish/skip the cutscene
  });

  socket.on('cutscene-done', () => {
    const code = playerRooms.get(socket.id);
    if (!code) return;
    const result = gm.markCutsceneDone(code, socket.id);
    if (result && result.allDone) {
      io.to(code).emit('game-start');
    }
  });

  socket.on('word-correct', ({ wordIndex, score, wpm }) => {
    const code = playerRooms.get(socket.id);
    if (!code) return;
    const result = gm.recordProgress(code, socket.id, wordIndex, score, wpm);
    if (!result) return;
    const { room, finished, allDone } = result;
    io.to(code).emit('progress-update', {
      players: room.players.map(p => ({
        id: p.id, name: p.name, progress: p.progress, place: p.place, charIndex: p.charIndex,
      })),
    });
    if (finished) socket.emit('you-finished', { place: room.players.find(p => p.id === socket.id).place });
    if (allDone) io.to(code).emit('game-over', { results: [...room.players].sort((a,b) => a.place - b.place) });
  });

  socket.on('play-again', () => {
    const code = playerRooms.get(socket.id);
    if (!code) return;
    const room = gm.getRoom(code);
    if (!room || room.host !== socket.id) return;
    const reset = gm.resetRoom(code);
    if (reset) io.to(code).emit('back-to-lobby', {
      players: reset.players, host: reset.host, theme: reset.theme,
      difficulty: reset.difficulty, roundType: reset.roundType,
    });
  });

  socket.on('disconnect', () => {
    const code = playerRooms.get(socket.id);
    if (!code) return;
    playerRooms.delete(socket.id);
    const room = gm.removePlayer(code, socket.id);
    if (room) io.to(code).emit('player-joined', { players: room.players, host: room.host });
  });
});

/* ── Start ────────────────────────────────────────────────── */
const PORT = process.env.PORT || 3000;
initDB().then(() => {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 GamePortal → http://localhost:${PORT}\n`);
    if (!process.env.DB_HOST)          console.log('   ⚠️  No DB_HOST — running without database');
    if (!process.env.GOOGLE_CLIENT_ID) console.log('   ⚠️  No GOOGLE_CLIENT_ID — Google Sign-In disabled\n');
  });
});
