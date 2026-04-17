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
  multipleStatements: true,   // required for stored procs that return result sets
  // Keep connections alive to avoid server-side idle disconnects
  enableKeepAlive:    true,
  keepAliveInitialDelay: 10000,
};

let pool = mysql.createPool(poolConfig);

/**
 * Call a stored procedure. Uses pool.query() (not execute()) because
 * mysql2's execute() does NOT support stored procedures that return result sets.
 * Returns the raw result array: [ [rows...], OkPacket ] or [ [[rows...]], OkPacket ]
 */
async function callProc(sql, params = []) {
  try {
    const [results] = await pool.query(sql, params);
    return results;
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
      const [results] = await pool.query(sql, params);
      return results;
    }
    throw err;
  }
}

/**
 * Run a plain SELECT query. Also uses query() for consistency.
 */
async function query(sql, params = []) {
  try {
    const [rows] = await pool.query(sql, params);
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
      const [rows] = await pool.query(sql, params);
      return rows;
    }
    throw err;
  }
}

module.exports = { pool, callProc, query };
