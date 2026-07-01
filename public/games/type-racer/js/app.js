/* ══════════════════════════════════════════════════════════
   CONSTANTS
   ══════════════════════════════════════════════════════════ */
const FLOOR_SPACING = 155;
const PLATFORM_H    = 32;
const CHAR_ON_PLAT  = 10;
const CAM_FROM_BOT  = 0.30;

const ROUND_TYPES = [
  { key: 'normal',      icon: '🏁', label: 'Normal',      desc: 'Classic race'     },
  { key: 'paragraph',   icon: '📖', label: 'Paragraph',   desc: 'Type a passage'   },
  { key: 'survival',    icon: '💀', label: 'Survival',     desc: '30s → last = out' },
  { key: 'timeattack',  icon: '⏱️', label: 'Time Attack',  desc: '60s countdown'    },
  { key: 'suddendeath', icon: '⚡', label: 'Sudden Death', desc: '1 mistake = out'  },
];

/* ══════════════════════════════════════════════════════════
   PLAYER PROFILE  (localStorage)
   ══════════════════════════════════════════════════════════ */
const PlayerProfile = {
  KEY: 'typeracer_profile_v2',
  get() {
    try { return JSON.parse(localStorage.getItem(this.KEY)) || this._blank(); }
    catch { return this._blank(); }
  },
  _blank() { return { name: '', wins: 0, races: 0, highScore: 0, bestWpm: 0, history: [] }; },
  save(d) { localStorage.setItem(this.KEY, JSON.stringify(d)); },
  afterRace({ name, score, place, wpm = 0 }) {
    const p = this.get();
    p.name  = name;
    p.races++;
    if (place === 1) p.wins++;
    if (score > p.highScore) p.highScore = score;
    if (wpm > (p.bestWpm || 0)) p.bestWpm = wpm;
    p.history.unshift({ score, place, wpm, date: Date.now() });
    if (p.history.length > 30) p.history = p.history.slice(0, 30);
    this.save(p);
    return p;
  },
};

/* ══════════════════════════════════════════════════════════
   CHARACTER ANIMATOR  (per player)
   ══════════════════════════════════════════════════════════ */
class CharacterAnimator {
  constructor(innerId) {
    this.el        = document.getElementById(innerId);
    this.state     = 'idle';
    this._idleT    = null;
    this._restT    = null;
  }
  set(st) {
    if (!this.el || this.state === st) return;
    clearTimeout(this._idleT);
    clearTimeout(this._restT);
    this.state = st;
    this.el.className = `char-inner char-${st}`;
    if (st === 'idle') {
      this._restT = setTimeout(() => this.set('resting'), 4500);
    }
  }
  onType()  { this.set('walking'); this._idleT = setTimeout(() => this.set('idle'), 700); }
  onJump()  { this.set('jumping'); }
  onLand()  { this.set('walking'); }
  onIdle()  { this.set('idle'); }
}

const charAnimators = {};  // playerId → CharacterAnimator

