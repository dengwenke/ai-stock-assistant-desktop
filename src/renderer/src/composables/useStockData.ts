import { ref, computed } from 'vue'
import type { Ref } from 'vue'
import { storeToRefs } from 'pinia'
import {
  getStockInfo,
  getStockHistory,
  getStockIndicator,
  getAnalysisList,
  resolveApiMarketCode,
  resolveCapabilityMessage,
} from '@/api/client'
import type { StockBasicInfo, StockHistoryItem, StockTechIndicator, NoticeRecord } from '@/api/types'
import { dataCache, CACHE_KEYS, CACHE_TTL, DataCache } from '@/utils/cache'
import { useWorkspaceStore } from '@/stores/workspace'

export interface UseStockDataOptions {
  stockCode: Ref<string>
  timeRange: Ref<string>
  market?: Ref<string>
}

export function useStockData(options: UseStockDataOptions) {
  const { stockCode, timeRange } = options
  const workspaceStore = useWorkspaceStore()
  const { currentMarket } = storeToRefs(workspaceStore)
  const selectedMarket = computed(() => options.market?.value ?? currentMarket.value)
  const marketCode = computed(() => resolveApiMarketCode(selectedMarket.value))

  // 加载状态
  const loading = ref({
    info: false,
    history: false,
    indicator: false,
    notices: false,
  })

  // 错误状态
  const error = ref({
    info: null as string | null,
    history: null as string | null,
    indicator: null as string | null,
    notices: null as string | null,
  })

  // 数据
  const stockInfo = ref<StockBasicInfo | null>(null)
  const history = ref<StockHistoryItem[]>([])
  const indicators = ref<StockTechIndicator[]>([])
  const notices = ref<NoticeRecord[]>([])
  const noticesTotal = ref(0)

  // 计算日期范围
  const dateRange = computed(() => {
    const end = new Date()
    const start = new Date()
    const range = timeRange.value

    switch (range) {
      case '1d':
        start.setDate(end.getDate() - 1)
        break
      case '5d':
        start.setDate(end.getDate() - 5)
        break
      case '1m':
        start.setMonth(end.getMonth() - 1)
        break
      case '3m':
        start.setMonth(end.getMonth() - 3)
        break
      case '6m':
        start.setMonth(end.getMonth() - 6)
        break
      case '1y':
        start.setFullYear(end.getFullYear() - 1)
        break
      default:
        start.setMonth(end.getMonth() - 6)
    }

    const fmt = (d: Date) => d.toISOString().split('T')[0]
    return { startDate: fmt(start), endDate: fmt(end) }
  })

  // 获取股票基本信息
  async function fetchStockInfo() {
    if (!stockCode.value) return

    const cacheKey = DataCache.generateKey(CACHE_KEYS.STOCK_INFO, { code: stockCode.value, market: marketCode.value })
    const cached = dataCache.get<StockBasicInfo>(cacheKey)

    if (cached) {
      stockInfo.value = cached
      return
    }

    loading.value.info = true
    error.value.info = null

    try {
      const data = await getStockInfo(stockCode.value)
      stockInfo.value = data
      dataCache.set(cacheKey, data, CACHE_TTL.STOCK_INFO)
    } catch (e) {
      error.value.info = e instanceof Error ? e.message : '获取股票信息失败'
    } finally {
      loading.value.info = false
    }
  }

  // 获取历史K线数据
  async function fetchHistory() {
    if (!stockCode.value) return

    const { startDate, endDate } = dateRange.value
    const cacheKey = DataCache.generateKey(CACHE_KEYS.STOCK_HISTORY, {
      code: stockCode.value,
      market: marketCode.value,
      start: startDate,
      end: endDate,
    })
    const cached = dataCache.get<StockHistoryItem[]>(cacheKey)

    if (cached) {
      history.value = cached
      return
    }

    loading.value.history = true
    error.value.history = null

    try {
      const data = await getStockHistory(stockCode.value, { startDate, endDate, market: marketCode.value })
      history.value = data || []
      dataCache.set(cacheKey, data, CACHE_TTL.STOCK_HISTORY)
    } catch (e) {
      error.value.history = resolveCapabilityMessage(e, '获取历史数据失败')
      history.value = []
    } finally {
      loading.value.history = false
    }
  }

  // 获取技术指标
  async function fetchIndicators() {
    if (!stockCode.value) return

    const { startDate, endDate } = dateRange.value
    const cacheKey = DataCache.generateKey(CACHE_KEYS.STOCK_INDICATOR, {
      code: stockCode.value,
      market: marketCode.value,
      start: startDate,
      end: endDate,
    })
    const cached = dataCache.get<StockTechIndicator[]>(cacheKey)

    if (cached) {
      indicators.value = cached
      return
    }

    loading.value.indicator = true
    error.value.indicator = null

    try {
      const data = await getStockIndicator(stockCode.value, { startDate, endDate, market: marketCode.value })
      indicators.value = data || []
      dataCache.set(cacheKey, data, CACHE_TTL.STOCK_INDICATOR)
    } catch (e) {
      error.value.indicator = resolveCapabilityMessage(e, '获取技术指标失败')
      indicators.value = []
    } finally {
      loading.value.indicator = false
    }
  }

  // 获取公告列表（分页查询，单页10条）
  async function fetchNotices(page: number = 1, size: number = 10) {
    if (!stockCode.value) return

    const cacheKey = DataCache.generateKey(CACHE_KEYS.NOTICE_LIST, {
      code: stockCode.value,
      market: marketCode.value,
      page,
      size,
    })
    const cached = dataCache.get<{ list: NoticeRecord[]; total: number }>(cacheKey)

    if (cached) {
      notices.value = cached.list
      noticesTotal.value = cached.total
      return
    }

    loading.value.notices = true
    error.value.notices = null

    try {
      const data = await getAnalysisList({
        market: marketCode.value,
        stockCode: stockCode.value,
        page,
        size,
        sortBy: 'publishTime:desc',
      })
      notices.value = data?.list || []
      noticesTotal.value = data?.total || 0
      dataCache.set(cacheKey, data, CACHE_TTL.NOTICE_LIST)
    } catch (e) {
      error.value.notices = e instanceof Error ? e.message : '获取公告列表失败'
      notices.value = []
      noticesTotal.value = 0
    } finally {
      loading.value.notices = false
    }
  }

  // 刷新所有数据
  async function refreshAll() {
    await Promise.all([
      fetchStockInfo(),
      fetchHistory(),
      fetchIndicators(),
      fetchNotices(),
    ])
  }

  // 清除缓存
  function clearCache() {
    dataCache.clear(stockCode.value)
  }

  return {
    // 状态
    loading,
    error,
    // 数据
    stockInfo,
    history,
    indicators,
    notices,
    noticesTotal,
    dateRange,
    // 方法
    fetchStockInfo,
    fetchHistory,
    fetchIndicators,
    fetchNotices,
    refreshAll,
    clearCache,
  }
}
