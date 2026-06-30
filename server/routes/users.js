const express = require('express');
const { getPool } = require('../db/connection');
const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  next();
}

/* ── XP helpers ───────────────────────────────────────────── */
const XP_TITLES = [[28,'God of Keys'],[22,'Legend'],[17,'Champion'],[12,'Word Wizard'],[8,'Speed Demon'],[5,'Contender'],[3,'Racer'],[1,'Rookie']];
function calcLevel(xp) { return Math.min(30, Math.floor(Math.sqrt(xp / 100)) + 1); }
function getTitle(level) { for (const [t,n] of XP_TITLES) if (level >= t) return n; return 'Rookie'; }
function calcXpGained(score, wpm, placement) {
  const pb = [0, 30, 20, 10, 5];
  return 50 + Math.floor(score / 200) + Math.max(0, wpm - 15) * 3 + (pb[placement] || 0);
}

/* ── Profile ──────────────────────────────────────────────── */
router.get('/profile', requireAuth, async (req, res) => {
  const pool = await getPool();
  if (!pool) return res.status(503).json({ error: 'DB unavailable' });
  const [user]  = await pool.query(
    'SELECT id,username,email,avatar_url,age,xp,level,created_at FROM users WHERE id=?',
    [req.user.id]
  );
  const [stats] = await pool.query(`
    SELECT COUNT(*) total_games, COALESCE(MAX(score),0) high_score,
           ROUND(COALESCE(AVG(score),0)) avg_score,
           SUM(placement=1) wins, COALESCE(MAX(wpm),0) best_wpm
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

/* ── XP & Level ───────────────────────────────────────────── */
router.get('/xp', requireAuth, async (req, res) => {
  const pool = await getPool();
  if (!pool) return res.status(503).json({ error: 'DB unavailable' });
  const [[u]] = await pool.query('SELECT COALESCE(xp,0) AS xp FROM users WHERE id=?', [req.user.id]);
  const xp    = u ? u.xp : 0;
  const level = calcLevel(xp);
  const prevXp = (level - 1) * (level - 1) * 100;
  const nextXp = level < 30 ? level * level * 100 : null;
  res.json({ xp, level, title: getTitle(level), prevXp, nextXp,
             xpInLevel: xp - prevXp, xpToNext: nextXp ? nextXp - xp : 0 });
});

/* ── Game history ─────────────────────────────────────────── */
router.get('/history', requireAuth, async (req, res) => {
  const pool = await getPool();
  if (!pool) return res.json({ history: [] });
  const limit = Math.min(parseInt(req.query.limit || '30'), 100);
  const [rows] = await pool.query(`
    SELECT game_type,theme,difficulty,score,wpm,words_correct,words_total,placement,players_count,played_at
    FROM game_sessions WHERE user_id=? ORDER BY played_at DESC LIMIT ?`, [req.user.id, limit]);
  res.json({ sessions: rows });
});

/* ── Public profile ──────────────────────────────────────── */
router.get('/public/:username', async (req, res) => {
  const pool = await getPool();
  if (!pool) return res.status(503).json({ error: 'DB unavailable' });
  const [users] = await pool.query(
    'SELECT id, username, avatar_url, xp, level, created_at FROM users WHERE username = ?',
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

/* ── Save game result ─────────────────────────────────────── */
router.post('/game-result', requireAuth, express.json(), async (req, res) => {
  const pool = await getPool();
  if (!pool) return res.status(503).json({ error: 'DB unavailable' });
  const {
    game_type='type-racer', theme, difficulty,
    score=0, words_correct=0, words_total=0, wpm=0, placement=1, players_count=1,
  } = req.body;

  await pool.query(
    `INSERT INTO game_sessions (user_id,game_type,theme,difficulty,score,words_correct,words_total,wpm,placement,players_count)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [req.user.id, game_type, theme||null, difficulty||null, score, words_correct, words_total, wpm||0, placement, players_count]
  );

  // XP & level-up
  const xpGained = calcXpGained(score, wpm||0, placement||1);
  const [[ur]]   = await pool.query('SELECT COALESCE(xp,0) AS xp FROM users WHERE id=?', [req.user.id]);
  const oldXp    = ur ? ur.xp : 0;
  const newXp    = oldXp + xpGained;
  const newLevel = calcLevel(newXp);
  const oldLevel = calcLevel(oldXp);
  await pool.query('UPDATE users SET xp=?, level=? WHERE id=?', [newXp, newLevel, req.user.id]);

  res.json({ ok: true, xpGained, newXp, newLevel, leveledUp: newLevel > oldLevel, title: getTitle(newLevel) });
});

module.exports = router;
