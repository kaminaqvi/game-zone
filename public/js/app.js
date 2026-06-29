/* ─── State ─────────────────────────────────────────────────────────────── */
const state = {
  playerName: '',
  roomCode: '',
  playerId: '',
  isHost: false,
  theme: 'dinosaurs',
  difficulty: 'easy',
  words: [],
  currentWordIndex: 0,
  players: [],
  myCharIndex: 0,
  gameActive: false,
};

/* ─── Socket ─────────────────────────────────────────────────────────────── */
const socket = io();

/* ─── Screen helpers ─────────────────────────────────────────────────────── */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

/* ─── Landing screen ─────────────────────────────────────────────────────── */
const nameInput     = document.getElementById('player-name');
const codeInput     = document.getElementById('room-code-input');
const btnCreate     = document.getElementById('btn-create');
const btnJoin       = document.getElementById('btn-join');
const landingError  = document.getElementById('landing-error');

btnCreate.addEventListener('click', () => {
  const name = nameInput.value.trim();
  if (!name) { showError('Enter your name first!'); return; }
  state.playerName = name;
  socket.emit('create-room', { playerName: name });
});

btnJoin.addEventListener('click', () => {
  const name = nameInput.value.trim();
  const code = codeInput.value.trim().toUpperCase();
  if (!name) { showError('Enter your name first!'); return; }
  if (!code || code.length !== 4) { showError('Enter a valid 4-letter room code!'); return; }
  state.playerName = name;
  socket.emit('join-room', { roomCode: code, playerName: name });
});

nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') btnCreate.click(); });
codeInput.addEventListener('keydown', e => { if (e.key === 'Enter') btnJoin.click(); });

function showError(msg) {
  landingError.textContent = msg;
  setTimeout(() => { landingError.textContent = ''; }, 3000);
}

/* ─── Lobby screen ───────────────────────────────────────────────────────── */
const lobbyCodeEl     = document.getElementById('lobby-code');
const playerListEl    = document.getElementById('player-list');
const hostControlsEl  = document.getElementById('host-controls');
const waitingMsgEl    = document.getElementById('waiting-msg');
const btnStart        = document.getElementById('btn-start');

function renderLobby() {
  lobbyCodeEl.textContent = state.roomCode;
  renderPlayerList();
  renderThemePicker();
  renderDifficultyPicker();
  updateHostVisibility();
}

function renderPlayerList() {
  playerListEl.innerHTML = '';
  state.players.forEach(p => {
    const div = document.createElement('div');
    div.className = 'player-item' + (p.id === state.playerId ? ' is-you' : '');
    const crown = p.id === state.isHost ? '' :
      (state.players[0] && state.players[0].id === state.playerId && p === state.players[0] ? '👑 ' : '');
    const theme = THEMES[state.theme];
    const char = theme ? theme.characters[p.charIndex % theme.characters.length] : '🎮';
    div.innerHTML = `<span>${char}</span> <span>${p.name}${p.id === state.playerId ? ' (you)' : ''}</span>${state.players.indexOf(p) === 0 ? ' <span class="crown">👑</span>' : ''}`;
    playerListEl.appendChild(div);
  });
}

function renderThemePicker() {
  const grid = document.getElementById('theme-grid');
  grid.innerHTML = '';
  Object.entries(THEMES).forEach(([key, t]) => {
    const btn = document.createElement('button');
    btn.className = 'theme-btn' + (state.theme === key ? ' selected' : '');
    btn.innerHTML = `<span class="theme-icon">${t.icon}</span><span class="theme-name">${t.name}</span>`;
    btn.addEventListener('click', () => {
      if (!state.isHost) return;
      state.theme = key;
      socket.emit('set-options', { theme: key, difficulty: state.difficulty });
    });
    grid.appendChild(btn);
  });
}

function renderDifficultyPicker() {
  const diffs = [
    { key: 'easy',   icon: '⭐',    label: 'Easy',   desc: 'Ages 5–7 · Short words' },
    { key: 'medium', icon: '⭐⭐',  label: 'Medium', desc: 'Ages 8–10 · Full words' },
    { key: 'hard',   icon: '⭐⭐⭐',label: 'Hard',   desc: 'Ages 10–12 · Long words' },
  ];
  const row = document.getElementById('difficulty-row');
  row.innerHTML = '';
  diffs.forEach(d => {
    const btn = document.createElement('button');
    btn.className = 'diff-btn' + (state.difficulty === d.key ? ' selected' : '');
    btn.innerHTML = `<span class="diff-icon">${d.icon}</span><span class="diff-label">${d.label}</span><span class="diff-desc">${d.desc}</span>`;
    btn.addEventListener('click', () => {
      if (!state.isHost) return;
      state.difficulty = d.key;
      socket.emit('set-options', { theme: state.theme, difficulty: d.key });
    });
    row.appendChild(btn);
  });
}