/* ── Locked skin helpers ─────────────────────────────────── */
function isUnlocked(idx, profile) {
  if (idx < 4) return true;
  const p = profile || PlayerProfile.get();
  if (idx === 4) return (p.wins    || 0) >= 5;
  if (idx === 5) return (p.bestWpm || 0) >= 30;
  if (idx === 6) return (p.races   || 0) >= 20;
  if (idx === 7) return (p.bestWpm || 0) >= 50;
  return false;
}
function lockHint(idx) {
  if (idx === 4) return '🏆 Win 5 races to unlock!';
  if (idx === 5) return '⚡ Reach 30 WPM to unlock!';
  if (idx === 6) return '🎮 Play 20 races to unlock!';
  if (idx === 7) return '🔥 Reach 50 WPM to unlock!';
  return 'Locked';
}
let _lockToastTimer = null;
function showLockToast(msg) {
  let toast = document.getElementById('skin-lock-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'skin-lock-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.className = 'skin-lock-toast show';
  clearTimeout(_lockToastTimer);
  _lockToastTimer = setTimeout(() => { toast.className = 'skin-lock-toast'; }, 2400);
}

/* ══════════════════════════════════════════════════════════
   CHARACTER SVG BUILDER
   ══════════════════════════════════════════════════════════ */
const CHAR_HALF_W = 26; // half SVG runner width in px (for horizontal centering)

function hxAdjust(hex, d) {
  const n = parseInt(hex.replace('#',''), 16);
  const r = Math.min(255, Math.max(0, (n >> 16) + d));
  const g = Math.min(255, Math.max(0, ((n >> 8) & 0xFF) + d));
  const b = Math.min(255, Math.max(0, (n & 0xFF) + d));
  return '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join('');
}

// Robot colour palettes — 0-3 default, 4-7 locked (unlocked by milestones)
const ROBOT_PALETTES = [
  { h:'#42A5F5', d:'#1565C0', f:'#E3F2FD', s:'#1a1a2e', pA:'#66BB6A', pB:'#388E3C' },
  { h:'#AB47BC', d:'#6A1B9A', f:'#F3E5F5', s:'#1a1a2e', pA:'#FF8A65', pB:'#E64A19' },
  { h:'#FF7043', d:'#BF360C', f:'#FBE9E7', s:'#212121', pA:'#66BB6A', pB:'#2E7D32' },
  { h:'#26C6DA', d:'#00696F', f:'#E0F7FA', s:'#1a1a2e', pA:'#FFCA28', pB:'#F57F17' },
  // Locked skins
  { h:'#FFD700', d:'#B8860B', f:'#FFFDE7', s:'#3d2600', pA:'#FF6D00', pB:'#E65100' }, // Gold — 5 wins
  { h:'#E8F500', d:'#9E9D24', f:'#F9FBE7', s:'#1a1a00', pA:'#00B0FF', pB:'#0091EA' }, // Electric — 30 WPM
  { h:'#7B1FA2', d:'#4A0072', f:'#F3E5F5', s:'#0d0020', pA:'#00E5FF', pB:'#00B8D4' }, // Galaxy — 20 races
  { h:'#FF1744', d:'#B71C1C', f:'#FFEBEE', s:'#1a0000', pA:'#FF9100', pB:'#E65100' }, // Champion — 50 WPM
];

function buildCharacterHTML(themeKey, charIndex, pid) {
  if (themeKey === 'cars')     return buildCarSVG(charIndex);
  if (themeKey === 'aviation') return buildPlaneSVG(charIndex);
  return buildRunnerSVG(themeKey, charIndex, pid);
}

function buildRunnerSVG(themeKey, charIndex, pid) {
  const c  = ROBOT_PALETTES[charIndex % ROBOT_PALETTES.length];
  const id = (pid !== undefined ? pid : charIndex) + '_' + charIndex;
  const h2 = hxAdjust(c.h, -30);   // darker head shade for depth

  return `<svg class="char-svg char-runner" viewBox="0 0 52 84" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="rbh${id}" x1="20%" y1="0%" x2="80%" y2="100%">
      <stop offset="0%" stop-color="${c.h}"/>
      <stop offset="100%" stop-color="${c.d}"/>
    </linearGradient>
    <linearGradient id="rbb${id}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${c.h}"/>
      <stop offset="100%" stop-color="${c.d}"/>
    </linearGradient>
  </defs>

  <!-- Shadow -->
  <ellipse cx="26" cy="83" rx="13" ry="2" fill="rgba(0,0,0,0.22)"/>

  <!-- ── Plant pot on head ── -->
  <!-- Stem -->
  <rect x="24.5" y="1" width="3" height="9" rx="1.5" fill="#4CAF50"/>
  <!-- Left leaf -->
  <ellipse cx="20" cy="5" rx="6" ry="2.5" fill="${c.pA}" transform="rotate(-38,20,5)"/>
  <!-- Right leaf -->
  <ellipse cx="32" cy="5" rx="6" ry="2.5" fill="${c.pB}" transform="rotate(38,32,5)"/>
  <!-- Pot body -->
  <rect x="19" y="9" width="14" height="8" rx="2.5" fill="#8D6E63"/>
  <!-- Pot rim -->
  <rect x="18" y="9" width="16" height="4" rx="2" fill="#A1887F"/>
  <!-- Soil -->
  <ellipse cx="26" cy="10.5" rx="7" ry="2" fill="#5D4037"/>

  <!-- ── Head (square-ish robot) ── -->
  <!-- Antenna ridge connecting pot to head -->
  <rect x="21" y="15" width="10" height="5" rx="2.5" fill="${c.d}"/>
  <!-- Head box -->
  <rect x="9" y="18" width="34" height="28" rx="8" fill="url(#rbh${id})"/>
  <!-- Face panel (lighter inset) -->
  <rect x="12" y="21" width="28" height="22" rx="6" fill="${c.f}"/>
  <!-- Eyes -->
  <circle cx="20" cy="30" r="4" fill="${c.d}"/>
  <circle cx="32" cy="30" r="4" fill="${c.d}"/>
  <!-- Eye shine -->
  <circle cx="21.5" cy="28.2" r="1.4" fill="white"/>
  <circle cx="33.5" cy="28.2" r="1.4" fill="white"/>
  <!-- Smile -->
  <path d="M18 36 Q26 41 34 36" stroke="${c.d}" stroke-width="2" fill="none" stroke-linecap="round"/>
  <!-- Cheeks -->
  <ellipse cx="14" cy="34" rx="3.5" ry="2" fill="#FF8A80" opacity="0.45"/>
  <ellipse cx="38" cy="34" rx="3.5" ry="2" fill="#FF8A80" opacity="0.45"/>

  <!-- ── Neck ── -->
  <rect x="21" y="44" width="10" height="6" rx="3" fill="${c.d}"/>

  <!-- ── Back arm (left) ── -->
  <g class="cfa-l" style="transform-origin:16px 52px">
    <rect x="4" y="49" width="13" height="7" rx="3.5" fill="${c.d}"/>
    <circle cx="4" cy="52" r="3.5" fill="${h2}"/>
  </g>

  <!-- ── Body ── -->
  <rect x="15" y="48" width="22" height="20" rx="6" fill="url(#rbb${id})"/>
  <!-- Chest detail -->
  <rect x="19" y="52" width="14" height="7" rx="2.5" fill="${c.f}" opacity="0.28"/>

  <!-- ── Front arm (right) ── -->
  <g class="cfa-r" style="transform-origin:36px 52px">
    <rect x="35" y="49" width="13" height="7" rx="3.5" fill="${c.h}"/>
    <circle cx="48" cy="52" r="3.5" fill="${c.h}"/>
  </g>

  <!-- ── Back leg (left) ── -->
  <g class="cfl-l" style="transform-origin:21px 68px">
    <rect x="17" y="68" width="8" height="13" rx="4" fill="${c.d}"/>
    <ellipse cx="20" cy="82" rx="6" ry="3.5" fill="${c.s}"/>
  </g>

  <!-- ── Front leg (right) ── -->
  <g class="cfl-r" style="transform-origin:31px 68px">
    <rect x="27" y="68" width="8" height="13" rx="4" fill="${c.h}"/>
    <ellipse cx="32" cy="82" rx="6" ry="3" fill="#111"/>
  </g>
</svg>`;
}

/* Pine-branch SVG — left side; right side is CSS-mirrored */
function buildBranchSVG() {
  return `<svg viewBox="0 0 52 60" width="52" height="60" xmlns="http://www.w3.org/2000/svg">
    <path d="M46 4 C38 16 28 32 20 56" stroke="#7B5230" stroke-width="4" fill="none" stroke-linecap="round"/>
    <line x1="40" y1="15" x2="28" y2="8"  stroke="#4CAF50" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="40" y1="15" x2="34" y2="24" stroke="#388E3C" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="30" y1="30" x2="18" y2="23" stroke="#43A047" stroke-width="2.2" stroke-linecap="round"/>
    <line x1="30" y1="30" x2="25" y2="39" stroke="#388E3C" stroke-width="2.2" stroke-linecap="round"/>
    <line x1="23" y1="44" x2="13" y2="38" stroke="#2E7D32" stroke-width="2"   stroke-linecap="round"/>
    <line x1="23" y1="44" x2="19" y2="52" stroke="#33691E" stroke-width="2"   stroke-linecap="round"/>
  </svg>`;
}

function buildCarSVG(charIndex) {
  const bodies = ['#EF5350','#42A5F5','#66BB6A','#FFA726'];
  const bc = bodies[charIndex % bodies.length];
  return `<svg class="char-svg char-car" viewBox="0 0 88 52" xmlns="http://www.w3.org/2000/svg">
    <!-- Body -->
    <rect x="4" y="18" width="80" height="24" rx="7" fill="${bc}"/>
    <!-- Cabin roof -->
    <rect x="18" y="7"  width="38" height="15" rx="7" fill="${bc}"/>
    <!-- Front window -->
    <rect x="41" y="9"  width="13" height="11" rx="4" fill="#B3E5FC" opacity="0.88"/>
    <!-- Rear window -->
    <rect x="20" y="9"  width="18" height="11" rx="4" fill="#B3E5FC" opacity="0.88"/>
    <!-- Headlight -->
    <ellipse cx="82" cy="27" rx="5" ry="4" fill="#FFF176"/>
    <ellipse cx="82" cy="27" rx="3" ry="2.5" fill="white"/>
    <!-- Taillight -->
    <ellipse cx="6"  cy="27" rx="4" ry="3.5" fill="#EF9A9A"/>
    <!-- Stripe detail -->
    <rect x="4" y="29" width="80" height="3" rx="1.5" fill="white" opacity="0.25"/>
    <!-- Left (front) wheel -->
    <g class="cfw-l" style="transform-origin:23px 44px">
      <circle cx="23" cy="44" r="11" fill="#263238"/>
      <circle cx="23" cy="44" r="6.5" fill="#455A64"/>
      <circle cx="23" cy="44" r="2.5" fill="#90A4AE"/>
      <line x1="23" y1="37.5" x2="23" y2="50.5" stroke="#607D8B" stroke-width="1.8"/>
      <line x1="16.5" y1="44" x2="29.5" y2="44" stroke="#607D8B" stroke-width="1.8"/>
    </g>
    <!-- Right (rear) wheel -->
    <g class="cfw-r" style="transform-origin:65px 44px">
      <circle cx="65" cy="44" r="11" fill="#263238"/>
      <circle cx="65" cy="44" r="6.5" fill="#455A64"/>
      <circle cx="65" cy="44" r="2.5" fill="#90A4AE"/>
      <line x1="65" y1="37.5" x2="65" y2="50.5" stroke="#607D8B" stroke-width="1.8"/>
      <line x1="58.5" y1="44" x2="71.5" y2="44" stroke="#607D8B" stroke-width="1.8"/>
    </g>
  </svg>`;
}

function buildPlaneSVG(charIndex) {
  const bodies = ['#90CAF9','#A5D6A7','#F48FB1','#FFE082'];
  const bc = bodies[charIndex % bodies.length];
  return `<svg class="char-svg char-plane" viewBox="0 0 92 54" xmlns="http://www.w3.org/2000/svg">
    <!-- Fuselage -->
    <ellipse cx="46" cy="28" rx="34" ry="10" fill="${bc}"/>
    <!-- Nose cone -->
    <path d="M78 24 Q92 28 78 32Z" fill="${bc}"/>
    <!-- Tail body -->
    <path d="M14 28 L4 22 L12 28Z" fill="${bc}"/>
    <!-- Vertical tail fin -->
    <path d="M16 22 L9 8 L22 22Z" fill="${bc}"/>
    <!-- Main wing (top) -->
    <path d="M40 25 L6  8 L40 27Z" fill="${bc}" opacity="0.9"/>
    <!-- Main wing (bottom) -->
    <path d="M40 31 L6 48 L40 29Z" fill="${bc}" opacity="0.9"/>
    <!-- Cockpit window -->
    <ellipse cx="68" cy="27" rx="6.5" ry="5" fill="#B3E5FC" opacity="0.9"/>
    <!-- Side window -->
    <ellipse cx="56" cy="27" rx="4" ry="4" fill="#B3E5FC" opacity="0.75"/>
    <!-- Propeller hub -->
    <circle cx="84" cy="28" r="3" fill="#78909C"/>
    <!-- Propeller (rotates) -->
    <g class="cfp-prop" style="transform-origin:84px 28px">
      <rect x="83" y="14" width="2.5" height="28" rx="1.2" fill="#546E7A"/>
      <ellipse cx="84" cy="14" rx="5"   ry="2.2" fill="#78909C"/>
      <ellipse cx="84" cy="42" rx="5"   ry="2.2" fill="#78909C"/>
    </g>
  </svg>`;
}

/* ══════════════════════════════════════════════════════════
   STATE
   ══════════════════════════════════════════════════════════ */
const state = {
  playerName: '', roomCode: '', playerId: '',
  isHost: false, theme: 'dinosaurs', difficulty: 'easy', roundType: 'normal',
  words: [], currentWordIndex: 0, players: [],
  myCharIndex: 0, gameActive: false,
  score: 0, lastWordTime: 0,
  charIndex: 0, charResults: [],
  gameStartTime: 0, totalCharsTyped: 0, wpm: 0,
  streak: 0, combo: 1, eliminated: false,
  taTimer: null, survivalTimer: null,
  paragraph: null,
};
const playerFloors = {};

/* ── Ghost replay state ──────────────────────────────────── */
let   ghostEl     = null;
const ghostTimers = [];
const ghostRec    = [];  // { wordIndex, elapsed } recorded this race

/* ══════════════════════════════════════════════════════════
   CONFETTI
   ══════════════════════════════════════════════════════════ */
const gameConfetti    = new ConfettiSystem('confetti-canvas');
const resultsConfetti = new ConfettiSystem('confetti-canvas-results');

/* ══════════════════════════════════════════════════════════
   SOCKET
   ══════════════════════════════════════════════════════════ */
const socket = io();

/* ══════════════════════════════════════════════════════════
   SCREEN HELPERS
   ══════════════════════════════════════════════════════════ */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  el.classList.add('active');
  gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: 'power2.out' });
}

/* ══════════════════════════════════════════════════════════
   NATURE BACKGROUND — cloud generation
   ══════════════════════════════════════════════════════════ */
function buildNatureBg(theme) {
  const cloudsEl = document.getElementById('bg-clouds');
  if (!cloudsEl) return;
  cloudsEl.innerHTML = '';

  if (theme === 'space') { cloudsEl.style.display = 'none'; return; }
  cloudsEl.style.display = '';

  // Three parallax layers: bg (large/slow/faint), mid, fg (small/fast/bright)
  const layers = [
    { layer: 0, count: theme === 'aviation' ? 4 : 3,  wRange: [180, 260], hFactor: [0.32, 0.42], topRange: [5,  38], opRange: [0.30, 0.45], durRange: [65, 90] },
    { layer: 1, count: theme === 'aviation' ? 5 : 4,  wRange: [110, 180], hFactor: [0.38, 0.50], topRange: [8,  52], opRange: [0.55, 0.72], durRange: [40, 62] },
    { layer: 2, count: theme === 'aviation' ? 5 : 3,  wRange: [55,  110], hFactor: [0.42, 0.56], topRange: [3,  45], opRange: [0.78, 0.95], durRange: [22, 40] },
  ];

  // Aviation theme: slightly bluer, softer clouds
  const cloudColor = theme === 'aviation'
    ? 'rgba(230,242,255,VAR)'
    : theme === 'rollercoaster'
    ? 'rgba(255,220,240,VAR)'
    : 'rgba(255,255,255,VAR)';

  layers.forEach(def => {
    for (let i = 0; i < def.count; i++) {
      const w   = def.wRange[0]  + Math.random() * (def.wRange[1]  - def.wRange[0]);
      const hF  = def.hFactor[0] + Math.random() * (def.hFactor[1] - def.hFactor[0]);
      const h   = w * hF;
      const top = def.topRange[0] + Math.random() * (def.topRange[1] - def.topRange[0]);
      const op  = def.opRange[0]  + Math.random() * (def.opRange[1]  - def.opRange[0]);
      const dur = def.durRange[0] + Math.random() * (def.durRange[1] - def.durRange[0]);
      const delay = -(Math.random() * dur);
      // Start off the right side of screen so they drift in from there
      const startX = Math.random() * 120; // 0–120vw (random starting point in animation)

      const cloud = document.createElement('div');
      cloud.className = `cloud cloud-layer-${def.layer}`;
      cloud.style.cssText = `
        top:${top}%;
        left:${100 + startX}vw;
        width:${w}px; height:${h * 0.6}px;
        opacity:${op.toFixed(2)};
        animation-duration:${dur.toFixed(1)}s;
        animation-delay:${delay.toFixed(1)}s;
      `;
      buildCloudPuffs(cloud, w, h, cloudColor);
      cloudsEl.appendChild(cloud);
    }
  });
}

