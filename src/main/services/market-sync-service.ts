import type { EnsureStockBundleInput } from '@shared/desktop-api'
import { MarketRepository } from './market-repository'

interface ApiResult<T> {
  code?: string | number
  data: T
  message?: string
}

interface ObservedStock {
  stockCode: string
  market: string
}

function buildQuery(params: Record<string, string | number | undefined | null>) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    search.set(key, String(value))
  })
  const query = search.toString()
  return query ? `?${query}` : ''
}

function normalizeMarket(value?: string | null) {
  const raw = String(value ?? 'A').trim().toUpperCase()
  if (raw === 'HK' || raw === 'H') return 'H'
  if (raw === 'US' || raw === 'U') return 'U'
  return 'A'
}

function normalizeDate(value?: string | null) {
  if (!value) return ''
  const trimmed = String(value).trim()
  if (/^\d{8}$/.test(trimmed)) {
    return `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10)
  return trimmed
}

function oneYearAgo() {
  const now = new Date()
  now.setFullYear(now.getFullYear() - 1)
  return now.toISOString().slice(0, 10)
}

function todayDate() {
  return new Date().toISOString().slice(0, 10)
}

export class MarketSyncService {
  private readonly observedStocks = new Map<string, ObservedStock>()

  constructor(
    private readonly repository: MarketRepository,
    private readonly remoteApiBase: string,
  ) {}

  async ensureStockBundle(input: EnsureStockBundleInput) {
    const stockCode = input.stockCode.trim()
    const market = normalizeMarket(input.market)
    const reasons: string[] = []
    const token = input.token ?? null
    this.rememberStock(stockCode, market)

    if (!this.repository.getStockInfo(stockCode)) {
      reasons.push('missing:info')
      await this.syncStockInfo(stockCode, market, token)
    }

    const latestHistoryDate = this.repository.getLatestHistoryDate(stockCode, market)
    const startDate = normalizeDate(input.historyRange?.startDate) || oneYearAgo()
    const endDate = normalizeDate(input.historyRange?.endDate) || todayDate()
    if (!latestHistoryDate || latestHistoryDate < endDate) {
      reasons.push('stale:history')
      await this.syncStockHistory(stockCode, market, startDate, endDate, token)
    }

    if (!this.repository.hasIndicators(stockCode, market)) {
      reasons.push('missing:indicator')
      await this.syncIndicators(stockCode, market, startDate, endDate, token)
    }

    const intradayDate = normalizeDate(input.intradayDate) || todayDate()
    if (!this.repository.hasIntradayForDate(stockCode, market, intradayDate, 1)) {
      reasons.push('missing:intraday')
      await this.syncIntraday(stockCode, market, intradayDate, 1, token)
    }

    return {
      synced: reasons.length > 0,
      reasons,
    }
  }

  async runScheduledSync(token: string) {
    const endDate = todayDate()
    const startDate = oneYearAgo()
    for (const item of this.observedStocks.values()) {
      try {
        await this.syncStockHistory(item.stockCode, item.market, startDate, endDate, token)
        await this.syncIndicators(item.stockCode, item.market, startDate, endDate, token)
      } catch (error) {
        console.error('[market-sync-service] scheduled stock sync failed', item, error)
      }
    }
  }

  async syncTradeCalendar(market: string, startDate: string, endDate: string, token?: string | null) {
    const normalizedMarket = normalizeMarket(market)
    const taskKey = `trade-calendar:${normalizedMarket}:${startDate}:${endDate}`
    try {
      const data = await this.get<Record<string, unknown>[]>(`/trade-calendar/list${buildQuery({ market: normalizedMarket, startDate, endDate })}`, token)
      this.repository.upsertTradeCalendar(normalizedMarket, data)
      this.repository.markSyncSuccess(taskKey, endDate)
      return data.length
    } catch (error) {
      this.repository.markSyncFailure(taskKey, error)
      throw error
    }
  }

  async refreshSpotQuotes(codes: string[], market: string, token?: string | null) {
    const normalizedMarket = normalizeMarket(market)
    const taskKey = `spot:${normalizedMarket}:${codes.join(',')}`
    try {
      const data = await this.get<Record<string, unknown>[]>(`/stock/spot/batch${buildQuery({ market: normalizedMarket, codes: codes.join(',') })}`, token)
      this.repository.upsertSpotQuotes(normalizedMarket, data)
      this.repository.markSyncSuccess(taskKey)
      return this.repository.getSpotQuotes(codes, normalizedMarket)
    } catch (error) {
      this.repository.markSyncFailure(taskKey, error)
      throw error
    }
  }

  private rememberStock(stockCode: string, market: string) {
    const key = `${market}:${stockCode}`
    if (this.observedStocks.has(key)) return
    this.observedStocks.set(key, { stockCode, market })
    if (this.observedStocks.size <= 20) return
    const firstKey = this.observedStocks.keys().next().value
    if (firstKey) this.observedStocks.delete(firstKey)
  }

  private async syncStockInfo(stockCode: string, market: string, token?: string | null) {
    const taskKey = `stock-info:${market}:${stockCode}`
    try {
      const data = await this.get<Record<string, unknown>>(`/stock/${encodeURIComponent(stockCode)}/info`, token)
      this.repository.upsertStockInfo(data, stockCode, market)
      this.repository.markSyncSuccess(taskKey)
    } catch (error) {
      this.repository.markSyncFailure(taskKey, error)
      throw error
    }
  }

  private async syncStockHistory(stockCode: string, market: string, startDate: string, endDate: string, token?: string | null) {
    const taskKey = `stock-history:${market}:${stockCode}`
    try {
      const data = await this.get<Record<string, unknown>[]>(`/stock/${encodeURIComponent(stockCode)}/history${buildQuery({ market, startDate, endDate })}`, token)
      this.repository.upsertDailyHistory(stockCode, market, data)
      this.repository.markSyncSuccess(taskKey, endDate)
    } catch (error) {
      this.repository.markSyncFailure(taskKey, error)
      throw error
    }
  }

  private async syncIntraday(stockCode: string, market: string, date: string, intervalMinutes: number, token?: string | null) {
    const taskKey = `stock-intraday:${market}:${stockCode}:${date}:${intervalMinutes}`
    try {
      const data = await this.get<Record<string, unknown>[]>(`/stock/${encodeURIComponent(stockCode)}/intraday${buildQuery({ market, date, intervalMinutes })}`, token)
      this.repository.upsertIntraday(stockCode, market, date, intervalMinutes, data)
      this.repository.markSyncSuccess(taskKey, date)
    } catch (error) {
      this.repository.markSyncFailure(taskKey, error)
      throw error
    }
  }

  private async syncIndicators(stockCode: string, market: string, startDate: string, endDate: string, token?: string | null) {
    const taskKey = `stock-indicator:${market}:${stockCode}`
    try {
      const data = await this.get<Record<string, unknown>[]>(`/stock/${encodeURIComponent(stockCode)}/indicator${buildQuery({ market, startDate, endDate })}`, token)
      this.repository.upsertIndicators(stockCode, market, data)
      this.repository.markSyncSuccess(taskKey, endDate)
    } catch (error) {
      this.repository.markSyncFailure(taskKey, error)
      throw error
    }
  }

  private async get<T>(path: string, token?: string | null): Promise<T> {
    const response = await fetch(`${this.remoteApiBase}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
    if (!response.ok) {
      const text = await response.text()
      throw new Error(text || `Remote request failed: ${response.status}`)
    }
    const payload = (await response.json()) as ApiResult<T> | T
    if (payload && typeof payload === 'object' && 'data' in payload) {
      const result = payload as ApiResult<T>
      const code = result.code === undefined ? '0' : String(result.code)
      if (code !== '0') {
        throw new Error(result.message || 'Remote request failed')
      }
      return result.data
    }
    return payload as T
  }
}
