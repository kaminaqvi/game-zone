const { getPool } = require('./connection');

const TABLES = [
  `CREATE TABLE IF NOT EXISTS users (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    google_id    VARCHAR(255) UNIQUE,
    username     VARCHAR(50)  NOT NULL,
    email        VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255),
    age          INT,
    avatar_url   VARCHAR(500),
    role         ENUM('player','admin') DEFAULT 'player',
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS game_sessions (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    user_id       INT NOT NULL,
    game_type     VARCHAR(50) DEFAULT 'type-racer',
    theme         VARCHAR(50),
    difficulty    ENUM('easy','medium','hard'),
    score         INT DEFAULT 0,
    words_correct INT DEFAULT 0,
    words_total   INT DEFAULT 0,
    wpm           INT DEFAULT 0,
    placement     INT DEFAULT 1,
    players_count INT DEFAULT 1,
    played_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS friends (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT NOT NULL,
    friend_id  INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uf (user_id, friend_id),
    FOREIGN KEY (user_id)   REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // Migrations — safe to re-run
  `ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS wpm   INT DEFAULT 0`,
  `ALTER TABLE users         ADD COLUMN IF NOT EXISTS xp    INT DEFAULT 0`,
  `ALTER TABLE users         ADD COLUMN IF NOT EXISTS level INT DEFAULT 1`,
];

async function initDB() {
  const pool = await getPool();
  if (!pool) { console.log('ℹ️  No DB — running without persistence'); return; }
  for (const sql of TABLES) {
    try { await pool.query(sql); }
    catch (e) { console.error('DB init error:', e.message); }
  }
  console.log('✅ DB schema ready');
}

module.exports = { initDB };