function buildCloudPuffs(cloud, w, h, colorTemplate) {
  // Main base (elongated oval)
  function makePuff(leftPct, bottomPct, sizePct, alphaBoost) {
    const d = document.createElement('div');
    const sz = w * sizePct;
    const col = colorTemplate.replace('VAR', (0.85 + alphaBoost).toFixed(2));
    d.className = 'cloud-puff';
    d.style.cssText = `
      left:${w * leftPct}px; bottom:${h * bottomPct}px;
      width:${sz}px; height:${sz}px;
      background:${col};
    `;
    cloud.appendChild(d);
  }

  // Base layer
  makePuff(0.10, 0.00, 0.80, 0.00);
  // Upper bumps (the "cauliflower" tops)
  makePuff(0.06, 0.38, 0.58, 0.05);
  makePuff(0.28, 0.55, 0.65, 0.08);
  makePuff(0.50, 0.48, 0.62, 0.05);
  makePuff(0.62, 0.30, 0.52, 0.02);
  // Wispy right tail
  makePuff(0.72, 0.05, 0.36, -0.10);
}

/* ══════════════════════════════════════════════════════════
   LANDING
   ══════════════════════════════════════════════════════════ */
const nameInput    = document.getElementById('player-name');
const codeInput    = document.getElementById('room-code-input');
const btnCreate    = document.getElementById('btn-create');
const btnJoin      = document.getElementById('btn-join');
const landingError = document.getElementById('landing-error');

// Pre-fill name from profile
(async function initProfile() {
  // If logged in via portal, pre-fill name and lock the field
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      if (data.user) {
        nameInput.value    = data.user.username;
        nameInput.readOnly = true;
        nameInput.style.cssText = 'opacity:0.7;cursor:default;background:rgba(255,255,255,0.04)';
        const nameCard = nameInput.closest('.card');
        if (nameCard) {
          const tag = document.createElement('div');
          tag.style.cssText = 'font-size:0.78rem;color:rgba(255,255,255,0.5);margin-top:6px;text-align:center';
          tag.textContent = '✓ Logged in as ' + data.user.username;
          nameCard.appendChild(tag);
        }
        return;
      }
    }
  } catch { /* guest — fall through */ }
  const p = PlayerProfile.get();
  if (p.name) nameInput.value = p.name;
  updateProfileBar(p);
})();

function updateProfileBar(p) {
  const bar = document.getElementById('profile-bar');
  if (!bar) return;
  if (p.races > 0) {
    bar.style.display = 'flex';
    document.getElementById('profile-wins').textContent  = `🏆 ${p.wins} wins`;
    document.getElementById('profile-races').textContent = `🏁 ${p.races} races`;
    document.getElementById('profile-high').textContent  = `⭐ Best: ${p.highScore.toLocaleString()}`;
  }
}

document.getElementById('btn-profile')?.addEventListener('click', showProfileModal);
document.getElementById('btn-close-profile')?.addEventListener('click', () => {
  document.getElementById('modal-profile').classList.add('hidden');
});

function showProfileModal() {
  const p = PlayerProfile.get();
  const modal = document.getElementById('modal-profile');
  const listEl = document.getElementById('profile-history-list');
  const statsEl = document.getElementById('history-stats');
  modal.classList.remove('hidden');

  listEl.innerHTML = '';
  if (!p.history.length) {
    listEl.innerHTML = '<p class="dim">No races yet — go race!</p>';
  } else {
    p.history.forEach(h => {
      const d = new Date(h.date);
      const li = document.createElement('div');
      li.className = 'history-item';
      li.innerHTML = `
        <span>${placeLabel(h.place)}</span>
        <span>⭐ ${h.score.toLocaleString()}</span>
        <span style="color:var(--text-dim);font-size:0.78rem">${d.toLocaleDateString()}</span>`;
      listEl.appendChild(li);
    });
  }
  statsEl.innerHTML = `
    <span>🏆 ${p.wins} wins</span>
    <span>🏁 ${p.races} races</span>
    <span>⭐ High: ${p.highScore.toLocaleString()}</span>
    <span>🎯 Win rate: ${p.races ? Math.round(p.wins/p.races*100) : 0}%</span>`;
}

gsap.from('#screen-landing .game-title', { y:-60, opacity:0, duration:0.8, ease:'back.out(1.7)', delay:0.1 });
gsap.from('#screen-landing .card',       { y:40,  opacity:0, duration:0.6, ease:'back.out(1.7)', stagger:0.12, delay:0.4 });

btnCreate.addEventListener('click', () => {
  const name = nameInput.value.trim();
  if (!name) { showError('Enter your name first!'); shakeEl(nameInput); return; }
  state.playerName = name;
  pulseEl(btnCreate);
  socket.emit('create-room', { playerName: name });
});
btnJoin.addEventListener('click', () => {
  const name = nameInput.value.trim();
  const code = codeInput.value.trim().toUpperCase();
  if (!name) { showError('Enter your name first!'); shakeEl(nameInput); return; }
  if (code.length !== 4) { showError('Enter a 4-letter room code!'); shakeEl(codeInput); return; }
  state.playerName = name;
  pulseEl(btnJoin);
  socket.emit('join-room', { roomCode: code, playerName: name });
});
nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') btnCreate.click(); });
codeInput.addEventListener('keydown', e => { if (e.key === 'Enter') btnJoin.click(); });

// Room list refresh
document.getElementById('btn-refresh-rooms')?.addEventListener('click', () => {
  socket.emit('list-rooms');
});
socket.emit('list-rooms');

socket.on('room-list', (rooms) => {
  const el = document.getElementById('room-list');
  if (!el) return;
  if (!rooms || !rooms.length) { el.innerHTML = '<p class="dim">No open rooms yet.</p>'; return; }
  el.innerHTML = '';
  rooms.forEach(r => {
    const div = document.createElement('div');
    div.className = 'room-item';
    div.innerHTML = `
      <div>
        <div class="room-code">${r.code}</div>
        <div class="room-info">${r.playerCount} player${r.playerCount !== 1 ? 's' : ''} · ${r.theme}</div>
      </div>
      <button class="btn btn-secondary btn-sm" data-code="${r.code}">Join</button>`;
    div.querySelector('button').addEventListener('click', () => {
      codeInput.value = r.code;
      btnJoin.click();
    });
    el.appendChild(div);
  });
});

function showError(msg) {
  landingError.textContent = msg;
  gsap.fromTo(landingError, { opacity:0, y:-6 }, { opacity:1, y:0, duration:0.3 });
  setTimeout(() => gsap.to(landingError, { opacity:0, duration:0.4, onComplete:() => landingError.textContent='' }), 3000);
}

/* ══════════════════════════════════════════════════════════
   LOBBY
   ══════════════════════════════════════════════════════════ */
const lobbyCodeEl    = document.getElementById('lobby-code');
const playerListEl   = document.getElementById('player-list');
const hostControlsEl = document.getElementById('host-controls');
const waitingMsgEl   = document.getElementById('waiting-msg');
const btnStart       = document.getElementById('btn-start');

document.getElementById('room-code-box')?.addEventListener('click', () => {
  const code = lobbyCodeEl?.textContent || '';
  if (!code || code === '----') return;
  navigator.clipboard?.writeText(code).then(() => {
    const hint = document.getElementById('copy-hint');
    if (hint) { hint.textContent = '✓ copied!'; setTimeout(() => { hint.textContent = 'tap to copy'; }, 1800); }
  }).catch(() => {});
});

function renderLobby() {
  lobbyCodeEl.textContent = state.roomCode;
  gsap.from('.room-code-box', { scale:0.7, opacity:0, duration:0.5, ease:'back.out(2)' });
  renderPlayerList();
  renderThemePicker();
  renderDifficultyPicker();
  renderRoundTypePicker();
  updateHostVisibility();
}

function renderPlayerList() {
  playerListEl.innerHTML = '';
  const t = THEMES[state.theme];
  state.players.forEach((p, idx) => {
    const chars = t ? t.characters : ['🎮'];
    const ci    = p.charIndex !== undefined ? p.charIndex : idx;
    const char  = chars[ci % chars.length];
    const isMe  = p.id === state.playerId;

    const readyBadge = p.ready
      ? `<span class="ready-badge ready">✅ Ready</span>`
      : `<span class="ready-badge not-ready">⏳ Not Ready</span>`;

    const div = document.createElement('div');
    div.className = 'player-item' + (isMe ? ' is-you' : '');
    const charSvg = buildCharacterHTML(state.theme, ci, 50 + idx);
    div.innerHTML = `
      <span class="p-char p-char-svg">${charSvg}</span>
      <span class="p-name">${p.name}${idx===0?' 👑':''}</span>
      <span class="p-score">${readyBadge}</span>`;

    // Own character picker row — shows same SVG as in-game
    if (isMe) {
      const picker     = document.createElement('div');
      picker.className = 'char-picker';
      const isVehicle  = state.theme === 'cars' || state.theme === 'aviation';
      const numSkins   = isVehicle ? 4 : 8;
      const snap       = PlayerProfile.get();
      for (let i = 0; i < numSkins; i++) {
        const locked = i >= 4 && !isUnlocked(i, snap);
        const btn = document.createElement('button');
        btn.className = 'char-pick-btn' + (i === ci ? ' selected' : '') + (locked ? ' skin-locked' : '');
        btn.title = locked ? lockHint(i) : `Pick character ${i + 1}`;
        btn.innerHTML = buildCharacterHTML(state.theme, i, 99 + i)
          + (locked ? `<div class="lock-overlay">🔒<span class="lock-tip">${lockHint(i)}</span></div>` : '');
        if (locked) {
          btn.addEventListener('click', () => showLockToast(lockHint(i)));
        } else {
          btn.addEventListener('click', () => {
            socket.emit('set-character', { charIndex: i });
            state.myCharIndex = i;
            renderPlayerList();
            gsap.fromTo(btn, { scale:0.7 }, { scale:1, duration:0.35, ease:'back.out(2)' });
          });
        }
        picker.appendChild(btn);
      }
      div.appendChild(picker);
    }

    playerListEl.appendChild(div);
    gsap.from(div, { x:-20, opacity:0, duration:0.3, delay:idx*0.06, ease:'power2.out' });
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
      socket.emit('set-options', { theme: key, difficulty: state.difficulty, roundType: state.roundType });
      gsap.fromTo(btn, { scale:0.85 }, { scale:1, duration:0.35, ease:'back.out(2)' });
    });
    grid.appendChild(btn);
  });
}

