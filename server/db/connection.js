const mysql = require('mysql2/promise');

let pool = null;

async function getPool() {
  if (pool) return pool;
  if (!process.env.DB_HOST) return null;

  try {
    pool = mysql.createPool({
      host:               process.env.DB_HOST || 'localhost',
      port:               parseInt(process.env.DB_PORT || '3306'),
      user:               process.env.DB_USER,
      password:           process.env.DB_PASS,
      database:           process.env.DB_NAME || 'gameportal',
      waitForConnections: true,
      connectionLimit:    10,
      charset:            'utf8mb4',
    });
    await pool.query('SELECT 1');
    console.log('✅ MySQL connected');
    return pool;
  } catch (err) {
    console.warn('⚠️  MySQL connection failed:', err.message);
    pool = null;
    return null;
  }
}

module.exports = { getPool };
