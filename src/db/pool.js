const mysql = require('mysql2/promise');
require('dotenv').config();

const poolConfig = {
  host:               process.env.DB_HOST,
  port:               parseInt(process.env.DB_PORT) || 3306,
  user:               process.env.DB_USER,
  password:           process.env.DB_PASSWORD,
  database:           process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  connectTimeout:     30000,
  // Keep connections alive to avoid server-side idle disconnects
  enableKeepAlive:    true,
  keepAliveInitialDelay: 10000,
  // Auto-reconnect on idle disconnect
};

let pool = mysql.createPool(poolConfig);

/**
 * Wrap execute with automatic pool recreation on connection loss.
 */
async function safeExecute(sql, params = []) {
  try {
    const [rows] = await pool.execute(sql, params);
    return rows;
  } catch (err) {
    const isConnectionErr =
      err.code === 'PROTOCOL_CONNECTION_LOST' ||
      err.code === 'ECONNRESET' ||
      err.code === 'ETIMEDOUT' ||
      err.fatal;

    if (isConnectionErr) {
      console.warn('DB connection lost, recreating pool…');
      try { await pool.end(); } catch (_) {}
      pool = mysql.createPool(poolConfig);
      // Retry once
      const [rows] = await pool.execute(sql, params);
      return rows;
    }
    throw err;
  }
}

async function callProc(sql, params = []) {
  return safeExecute(sql, params);
}

async function query(sql, params = []) {
  return safeExecute(sql, params);
}

module.exports = { pool, callProc, query };
