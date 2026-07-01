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

/* ── Theme ───────────────────────────────────────────────── */
function initTheme() {
  const saved = localStorage.getItem('gz-theme') || 'dark';
  applyTheme(saved, false);
}

function applyTheme(theme, animate) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('gz-theme', theme);
  const icon = document.getElementById('theme-icon');
  if (icon) icon.textContent = theme === 'dark' ? '🌙' : '☀️';
  if (animate && neuralCtx) drawNeural(); // repaint canvas colors
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  applyTheme(current === 'dark' ? 'light' : 'dark', true);
}

/* ── Neural canvas ───────────────────────────────────────── */
let neuralCtx = null;
let neuralAnimId = null;
const PARTICLE_COUNT = 55;
const LINK_DIST = 130;
let particles = [];

function initNeural() {
  const canvas = document.getElementById('neural-canvas');
  if (!canvas) return;
  neuralCtx = canvas.getContext('2d');

  function resize() {
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const hero = canvas.parentElement;
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push({
      x:  Math.random() * canvas.width,
      y:  Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r:  Math.random() * 1.5 + 1,
    });
  }

  function drawNeural() {
    const isDark  = document.documentElement.getAttribute('data-theme') !== 'light';
    const dotClr  = isDark ? 'rgba(129,140,248,0.55)' : 'rgba(79,70,229,0.4)';
    const lineClr = isDark ? 'rgba(99,102,241,'        : 'rgba(79,70,229,';

    const w = canvas.width, h = canvas.height;
    neuralCtx.clearRect(0, 0, w, h);

    for (const p of particles) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h) p.vy *= -1;
    }

    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const d  = Math.sqrt(dx * dx + dy * dy);
        if (d < LINK_DIST) {
          const alpha = (1 - d / LINK_DIST) * 0.45;
          neuralCtx.beginPath();
          neuralCtx.strokeStyle = lineClr + alpha + ')';
          neuralCtx.lineWidth = 0.8;
          neuralCtx.moveTo(particles[i].x, particles[i].y);
          neuralCtx.lineTo(particles[j].x, particles[j].y);
          neuralCtx.stroke();
        }
      }
    }

    for (const p of particles) {
      neuralCtx.beginPath();
      neuralCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      neuralCtx.fillStyle = dotClr;
      neuralCtx.fill();
    }

    neuralAnimId = requestAnimationFrame(drawNeural);
  }

  drawNeural();
}

/* ── Cursor glow ─────────────────────────────────────────── */
function initCursorGlow() {
  const hero  = document.querySelector('.hero');
  const glow  = document.getElementById('hero-cursor-glow');
  if (!hero || !glow) return;

  hero.addEventListener('mousemove', e => {
    const rect = hero.getBoundingClientRect();
    glow.style.left = (e.clientX - rect.left) + 'px';
    glow.style.top  = (e.clientY - rect.top)  + 'px';
    glow.style.opacity = '1';
  });
  hero.addEventListener('mouseleave', () => { glow.style.opacity = '0'; });
  glow.style.opacity = '0';
  glow.style.transition = 'opacity 0.4s';
}

/* ── Typewriter ──────────────────────────────────────────── */
const TW_WORDS = ['Typing Skills', 'WPM Score', 'Racing Speed', 'Reaction Time', 'Game Rank'];
let twIndex = 0;
let twCharIndex = 0;
let twDeleting = false;
let twTimeout = null;

function runTypewriter() {
  const el = document.getElementById('tw-target');
  if (!el) return;
  const word = TW_WORDS[twIndex];

  if (!twDeleting) {
    twCharIndex++;
    el.textContent = word.slice(0, twCharIndex);
    if (twCharIndex === word.length) {
      twDeleting = true;
      twTimeout = setTimeout(runTypewriter, 1800);
      return;
    }
    twTimeout = setTimeout(runTypewriter, 90);
  } else {
    twCharIndex--;
    el.textContent = word.slice(0, twCharIndex);
    if (twCharIndex === 0) {
      twDeleting = false;
      twIndex = (twIndex + 1) % TW_WORDS.length;
      twTimeout = setTimeout(runTypewriter, 280);
      return;
    }
    twTimeout = setTimeout(runTypewriter, 48);
  }
}

/* ── Scroll reveal ───────────────────────────────────────── */
function initScrollReveal() {
  const els = document.querySelectorAll('[data-reveal]');
  if (!els.length) return;
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('revealed');
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });
  els.forEach(el => observer.observe(el));
}

/* ── Card 3-D tilt ───────────────────────────────────────── */
function initCardTilt() {
  document.querySelectorAll('.game-card.available').forEach(card => {
    card.addEventListener('mousemove', e => {
      const rect   = card.getBoundingClientRect();
      const cx     = rect.left + rect.width  / 2;
      const cy     = rect.top  + rect.height / 2;
      const rx     = ((e.clientY - cy) / (rect.height / 2)) * -8;
      const ry     = ((e.clientX - cx) / (rect.width  / 2)) *  8;
      card.style.transform = `perspective(1000px) rotateX(${rx}deg) rotateY(${ry}deg) scale(1.03)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale(1)';
      card.style.transition = 'transform 0.5s ease';
    });
    card.addEventListener('mouseenter', () => {
      card.style.transition = 'transform 0.1s ease, border-color 0.3s, box-shadow 0.3s';
    });
  });
}

/* ── Toast notification ──────────────────────────────────── */
function showToast(msg, type = 'success', duration = 3500) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const icon = type === 'success' ? '✅' : '❌';
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icon}</span><span>${escHtml(msg)}</span>`;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = 'opacity 0.4s, transform 0.4s';
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(12px)';
    setTimeout(() => toast.remove(), 420);
  }, duration);
}

/* ── Handle Google auth redirect params ──────────────────── */
function handleAuthParams() {
  const params = new URLSearchParams(window.location.search);
  if (params.has('auth')) {
    const val = params.get('auth');
    history.replaceState({}, '', '/');
    if (val === 'success') {
      showToast('Signed in with Google!', 'success');
    } else if (val === 'fail') {
      showToast('Google sign-in failed — please try again', 'error');
    }
  }
}

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
  showToast('Signed out successfully', 'success');
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

    const badge = g.available
      ? `<div class="card-live-badge"><div class="card-live-dot"></div>Live</div>`
      : `<span class="coming-soon-badge">Coming Soon</span>`;

    card.innerHTML = `
      ${badge}
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

  initCardTilt();
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
  const modal = document.getElementById('auth-modal');
  if (modal) {
    modal.classList.remove('hidden');
    switchTab(tab || 'login');
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
      showToast(`Welcome back, ${data.user.username}!`, 'success');
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
      showToast(`Welcome to GameZone, ${data.user.username}! 🎉`, 'success');
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
  initTheme();
  buildGameCards();
  loadAuthState();
  loadLeaderboard();
  loadStats();
  handleAuthParams();
  initNeural();
  initCursorGlow();
  initScrollReveal();
  setTimeout(runTypewriter, 1200);

  const overlay = document.getElementById('page-transition');
  if (overlay && typeof gsap !== 'undefined') {
    gsap.to(overlay, { opacity: 0, duration: 0.3, delay: 0.1 });
  }
});