function renderDifficultyPicker() {
  const diffs = [
    { key:'easy',   icon:'⭐',     label:'Easy',   desc:'Ages 5–7'   },
    { key:'medium', icon:'⭐⭐',   label:'Medium', desc:'Ages 8–10'  },
    { key:'hard',   icon:'⭐⭐⭐', label:'Hard',   desc:'Ages 10–12' },
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
      socket.emit('set-options', { theme: state.theme, difficulty: d.key, roundType: state.roundType });
    });
    row.appendChild(btn);
  });
}

function renderRoundTypePicker() {
  const row = document.getElementById('round-type-row');
  if (!row) return;
  row.innerHTML = '';
  ROUND_TYPES.forEach(rt => {
    const btn = document.createElement('button');
    btn.className = 'round-btn' + (state.roundType === rt.key ? ' selected' : '');
    btn.innerHTML = `<span class="round-icon">${rt.icon}</span><span class="round-label">${rt.label}</span><span class="round-desc">${rt.desc}</span>`;
    btn.addEventListener('click', () => {
      if (!state.isHost) return;
      state.roundType = rt.key;
      socket.emit('set-options', { theme: state.theme, difficulty: state.difficulty, roundType: rt.key });
    });
    row.appendChild(btn);
  });
}

function updateStreakDisplay() {
  const el = document.getElementById('combo-display');
  if (!el) return;
  if (state.streak < 2) { el.textContent = ''; el.className = 'combo-display'; return; }
  const mult = state.combo > 1 ? ` ×${state.combo}` : '';
  el.textContent = `🔥 ${state.streak}${mult}`;
  el.className = 'combo-display' + (state.combo >= 2 ? ' combo-hot' : '');
  gsap.fromTo(el, { scale: 1.4 }, { scale: 1, duration: 0.3, ease: 'back.out(2)' });
}

function updateParagraphBanner() {
  const banner   = document.getElementById('paragraph-banner');
  if (!banner || state.roundType !== 'paragraph') return;
  const textArea = document.getElementById('para-text-area');
  const wcCur    = document.getElementById('para-wc-cur');
  const wcTotal  = document.getElementById('para-wc-total');
  const progBar  = document.getElementById('para-progress-bar');
  if (!textArea) return;

  const words = state.words;
  const cur   = state.currentWordIndex;

  if (wcCur)   wcCur.textContent   = cur + 1;
  if (wcTotal) wcTotal.textContent = words.length;

  const pct = Math.round(((cur + (state.charIndex / (words[cur]?.length || 1))) / words.length) * 100);
  if (progBar) progBar.style.setProperty('--para-progress', pct + '%');

  let html = '';
  words.forEach((word, wi) => {
    if (wi > 0) html += ' ';
    if (wi < cur) {
      html += `<span class="para-done">${escHtml(word)}</span>`;
    } else if (wi === cur) {
      let wHtml = '';
      for (let ci = 0; ci < word.length; ci++) {
        const ch = escHtml(word[ci]);
        if (ci < state.charIndex)        wHtml += `<span class="para-ch-done">${ch}</span>`;
        else if (ci === state.charIndex)  wHtml += `<span class="para-ch-cur">${ch}</span>`;
        else                              wHtml += `<span class="para-ch-rest">${ch}</span>`;
      }
      html += `<span class="para-cur">${wHtml}</span>`;
    } else {
      html += `<span class="para-future">${escHtml(word)}</span>`;
    }
  });
  textArea.innerHTML = html;

  const curEl = textArea.querySelector('.para-cur');
  if (curEl) {
    const lineH = parseFloat(getComputedStyle(textArea).lineHeight) || 39;
    textArea.scrollTop = Math.max(0, curEl.offsetTop - lineH * 0.4);
  }
}

function updateHostVisibility() {
  if (state.isHost) {
    const wasHidden = hostControlsEl.classList.contains('hidden');
    hostControlsEl.classList.remove('hidden');
    waitingMsgEl.classList.add('hidden');
    if (wasHidden) {
      gsap.fromTo(hostControlsEl, { y:20, opacity:0 }, { y:0, opacity:1, duration:0.4, ease:'power2.out' });
    }
  } else {
    const wasHidden = waitingMsgEl.classList.contains('hidden');
    hostControlsEl.classList.add('hidden');
    waitingMsgEl.classList.remove('hidden');
    if (wasHidden) {
      gsap.fromTo(waitingMsgEl, { y:20, opacity:0 }, { y:0, opacity:1, duration:0.4, ease:'power2.out' });
    }
  }
  updateStartButton();
  updateReadyButton();
}

function updateStartButton() {
  if (!state.isHost) return;
  const nonHost = state.players.filter(p => p.id !== state.playerId);
  const allReady = nonHost.length === 0 || nonHost.every(p => p.ready);
  btnStart.disabled = !allReady;
  btnStart.style.opacity = allReady ? '1' : '0.45';
  btnStart.style.cursor  = allReady ? 'pointer' : 'not-allowed';
  const waiting = nonHost.filter(p => !p.ready).length;
  btnStart.textContent = allReady
    ? '🏁 Start Race!'
    : `⏳ Waiting for ${waiting} player${waiting > 1 ? 's' : ''}…`;
}

function updateReadyButton() {
  if (state.isHost) return;
  const me = state.players.find(p => p.id === state.playerId);
  const btnReady = document.getElementById('btn-ready');
  if (!btnReady || !me) return;
  if (me.ready) {
    btnReady.textContent = '✅ Ready!';
    btnReady.classList.add('is-ready');
  } else {
    btnReady.textContent = '✅ I\'m Ready!';
    btnReady.classList.remove('is-ready');
  }
}

document.getElementById('btn-ready')?.addEventListener('click', () => {
  socket.emit('toggle-ready');
});

btnStart.addEventListener('click', () => {
  if (btnStart.disabled) return;
  pulseEl(btnStart);
  socket.emit('start-game');
});

/* ══════════════════════════════════════════════════════════
   GAME INIT
   ══════════════════════════════════════════════════════════ */
const jumpArenaEl      = document.getElementById('jump-arena');
const wordCounterEl    = document.getElementById('word-counter');
const scoreDisplayEl   = document.getElementById('score-display');
const wpmDisplayEl     = document.getElementById('wpm-display');
let idleTypingTimer = null;
const countdownOverlay = document.getElementById('countdown-overlay');
const countdownNumber  = document.getElementById('countdown-number');
const finishedOverlay  = document.getElementById('finished-overlay');
const finishedMsgEl    = document.getElementById('finished-msg');

function initGame() {
  state.gameActive       = false;
  state.currentWordIndex = 0;
  state.charIndex        = 0;
  state.charResults      = [];
  state.score            = 0;
  state.lastWordTime     = 0;
  state.gameStartTime    = 0;
  state.totalCharsTyped  = 0;
  state.wpm              = 0;
  if (wpmDisplayEl) wpmDisplayEl.textContent = '— WPM';
  state.streak = 0; state.combo = 1; state.eliminated = false;
  if (state.taTimer)      { clearInterval(state.taTimer);      state.taTimer = null; }
  if (state.survivalTimer){ clearInterval(state.survivalTimer); state.survivalTimer = null; }
  const elimEl = document.getElementById('eliminated-overlay');
  if (elimEl) elimEl.style.display = 'none';
  const taHud = document.getElementById('time-attack-hud');
  if (taHud) { taHud.textContent = ''; taHud.className = 'time-attack-hud hidden'; }
  updateStreakDisplay();
  const paraBanner = document.getElementById('paragraph-banner');
  if (paraBanner) {
    if (state.roundType === 'paragraph') { paraBanner.classList.remove('hidden'); updateParagraphBanner(); }
    else paraBanner.classList.add('hidden');
  }
  finishedOverlay.classList.add('hidden');
  countdownOverlay.classList.add('hidden');

  const t = THEMES[state.theme];
  const screenEl = document.getElementById('screen-game');
  screenEl.className = `screen active ${t ? t.bgClass : ''}`;
  document.body.className = state.theme === 'space' ? 'theme-space' : '';

  buildNatureBg(state.theme);

  state.players.forEach(p => { playerFloors[p.id] = 0; });
  ghostEl = null;
  ghostTimers.forEach(clearTimeout); ghostTimers.length = 0;
  ghostRec.length = 0;

  buildJumpArena();
  buildGhostOverlay();
  markTargetPlatform(0);
  updateWordCounter();
  updateScoreDisplay();
  showCutscene();
}

/* ══════════════════════════════════════════════════════════
   JUMP ARENA
   ══════════════════════════════════════════════════════════ */
function innerH(totalFloors) { return totalFloors * FLOOR_SPACING + 300; }
function charBottomPx(floor) {
  return floor === 0 ? 55 : floor * FLOOR_SPACING + PLATFORM_H + CHAR_ON_PLAT;
}

