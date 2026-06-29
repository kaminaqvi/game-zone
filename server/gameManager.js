const { easy, medium, hard } = require('./wordLists');

const rooms = new Map();
const WORD_COUNTS = { easy: 10, medium: 15, hard: 20 };
const WORD_BANKS = { easy, medium, hard };

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return rooms.has(code) ? generateCode() : code;
}

function shuffleSlice(arr, n) {
  const copy = [...arr].sort(() => Math.random() - 0.5);
  return copy.slice(0, n);
}

function createRoom(hostId, hostName) {
  const code = generateCode();
  rooms.set(code, {
    code,
    host: hostId,
    players: [{ id: hostId, name: hostName, progress: 0, place: 0, charIndex: 0, score: 0 }],
    state: 'waiting',
    theme: 'dinosaurs',
    difficulty: 'easy',
    words: [],
    finishedCount: 0,
    cleanupTimer: null,
  });
  return code;
}

function getRoom(code) {
  return rooms.get(code) || null;
}

function addPlayer(code, playerId, playerName) {
  const room = rooms.get(code);
  if (!room || room.state !== 'waiting') return null;
  if (room.players.find(p => p.id === playerId)) return room;
  const charIndex = room.players.length % 4;
  room.players.push({ id: playerId, name: playerName, progress: 0, place: 0, charIndex, score: 0 });
  return room;
}

function removePlayer(code, playerId) {
  const room = rooms.get(code);
  if (!room) return null;
  room.players = room.players.filter(p => p.id !== playerId);
  if (room.players.length === 0) {
    if (room.cleanupTimer) clearTimeout(room.cleanupTimer);
    rooms.delete(code);
    return null;
  }
  if (room.host === playerId) {
    room.host = room.players[0].id;
  }
  return room;
}

function setOptions(code, theme, difficulty) {
  const room = rooms.get(code);
  if (!room) return;
  room.theme = theme;
  room.difficulty = difficulty;
}

function startGame(code) {
  const room = rooms.get(code);
  if (!room || room.state !== 'waiting') return null;
  const count = WORD_COUNTS[room.difficulty] || 10;
  room.words = shuffleSlice(WORD_BANKS[room.difficulty], count);
  room.state = 'racing';
  room.finishedCount = 0;
  room.players.forEach(p => { p.progress = 0; p.place = 0; p.score = 0; });
  return room;
}

function recordProgress(code, playerId, wordIndex, score) {
  const room = rooms.get(code);
  if (!room || room.state !== 'racing') return null;
  const player = room.players.find(p => p.id === playerId);
  if (!player) return null;

  player.progress = Math.round(((wordIndex + 1) / room.words.length) * 100);
  if (score !== undefined) player.score = score;

  const finished = wordIndex + 1 >= room.words.length;
  if (finished && player.place === 0) {
    room.finishedCount++;
    player.place = room.finishedCount;
  }

  const allDone = room.players.length > 0 && room.finishedCount >= room.players.length;
  if (allDone && room.state === 'racing') {
    room.state = 'finished';
    if (room.cleanupTimer) clearTimeout(room.cleanupTimer);
    room.cleanupTimer = setTimeout(() => rooms.delete(code), 5 * 60 * 1000);
  }

  return { room, finished, allDone };
}

function resetRoom(code) {
  const room = rooms.get(code);
  if (!room) return null;
  if (room.cleanupTimer) clearTimeout(room.cleanupTimer);
  room.cleanupTimer = null;
  room.state = 'waiting';
  room.words = [];
  room.finishedCount = 0;
  room.players.forEach(p => { p.progress = 0; p.place = 0; p.score = 0; });
  return room;
}

function listOpenRooms() {
  const open = [];
  rooms.forEach(r => {
    if (r.state === 'waiting') open.push(r);
  });
  return open;
}

function setCharacter(code, playerId, charIndex) {
  const room = rooms.get(code);
  if (!room) return null;
  const player = room.players.find(p => p.id === playerId);
  if (player) player.charIndex = charIndex;
  return room;
}

module.exports = { createRoom, getRoom, addPlayer, removePlayer, setOptions, startGame, recordProgress, resetRoom, listOpenRooms, setCharacter };