function updateHostVisibility() {
  if (state.isHost) {
    hostControlsEl.classList.remove('hidden');
    waitingMsgEl.classList.add('hidden');
  } else {
    hostControlsEl.classList.add('hidden');
    waitingMsgEl.classList.remove('hidden');
  }
}

btnStart.addEventListener('click', () => {
  if (state.players.length < 1) return;
  socket.emit('start-game');
});

/* ─── Game screen ────────────────────────────────────────────────────────── */
const countdownOverlay  = document.getElementById('countdown-overlay');
const countdownNumber   = document.getElementById('countdown-number');
const raceTrackEl       = document.getElementById('race-track');
const currentWordEl     = document.getElementById('current-word');
const wordCounterEl     = document.getElementById('word-counter');
const typingInput       = document.getElementById('typing-input');
const playersPanelEl    = document.getElementById('players-panel');
const finishedOverlay   = document.getElementById('finished-overlay');
const finishedMsgEl     = document.getElementById('finished-msg');

function initGame() {
  state.gameActive = false;
  state.currentWordIndex = 0;
  typingInput.value = '';
  typingInput.disabled = true;
  typingInput.className = '';
  finishedOverlay.classList.add('hidden');
  countdownOverlay.classList.remove('hidden');

  applyThemeToGame();
  buildTrack();
  renderPlayersPanel();
  updateWordDisplay();

  runCountdown();
}

function applyThemeToGame() {
  const t = THEMES[state.theme];
  if (!t) return;
  document.getElementById('screen-game').style.background = t.skyGradient;
  raceTrackEl.style.background = t.trackBg + '99';

  // Space theme: show stars
  document.body.className = state.theme === 'space' ? 'theme-space' : '';
}

function buildTrack() {
  raceTrackEl.innerHTML = '';
  state.players.forEach(p => {
    const t = THEMES[state.theme];
    const char = t ? t.characters[p.charIndex % t.characters.length] : '🎮';

    const lane = document.createElement('div');
    lane.className = 'track-lane';
    lane.id = `lane-${p.id}`;
    lane.innerHTML = `
      <div class="lane-name">${p.name}</div>
      <div class="lane-bar">
        <div class="lane-fill" style="width:0%"></div>
        <div class="lane-character">${char}</div>
      </div>
      <div class="finish-flag">🏁</div>
    `;
    raceTrackEl.appendChild(lane);
  });
}

function updateTrack() {
  state.players.forEach(p => {
    const lane = document.getElementById(`lane-${p.id}`);
    if (!lane) return;
    const bar = lane.querySelector('.lane-bar');
    const fill = lane.querySelector('.lane-fill');
    const character = lane.querySelector('.lane-character');
    const barW = bar.clientWidth;
    const charW = 32;
    const pct = p.progress / 100;
    const leftPx = Math.max(0, pct * (barW - charW));
    fill.style.width = p.progress + '%';
    character.style.left = leftPx + 'px';
    if (p.place > 0) {
      let existing = lane.querySelector('.place-badge');
      if (!existing) {
        existing = document.createElement('div');
        existing.className = 'place-badge';
        lane.appendChild(existing);
      }
      existing.textContent = placeLabel(p.place);
    }
  });
}

function renderPlayersPanel() {
  playersPanelEl.innerHTML = '';
  state.players.forEach(p => {
    const t = THEMES[state.theme];
    const char = t ? t.characters[p.charIndex % t.characters.length] : '🎮';
    const card = document.createElement('div');
    card.className = 'player-progress-card' + (p.id === state.playerId ? ' is-you' : '');
    card.id = `pp-${p.id}`;
    card.innerHTML = `
      <div class="pp-name">${char} ${p.name}</div>
      <div class="pp-bar-wrap"><div class="pp-bar" style="width:0%"></div></div>
      <div class="pp-pct">0%</div>
    `;
    playersPanelEl.appendChild(card);
  });
}

function updateProgressBars() {
  state.players.forEach(p => {
    const card = document.getElementById(`pp-${p.id}`);
    if (!card) return;
    card.querySelector('.pp-bar').style.width = p.progress + '%';
    card.querySelector('.pp-pct').textContent = p.progress + '%';
  });
}

