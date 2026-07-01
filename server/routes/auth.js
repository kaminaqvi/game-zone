const express  = require('express');
const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const { Strategy: LocalStrategy  } = require('passport-local');
const bcrypt   = require('bcryptjs');
const { getPool } = require('../db/connection');

const router = express.Router();

/* ── Passport: Google OAuth ───────────────────────────────── */
if (process.env.GOOGLE_CLIENT_ID) {
  passport.use(new GoogleStrategy({
    clientID:     process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL:  process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback',
  }, async (accessToken, refreshToken, profile, done) => {
    const pool = await getPool();
    if (!pool) return done(null, false);
    try {
      const email  = profile.emails?.[0]?.value || null;
      const avatar = profile.photos?.[0]?.value  || null;
      let [rows] = await pool.query('SELECT * FROM users WHERE google_id = ?', [profile.id]);

      if (!rows.length) {
        if (email) {
          const [byEmail] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
          if (byEmail.length) {
            await pool.query('UPDATE users SET google_id=?, avatar_url=? WHERE email=?', [profile.id, avatar, email]);
            return done(null, byEmail[0]);
          }
        }
        const username = (profile.displayName || 'Player').trim().slice(0, 40) || `Player${Date.now()}`;
        const [r] = await pool.query(
          'INSERT INTO users (google_id, username, email, avatar_url) VALUES (?,?,?,?)',
          [profile.id, username, email, avatar]
        );
        [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [r.insertId]);
      }
      done(null, rows[0]);
    } catch (e) { done(e); }
  }));
}

/* ── Passport: Local (email + password) ───────────────────── */
passport.use(new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
  const pool = await getPool();
  if (!pool) return done(null, false, { message: 'Database unavailable' });
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
    if (!rows.length) return done(null, false, { message: 'Invalid email or password' });
    const user = rows[0];
    if (!user.password_hash) return done(null, false, { message: 'Please use Google Sign-In' });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return done(null, false, { message: 'Invalid email or password' });
    done(null, user);
  } catch (e) { done(e); }
}));

/* ── Session serialization ────────────────────────────────── */
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  const pool = await getPool();
  if (!pool) return done(null, false);
  try {
    const [rows] = await pool.query(
      'SELECT id, username, email, avatar_url, age, role FROM users WHERE id = ?', [id]
    );
    done(null, rows[0] || false);
  } catch (e) { done(e); }
});

/* ── Routes ───────────────────────────────────────────────── */

// Google OAuth
router.get('/google', (req, res, next) => {
  // Store a safe returnTo path so we can redirect back after Google auth
  const raw = req.query.returnTo;
  if (raw && /^\/[a-zA-Z0-9/\-._~:@!$&'()*+,;=?%]*$/.test(raw)) {
    req.session.authReturnTo = raw;
  }
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});
router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/?auth=fail' }),
  (req, res) => {
    const returnTo = req.session.authReturnTo || '/';
    delete req.session.authReturnTo;
    const sep = returnTo.includes('?') ? '&' : '?';
    res.redirect(returnTo + sep + 'auth=success');
  }
);

// Sign up (local)
router.post('/signup', express.json(), async (req, res) => {
  const pool = await getPool();
  if (!pool) return res.status(503).json({ error: 'Database unavailable' });
  const { username, email, password, age } = req.body;
  if (!username || !email || !password) return res.status(400).json({ error: 'Fill in all required fields' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const [r] = await pool.query(
      'INSERT INTO users (username, email, password_hash, age) VALUES (?,?,?,?)',
      [username.trim().slice(0, 40), email.toLowerCase().trim(), hash, age ? parseInt(age) : null]
    );
    const [rows] = await pool.query('SELECT id, username, email, avatar_url, age FROM users WHERE id = ?', [r.insertId]);
    req.login(rows[0], err => {
      if (err) return res.status(500).json({ error: 'Login failed after signup' });
      res.json({ user: rows[0] });
    });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Email already registered' });
    res.status(500).json({ error: 'Signup failed' });
  }
});

// Login (local)
router.post('/login', express.json(), (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) return res.status(500).json({ error: 'Auth error' });
    if (!user) return res.status(401).json({ error: info?.message || 'Login failed' });
    req.login(user, err => {
      if (err) return res.status(500).json({ error: 'Session error' });
      res.json({ user: { id: user.id, username: user.username, email: user.email, avatar_url: user.avatar_url } });
    });
  })(req, res, next);
});

// Current user
router.get('/me', (req, res) => res.json({ user: req.user || null }));

// Logout
router.post('/logout', (req, res) => {
  req.logout(err => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.json({ ok: true });
  });
});

module.exports = { router, passport };
