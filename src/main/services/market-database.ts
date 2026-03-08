import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

export class MarketDatabase {
  private readonly marketDbPath: string
  private readonly intradayDbPath: string
  private marketDb: DatabaseSync | null = null
  private intradayDb: DatabaseSync | null = null

  constructor(baseDir: string) {
    mkdirSync(baseDir, { recursive: true })
    this.marketDbPath = join(baseDir, 'market.db')
    this.intradayDbPath = join(baseDir, 'intraday.db')
  }

  initialize() {
    this.close()
    this.marketDb = new DatabaseSync(this.marketDbPath)
    this.intradayDb = new DatabaseSync(this.intradayDbPath)
    this.configure(this.marketDb)
    this.configure(this.intradayDb)
    this.initMarketSchema()
    this.initIntradaySchema()
  }

  close() {
    if (this.marketDb) {
      this.marketDb.close()
      this.marketDb = null
    }
    if (this.intradayDb) {
      this.intradayDb.close()
      this.intradayDb = null
    }
  }

  getMarketDb() {
    if (!this.marketDb) throw new Error('market.db is not initialized')
    return this.marketDb
  }

  getIntradayDb() {
    if (!this.intradayDb) throw new Error('intraday.db is not initialized')
    return this.intradayDb
  }

  getPaths() {
    return {
      marketDbPath: this.marketDbPath,
      intradayDbPath: this.intradayDbPath,
    }
  }

  private configure(db: DatabaseSync) {
    db.exec('PRAGMA journal_mode = WAL;')
    db.exec('PRAGMA synchronous = NORMAL;')
    db.exec('PRAGMA foreign_keys = ON;')
    db.exec('PRAGMA temp_store = MEMORY;')
    db.exec('PRAGMA busy_timeout = 5000;')
  }

  private initMarketSchema() {
    const db = this.getMarketDb()
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_version (
        name TEXT PRIMARY KEY,
        version INTEGER NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS stock_basic_info (
        stock_code TEXT PRIMARY KEY,
        stock_name TEXT NOT NULL DEFAULT '',
        market TEXT NOT NULL DEFAULT 'A',
        industry TEXT NOT NULL DEFAULT '',
        market_cap TEXT NOT NULL DEFAULT '',
        pe TEXT NOT NULL DEFAULT '',
        pb TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS trade_calendar (
        market TEXT NOT NULL,
        trade_date TEXT NOT NULL,
        is_open INTEGER NOT NULL DEFAULT 1,
        pre_trade_date TEXT,
        next_trade_date TEXT,
        source TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (market, trade_date)
      );

      CREATE TABLE IF NOT EXISTS price_daily (
        stock_code TEXT NOT NULL,
        market TEXT NOT NULL DEFAULT 'A',
        trade_date TEXT NOT NULL,
        open REAL NOT NULL DEFAULT 0,
        high REAL NOT NULL DEFAULT 0,
        low REAL NOT NULL DEFAULT 0,
        close REAL NOT NULL DEFAULT 0,
        volume REAL NOT NULL DEFAULT 0,
        pct_change REAL NOT NULL DEFAULT 0,
        amount REAL NOT NULL DEFAULT 0,
        pre_close REAL NOT NULL DEFAULT 0,
        change_amount REAL NOT NULL DEFAULT 0,
        source TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (stock_code, market, trade_date)
      );

      CREATE TABLE IF NOT EXISTS tech_indicator_daily (
        stock_code TEXT NOT NULL,
        market TEXT NOT NULL DEFAULT 'A',
        trade_date TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (stock_code, market, trade_date)
      );

      CREATE TABLE IF NOT EXISTS market_snapshot (
        stock_code TEXT NOT NULL,
        market TEXT NOT NULL DEFAULT 'A',
        payload_json TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (stock_code, market)
      );

      CREATE TABLE IF NOT EXISTS sync_status (
        task_key TEXT PRIMARY KEY,
        last_success_at TEXT,
        last_attempt_at TEXT,
        last_cursor TEXT,
        retry_count INTEGER NOT NULL DEFAULT 0,
        last_error TEXT
      );

      CREATE TABLE IF NOT EXISTS sync_task_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_key TEXT NOT NULL,
        status TEXT NOT NULL,
        message TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS import_batch (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_path TEXT NOT NULL,
        status TEXT NOT NULL,
        manifest_json TEXT,
        message TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_price_daily_lookup ON price_daily (stock_code, market, trade_date);
      CREATE INDEX IF NOT EXISTS idx_indicator_lookup ON tech_indicator_daily (stock_code, market, trade_date);
      CREATE INDEX IF NOT EXISTS idx_stock_basic_name ON stock_basic_info (stock_name);
    `)

    db.prepare(`
      INSERT INTO schema_version (name, version, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(name) DO UPDATE SET version = excluded.version, updated_at = CURRENT_TIMESTAMP
    `).run('market', 1)
  }

  private initIntradaySchema() {
    const db = this.getIntradayDb()
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_version (
        name TEXT PRIMARY KEY,
        version INTEGER NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS price_intraday (
        stock_code TEXT NOT NULL,
        market TEXT NOT NULL DEFAULT 'A',
        trade_date TEXT NOT NULL,
        interval_minutes INTEGER NOT NULL DEFAULT 1,
        quote_time TEXT NOT NULL,
        open REAL NOT NULL DEFAULT 0,
        high REAL NOT NULL DEFAULT 0,
        low REAL NOT NULL DEFAULT 0,
        close REAL NOT NULL DEFAULT 0,
        volume REAL NOT NULL DEFAULT 0,
        amount REAL NOT NULL DEFAULT 0,
        source TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (stock_code, market, trade_date, interval_minutes, quote_time)
      );

      CREATE INDEX IF NOT EXISTS idx_intraday_lookup
      ON price_intraday (stock_code, market, trade_date, interval_minutes, quote_time);
    `)

    db.prepare(`
      INSERT INTO schema_version (name, version, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(name) DO UPDATE SET version = excluded.version, updated_at = CURRENT_TIMESTAMP
    `).run('intraday', 1)
  }
}
