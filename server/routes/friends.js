const express = require('express');
const { getPool } = require('../db/connection');
const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  next();
}

/* GET /api/friends — list people I follow */
router.get('/', requireAuth, async (req, res) => {
  const pool = await getPool();
  if (!pool) return res.json({ friends: [] });
  const [rows] = await pool.query(`
    SELECT u.id, u.username, u.avatar_url,
           COALESCE(MAX(gs.score),0) AS high_score,
           COALESCE(MAX(gs.wpm),0)   AS best_wpm,
           COUNT(gs.id)              AS total_games,
           SUM(gs.placement=1)       AS wins
    FROM friends f
    JOIN users u ON u.id = f.friend_id
    LEFT JOIN game_sessions gs ON gs.user_id = u.id
    WHERE f.user_id = ?
    GROUP BY u.id, u.username, u.avatar_url
    ORDER BY high_score DESC
  `, [req.user.id]);
  res.json({ friends: rows });
});

/* GET /api/friends/is-following/:username */
router.get('/is-following/:username', requireAuth, async (req, res) => {
  const pool = await getPool();
  if (!pool) return res.json({ following: false });
  const [users] = await pool.query('SELECT id FROM users WHERE username=?', [req.params.username]);
  if (!users.length) return res.json({ following: false });
  const friendId = users[0].id;
  if (friendId === req.user.id) return res.json({ following: false, isSelf: true });
  const [rows] = await pool.query(
    'SELECT id FROM friends WHERE user_id=? AND friend_id=?',
    [req.user.id, friendId]
  );
  res.json({ following: rows.length > 0 });
});

/* POST /api/friends/follow — body: { username } */
router.post('/follow', requireAuth, express.json(), async (req, res) => {
  const pool = await getPool();
  if (!pool) return res.status(503).json({ error: 'DB unavailable' });
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'username required' });
  const [users] = await pool.query('SELECT id FROM users WHERE username=?', [username]);
  if (!users.length) return res.status(404).json({ error: 'User not found' });
  const friendId = users[0].id;
  if (friendId === req.user.id) return res.status(400).json({ error: 'Cannot follow yourself' });
  await pool.query('INSERT IGNORE INTO friends (user_id, friend_id) VALUES (?,?)', [req.user.id, friendId]);
  res.json({ ok: true });
});

/* DELETE /api/friends/follow/:username */
router.delete('/follow/:username', requireAuth, async (req, res) => {
  const pool = await getPool();
  if (!pool) return res.status(503).json({ error: 'DB unavailable' });
  const [users] = await pool.query('SELECT id FROM users WHERE username=?', [req.params.username]);
  if (!users.length) return res.status(404).json({ error: 'User not found' });
  await pool.query(
    'DELETE FROM friends WHERE user_id=? AND friend_id=?',
    [req.user.id, users[0].id]
  );
  res.json({ ok: true });
});

module.exports = router;
