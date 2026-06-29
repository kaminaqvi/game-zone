'use strict';

/* ── Game catalogue ──────────────────────────────────────── */
const GAMES = [
  {
    id: 'type-racer',
    title: 'Type Racer',
    icon: '🏎️',
    desc: 'Race friends in real-time. Type words to move your character up the track. First to the top wins!',
    tags: ['Multiplayer', 'Typing'],
    gradient: 'linear-gradient(135deg,rgba(99,102,241,0.55) 0%,rgba(99,102,241,0.2) 100%)',
    url: '/games/type-racer/',
    available: true,
  },
  {
    id: 'spelling-bee',
    title: 'Spelling Bee',
    icon: '🐝',
    desc: 'Spell words correctly to help your bee collect honey before time runs out.',
    tags: ['Single Player', 'Spelling'],
    gradient: 'linear-gradient(135deg,rgba(245,158,11,0.55) 0%,rgba(245,158,11,0.2) 100%)',
    url: null,
    available: false,
  },
  {
    id: 'word-memory',
    title: 'Word Memory',
    icon: '🧠',
    desc: 'Remember and type sequences of words to train your memory and vocabulary.',
    tags: ['Single Player', 'Memory'],
    gradient: 'linear-gradient(135deg,rgba(16,185,129,0.55) 0%,rgba(16,185,129,0.2) 100%)',
    url: null,
    available: false,
  },
];

/* ── Auth state ──────────────────────────────────────────── */
let currentUser = null;

async function loadAuthState() {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      if (data.user) setLoggedIn(data.user);
      else setLoggedOut();
    } else {
      setLoggedOut();
    }
  } catch {
    setLoggedOut();
  }
}

function setLoggedIn(user) {
  currentUser = user;
  const navAuth   = document.getElementById('nav-auth');
  const navUser   = document.getElementById('nav-user');
  const navName   = document.getElementById('nav-username');
  const navAvatar = document.getElementById('nav-avatar');

  if (navAuth)   navAuth.classList.add('hidden');
  if (navUser)   navUser.classList.remove('hidden');
  if (navName)   navName.textContent = user.username;
  if (navAvatar) {
    if (user.avatar_url) {
      navAvatar.src = user.avatar_url;
    } else {
      const letter = encodeURIComponent((user.username || '?')[0].toUpperCase());
      navAvatar.src = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><rect width='40' height='40' rx='20' fill='%236366F1'/><text x='50%25' y='55%25' dominant-baseline='middle' text-anchor='middle' fill='white' font-size='18' font-family='system-ui'>${letter}</text></svg>`;
    }
  }
}

function setLoggedOut() {
  currentUser = null;
  const navAuth = document.getElementById('nav-auth');
  const navUser = document.getElementById('nav-user');
  if (navAuth) navAuth.classList.remove('hidden');
  if (navUser) navUser.classList.add('hidden');
}

async function logout() {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  setLoggedOut();
}

/* ── Game cards ──────────────────────────────────────────── */
function buildGameCards() {
  const grid = document.getElementById('games-grid');
  if (!grid) return;
  grid.innerHTML = '';
  GAMES.forEach(g => {
    const card = document.createElement('div');
    card.className = `game-card ${g.available ? 'available' : 'locked'}`;
    card.style.setProperty('--card-gradient', g.gradient);
    if (g.available) card.onclick = () => navigate(g.url);

    card.innerHTML = `
      ${!g.available ? '<span class="coming-soon-badge">Coming Soon</span>' : ''}
      <div class="card-icon">${g.icon}</div>
      <div class="card-title">${g.title}</div>
      <div class="card-desc">${g.desc}</div>
      <div class="card-meta">
        <div class="card-tags">${g.tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>
      </div>
      ${g.available ? '<button class="card-play-btn">Play Now →</button>' : ''}
    `;
    grid.appendChild(card);
  });
}

function navigate(url) {
  const overlay = document.getElementById('page-transition');
  if (overlay && typeof gsap !== 'undefined') {
    gsap.to(overlay, { opacity: 1, duration: 0.22, onComplete: () => { window.location.href = url; } });
  } else {
    window.location.href = url;
  }
}

/* ── Leaderboard preview ─────────────────────────────────── */
async function loadLeaderboard() {
  const wrap = document.getElementById('lb-preview-rows');
  if (!wrap) return;

  try {
    const res  = await fetch('/api/leaderboard?game=type-racer&period=week');
    const data = await res.json();
    const rows = (data.leaderboard || []).slice(0, 8);

    if (!rows.length) {
      wrap.innerHTML = '<div class="lb-loading">No games played yet — be the first!</div>';
      return;
    }

    const rankClass = r => r === 1 ? 'gold' : r === 2 ? 'silver' : r === 3 ? 'bronze' : '';
    const rankIcon  = r => r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : `#${r}`;

    wrap.innerHTML = rows.map(p => {
      const initial = (p.username || '?')[0].toUpperCase();
      const avatar  = p.avatar_url
        ? `<img class="lb-avatar" src="${p.avatar_url}" alt=""/>`
        : `<div class="lb-avatar" style="font-size:1.1rem">${initial}</div>`;
      return `
        <div class="lb-row">
          <div class="lb-rank ${rankClass(Number(p.rank))}">${rankIcon(Number(p.rank))}</div>
          <div class="lb-player">${avatar}<span class="lb-name">${escHtml(p.username)}</span></div>
          <div class="lb-score">${Number(p.high_score).toLocaleString()}</div>
          <div class="lb-games">${p.total_games} games</div>
        </div>`;
    }).join('');
  } catch {
    const wrap2 = document.getElementById('lb-preview-rows');
    if (wrap2) wrap2.innerHTML = '<div class="lb-loading">Leaderboard unavailable</div>';
  }
}

/* ── Auth modal ──────────────────────────────────────────── */
function openAuth(tab) {
  tab = tab || 'login';
  const modal = document.getElementById('auth-modal');
  if (modal) {
    modal.classList.remove('hidden');
    switchTab(tab);
  }
}

function closeAuth() {
  const modal = document.getElementById('auth-modal');
  if (modal) modal.classList.add('hidden');
  clearAuthError();
}

function closeAuthOnOverlay(e) {
  if (e.target === document.getElementById('auth-modal')) closeAuth();
}

function switchTab(tab) {
  const loginForm  = document.getElementById('form-login');
  const signupForm = document.getElementById('form-signup');
  const tabLogin   = document.getElementById('tab-login');
  const tabSignup  = document.getElementById('tab-signup');
  const googleBtn  = document.getElementById('google-btn');
  clearAuthError();
  if (tab === 'login') {
    loginForm.classList.remove('hidden');
    signupForm.classList.add('hidden');
    tabLogin.classList.add('active');
    tabSignup.classList.remove('active');
    if (googleBtn) googleBtn.innerHTML = svgGoogle() + 'Continue with Google';
  } else {
    loginForm.classList.add('hidden');
    signupForm.classList.remove('hidden');
    tabLogin.classList.remove('active');
    tabSignup.classList.add('active');
    if (googleBtn) googleBtn.innerHTML = svgGoogle() + 'Sign Up with Google';
  }
}

function svgGoogle() {
  return '<svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';
}

async function submitLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-login-submit');
  const fd  = new FormData(e.target);
  btn.disabled = true; btn.textContent = 'Logging in…';
  clearAuthError();
  try {
    const res  = await fetch('/api/auth/login', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: fd.get('email'), password: fd.get('password') }),
    });
    const data = await res.json();
    if (res.ok && data.user) {
      setLoggedIn(data.user);
      closeAuth();
    } else {
      showAuthError(data.error || 'Login failed');
    }
  } catch {
    showAuthError('Network error — please try again');
  }
  btn.disabled = false; btn.textContent = 'Log In';
}