function buildJumpArena() {
  jumpArenaEl.innerHTML = '';
  Object.keys(charAnimators).forEach(k => delete charAnimators[k]);

  const t        = THEMES[state.theme];
  const totalF   = state.words.length;
  const platCls  = t ? t.platformClass : 'platform-dinosaurs';
  const ih       = innerH(totalF);

  state.players.forEach((p, pi) => {
    const ci      = p.charIndex !== undefined ? p.charIndex : pi;
    const chars   = t ? t.characters : ['🎮'];
    const charEm  = chars[ci % chars.length];
    const isMe    = p.id === state.playerId;

    const col = document.createElement('div');
    col.className = 'player-column';
    col.id = `col-${p.id}`;

    const finDiv = document.createElement('div');
    finDiv.className = 'col-finish';
    finDiv.textContent = t ? t.topEmoji : '🏁';

    const hdr = document.createElement('div');
    hdr.className = 'col-header' + (isMe ? ' is-you' : '');
    hdr.id = `header-${p.id}`;
    hdr.innerHTML = `${p.name}${isMe ? ' ★' : ''}<span class="col-score"></span>`;

    const arena = document.createElement('div');
    arena.className = 'col-arena';
    arena.id = `arena-${p.id}`;

    const inner = document.createElement('div');
    inner.className = 'arena-inner';
    inner.id = `inner-${p.id}`;
    inner.style.height = ih + 'px';

    // Ground
    const ground = document.createElement('div');
    ground.className = 'col-ground';
    ground.textContent = t ? t.groundEmoji : '🌱';
    inner.appendChild(ground);

    // Platforms
    for (let f = 1; f <= totalF; f++) {
      const plat = document.createElement('div');
      plat.className = `platform ${platCls}`;
      plat.id = `plat-${p.id}-${f}`;
      plat.style.bottom = (f * FLOOR_SPACING) + 'px';
      // Dramatic left/right stagger — zigzag path like the sketch
      const isLeft = f % 2 === 1;
      plat.style.left  = isLeft ? '1%'  : '42%';
      plat.style.width = '57%';

      // Pine-branch decorations for forest themes
      if (state.theme === 'dinosaurs' || state.theme === 'animals') {
        const brL = document.createElement('div');
        brL.className = 'plat-branch plat-branch-l';
        brL.innerHTML = buildBranchSVG();
        plat.appendChild(brL);
        const brR = document.createElement('div');
        brR.className = 'plat-branch plat-branch-r';
        brR.innerHTML = buildBranchSVG();
        plat.appendChild(brR);
      }

      if (isMe) {
        const wordEl = document.createElement('div');
        wordEl.className = 'plat-word future';
        wordEl.id = `platword-${f}`;
        const w = state.words[f - 1] || '';
        wordEl.innerHTML = `<span class="t"></span><span class="r">${escHtml(w)}</span>`;
        wordEl.style.left = isLeft ? '65%' : '35%';
        plat.appendChild(wordEl);
      }
      inner.appendChild(plat);
    }

    // Finish flag
    const flag = document.createElement('div');
    flag.style.cssText = `position:absolute;bottom:${totalF * FLOOR_SPACING + 65}px;left:50%;transform:translateX(-50%);font-size:2rem;filter:drop-shadow(0 0 8px gold)`;
    flag.textContent = '🏁';
    inner.appendChild(flag);

    // charWrap: GSAP controls y-arc + squash/bounce scale.
    // CSS transition: left handles horizontal zigzag (no GSAP conflict).
    const charHalfW = state.theme === 'cars' ? 44 : (state.theme === 'aviation' ? 46 : 26);
    const charWrap = document.createElement('div');
    charWrap.className = 'jump-character';
    charWrap.id = `char-${p.id}`;
    charWrap.style.cssText = `bottom:${charBottomPx(0)}px; left:50%; margin-left:-${charHalfW}px;`;

    // charFlip: CSS scaleX(-1) flips character to face movement direction
    const charFlip = document.createElement('div');
    charFlip.className = 'char-flipper';
    charFlip.id = `flip-${p.id}`;

    // charInner: walking/jumping/idle/resting state machine via CSS class
    const charInner = document.createElement('div');
    charInner.className = 'char-inner char-idle';
    charInner.id = `charinner-${p.id}`;
    charInner.innerHTML = buildCharacterHTML(state.theme, ci, pi);

    charFlip.appendChild(charInner);
    charWrap.appendChild(charFlip);
    inner.appendChild(charWrap);

    arena.appendChild(inner);
    col.appendChild(finDiv);
    col.appendChild(hdr);
    col.appendChild(arena);

    // Progress bar — left edge of this column, full height
    const cpBar  = document.createElement('div');
    cpBar.className = 'col-prog-bar' + (isMe ? ' is-you' : '');
    const cpFill = document.createElement('div');
    cpFill.className = 'hud-bar-fill';
    cpFill.id = `progfill-${p.id}`;
    cpFill.style.height = '0%';
    cpBar.appendChild(cpFill);
    col.appendChild(cpBar);

    jumpArenaEl.appendChild(col);

    charAnimators[p.id] = new CharacterAnimator(`charinner-${p.id}`);
    gsap.from(col, { x:-30, opacity:0, duration:0.4, delay:pi*0.1, ease:'power2.out' });
  });
}

/* ──────────────────────────────────────────────────────────
   HUD PROGRESS BARS
   ────────────────────────────────────────────────────────── */
function buildProgressBars() {
  const el = document.getElementById('hud-progress-bars');
  if (!el) return;
  el.innerHTML = '';
  const t = THEMES[state.theme];

  state.players.forEach((p, pi) => {
    const ci   = p.charIndex !== undefined ? p.charIndex : pi;
    const chars = t ? t.characters : ['🎮'];
    const em   = chars[ci % chars.length];
    const isMe = p.id === state.playerId;

    const col = document.createElement('div');
    col.className = 'hud-prog-col' + (isMe ? ' is-you' : '');
    col.id = `prog-${p.id}`;

    const name = document.createElement('div');
    name.className = 'hud-bar-name';
    name.textContent = p.name;

    const track = document.createElement('div');
    track.className = 'hud-bar-track';

    const fill = document.createElement('div');
    fill.className = 'hud-bar-fill';
    fill.id = `progfill-${p.id}`;
    fill.style.height = '0%';

    const charEl = document.createElement('div');
    charEl.className = 'hud-bar-char';
    charEl.id = `progchar-${p.id}`;
    charEl.textContent = em;  // theme emoji in HUD bar
    charEl.style.bottom = '0%';

    track.appendChild(fill);
    track.appendChild(charEl);
    col.appendChild(track);
    col.appendChild(name);
    el.appendChild(col);
  });
}

function updateProgressBar(playerId, wordsDone) {
  const total = state.words.length;
  const pct   = total > 0 ? Math.round(wordsDone / total * 100) : 0;
  const fill  = document.getElementById(`progfill-${playerId}`);
  const char  = document.getElementById(`progchar-${playerId}`);
  if (fill) fill.style.height = pct + '%';
  if (char) char.style.bottom = Math.max(0, pct - 8) + '%';
}

/* ──────────────────────────────────────────────────────────
   GHOST REPLAY
   ────────────────────────────────────────────────────────── */
function buildGhostOverlay() {
  const key = `typeracer_ghost_v1_${state.theme}_${state.difficulty}`;
  let ghost; try { ghost = JSON.parse(localStorage.getItem(key)); } catch {}
  if (!ghost || !ghost.timings || !ghost.timings.length) return;

  const inner = document.getElementById(`inner-${state.playerId}`);
  if (!inner) return;
  ghostEl = document.createElement('div');
  ghostEl.id = 'ghost-char';
  ghostEl.style.cssText = [
    `position:absolute`,
    `bottom:${charBottomPx(0)}px`,
    `left:calc(50% + 34px)`,
    `opacity:0.36`,
    `pointer-events:none`,
    `transition:bottom 0.7s ease,left 0.5s ease`,
    `filter:grayscale(0.5) hue-rotate(160deg)`,
    `z-index:6`,
  ].join(';');
  ghostEl.innerHTML = buildCharacterHTML(state.theme, state.myCharIndex, 998);
  const lbl = document.createElement('div');
  lbl.style.cssText = 'position:absolute;top:-18px;left:0;width:100%;text-align:center;font-size:0.62rem;color:rgba(255,255,255,0.55);white-space:nowrap;font-family:Nunito,sans-serif;font-weight:700;';
  lbl.textContent = '👻 ' + (ghost.wpm ? ghost.wpm + ' WPM' : 'Best');
  ghostEl.appendChild(lbl);
  inner.appendChild(ghostEl);
}

function startGhostReplay() {
  if (!ghostEl) return;
  const key = `typeracer_ghost_v1_${state.theme}_${state.difficulty}`;
  let ghost; try { ghost = JSON.parse(localStorage.getItem(key)); } catch {}
  if (!ghost || !ghost.timings) return;
  ghostTimers.forEach(clearTimeout); ghostTimers.length = 0;
  ghost.timings.forEach(({ wordIndex, elapsed }) => {
    const t = setTimeout(() => {
      if (!ghostEl) return;
      const floor  = wordIndex + 1;
      ghostEl.style.bottom = charBottomPx(floor) + 'px';
      const isLeft = floor % 2 === 1;
      ghostEl.style.left   = `calc(${isLeft ? '29.5%' : '70.5%'} + 8px)`;
    }, elapsed);
    ghostTimers.push(t);
  });
}

function saveGhostBest() {
  if (ghostRec.length !== state.words.length) return;
  const key      = `typeracer_ghost_v1_${state.theme}_${state.difficulty}`;
  const lastTime = ghostRec[ghostRec.length - 1].elapsed;
  let existing; try { existing = JSON.parse(localStorage.getItem(key)); } catch {}
  if (!existing || lastTime < existing.totalTime) {
    localStorage.setItem(key, JSON.stringify({
      totalTime: lastTime, timings: [...ghostRec], wpm: state.wpm, savedAt: Date.now(),
    }));
  }
}

function showXpPopup(xpGained, leveledUp, newLevel, title) {
  const popup = document.createElement('div');
  popup.className = 'xp-popup';
  popup.innerHTML = leveledUp
    ? `<div class="xp-lvl">🎉 LEVEL UP!</div><div class="xp-num">Level ${newLevel} · ${title}</div><div class="xp-amt">+${xpGained} XP</div>`
    : `<div class="xp-amt">+${xpGained} XP</div>`;
  document.body.appendChild(popup);
  gsap.fromTo(popup, { y:60, opacity:0, scale:0.8 }, { y:0, opacity:1, scale:1, duration:0.5, ease:'back.out(2)',
    onComplete: () => gsap.to(popup, { y:-40, opacity:0, duration:0.5, delay: leveledUp ? 3.5 : 2,
      onComplete: () => popup.remove() }) });
}

/* ──────────────────────────────────────────────────────────
   CAMERA SCROLL
   ────────────────────────────────────────────────────────── */
