const express = require('express');
const { getPool } = require('../db/connection');
const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  next();
}

/* ── Profile ──────────────────────────────────────────────── */
router.get('/profile', requireAuth, async (req, res) => {
  const pool = await getPool();
  if (!pool) return res.status(503).json({ error: 'DB unavailable' });
  const [user]  = await pool.query('SELECT id,username,email,avatar_url,age,created_at FROM users WHERE id=?', [req.user.id]);
  const [stats] = await pool.query(`
    SELECT COUNT(*) total_games, COALESCE(MAX(score),0) high_score,
           ROUND(COALESCE(AVG(score),0)) avg_score,
           SUM(placement=1) wins
    FROM game_sessions WHERE user_id=?`, [req.user.id]);
  res.json({ user: user[0], stats: stats[0] });
});

router.patch('/profile', requireAuth, express.json(), async (req, res) => {
  const pool = await getPool();
  if (!pool) return res.status(503).json({ error: 'DB unavailable' });
  const { username, age } = req.body;
  const sets = []; const vals = [];
  if (username) { sets.push('username=?'); vals.push(username.trim().slice(0,40)); }
  if (age)      { sets.push('age=?');      vals.push(parseInt(age)); }
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
  vals.push(req.user.id);
  await pool.query(`UPDATE users SET ${sets.join(',')} WHERE id=?`, vals);
  res.json({ ok: true });
});

/* ── Game history ─────────────────────────────────────────── */
router.get('/history', requireAuth, async (req, res) => {
  const pool = await getPool();
  if (!pool) return res.json({ history: [] });
  const limit = Math.min(parseInt(req.query.limit || '30'), 100);
  const [rows] = await pool.query(`
    SELECT game_type,theme,difficulty,score,words_correct,words_total,placement,players_count,played_at
    FROM game_sessions WHERE user_id=? ORDER BY played_at DESC LIMIT ?`, [req.user.id, limit]);
  res.json({ sessions: rows });
});

/* ── Public profile (anyone can view) ────────────────────── */
router.get('/public/:username', async (req, res) => {
  const pool = await getPool();
  if (!pool) return res.status(503).json({ error: 'DB unavailable' });
  const [users] = await pool.query(
    'SELECT id, username, avatar_url, created_at FROM users WHERE username = ?',
    [req.params.username]
  );
  if (!users.length) return res.status(404).json({ error: 'User not found' });
  const u = users[0];
  const [stats] = await pool.query(`
    SELECT COUNT(*) total_games, COALESCE(MAX(score),0) high_score,
           ROUND(COALESCE(AVG(score),0)) avg_score,
           SUM(placement=1) wins, COALESCE(MAX(wpm),0) best_wpm
    FROM game_sessions WHERE user_id=?`, [u.id]);
  res.json({ user: u, stats: stats[0] });
});

router.get('/public/:username/history', async (req, res) => {
  const pool = await getPool();
  if (!pool) return res.json({ sessions: [] });
  const [users] = await pool.query('SELECT id FROM users WHERE username = ?', [req.params.username]);
  if (!users.length) return res.json({ sessions: [] });
  const limit = Math.min(parseInt(req.query.limit || '20'), 50);
  const [rows] = await pool.query(`
    SELECT game_type, theme, difficulty, score, wpm, words_correct, words_total, placement, players_count, played_at
    FROM game_sessions WHERE user_id=? ORDER BY played_at DESC LIMIT ?`,
    [users[0].id, limit]
  );
  res.json({ sessions: rows });
});

/* ── Save game result (called by client after game over) ──── */
router.post('/game-result', requireAuth, express.json(), async (req, res) => {
  const pool = await getPool();
  if (!pool) return res.status(503).json({ error: 'DB unavailable' });
  const { game_type='type-racer', theme, difficulty, score=0, words_correct=0, words_total=0, wpm=0, placement=1, players_count=1 } = req.body;
  await pool.query(
    `INSERT INTO game_sessions (user_id,game_type,theme,difficulty,score,words_correct,words_total,wpm,placement,players_count)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [req.user.id, game_type, theme||null, difficulty||null, score, words_correct, words_total, wpm||0, placement, players_count]
  );
  res.json({ ok: true });
});

module.exports = router;