function updateWordDisplay() {
  const word = state.words[state.currentWordIndex] || '';
  currentWordEl.textContent = word;
  currentWordEl.className = 'current-word';
  wordCounterEl.textContent = `Word ${state.currentWordIndex + 1} of ${state.words.length}`;
}

function runCountdown() {
  const steps = ['3', '2', '1', 'GO!'];
  let i = 0;
  function tick() {
    const val = steps[i];
    countdownNumber.textContent = val;
    countdownNumber.className = val === 'GO!' ? 'countdown-go' : 'countdown-number';
    // Force reflow to restart animation
    void countdownNumber.offsetWidth;
    i++;
    if (i < steps.length) {
      setTimeout(tick, val === 'GO!' ? 600 : 900);
    } else {
      setTimeout(startTyping, 200);
    }
  }
  tick();
}

function startTyping() {
  countdownOverlay.classList.add('hidden');
  state.gameActive = true;
  typingInput.disabled = false;
  typingInput.focus();
}

/* ─── Typing logic ───────────────────────────────────────────────────────── */
typingInput.addEventListener('input', () => {
  if (!state.gameActive) return;
  const typed = typingInput.value.toLowerCase();
  const target = (state.words[state.currentWordIndex] || '').toLowerCase();
  if (typed.length === 0) {
    typingInput.className = '';
    currentWordEl.className = 'current-word';
  } else if (target.startsWith(typed)) {
    typingInput.className = 'input-correct';
    currentWordEl.className = 'current-word correct';
  } else {
    typingInput.className = 'input-wrong';
    currentWordEl.className = 'current-word wrong';
  }
});

typingInput.addEventListener('keydown', e => {
  if (!state.gameActive) return;
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    submitWord();
  }
});

function submitWord() {
  const typed = typingInput.value.trim().toLowerCase();
  const target = (state.words[state.currentWordIndex] || '').toLowerCase();

  if (typed === target) {
    handleCorrect();
  } else {
    handleWrong();
  }
}

function handleCorrect() {
  const completedIndex = state.currentWordIndex;
  state.currentWordIndex++;
  typingInput.value = '';
  typingInput.className = '';

  socket.emit('word-correct', { wordIndex: completedIndex });

  if (state.currentWordIndex < state.words.length) {
    updateWordDisplay();
    // Brief green flash
    currentWordEl.className = 'current-word correct';
    setTimeout(() => { currentWordEl.className = 'current-word'; }, 300);
  } else {
    // Player finished all words — wait for server game-over
    state.gameActive = false;
    typingInput.disabled = true;
    currentWordEl.textContent = '🏁';
    currentWordEl.className = 'current-word';
    wordCounterEl.textContent = 'All done! Waiting for others...';
  }
}

function handleWrong() {
  typingInput.value = '';
  typingInput.className = 'input-wrong';
  currentWordEl.className = 'current-word wrong';
  setTimeout(() => {
    typingInput.className = '';
    currentWordEl.className = 'current-word';
  }, 400);
}

function showFinishedMessage(place) {
  const labels = ['', '🥇 1st Place!', '🥈 2nd Place!', '🥉 3rd Place!'];
  const label = labels[place] || `#${place} Place!`;
  finishedMsgEl.innerHTML = `
    <div class="finished-msg">${label}</div>
    <div class="finished-sub">Waiting for others to finish...</div>
  `;
  finishedOverlay.classList.remove('hidden');
  setTimeout(() => finishedOverlay.classList.add('hidden'), 3000);
}

/* ─── Results screen ─────────────────────────────────────────────────────── */
const btnPlayAgain  = document.getElementById('btn-play-again');
const btnNewGame    = document.getElementById('btn-new-game');