function scrollCamera(playerId, floor) {
  const inner = document.getElementById(`inner-${playerId}`);
  const arena = document.getElementById(`arena-${playerId}`);
  if (!inner || !arena) return;
  const arenaH  = arena.clientHeight || 420;
  const ih      = innerH(state.words.length);
  const charB   = charBottomPx(floor);
  const tY      = Math.max(0, Math.min(ih - arenaH, charB - arenaH * CAM_FROM_BOT));
  gsap.to(inner, { y: tY, duration: 0.65, ease: 'power2.inOut' });
}

/* ──────────────────────────────────────────────────────────
   CHARACTER JUMP
   - y-transform arc for vertical movement
   - x-transform for horizontal zigzag between left/right platforms
   - CSS bottom snapped instantly; all visual movement via transforms
   ────────────────────────────────────────────────────────── */

function animateCharacterJump(playerId, toFloor) {
  const wrap = document.getElementById(`char-${playerId}`);
  if (!wrap) return;

  gsap.killTweensOf(wrap);
  gsap.set(wrap, { y: 0, scaleX: 1, scaleY: 1 });

  const anim    = charAnimators[playerId];
  const isLeft  = toFloor % 2 === 1;
  const platPct = toFloor === 0 ? 0.50 : (isLeft ? 0.295 : 0.705);
  const targetB = charBottomPx(toFloor);

  // Face direction of travel before moving
  const flipper = document.getElementById(`flip-${playerId}`);
  if (flipper) flipper.style.transform = isLeft ? 'scaleX(-1)' : 'scaleX(1)';

  // CSS transitions on left + bottom → smooth walk (no arc/fly)
  wrap.style.left   = (platPct * 100) + '%';
  wrap.style.bottom = targetB + 'px';

  if (anim) anim.onJump();
  scrollCamera(playerId, toFloor);

  // After walk completes, face next platform
  setTimeout(() => {
    if (anim) anim.onLand();
    if (flipper) flipper.style.transform = isLeft ? 'scaleX(1)' : 'scaleX(-1)';
  }, 750);

  // Flash platform on arrival
  const plat = document.getElementById(`plat-${playerId}-${toFloor}`);
  if (plat) { plat.classList.add('lit'); setTimeout(() => plat.classList.remove('lit'), 550); }

  if (playerId === state.playerId) {
    setTimeout(() => {
      const r = wrap.getBoundingClientRect();
      starBurst(r.left + r.width / 2, r.top, 5);
    }, 500);
  }
}

/* ──────────────────────────────────────────────────────────
   PLATFORM WORD
   ────────────────────────────────────────────────────────── */
function markTargetPlatform(wordIdx) {
  const total = state.words.length;
  for (let f = 1; f <= total; f++) {
    const plat   = document.getElementById(`plat-${state.playerId}-${f}`);
    const wordEl = document.getElementById(`platword-${f}`);
    const tf     = wordIdx + 1;
    if (plat)   plat.classList.toggle('target-plat', f === tf);
    if (!wordEl) continue;
    if (f < tf) {
      wordEl.className = 'plat-word past';
    } else if (f === tf) {
      wordEl.className = 'plat-word';
      wordEl.innerHTML = `<span class="t"></span><span class="r">${escHtml(state.words[wordIdx]||'')}</span>`;
    } else {
      wordEl.className = 'plat-word future';
      wordEl.innerHTML = `<span class="t"></span><span class="r">${escHtml(state.words[f-1]||'')}</span>`;
    }
  }
}