async function submitSignup(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-signup-submit');
  const fd  = new FormData(e.target);
  btn.disabled = true; btn.textContent = 'Creating…';
  clearAuthError();
  try {
    const body = {
      username: fd.get('username'),
      email:    fd.get('email'),
      password: fd.get('password'),
    };
    const age = fd.get('age');
    if (age) body.age = parseInt(age, 10);
    const res  = await fetch('/api/auth/signup', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (res.ok && data.user) {
      setLoggedIn(data.user);
      closeAuth();
    } else {
      showAuthError(data.error || 'Signup failed');
    }
  } catch {
    showAuthError('Network error — please try again');
  }
  btn.disabled = false; btn.textContent = 'Create Account';
}

function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  if (el) { el.textContent = msg; el.classList.remove('hidden'); }
}

function clearAuthError() {
  const el = document.getElementById('auth-error');
  if (el) el.classList.add('hidden');
}

/* ── Player count stat ───────────────────────────────────── */
async function loadStats() {
  try {
    const res  = await fetch('/api/leaderboard?game=type-racer&period=all');
    const data = await res.json();
    const count = (data.leaderboard || []).length;
    const el = document.getElementById('stat-players');
    if (el && count > 0) el.textContent = count + '+';
  } catch { /* keep default */ }
}

/* ── Keyboard: Esc closes modal ──────────────────────────── */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeAuth();
});

/* ── Helpers ─────────────────────────────────────────────── */
function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ── Init ────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  buildGameCards();
  loadAuthState();
  loadLeaderboard();
  loadStats();

  const overlay = document.getElementById('page-transition');
  if (overlay && typeof gsap !== 'undefined') {
    gsap.to(overlay, { opacity: 0, duration: 0.3, delay: 0.1 });
  }
});