function showResults(results) {
  state.gameActive = false;
  showScreen('screen-results');

  const podiumEl = document.getElementById('podium');
  const listEl   = document.getElementById('results-list');

  // Podium: show top 3 in 2nd-1st-3rd order
  const top3 = results.slice(0, 3);
  const podiumOrder = top3.length === 1 ? [top3[0]] :
                      top3.length === 2 ? [top3[0], top3[1]] :
                      [top3[1], top3[0], top3[2]]; // 2nd, 1st, 3rd

  podiumEl.innerHTML = '';
  podiumOrder.forEach((p, i) => {
    if (!p) return;
    const t = THEMES[state.theme];
    const char = t ? t.characters[p.charIndex % t.characters.length] : '🎮';
    const div = document.createElement('div');
    div.className = 'podium-place';
    const blockHeight = i === 1 ? 130 : (i === 0 ? 90 : 60);
    const blockColor = i === 1 ? '#FCD34D' : (i === 0 ? '#C0C0C0' : '#CD7F32');
    div.innerHTML = `
      <div class="podium-char">${char}</div>
      <div class="podium-name">${p.name}</div>
      <div class="podium-block" style="height:${blockHeight}px;background:${blockColor}">${placeLabel(p.place)}</div>
    `;
    podiumEl.appendChild(div);
  });

  // Full list
  listEl.innerHTML = '';
  results.forEach(p => {
    const t = THEMES[state.theme];
    const char = t ? t.characters[(p.charIndex || 0) % t.characters.length] : '🎮';
    const li = document.createElement('div');
    li.className = 'result-item';
    li.innerHTML = `<span class="result-place">${placeLabel(p.place)}</span><span>${char}</span><span class="result-name">${p.name}</span>`;
    listEl.appendChild(li);
  });

  btnPlayAgain.classList.toggle('hidden', !state.isHost);
}

btnPlayAgain.addEventListener('click', () => {
  socket.emit('play-again');
});

btnNewGame.addEventListener('click', () => {
  state.roomCode = '';
  state.playerId = '';
  state.isHost = false;
  state.players = [];
  showScreen('screen-landing');
});

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function placeLabel(n) {
  if (n === 1) return '🥇';
  if (n === 2) return '🥈';
  if (n === 3) return '🥉';
  return `#${n}`;
}

/* ─── Socket events ──────────────────────────────────────────────────────── */
socket.on('room-created', ({ roomCode, playerId }) => {
  state.roomCode = roomCode;
  state.playerId = playerId;
  state.isHost = true;
  showScreen('screen-lobby');
  renderLobby();
});

socket.on('room-joined', ({ roomCode, playerId }) => {
  state.roomCode = roomCode;
  state.playerId = playerId;
  state.isHost = false;
  showScreen('screen-lobby');
  renderLobby();
});

socket.on('join-error', ({ message }) => {
  showError(message);
});

socket.on('player-joined', ({ players, host }) => {
  state.players = players;
  state.isHost = host === state.playerId;
  const myPlayer = players.find(p => p.id === state.playerId);
  if (myPlayer) state.myCharIndex = myPlayer.charIndex;
  renderPlayerList();
  updateHostVisibility();
  if (state.isHost) {
    renderThemePicker();
    renderDifficultyPicker();
  }
});

socket.on('options-updated', ({ theme, difficulty }) => {
  state.theme = theme;
  state.difficulty = difficulty;
  renderThemePicker();
  renderDifficultyPicker();
  renderPlayerList();
});

socket.on('game-starting', ({ words, theme, difficulty, players }) => {
  state.words = words;
  state.theme = theme;
  state.difficulty = difficulty;
  state.players = players;
  state.currentWordIndex = 0;
  const me = players.find(p => p.id === state.playerId);
  state.myCharIndex = me ? me.charIndex : 0;
  showScreen('screen-game');
  initGame();
});

socket.on('progress-update', ({ players }) => {
  state.players = players;
  updateTrack();
  updateProgressBars();
});

socket.on('you-finished', ({ place }) => {
  showFinishedMessage(place);
});

socket.on('game-over', ({ results }) => {
  setTimeout(() => showResults(results), 1800);
});

socket.on('back-to-lobby', ({ players, host, theme, difficulty }) => {
  state.players = players;
  state.isHost = host === state.playerId;
  state.theme = theme;
  state.difficulty = difficulty;
  const me = players.find(p => p.id === state.playerId);
  state.myCharIndex = me ? me.charIndex : 0;
  showScreen('screen-lobby');
  renderLobby();
});

/* ─── Stars background for space theme ──────────────────────────────────── */
(function createStars() {
  const container = document.createElement('div');
  container.className = 'stars';
  for (let i = 0; i < 80; i++) {
    const star = document.createElement('div');
    star.className = 'star';
    const size = Math.random() * 3 + 1;
    star.style.cssText = `
      width:${size}px; height:${size}px;
      left:${Math.random()*100}%;
      top:${Math.random()*100}%;
      animation-delay:${Math.random()*2}s;
      animation-duration:${1.5 + Math.random()*2}s;
    `;
    container.appendChild(star);
  }
  document.body.appendChild(container);
})();