function updatePlatWord() {
  const f  = state.currentWordIndex + 1;
  const el = document.getElementById(`platword-${f}`);
  if (!el) return;
  const word = state.words[state.currentWordIndex] || '';
  let html = '';
  for (let i = 0; i < word.length; i++) {
    const res = state.charResults[i];
    const ch  = escHtml(word[i]);
    if (!res) {
      html += i === state.charIndex
        ? `<span class="ch-cur">${ch}</span>`
        : `<span class="ch-rest">${ch}</span>`;
    } else if (res.correct) {
      html += `<span class="ch-done">${ch}</span>`;
    } else {
      html += `<span class="ch-wrong">${escHtml(res.typed)}</span>`;
    }
  }
  el.innerHTML = html;
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ══════════════════════════════════════════════════════════
   SCORE
   ══════════════════════════════════════════════════════════ */
function addScore() {
  const now     = Date.now();
  const elapsed = state.lastWordTime ? now - state.lastWordTime : 3500;
  state.lastWordTime = now;
  const base  = 100;
  const bonus = Math.round(Math.max(0, 420 - elapsed / 7));
  const gain  = Math.round((base + bonus) * state.combo);
  state.score += gain;
  updateScoreDisplay(gain);
}

function updateScoreDisplay(flash=0) {
  if (scoreDisplayEl) scoreDisplayEl.textContent = `⭐ ${state.score.toLocaleString()}`;
  if (flash) {
    gsap.fromTo(scoreDisplayEl,
      { scale:1.5, color:'#FCD34D' },
      { scale:1,   color:'#FCD34D', duration:0.4, ease:'back.out(2)' }
    );
  }
  const sc = document.querySelector(`#header-${state.playerId} .col-score`);
  if (sc) sc.textContent = ` · ${state.score}`;
}

function updateWordCounter() {
  const t     = THEMES[state.theme];
  const label = t ? t.platformWord : 'Step';
  wordCounterEl.textContent = `${label} ${state.currentWordIndex + 1} of ${state.words.length}`;
}

/* ══════════════════════════════════════════════════════════
   CUTSCENE
   ══════════════════════════════════════════════════════════ */
let cutscenePanel = 0;
const cutsceneOverlay = document.getElementById('cutscene-overlay');
const btnSkipStory    = document.getElementById('btn-skip-story');
const btnNextPanel    = document.getElementById('btn-next-panel');

function showCutscene() {
  if (localStorage.getItem('typeracer_skip_cutscene') === '1') { signalCutsceneDone(); return; }
  cutscenePanel = 0;
  cutsceneOverlay.classList.remove('hidden');
  const dotsEl = document.getElementById('cutscene-dots');
  dotsEl.innerHTML = '';
  const panels = (THEMES[state.theme]||{}).storyPanels||[];
  panels.forEach((_,i) => {
    const d = document.createElement('div');
    d.className = 'dot' + (i===0?' active':'');
    dotsEl.appendChild(d);
  });
  gsap.fromTo('.cutscene-card',
    { y:60, opacity:0, scale:0.9 },
    { y:0,  opacity:1, scale:1,  duration:0.5, ease:'back.out(1.7)' }
  );
  renderCutscenePanel(0);
}

function renderCutscenePanel(idx) {
  const panels = (THEMES[state.theme]||{}).storyPanels||[];
  if (!panels.length) { hideCutscene(); return; }
  const panel  = panels[idx];
  const isLast = idx === panels.length - 1;
  document.querySelectorAll('.dot').forEach((d,i) => d.classList.toggle('active', i===idx));
  document.getElementById('panel-scene').style.background = panel.sceneBg;
  const emEl = document.getElementById('panel-scene-emojis');
  emEl.innerHTML = '';
  panel.sceneEmojis.forEach((e,i) => {
    const s = document.createElement('span');
    s.textContent = e;
    emEl.appendChild(s);
    gsap.fromTo(s,{ y:-40,opacity:0,scale:0.5,rotation:(i-1)*20},
                  { y:0,  opacity:1,scale:1,  rotation:0, duration:0.5, ease:'back.out(2)', delay:i*0.1});
  });
  [['#panel-badge',panel.badge],['#panel-title',panel.title],
   ['#panel-text',panel.text], ['#speech-char',panel.charEmoji],
   ['#speech-bubble',panel.charSay]].forEach(([sel,val]) => {
    const el = document.querySelector(sel);
    if (el) el.textContent = val;
  });
  gsap.from('.panel-content > *', { y:20, opacity:0, duration:0.4, stagger:0.08, ease:'power2.out', delay:0.2 });
  btnNextPanel.textContent = isLast ? 'Play! 🚀' : 'Next →';
}

function advanceCutscene() {
  const panels = (THEMES[state.theme]||{}).storyPanels||[];
  if (cutscenePanel < panels.length - 1) {
    gsap.to('.panel-content', { x:-30, opacity:0, duration:0.2, ease:'power2.in', onComplete: () => {
      cutscenePanel++;
      renderCutscenePanel(cutscenePanel);
      gsap.fromTo('.panel-content', { x:30, opacity:0 }, { x:0, opacity:1, duration:0.3, ease:'power2.out' });
    }});
  } else { hideCutscene(); }
}

function hideCutscene() {
  if (document.getElementById('chk-skip-forever')?.checked) {
    localStorage.setItem('typeracer_skip_cutscene', '1');
  }
  gsap.to('.cutscene-card', { y:-40, opacity:0, scale:0.9, duration:0.4, ease:'power2.in',
    onComplete: () => { cutsceneOverlay.classList.add('hidden'); signalCutsceneDone(); }
  });
}

function signalCutsceneDone() {
  socket.emit('cutscene-done');
  // Show a waiting state until all players are done
  countdownOverlay.classList.remove('hidden');
  countdownNumber.className = 'countdown-number';
  countdownNumber.textContent = '⏳';
  let waitSub = document.getElementById('countdown-wait-sub');
  if (!waitSub) {
    waitSub = document.createElement('div');
    waitSub.id = 'countdown-wait-sub';
    waitSub.style.cssText = 'font-size:1rem;color:rgba(255,255,255,0.7);margin-top:10px;text-align:center;font-family:Nunito,sans-serif;font-weight:700;';
    countdownOverlay.appendChild(waitSub);
  }
  waitSub.textContent = 'Waiting for others…';
  waitSub.style.display = 'block';
}

btnNextPanel.addEventListener('click', advanceCutscene);
btnSkipStory.addEventListener('click', () => {
  if (document.getElementById('chk-skip-forever')?.checked) {
    localStorage.setItem('typeracer_skip_cutscene', '1');
  }
  gsap.to('.cutscene-card', { opacity:0, scale:0.8, duration:0.3, ease:'power2.in',
    onComplete: () => { cutsceneOverlay.classList.add('hidden'); signalCutsceneDone(); }
  });
});

/* ══════════════════════════════════════════════════════════
   COUNTDOWN
   ══════════════════════════════════════════════════════════ */
function startCountdown() {
  // Hide the "waiting for others" sub-text if present
  const waitSub = document.getElementById('countdown-wait-sub');
  if (waitSub) waitSub.style.display = 'none';
  countdownOverlay.classList.remove('hidden');
  gsap.set(countdownOverlay, { opacity:1 });
  const steps = ['3','2','1','GO!'];
  let i = 0;
  function tick() {
    const val = steps[i];
    countdownNumber.textContent = val;
    countdownNumber.className   = val === 'GO!' ? 'countdown-go' : 'countdown-number';
    gsap.fromTo(countdownNumber,
      { scale:2.5, opacity:0, rotation:-15 },
      { scale:1,   opacity:1, rotation:0, duration:0.45, ease:'back.out(2)' }
    );
    i++;
    if (i < steps.length) {
      setTimeout(tick, val === 'GO!' ? 650 : 900);
    } else {
      setTimeout(enableTyping, 650);
    }
  }
  tick();
}

function enableTyping() {
  gsap.to(countdownOverlay, { opacity:0, duration:0.35, onComplete: () => {
    countdownOverlay.classList.add('hidden');
    gsap.set(countdownOverlay, { opacity:1 });
  }});
  state.gameActive      = true;
  state.lastWordTime    = Date.now();
  state.gameStartTime   = Date.now();
  state.totalCharsTyped = 0;
  state.wpm             = 0;
  state.charIndex       = 0;
  state.charResults     = [];
  if (wpmDisplayEl) wpmDisplayEl.textContent = '0 WPM';
  updatePlatWord();
  // Start idle animation on all characters
  Object.values(charAnimators).forEach(a => a.set('idle'));
  startGhostReplay();
  if (state.roundType === 'timeattack')  startTimeAttack();
  else if (state.roundType === 'survival') startSurvival();
}

function updateWpmDisplay() {
  if (!state.gameStartTime) return;
  const elapsed = (Date.now() - state.gameStartTime) / 60000;
  if (elapsed < 0.02) return; // skip first ~1s to avoid huge spike
  state.wpm = Math.round((state.totalCharsTyped / 5) / elapsed);
  if (wpmDisplayEl) {
    wpmDisplayEl.textContent = `${state.wpm} WPM`;
    // Color hint: green = fast, yellow = mid, lavender = slow
    wpmDisplayEl.style.color = state.wpm >= 40 ? '#4ade80' : state.wpm >= 20 ? '#FCD34D' : '#A78BFA';
  }
}

/* ══════════════════════════════════════════════════════════
   SOUND ENGINE  (Web Audio API)
   ══════════════════════════════════════════════════════════ */
let _audioCtx = null;
function _ac() {
  if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return _audioCtx;
}
function _tone(freq, type, dur, vol, delay = 0) {
  try {
    const ctx = _ac(), osc = ctx.createOscillator(), g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = type; osc.frequency.value = freq;
    const t = ctx.currentTime + delay;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.start(t); osc.stop(t + dur);
  } catch {}
}

function playKeyClick() {
  _tone(1100, 'sine', 0.045, 0.055);
}
function playWrongKey() {
  _tone(160, 'square', 0.13, 0.09);
}
function playWordChime() {
  _tone(523, 'sine', 0.18, 0.13, 0);
  _tone(784, 'sine', 0.22, 0.16, 0.13);
}
function playFinishFanfare() {
  [523, 659, 784, 1047].forEach((f, i) => _tone(f, 'sine', 0.28, 0.15, i * 0.13));
}

/* ══════════════════════════════════════════════════════════
   TYPING  —  direct keydown capture, no textbox
   ══════════════════════════════════════════════════════════ */

document.addEventListener('keydown', e => {
  if (!state.gameActive) return;
  // Only single printable characters — ignore ctrl/meta/alt combos and special keys
  if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
  e.preventDefault();

  const word = state.words[state.currentWordIndex] || '';
  if (!word || state.charIndex >= word.length) return;

  const expected = word[state.charIndex].toLowerCase();
  const isCorrect = e.key.toLowerCase() === expected;

  if (!isCorrect) {
    playWrongKey();
    if (state.roundType === 'suddendeath' && !state.eliminated) {
      state.eliminated = true;
      state.gameActive = false;
      showEliminatedOverlay('⚡ One mistake!<br>You\'re out!');
      return;
    }
    if (state.streak > 0) { state.streak = 0; state.combo = 1; updateStreakDisplay(); }
    const f = state.currentWordIndex + 1;
    const platEl = document.getElementById(`platword-${f}`);
    if (platEl) {
      platEl.classList.remove('word-error');
      void platEl.offsetWidth; // force reflow so re-triggering restarts animation
      platEl.classList.add('word-error');
      setTimeout(() => platEl.classList.remove('word-error'), 350);
    }
    return;
  }

  // Correct key — record and advance
  playKeyClick();
  state.charResults[state.charIndex] = { typed: e.key, correct: true };
  state.charIndex++;
  state.totalCharsTyped++;
  updateWpmDisplay();

  // Walk animation on every keystroke
  const anim = charAnimators[state.playerId];
  if (anim) anim.onType();
  clearTimeout(idleTypingTimer);
  idleTypingTimer = setTimeout(() => { if (anim) anim.onIdle(); }, 1200);

  // Incrementally walk character toward next platform as letters are typed
  const floor    = playerFloors[state.playerId] || 0;
  const nextFloor = floor + 1;
  const curPct  = floor === 0 ? 0.50 : (floor % 2 === 1 ? 0.295 : 0.705);
  const nxtPct  = nextFloor % 2 === 1 ? 0.295 : 0.705;
  const progress = Math.min(state.charIndex / word.length, 0.82);
  const wrap = document.getElementById(`char-${state.playerId}`);
  if (wrap) wrap.style.left = (curPct + (nxtPct - curPct) * progress) * 100 + '%';

  // Update per-character display
  updatePlatWord();
  updateParagraphBanner();

  // Word complete → jump
  if (state.charIndex >= word.length) {
    handleCorrect();
  }
});

function handleCorrect() {
  playWordChime();
  const done     = state.currentWordIndex;
  const newFloor = done + 1;
  addScore();
  state.streak++;
  state.combo = state.streak >= 15 ? 3 : state.streak >= 10 ? 2 : state.streak >= 5 ? 1.5 : 1;
  updateStreakDisplay();
  state.currentWordIndex++;
  updateParagraphBanner();
  state.charIndex   = 0;
  state.charResults = [];
  clearTimeout(idleTypingTimer);

  // Mark done platform word (show all chars as completed)
  const doneWordEl = document.getElementById(`platword-${newFloor}`);
  if (doneWordEl) {
    doneWordEl.className = 'plat-word past';
    const w = state.words[done] || '';
    doneWordEl.innerHTML = w.split('').map(ch => `<span class="ch-done">${escHtml(ch)}</span>`).join('');
  }
  const donePlat = document.getElementById(`plat-${state.playerId}-${newFloor}`);
  if (donePlat) donePlat.classList.remove('target-plat');

  // Jump
  if ((playerFloors[state.playerId]||0) !== newFloor) {
    playerFloors[state.playerId] = newFloor;
    animateCharacterJump(state.playerId, newFloor);
  }

  updateProgressBar(state.playerId, state.currentWordIndex);
  if (state.gameStartTime) ghostRec.push({ wordIndex: done, elapsed: Date.now() - state.gameStartTime });
  socket.emit('word-correct', { wordIndex: done, score: state.score, wpm: state.wpm });

  if (state.currentWordIndex < state.words.length) {
    markTargetPlatform(state.currentWordIndex);
    updateWordCounter();
    // Resume walking after landing
    setTimeout(() => {
      const a = charAnimators[state.playerId];
      if (a && a.state === 'jumping') a.onLand();
    }, 700);
  } else {
    state.gameActive = false;
    wordCounterEl.textContent = 'All done! 🏁';
    gsap.fromTo(wordCounterEl, { scale:1.4 }, { scale:1, duration:0.4, ease:'back.out(2)' });
    const a = charAnimators[state.playerId];
    if (a) a.set('idle');
  }
}

/* ══════════════════════════════════════════════════════════
   OTHER PLAYERS PROGRESS
   ══════════════════════════════════════════════════════════ */
function handleProgressUpdate(players) {
  state.players = players;
  players.forEach(p => {
    if (p.id === state.playerId) return;
    const newFloor = Math.round((p.progress / 100) * state.words.length);
    if (newFloor !== (playerFloors[p.id]||0)) {
      playerFloors[p.id] = newFloor;
      animateCharacterJump(p.id, newFloor);
    }
    const wordsDone = Math.round(p.progress / 100 * state.words.length);
    updateProgressBar(p.id, wordsDone);
  });
}

/* ══════════════════════════════════════════════════════════
   FINISHED BANNER
   ══════════════════════════════════════════════════════════ */
function showFinishedMessage(place) {
  playFinishFanfare();
  const labels = ['','🥇 1st Place!','🥈 2nd Place!','🥉 3rd Place!'];
  const label  = labels[place] || `#${place} Place!`;
  finishedMsgEl.innerHTML = `
    <div class="finished-msg">${label}</div>
    <div class="finished-sub">⭐ ${state.score.toLocaleString()} · ${state.wpm} WPM — Waiting for others…</div>`;
  finishedOverlay.classList.remove('hidden');
  gsap.fromTo(finishedOverlay, { opacity:0, scale:0.8 }, { opacity:1, scale:1, duration:0.5, ease:'back.out(1.7)' });
  gameConfetti.launch(3000);
  setTimeout(() => gsap.to(finishedOverlay, { opacity:0, duration:0.4, onComplete:() => finishedOverlay.classList.add('hidden') }), 4500);
}

/* ══════════════════════════════════════════════════════════
   RESULTS
   ══════════════════════════════════════════════════════════ */
const btnPlayAgain = document.getElementById('btn-play-again');
const btnNewGame   = document.getElementById('btn-new-game');

function showResults(results) {
  state.gameActive = false;
  showScreen('screen-results');
  resultsConfetti.launch(6000);

  // Save profile (local)
  const myResult = results.find(r => r.id === state.playerId);
  if (myResult) {
    const profile = PlayerProfile.afterRace({ name: state.playerName, score: state.score, place: myResult.place, wpm: state.wpm });
    saveGhostBest();
    updateProfileBar(profile);
    // Post to server if logged in
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d && d.user) {
          fetch('/api/users/game-result', {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              game_type:     'type-racer',
              theme:         state.theme,
              difficulty:    state.difficulty,
              score:         state.score,
              words_correct: state.words ? Math.round(myResult.progress / 100 * state.words.length) : 0,
              words_total:   state.words ? state.words.length : 0,
              wpm:           state.wpm,
              placement:     myResult.place,
              players_count: results.length,
            }),
          })
          .then(r => r.ok ? r.json() : null)
          .then(data => { if (data && data.xpGained) showXpPopup(data.xpGained, data.leveledUp, data.newLevel, data.title); })
          .catch(() => {});
        }
      }).catch(() => {});
  }

  const t       = THEMES[state.theme];
  const podiumEl = document.getElementById('podium');
  const listEl   = document.getElementById('results-list');

  const top3    = results.slice(0,3);
  const heights = [90, 130, 60];
  const colors  = ['#C0C0C0','#FCD34D','#CD7F32'];
  const order   = top3.length >= 3 ? [top3[1],top3[0],top3[2]]
                : top3.length === 2 ? [top3[0],top3[1]] : [top3[0]];

  podiumEl.innerHTML = '';
  order.forEach((p, i) => {
    if (!p) return;
    const ci   = p.charIndex !== undefined ? p.charIndex : 0;
    const chars = t ? t.characters : ['🎮'];
    const char = chars[ci % chars.length];
    const div  = document.createElement('div');
    div.className = 'podium-place';
    div.innerHTML = `
      <div class="podium-char">${char}</div>
      <div class="podium-name">${p.name}</div>
      <div class="podium-block" style="height:${heights[i]}px;background:${colors[i]}">${placeLabel(p.place)}</div>`;
    podiumEl.appendChild(div);
  });
  gsap.from('.podium-block', { scaleY:0, transformOrigin:'bottom', duration:0.7, stagger:0.15, ease:'back.out(1.7)', delay:0.4 });
  gsap.from('.podium-char',  { y:-50, opacity:0, duration:0.6, stagger:0.1, ease:'bounce.out', delay:0.8 });

  listEl.innerHTML = '';
  results.forEach((p, i) => {
    const ci    = p.charIndex !== undefined ? p.charIndex : i;
    const chars = t ? t.characters : ['🎮'];
    const char  = chars[ci % chars.length];
    const li    = document.createElement('div');
    li.className = 'result-item' + (p.id === state.playerId ? ' is-you' : '');
    li.innerHTML = `
      <span class="result-place">${placeLabel(p.place)}</span>
      <span>${char}</span>
      <span class="result-name">${p.name}${p.id===state.playerId?' (you)':''}</span>
      <span class="result-score">⭐ ${(p.score||0).toLocaleString()}</span>
      <span class="result-wpm">${p.wpm ? p.wpm+' WPM' : '—'}</span>`;
    listEl.appendChild(li);
    gsap.from(li, { x:-40, opacity:0, duration:0.4, delay:0.6+i*0.08, ease:'power2.out' });
  });

  btnPlayAgain.classList.toggle('hidden', !state.isHost);
}

