/**
 * KRAY SPACE L2 - Database Manager
 * 
 * SQLite database initialization and management
 */

import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { DATABASE } from './constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let db = null;

/**
 * Initialize database connection
 */
export function initDatabase() {
  if (db) {
    return db;
  }

  console.log('🗄️  Initializing KRAY L2 database...');
  console.log(`   Path: ${DATABASE.PATH}`);

  // Create database connection
  db = new Database(DATABASE.PATH, {
    verbose: process.env.NODE_ENV === 'development' ? console.log : null
  });

  // Enable WAL mode for better concurrency
  if (DATABASE.WAL_MODE) {
    db.pragma('journal_mode = WAL');
  }

  // Set busy timeout
  db.pragma(`busy_timeout = ${DATABASE.TIMEOUT}`);

  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Check if database already has tables
  const tables = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name='l2_accounts'
  `).get();

  if (!tables) {
    // Database is new, execute schema
    const schemaPath = join(__dirname, 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf8');

    console.log('   Executing schema...');
    db.exec(schema);
    console.log('✅ Database initialized successfully');
  } else {
    console.log('✅ Database already exists, skipping schema');
  }

  return db;
}

/**
 * Get database instance
 */
export function getDatabase() {
  if (!db) {
    return initDatabase();
  }
  return db;
}

/**
 * Close database connection
 */
export function closeDatabase() {
  if (db) {
    console.log('🔒 Closing database connection...');
    db.close();
    db = null;
  }
}

/**
 * Execute a query with parameters
 */
export function query(sql, params = []) {
  const database = getDatabase();
  const stmt = database.prepare(sql);
  return stmt.all(...params);
}

/**
 * Execute a single row query
 */
export function queryOne(sql, params = []) {
  const database = getDatabase();
  const stmt = database.prepare(sql);
  return stmt.get(...params);
}

/**
 * Execute an insert/update/delete
 */
export function execute(sql, params = []) {
  const database = getDatabase();
  const stmt = database.prepare(sql);
  return stmt.run(...params);
}

/**
 * Execute multiple statements in a transaction
 */
export function transaction(callback) {
  const database = getDatabase();
  const txn = database.transaction(callback);
  return txn();
}

/**
 * Get database statistics
 */
export function getStats() {
  const database = getDatabase();

  const stats = {
    accounts: queryOne('SELECT COUNT(*) as count FROM l2_accounts')?.count || 0,
    transactions: queryOne('SELECT COUNT(*) as count FROM l2_transactions')?.count || 0,
    deposits: queryOne('SELECT COUNT(*) as count FROM l2_deposits')?.count || 0,
    withdrawals: queryOne('SELECT COUNT(*) as count FROM l2_withdrawals')?.count || 0,
    batches: queryOne('SELECT COUNT(*) as count FROM l2_batches')?.count || 0,
    validators: queryOne('SELECT COUNT(*) as count FROM l2_validators')?.count || 0,
    pools: queryOne('SELECT COUNT(*) as count FROM l2_defi_pools')?.count || 0,
    listings: queryOne('SELECT COUNT(*) as count FROM l2_marketplace_listings')?.count || 0,

    totalBalance: queryOne(`
      SELECT SUM(CAST(balance_credits AS INTEGER)) as total 
      FROM l2_accounts
    `)?.total || 0,

    totalStaked: queryOne(`
      SELECT SUM(CAST(staked_credits AS INTEGER)) as total 
      FROM l2_accounts
    `)?.total || 0
  };

  return stats;
}

/**
 * Vacuum database (cleanup and optimize)
 */
export function vacuum() {
  const database = getDatabase();
  console.log('🧹 Vacuuming database...');
  database.exec('VACUUM');
  console.log('✅ Database vacuumed');
}

/**
 * Backup database to file
 */
export function backup(destinationPath) {
  const database = getDatabase();
  console.log(`💾 Backing up database to ${destinationPath}...`);
  database.backup(destinationPath);
  console.log('✅ Backup completed');
}

/**
 * Health check
 */
export function healthCheck() {
  try {
    const database = getDatabase();
    const result = database.prepare('SELECT 1 as health').get();
    return result?.health === 1;
  } catch (error) {
    console.error('❌ Database health check failed:', error);
    return false;
  }
}

export default {
  initDatabase,
  getDatabase,
  closeDatabase,
  query,
  queryOne,
  execute,
  transaction,
  getStats,
  vacuum,
  backup,
  healthCheck
};

