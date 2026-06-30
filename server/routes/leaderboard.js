const express = require('express');
const { getPool } = require('../db/connection');
const router = express.Router();

router.get('/', async (req, res) => {
  const pool = await getPool();
  if (!pool) return res.json({ leaderboard: [] });

  const game        = req.query.game   || 'type-racer';
  const period      = req.query.period || 'all';
  const friendsOnly = req.query.friends === '1';

  if (friendsOnly && !req.user) return res.json({ leaderboard: [] });

  let dateWhere    = '';
  let friendsWhere = '';
  const params     = [game];

  if (period === 'week')  dateWhere = 'AND gs.played_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
  if (period === 'month') dateWhere = 'AND gs.played_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';

  if (friendsOnly) {
    friendsWhere = 'AND (u.id = ? OR u.id IN (SELECT friend_id FROM friends WHERE user_id = ?))';
    params.push(req.user.id, req.user.id);
  }

  try {
    const [rows] = await pool.query(`
      SELECT
        ROW_NUMBER() OVER (ORDER BY MAX(gs.score) DESC) AS rank,
        u.id, u.username, u.avatar_url,
        MAX(gs.score)        AS high_score,
        MAX(gs.wpm)          AS best_wpm,
        COUNT(*)             AS total_games,
        SUM(gs.placement=1)  AS wins,
        ROUND(AVG(gs.score)) AS avg_score
      FROM game_sessions gs
      JOIN users u ON u.id = gs.user_id
      WHERE gs.game_type = ? ${dateWhere} ${friendsWhere}
      GROUP BY u.id, u.username, u.avatar_url
      ORDER BY high_score DESC
      LIMIT 100
    `, params);
    res.json({ leaderboard: rows });
  } catch (e) {
    res.status(500).json({ error: 'Leaderboard query failed', leaderboard: [] });
  }
});

module.exports = router;