btnPlayAgain.addEventListener('click', () => { resultsConfetti.stop(); socket.emit('play-again'); });
btnNewGame.addEventListener('click',   () => { resultsConfetti.stop(); window.location.href='/'; });

/* ══════════════════════════════════════════════════════════
   SOCKET EVENTS
   ══════════════════════════════════════════════════════════ */
socket.on('room-created', ({ roomCode, playerId }) => {
  Object.assign(state, { roomCode, playerId, isHost: true });
  showScreen('screen-lobby'); renderLobby();
});
socket.on('room-joined', ({ roomCode, playerId }) => {
  Object.assign(state, { roomCode, playerId, isHost: false });
  showScreen('screen-lobby'); renderLobby();
});
socket.on('join-error', ({ message }) => showError(message));

socket.on('player-joined', ({ players, host }) => {
  state.players = players;
  state.isHost  = host === state.playerId;
  const me = players.find(p => p.id === state.playerId);
  if (me) state.myCharIndex = me.charIndex;
  renderPlayerList();
  updateHostVisibility();
  updateStartButton();
  updateReadyButton();
  if (state.isHost) { renderThemePicker(); renderDifficultyPicker(); renderRoundTypePicker(); }
});
socket.on('options-updated', ({ theme, difficulty, roundType }) => {
  state.theme = theme; state.difficulty = difficulty;
  if (roundType) state.roundType = roundType;
  renderThemePicker(); renderDifficultyPicker(); renderRoundTypePicker(); renderPlayerList();
});
socket.on('character-updated', ({ players }) => {
  state.players = players;
  renderPlayerList();
});
socket.on('game-starting', ({ words, theme, difficulty, players, roundType, paragraph }) => {
  Object.assign(state, { words, theme, difficulty, players, roundType: roundType || 'normal', paragraph: paragraph || null, currentWordIndex: 0, charIndex: 0, charResults: [] });
  const me = players.find(p => p.id === state.playerId);
  state.myCharIndex = me ? me.charIndex : 0;
  showScreen('screen-game');
  initGame();
});
socket.on('game-start', () => startCountdown());
socket.on('progress-update', ({ players }) => handleProgressUpdate(players));
socket.on('you-finished',    ({ place })   => showFinishedMessage(place));
socket.on('game-over',       ({ results }) => setTimeout(() => showResults(results), 1800));
socket.on('back-to-lobby', ({ players, host, theme, difficulty, roundType }) => {
  Object.assign(state, { players, theme, difficulty, roundType: roundType || 'normal', currentWordIndex: 0, charIndex: 0, charResults: [] });
  state.isHost = host === state.playerId;
  const me = players.find(p => p.id === state.playerId);
  state.myCharIndex = me ? me.charIndex : 0;
  showScreen('screen-lobby'); renderLobby();
});

/* ══════════════════════════════════════════════════════════
   ROUND MODES
   ══════════════════════════════════════════════════════════ */
function startTimeAttack() {
  let left = 60;
  const hud = document.getElementById('time-attack-hud');
  if (hud) { hud.classList.remove('hidden'); hud.textContent = `⏱️ ${left}s`; }
  clearInterval(state.taTimer);
  state.taTimer = setInterval(() => {
    left--;
    if (hud) {
      hud.textContent = `⏱️ ${left}s`;
      hud.className = 'time-attack-hud' + (left <= 10 ? ' urgent' : '');
      if (left <= 10) gsap.fromTo(hud, { scale:1.3 }, { scale:1, duration:0.3 });
    }
    if (left <= 0) {
      clearInterval(state.taTimer); state.taTimer = null;
      if (state.gameActive) {
        state.gameActive = false;
        wordCounterEl.textContent = "⏱️ Time's Up!";
        gsap.fromTo(wordCounterEl, { scale:1.4 }, { scale:1, duration:0.4 });
        showEliminatedOverlay(`⏱️ Time's Up!<br>Score: ${state.score.toLocaleString()}`);
        socket.emit('word-correct', { wordIndex: Math.max(0, state.currentWordIndex - 1), score: state.score, wpm: state.wpm });
      }
    }
  }, 1000);
}

function startSurvival() {
  let tick = 0;
  clearInterval(state.survivalTimer);
  state.survivalTimer = setInterval(() => {
    if (!state.gameActive) { clearInterval(state.survivalTimer); return; }
    tick++;
    const alive = state.players.filter(p => !p.eliminated);
    if (alive.length <= 1) { clearInterval(state.survivalTimer); return; }
    const sorted = [...alive].sort((a, b) => a.progress - b.progress);
    const last = sorted[0];
    if (tick === 1) {
      if (last.id === state.playerId) showSurvivalWarning();
    } else {
      clearInterval(state.survivalTimer);
      if (last.id === state.playerId) {
        state.eliminated = true;
        state.gameActive = false;
        showEliminatedOverlay('💀 Eliminated!<br>You were in last place!');
      }
    }
  }, 30000);
}

function showSurvivalWarning() {
  let el = document.getElementById('survival-warn');
  if (!el) {
    el = document.createElement('div');
    el.id = 'survival-warn';
    el.style.cssText = 'position:fixed;top:80px;left:50%;transform:translateX(-50%);background:#dc2626;color:#fff;padding:10px 24px;border-radius:50px;font-weight:900;font-size:1rem;z-index:300;font-family:Nunito,sans-serif;display:none;pointer-events:none';
    document.body.appendChild(el);
  }
  el.textContent = '⚠️ You\'re last! 30s or you\'re eliminated!';
  el.style.display = 'block';
  gsap.fromTo(el, { y:-20, opacity:0 }, { y:0, opacity:1, duration:0.4 });
  setTimeout(() => gsap.to(el, { opacity:0, duration:0.5, onComplete:() => { el.style.display='none'; } }), 5000);
}

function showEliminatedOverlay(msg) {
  let el = document.getElementById('eliminated-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'eliminated-overlay';
    el.className = 'eliminated-overlay';
    document.getElementById('screen-game').appendChild(el);
  }
  el.innerHTML = `<div class="elim-inner"><div class="elim-icon">💀</div><div class="elim-msg">${msg}</div></div>`;
  el.style.display = 'flex';
  gsap.fromTo(el, { opacity:0, scale:0.7 }, { opacity:1, scale:1, duration:0.5, ease:'back.out(2)' });
}

/* ══════════════════════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════════════════════ */
function placeLabel(n) { return n===1?'🥇':n===2?'🥈':n===3?'🥉':`#${n}`; }
function shakeEl(el) {
  gsap.fromTo(el, { x:-10 }, { x:10, duration:0.06, ease:'power2.inOut', yoyo:true, repeat:5, onComplete:() => gsap.set(el,{x:0}) });
}
function pulseEl(el) { gsap.fromTo(el, { scale:0.93 }, { scale:1, duration:0.35, ease:'back.out(2)' }); }

/* Space stars */
(function() {
  const c = document.createElement('div');
  c.className = 'stars';
  for (let i = 0; i < 90; i++) {
    const s  = document.createElement('div');
    s.className = 'star';
    const sz = Math.random() * 3 + 1;
    s.style.cssText = `width:${sz}px;height:${sz}px;left:${Math.random()*100}%;top:${Math.random()*100}%;animation-delay:${Math.random()*2}s;animation-duration:${1.5+Math.random()*2}s`;
    c.appendChild(s);
  }
  document.body.appendChild(c);
})();
