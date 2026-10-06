import mysql from 'mysql2/promise';

// Key/payload cache tables in the `insights_cache` schema (data model: Insights Service).
// geocode_cache is created here too so the schema lives in one place.
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS psgc_cache (
    \`key\` VARCHAR(64) NOT NULL PRIMARY KEY,
    payload JSON NOT NULL,
    fetched_at DATETIME(3) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS overpass_cache (
    \`key\` VARCHAR(64) NOT NULL PRIMARY KEY,
    payload JSON NOT NULL,
    fetched_at DATETIME(3) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS geocode_cache (
    address_hash CHAR(64) NOT NULL PRIMARY KEY,
    query VARCHAR(512) NOT NULL,
    lat DECIMAL(9,6) NOT NULL,
    lon DECIMAL(9,6) NOT NULL,
    \`precision\` ENUM('street','city') NOT NULL,
    fetched_at DATETIME(3) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];

const TABLES = new Set(['psgc_cache', 'overpass_cache']);

function checkTable(table) {
  if (!TABLES.has(table)) throw new Error(`Unknown cache table ${table}`);
}

/**
 * MySQL-backed cache. Every method rejects when the database is down; callers treat that
 * as a cache miss (see cached.js), so the service keeps working without its cache.
 */
export function createMysqlStore(db) {
  const pool = mysql.createPool({
    ...db,
    timezone: 'Z',
    connectionLimit: 5,
    connectTimeout: 2_000,
  });

  return {
    async migrate() {
      for (const statement of SCHEMA) await pool.query(statement);
    },

    async ping() {
      await pool.query('SELECT 1');
    },

    /** @returns {Promise<{ payload: unknown, fetchedAt: Date } | null>} */
    async get(table, key) {
      checkTable(table);
      const [rows] = await pool.execute(`SELECT payload, fetched_at FROM ${table} WHERE \`key\` = ?`, [key]);
      if (rows.length === 0) return null;
      return { payload: rows[0].payload, fetchedAt: rows[0].fetched_at };
    },

    async put(table, key, payload, fetchedAt = new Date()) {
      checkTable(table);
      await pool.execute(
        `INSERT INTO ${table} (\`key\`, payload, fetched_at) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE payload = VALUES(payload), fetched_at = VALUES(fetched_at)`,
        [key, JSON.stringify(payload), fetchedAt],
      );
    },

    close: () => pool.end(),
  };
}
