import type { IntradayQuoteItem, LocalSyncStatus, SpotQuote, StockBasicInfo, StockHistoryItem, TradeCalendarItem } from '@shared/desktop-api'
import { MarketDatabase } from './market-database'

function normalizeDate(value?: string | null) {
  if (!value) return ''
  const trimmed = String(value).trim()
  if (/^\d{8}$/.test(trimmed)) {
    return `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10)
  }
  return trimmed
}

export class MarketRepository {
  constructor(private readonly database: MarketDatabase) {}

  getStockInfo(stockCode: string): StockBasicInfo | null {
    const row = this.database.getMarketDb().prepare(`
      SELECT stock_code, stock_name, market, industry, market_cap, pe, pb
      FROM stock_basic_info
      WHERE stock_code = ?
    `).get(stockCode) as Record<string, unknown> | undefined
    if (!row) return null
    return {
      stockCode: String(row.stock_code ?? stockCode),
      stockName: String(row.stock_name ?? ''),
      market: String(row.market ?? 'A'),
      industry: String(row.industry ?? ''),
      marketCap: String(row.market_cap ?? ''),
      pe: String(row.pe ?? ''),
      pb: String(row.pb ?? ''),
    }
  }

  getStockHistory(stockCode: string, market = 'A', startDate?: string, endDate?: string): StockHistoryItem[] {
    const clauses = ['stock_code = ?', 'market = ?']
    const params: (string | number)[] = [stockCode, market]
    if (startDate) {
      clauses.push('trade_date >= ?')
      params.push(normalizeDate(startDate))
    }
    if (endDate) {
      clauses.push('trade_date <= ?')
      params.push(normalizeDate(endDate))
    }
    const stmt = this.database.getMarketDb().prepare(`
      SELECT trade_date, open, high, low, close, volume, pct_change, amount, pre_close, change_amount
      FROM price_daily
      WHERE ${clauses.join(' AND ')}
      ORDER BY trade_date ASC
    `)
    return (stmt.all(...params) as Record<string, unknown>[]).map((row) => ({
      date: String(row.trade_date ?? ''),
      open: Number(row.open ?? 0),
      high: Number(row.high ?? 0),
      low: Number(row.low ?? 0),
      close: Number(row.close ?? 0),
      volume: Number(row.volume ?? 0),
      pctChange: Number(row.pct_change ?? 0),
      amount: Number(row.amount ?? 0),
      preClose: Number(row.pre_close ?? 0),
      changeAmount: Number(row.change_amount ?? 0),
    }))
  }

  getStockIntraday(stockCode: string, tradeDate: string, intervalMinutes = 1, market = 'A'): IntradayQuoteItem[] {
    const stmt = this.database.getIntradayDb().prepare(`
      SELECT quote_time, open, high, low, close, volume, amount
      FROM price_intraday
      WHERE stock_code = ? AND market = ? AND trade_date = ? AND interval_minutes = ?
      ORDER BY quote_time ASC
    `)
    return (stmt.all(stockCode, market, normalizeDate(tradeDate), intervalMinutes) as Record<string, unknown>[]).map((row) => ({
      time: String(row.quote_time ?? ''),
      open: Number(row.open ?? 0),
      high: Number(row.high ?? 0),
      low: Number(row.low ?? 0),
      close: Number(row.close ?? 0),
      volume: Number(row.volume ?? 0),
      amount: Number(row.amount ?? 0),
    }))
  }

  getStockIndicators(stockCode: string, market = 'A', startDate?: string, endDate?: string): Record<string, unknown>[] {
    const clauses = ['stock_code = ?', 'market = ?']
    const params: (string | number)[] = [stockCode, market]
    if (startDate) {
      clauses.push('trade_date >= ?')
      params.push(normalizeDate(startDate))
    }
    if (endDate) {
      clauses.push('trade_date <= ?')
      params.push(normalizeDate(endDate))
    }
    const stmt = this.database.getMarketDb().prepare(`
      SELECT payload_json
      FROM tech_indicator_daily
      WHERE ${clauses.join(' AND ')}
      ORDER BY trade_date ASC
    `)
    return (stmt.all(...params) as Record<string, unknown>[]).map((row) => JSON.parse(String(row.payload_json ?? '{}')))
  }

  getTradeCalendar(market: string, startDate: string, endDate: string): TradeCalendarItem[] {
    const stmt = this.database.getMarketDb().prepare(`
      SELECT market, trade_date, is_open, pre_trade_date, next_trade_date
      FROM trade_calendar
      WHERE market = ? AND trade_date >= ? AND trade_date <= ?
      ORDER BY trade_date ASC
    `)
    return (stmt.all(market, normalizeDate(startDate), normalizeDate(endDate)) as Record<string, unknown>[]).map((row) => ({
      calDate: String(row.trade_date ?? ''),
      isOpen: Number(row.is_open ?? 0),
      holidayName: undefined,
    }))
  }

  getSpotQuotes(codes: string[], market = 'A'): SpotQuote[] {
    const stmt = this.database.getMarketDb().prepare(`
      SELECT stock_code, payload_json, updated_at
      FROM market_snapshot
      WHERE market = ? AND stock_code = ?
    `)
    return codes.map((code) => {
      const row = stmt.get(market, code) as Record<string, unknown> | undefined
      if (!row) {
        return { stockCode: code, market, updateTime: '' }
      }
      const payload = JSON.parse(String(row.payload_json ?? '{}')) as Record<string, unknown>
      return {
        ...((payload as unknown) as SpotQuote),
        stockCode: String(payload.stockCode ?? payload.stock_code ?? code),
        market: String(payload.market ?? market),
        updateTime: String(row.updated_at ?? payload.updateTime ?? ''),
      }
    })
  }

  getSyncStatuses(): LocalSyncStatus[] {
    const rows = this.database.getMarketDb().prepare(`
      SELECT task_key, last_success_at, last_attempt_at, last_cursor, retry_count, last_error
      FROM sync_status
      ORDER BY task_key ASC
    `).all() as Record<string, unknown>[]
    return rows.map((row) => ({
      taskKey: String(row.task_key ?? ''),
      lastSuccessAt: row.last_success_at ? String(row.last_success_at) : null,
      lastAttemptAt: row.last_attempt_at ? String(row.last_attempt_at) : null,
      lastCursor: row.last_cursor ? String(row.last_cursor) : null,
      retryCount: Number(row.retry_count ?? 0),
      lastError: row.last_error ? String(row.last_error) : null,
    }))
  }

  getLatestHistoryDate(stockCode: string, market = 'A'): string | null {
    const row = this.database.getMarketDb().prepare(`
      SELECT MAX(trade_date) AS trade_date FROM price_daily WHERE stock_code = ? AND market = ?
    `).get(stockCode, market) as Record<string, unknown> | undefined
    return row?.trade_date ? String(row.trade_date) : null
  }

  hasIntradayForDate(stockCode: string, market = 'A', tradeDate: string, intervalMinutes = 1): boolean {
    const row = this.database.getIntradayDb().prepare(`
      SELECT 1 AS matched FROM price_intraday
      WHERE stock_code = ? AND market = ? AND trade_date = ? AND interval_minutes = ? LIMIT 1
    `).get(stockCode, market, normalizeDate(tradeDate), intervalMinutes) as Record<string, unknown> | undefined
    return !!row?.matched
  }

  hasIndicators(stockCode: string, market = 'A'): boolean {
    const row = this.database.getMarketDb().prepare(`
      SELECT 1 AS matched FROM tech_indicator_daily WHERE stock_code = ? AND market = ? LIMIT 1
    `).get(stockCode, market) as Record<string, unknown> | undefined
    return !!row?.matched
  }

  upsertStockInfo(info: Record<string, unknown>, fallbackCode: string, fallbackMarket = 'A') {
    this.database.getMarketDb().prepare(`
      INSERT INTO stock_basic_info (stock_code, stock_name, market, industry, market_cap, pe, pb, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(stock_code) DO UPDATE SET
        stock_name = excluded.stock_name,
        market = excluded.market,
        industry = excluded.industry,
        market_cap = excluded.market_cap,
        pe = excluded.pe,
        pb = excluded.pb,
        updated_at = CURRENT_TIMESTAMP
    `).run(
      String(info.stockCode ?? info.stock_code ?? fallbackCode),
      String(info.stockName ?? info.stock_name ?? ''),
      String(info.market ?? fallbackMarket),
      String(info.industry ?? ''),
      String(info.marketCap ?? info.market_cap ?? ''),
      String(info.pe ?? ''),
      String(info.pb ?? ''),
    )
  }

  upsertDailyHistory(stockCode: string, market: string, items: Record<string, unknown>[], source = 'remote') {
    const db = this.database.getMarketDb()
    const stmt = db.prepare(`
      INSERT INTO price_daily (
        stock_code, market, trade_date, open, high, low, close, volume, pct_change,
        amount, pre_close, change_amount, source, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(stock_code, market, trade_date) DO UPDATE SET
        open = excluded.open,
        high = excluded.high,
        low = excluded.low,
        close = excluded.close,
        volume = excluded.volume,
        pct_change = excluded.pct_change,
        amount = excluded.amount,
        pre_close = excluded.pre_close,
        change_amount = excluded.change_amount,
        source = excluded.source,
        updated_at = CURRENT_TIMESTAMP
    `)
    db.exec('BEGIN')
    try {
      for (const item of items) {
        stmt.run(
          stockCode,
          market,
          normalizeDate(String(item.date ?? item.tradeDate ?? item.trade_date ?? '')),
          Number(item.open ?? 0),
          Number(item.high ?? 0),
          Number(item.low ?? 0),
          Number(item.close ?? 0),
          Number(item.volume ?? item.vol ?? 0),
          Number(item.pctChange ?? item.pct_change ?? 0),
          Number(item.amount ?? 0),
          Number(item.preClose ?? item.pre_close ?? 0),
          Number(item.changeAmount ?? item.change_amount ?? 0),
          source,
        )
      }
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
  }

  upsertIntraday(stockCode: string, market: string, tradeDate: string, intervalMinutes: number, items: Record<string, unknown>[], source = 'remote') {
    const db = this.database.getIntradayDb()
    const stmt = db.prepare(`
      INSERT INTO price_intraday (
        stock_code, market, trade_date, interval_minutes, quote_time, open, high, low, close, volume, amount, source, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(stock_code, market, trade_date, interval_minutes, quote_time) DO UPDATE SET
        open = excluded.open,
        high = excluded.high,
        low = excluded.low,
        close = excluded.close,
        volume = excluded.volume,
        amount = excluded.amount,
        source = excluded.source,
        updated_at = CURRENT_TIMESTAMP
    `)
    db.exec('BEGIN')
    try {
      for (const item of items) {
        stmt.run(
          stockCode,
          market,
          normalizeDate(tradeDate),
          intervalMinutes,
          String(item.time ?? item.quoteTime ?? item.quote_time ?? ''),
          Number(item.open ?? 0),
          Number(item.high ?? 0),
          Number(item.low ?? 0),
          Number(item.close ?? 0),
          Number(item.volume ?? 0),
          Number(item.amount ?? 0),
          source,
        )
      }
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
  }

  upsertIndicators(stockCode: string, market: string, items: Record<string, unknown>[], source = 'remote') {
    const db = this.database.getMarketDb()
    const stmt = db.prepare(`
      INSERT INTO tech_indicator_daily (stock_code, market, trade_date, payload_json, source, updated_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(stock_code, market, trade_date) DO UPDATE SET
        payload_json = excluded.payload_json,
        source = excluded.source,
        updated_at = CURRENT_TIMESTAMP
    `)
    db.exec('BEGIN')
    try {
      for (const item of items) {
        const tradeDate = normalizeDate(String(item.tradeDate ?? item.trade_date ?? item.date ?? ''))
        const normalized = {
          ...item,
          tradeDate,
        }
        stmt.run(stockCode, market, tradeDate, JSON.stringify(normalized), source)
      }
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
  }

  upsertTradeCalendar(market: string, items: Record<string, unknown>[], source = 'remote') {
    const db = this.database.getMarketDb()
    const stmt = db.prepare(`
      INSERT INTO trade_calendar (market, trade_date, is_open, pre_trade_date, next_trade_date, source, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(market, trade_date) DO UPDATE SET
        is_open = excluded.is_open,
        pre_trade_date = excluded.pre_trade_date,
        next_trade_date = excluded.next_trade_date,
        source = excluded.source,
        updated_at = CURRENT_TIMESTAMP
    `)
    db.exec('BEGIN')
    try {
      for (const item of items) {
        stmt.run(
          market,
          normalizeDate(String(item.tradeDate ?? item.trade_date ?? '')),
          Number(item.isOpen ?? item.is_open ?? item.isTrade ?? 1 ? 1 : 0),
          item.preTradeDate ? normalizeDate(String(item.preTradeDate)) : item.pre_trade_date ? normalizeDate(String(item.pre_trade_date)) : null,
          item.nextTradeDate ? normalizeDate(String(item.nextTradeDate)) : item.next_trade_date ? normalizeDate(String(item.next_trade_date)) : null,
          source,
        )
      }
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
  }

  upsertSpotQuotes(market: string, items: Record<string, unknown>[]) {
    const db = this.database.getMarketDb()
    const stmt = db.prepare(`
      INSERT INTO market_snapshot (stock_code, market, payload_json, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(stock_code, market) DO UPDATE SET
        payload_json = excluded.payload_json,
        updated_at = CURRENT_TIMESTAMP
    `)
    db.exec('BEGIN')
    try {
      for (const item of items) {
        const code = String(item.stockCode ?? item.stock_code ?? item.code ?? '')
        stmt.run(code, market, JSON.stringify({ ...item, stockCode: code, market }))
      }
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
  }

  markSyncSuccess(taskKey: string, lastCursor?: string | null) {
    this.database.getMarketDb().prepare(`
      INSERT INTO sync_status (task_key, last_success_at, last_attempt_at, last_cursor, retry_count, last_error)
      VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?, 0, NULL)
      ON CONFLICT(task_key) DO UPDATE SET
        last_success_at = CURRENT_TIMESTAMP,
        last_attempt_at = CURRENT_TIMESTAMP,
        last_cursor = excluded.last_cursor,
        retry_count = 0,
        last_error = NULL
    `).run(taskKey, lastCursor ?? null)
    this.logSync(taskKey, 'SUCCESS', '')
  }

  markSyncFailure(taskKey: string, error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    this.database.getMarketDb().prepare(`
      INSERT INTO sync_status (task_key, last_attempt_at, retry_count, last_error)
      VALUES (?, CURRENT_TIMESTAMP, 1, ?)
      ON CONFLICT(task_key) DO UPDATE SET
        last_attempt_at = CURRENT_TIMESTAMP,
        retry_count = retry_count + 1,
        last_error = excluded.last_error
    `).run(taskKey, message)
    this.logSync(taskKey, 'FAILED', message)
  }

  recordImport(sourcePath: string, status: string, manifestJson: string | null, message: string) {
    this.database.getMarketDb().prepare(`
      INSERT INTO import_batch (source_path, status, manifest_json, message)
      VALUES (?, ?, ?, ?)
    `).run(sourcePath, status, manifestJson, message)
  }

  private logSync(taskKey: string, status: string, message: string) {
    this.database.getMarketDb().prepare(`
      INSERT INTO sync_task_log (task_key, status, message)
      VALUES (?, ?, ?)
    `).run(taskKey, status, message)
  }
}
