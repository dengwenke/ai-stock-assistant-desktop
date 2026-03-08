<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePriceColorStore } from '@/stores/priceColor'
import { storeToRefs } from 'pinia'
import { echarts } from '@/utils/echarts'
import type { EChartsOption, SeriesOption } from 'echarts'
import Breadcrumb from '@/components/Breadcrumb.vue'
import {
  getStockHistory,
  getNoticesByStockCode,
  getStockIntraday,
  getStockInfo,
  getStockIndicator,
  resolveApiMarketCode,
  resolveCapabilityMessage,
} from '@/api/client'
import type { StockHistoryItem, NoticeRecord, IntradayQuoteItem, StockBasicInfo, StockTechIndicator } from '@/api/types'
import { useWorkspaceStore } from '@/stores/workspace'

type MainAverageKey = 'EMA' | 'MA'
type ChartType = 'kline' | 'intraday'
type IndicatorKey = 'MACD' | 'KDJ' | 'BOLL' | 'RSI' | 'WR' | 'DMI' | 'CCI' | 'BIAS'
type MainLayoutMode = 'focus' | 'balanced' | 'compact'
type SubLayoutMode = 'compact' | 'balanced' | 'expanded'

interface IndicatorSeriesConfig {
  name: string
  field: keyof StockTechIndicator
  color: string
  type?: 'line' | 'bar'
}

interface MainAverageOption {
  key: MainAverageKey
  label: string
  series: IndicatorSeriesConfig[]
}

interface SubIndicatorOption {
  key: IndicatorKey
  label: string
  series: IndicatorSeriesConfig[]
}

interface MainLayoutOption {
  key: MainLayoutMode
  label: string
}

interface SubLayoutOption {
  key: SubLayoutMode
  label: string
}

const MAIN_AVERAGE_OPTIONS: MainAverageOption[] = [
  {
    key: 'EMA',
    label: 'EMA',
    series: [
      { name: 'EMA13', field: 'ema13', color: '#3b82f6' },
      { name: 'EMA34', field: 'ema34', color: '#f59e0b' },
      { name: 'EMA120', field: 'ema120', color: '#10b981' },
    ],
  },
  {
    key: 'MA',
    label: 'MA',
    series: [
      { name: 'MA5', field: 'ma5', color: '#3b82f6' },
      { name: 'MA10', field: 'ma10', color: '#f59e0b' },
      { name: 'MA20', field: 'ma20', color: '#10b981' },
      { name: 'MA60', field: 'ma60', color: '#06b6d4' },
    ],
  },
]

const SUB_INDICATORS: SubIndicatorOption[] = [
  {
    key: 'MACD',
    label: 'MACD',
    series: [
      { name: 'DIF', field: 'dif', color: '#3b82f6' },
      { name: 'DEA', field: 'dea', color: '#f59e0b' },
      { name: 'MACD', field: 'macd', color: '#10b981', type: 'bar' },
    ],
  },
  {
    key: 'KDJ',
    label: 'KDJ',
    series: [
      { name: 'K', field: 'kdjK', color: '#3b82f6' },
      { name: 'D', field: 'kdjD', color: '#f59e0b' },
      { name: 'J', field: 'kdjJ', color: '#10b981' },
    ],
  },
  {
    key: 'BOLL',
    label: '布林带',
    series: [
      { name: '上轨', field: 'bollUpper', color: '#3b82f6' },
      { name: '中轨', field: 'bollMiddle', color: '#f59e0b' },
      { name: '下轨', field: 'bollLower', color: '#10b981' },
    ],
  },
  {
    key: 'RSI',
    label: 'RSI',
    series: [
      { name: 'RSI6', field: 'rsi6', color: '#3b82f6' },
      { name: 'RSI12', field: 'rsi12', color: '#f59e0b' },
      { name: 'RSI24', field: 'rsi24', color: '#10b981' },
    ],
  },
  {
    key: 'WR',
    label: '威廉指标',
    series: [
      { name: 'WR6', field: 'wr6', color: '#3b82f6' },
      { name: 'WR10', field: 'wr10', color: '#f59e0b' },
    ],
  },
  {
    key: 'DMI',
    label: 'DMI',
    series: [
      { name: 'PDI', field: 'dmiPdi', color: '#3b82f6' },
      { name: 'MDI', field: 'dmiMdi', color: '#f59e0b' },
      { name: 'ADX', field: 'dmiAdx', color: '#10b981' },
    ],
  },
  {
    key: 'CCI',
    label: 'CCI',
    series: [{ name: 'CCI', field: 'cci', color: '#3b82f6' }],
  },
  {
    key: 'BIAS',
    label: 'BIAS',
    series: [
      { name: 'BIAS6', field: 'bias6', color: '#3b82f6' },
      { name: 'BIAS12', field: 'bias12', color: '#f59e0b' },
      { name: 'BIAS24', field: 'bias24', color: '#10b981' },
    ],
  },
]

const MAIN_LAYOUT_OPTIONS: MainLayoutOption[] = [
  { key: 'focus', label: '主图优先' },
  { key: 'balanced', label: '均衡' },
  { key: 'compact', label: '紧凑' },
]

const SUB_LAYOUT_OPTIONS: SubLayoutOption[] = [
  { key: 'compact', label: '紧凑' },
  { key: 'balanced', label: '标准' },
  { key: 'expanded', label: '扩展' },
]

const MAIN_LAYOUT_STYLE_MAP: Record<MainLayoutMode, {
  mainMinHeight: number
  mainMinHeightMobile: number
  volumeHeight: number
  volumeHeightMobile: number
}> = {
  focus: {
    mainMinHeight: 340,
    mainMinHeightMobile: 264,
    volumeHeight: 90,
    volumeHeightMobile: 74,
  },
  balanced: {
    mainMinHeight: 280,
    mainMinHeightMobile: 220,
    volumeHeight: 80,
    volumeHeightMobile: 66,
  },
  compact: {
    mainMinHeight: 240,
    mainMinHeightMobile: 198,
    volumeHeight: 70,
    volumeHeightMobile: 58,
  },
}

const SUB_LAYOUT_STYLE_MAP: Record<SubLayoutMode, {
  indicatorHeight: number
  indicatorHeightMobile: number
}> = {
  compact: {
    indicatorHeight: 88,
    indicatorHeightMobile: 80,
  },
  balanced: {
    indicatorHeight: 102,
    indicatorHeightMobile: 90,
  },
  expanded: {
    indicatorHeight: 128,
    indicatorHeightMobile: 106,
  },
}

const selectedMainAverage = ref<MainAverageKey>('EMA')
const selectedIndicator = ref<IndicatorKey>('MACD')
const selectedMainLayout = ref<MainLayoutMode>('balanced')
const selectedSubLayout = ref<SubLayoutMode>('balanced')

const route = useRoute()
const router = useRouter()
const priceColorStore = usePriceColorStore()
const { upColor: priceUpColor, downColor: priceDownColor } = storeToRefs(priceColorStore)
const workspaceStore = useWorkspaceStore()
const { currentMarket } = storeToRefs(workspaceStore)

const marketCode = computed(() => resolveApiMarketCode(currentMarket.value))

const stockCode = computed(() => {
  const code = route.params.stockCode
  return typeof code === 'string' ? code : ''
})

const from = computed(() => {
  const q = route.query.from
  return (typeof q === 'string' && (q === 'announcements' || q === 'today-watch')) ? q : 'announcements'
})

const backPath = computed(() => {
  if (from.value === 'today-watch') return '/'
  return '/announcements'
})

const backLabel = computed(() => {
  if (from.value === 'today-watch') return '返回当日看盘'
  return '返回公告分析'
})

const breadcrumbItems = computed(() => [
  { text: '首页', to: '/' },
  { text: '公告分析', to: backPath.value },
  { text: stockName.value ? `${stockName.value} 行情` : `${stockCode.value || ''}`.trim() || '股票行情' },
])

const historyLoading = ref(false)
const historyError = ref<string | null>(null)
const history = ref<StockHistoryItem[]>([])

const intradayLoading = ref(false)
const intradayError = ref<string | null>(null)
const intraday = ref<IntradayQuoteItem[]>([])
const intradayDate = ref<string | null>(null)

const noticesLoading = ref(false)
const noticesError = ref<string | null>(null)
const notices = ref<NoticeRecord[]>([])
const hoveredNoticeDate = ref<string | null>(null)
const selectedNoticeDate = ref<string | null>(null)
const selectedNoticeId = ref<number | null>(null)

const stockBasicInfo = ref<StockBasicInfo | null>(null)

const techIndicator = ref<StockTechIndicator[]>([])

const indicatorCache = new Map<string, StockTechIndicator[]>()

const techIndicatorMap = computed(() => {
  const map = new Map<string, StockTechIndicator>()
  for (const item of techIndicator.value) {
    map.set(item.tradeDate, item)
  }
  return map
})

const indicatorData = computed(() => {
  const list = filteredHistoryByRange.value
  if (!list.length) return null
  const map = techIndicatorMap.value
  const data = list.map((item) => {
    const dateKey = normalizeDateKey(item.date)
    return map.get(dateKey) ?? null
  })
  return data
})

const currentMainAverageOption = computed(() => {
  return (
    MAIN_AVERAGE_OPTIONS.find((option) => option.key === selectedMainAverage.value) ??
    MAIN_AVERAGE_OPTIONS[0]
  )
})

const currentSubIndicatorOption = computed(() => {
  return (
    SUB_INDICATORS.find((option) => option.key === selectedIndicator.value) ??
    SUB_INDICATORS[0]
  )
})

const stockName = computed(() => {
  if (stockBasicInfo.value?.stockName?.trim()) return stockBasicInfo.value.stockName.trim()
  return notices.value.find((n) => n.stockName)?.stockName ?? ''
})

const hasBasicInfoRow = computed(() => {
  const b = stockBasicInfo.value
  if (!b) return false
  return !!(b.industry?.trim() || b.marketCap?.trim() || b.pe?.trim() || b.pb?.trim())
})

const chartType = ref<ChartType>('kline')
const chartLayoutStyle = computed<Record<string, string>>(() => {
  const mainLayout = MAIN_LAYOUT_STYLE_MAP[selectedMainLayout.value]
  const subLayout = SUB_LAYOUT_STYLE_MAP[selectedSubLayout.value]
  return {
    '--quote-kline-main-min-height': `${mainLayout.mainMinHeight}px`,
    '--quote-kline-main-min-height-mobile': `${mainLayout.mainMinHeightMobile}px`,
    '--quote-kline-volume-height': `${mainLayout.volumeHeight}px`,
    '--quote-kline-volume-height-mobile': `${mainLayout.volumeHeightMobile}px`,
    '--quote-kline-indicator-height': `${subLayout.indicatorHeight}px`,
    '--quote-kline-indicator-height-mobile': `${subLayout.indicatorHeightMobile}px`,
  }
})
const KLINE_MIN_VALUE_SPAN = 1
const KLINE_MAX_VALUE_SPAN = 365
const KLINE_DEFAULT_CALENDAR_DAYS = 30
const KLINE_DEFAULT_TRADING_DAYS = 21

const chartTypeSelectValue = computed<ChartType>({
  get: () => chartType.value,
  set: (next) => {
    handleSwitchChartType(next)
  },
})

const noticesByDate = computed(() => {
  const map = new Map<string, NoticeRecord[]>()
  for (const n of notices.value) {
    const d = getNoticeTradeDate(n)
    if (!d) continue
    const list = map.get(d)
    if (list) {
      list.push(n)
    } else {
      map.set(d, [n])
    }
  }
  return map
})

function getNoticeTradeDate(row: NoticeRecord): string | null {
  const anyRow = row as NoticeRecord & { t_date?: string; tdate?: string }
  const v = row.tDate ?? anyRow.t_date ?? anyRow.tdate ?? null
  if (v && String(v).trim() !== '') return String(v).trim()
  return null
}

function getNoticePctT(row: NoticeRecord): number | null {
  const anyRow = row as NoticeRecord & { pct_t?: number }
  const raw = row.pctT ?? anyRow.pct_t ?? null
  if (raw == null || Number.isNaN(raw)) return null
  return Number(raw)
}

function isNoticeLocked(row: NoticeRecord): boolean {
  if (selectedNoticeId.value != null && row.id != null) return selectedNoticeId.value === row.id
  const tDate = getNoticeTradeDate(row)
  return !!tDate && tDate === selectedNoticeDate.value
}

type NoticeTimelineStatus = 'future' | 'today' | 'past' | 'unknown'

const latestKlineDate = computed(() => {
  const list = validHistorySorted.value
  if (!list.length) return null
  return normalizeDateKey(list[list.length - 1].date)
})

function getNoticeTimelineStatus(row: NoticeRecord): NoticeTimelineStatus {
  const tDate = getNoticeTradeDate(row)
  const latestDate = latestKlineDate.value
  if (!tDate || !latestDate) return 'unknown'
  if (tDate > latestDate) return 'future'
  if (tDate < latestDate) return 'past'
  return 'today'
}

function goBack() {
  router.push(backPath.value)
}

function goToAnalysisDetail(row: NoticeRecord) {
  if (row.id == null || !row.stockCode) return
  router.push({
    name: 'stock-detail',
    params: { stockCode: row.stockCode },
    query: { mode: 'analysis', noticeId: String(row.id), market: currentMarket.value }
  })
}

function handleNoticeHover(notice: NoticeRecord | null) {
  hoveredNoticeDate.value = notice ? getNoticeTradeDate(notice) : null
  debouncedHoverKlineOptionUpdate()
}

function getDefaultDateRange(): { startDate: string; endDate: string } {
  const end = new Date()
  const start = new Date()
  start.setFullYear(end.getFullYear() - 1)

  function fmt(d: Date): string {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  return { startDate: fmt(start), endDate: fmt(end) }
}

async function loadHistoryAndNotices() {
  const code = stockCode.value
  if (!code) return
  const { startDate, endDate } = getDefaultDateRange()
  const indicatorCacheKey = `${marketCode.value}:${code}:${startDate}:${endDate}`
  const indicatorPromise = indicatorCache.has(indicatorCacheKey)
    ? Promise.resolve(indicatorCache.get(indicatorCacheKey) ?? [])
    : getStockIndicator(code, { startDate, endDate, market: marketCode.value })

  historyLoading.value = true
  historyError.value = null
  noticesLoading.value = true
  noticesError.value = null
  hoveredNoticeDate.value = null
  selectedNoticeDate.value = null
  selectedNoticeId.value = null
  stockBasicInfo.value = null

  const [historyResult, noticesResult, infoResult, indicatorResult] = await Promise.allSettled([
    getStockHistory(code, { startDate, endDate, market: marketCode.value }),
    getNoticesByStockCode(code, { market: marketCode.value }),
    getStockInfo(code),
    indicatorPromise,
  ])

  if (historyResult.status === 'fulfilled') {
    const h = historyResult.value
    history.value = Array.isArray(h) ? h : []
    applyDefaultMonthZoom()
  } else if (!history.value.length) {
    historyError.value = resolveCapabilityMessage(historyResult.reason, '数据接入中')
  }

  if (noticesResult.status === 'fulfilled') {
    const n = noticesResult.value
    notices.value = n?.list ?? []
  } else if (!notices.value.length) {
    const e = noticesResult.reason
    const msg = e instanceof Error ? e.message : '加载公告失败'
    noticesError.value = msg
  }

  if (infoResult.status === 'fulfilled') {
    stockBasicInfo.value = infoResult.value
  }

  if (indicatorResult.status === 'fulfilled') {
    const ind = indicatorResult.value
    const data = Array.isArray(ind) ? ind : []
    techIndicator.value = data
    indicatorCache.set(indicatorCacheKey, data)
  }

  historyLoading.value = false
  noticesLoading.value = false
  nextTick(() => {
    requestAnimationFrame(() => {
      updateChart()
    })
  })
}

const chartRef = ref<HTMLElement | null>(null)
let chart: echarts.ECharts | null = null

const chartKlineRef = ref<HTMLElement | null>(null)
const chartVolumeRef = ref<HTMLElement | null>(null)
const chartIndicatorRef = ref<HTMLElement | null>(null)
const chartTimelineRef = ref<HTMLElement | null>(null)
let chartKline: echarts.ECharts | null = null
let chartVolume: echarts.ECharts | null = null
let chartIndicator: echarts.ECharts | null = null
let chartTimeline: echarts.ECharts | null = null
let chartResizeRafId: number | null = null

const klineDataZoomRange = ref({ start: 0, end: 100 })

function getDefaultMonthZoomRange(dates: string[]) {
  if (!dates.length) return { start: 0, end: 100 }
  if (dates.length <= KLINE_DEFAULT_TRADING_DAYS) return { start: 0, end: 100 }

  const total = dates.length
  const endIndex = total - 1
  let startIndex = Math.max(0, total - KLINE_DEFAULT_TRADING_DAYS)

  const endDate = new Date(dates[endIndex])
  if (!Number.isNaN(endDate.getTime())) {
    const targetMs = endDate.getTime() - KLINE_DEFAULT_CALENDAR_DAYS * 24 * 60 * 60 * 1000
    const found = dates.findIndex((d) => {
      const parsed = new Date(d)
      return !Number.isNaN(parsed.getTime()) && parsed.getTime() >= targetMs
    })
    if (found >= 0) startIndex = found
  }

  const start = (startIndex / total) * 100
  const end = ((endIndex + 1) / total) * 100
  return { start, end }
}

function applyDefaultMonthZoom() {
  const dates = validHistorySorted.value.map((item) => normalizeDateKey(item.date))
  klineDataZoomRange.value = getDefaultMonthZoomRange(dates)
}

function focusKlineOnDate(dateStr: string) {
  const items = filteredHistoryByRange.value
  if (!items.length) return

  const normalizedDate = normalizeDateKey(dateStr)
  const dateIndex = items.findIndex((row) => normalizeDateKey(row.date) === normalizedDate)
  if (dateIndex === -1) return

  const total = items.length
  const visibleDays = Math.min(Math.max(KLINE_DEFAULT_TRADING_DAYS, KLINE_MIN_VALUE_SPAN), KLINE_MAX_VALUE_SPAN, total)
  let startIndex = Math.max(0, dateIndex - Math.floor(visibleDays / 2))
  let endIndex = Math.min(total - 1, startIndex + visibleDays - 1)
  if (endIndex - startIndex + 1 < visibleDays) {
    startIndex = Math.max(0, endIndex - visibleDays + 1)
  }

  const start = (startIndex / total) * 100
  const end = ((endIndex + 1) / total) * 100
  klineDataZoomRange.value = { start, end }
}

function getLockedNoticeDateForZoom(): string | null {
  if (selectedNoticeDate.value) return normalizeDateKey(selectedNoticeDate.value)
  if (selectedNoticeId.value == null) return null
  const matched = notices.value.find((notice) => notice.id === selectedNoticeId.value)
  const tDate = matched ? getNoticeTradeDate(matched) : null
  return tDate ? normalizeDateKey(tDate) : null
}

function constrainZoomRangeToLockedNotice(range: { start: number; end: number }): { start: number; end: number } {
  const dates = validHistorySorted.value.map((item) => normalizeDateKey(item.date))
  if (!dates.length) return { start: 0, end: 100 }

  const lockedDate = getLockedNoticeDateForZoom()
  if (!lockedDate) return range

  const lockedIndex = dates.indexOf(lockedDate)
  if (lockedIndex < 0) return range

  const total = dates.length
  let startIndex = Math.floor((Math.max(0, Math.min(100, range.start)) / 100) * total)
  let endIndex = Math.ceil((Math.max(0, Math.min(100, range.end)) / 100) * total) - 1
  startIndex = Math.max(0, Math.min(total - 1, startIndex))
  endIndex = Math.max(startIndex, Math.min(total - 1, endIndex))

  const span = Math.max(0, endIndex - startIndex)
  if (lockedIndex < startIndex) {
    startIndex = lockedIndex
    endIndex = Math.min(total - 1, startIndex + span)
  } else if (lockedIndex > endIndex) {
    endIndex = lockedIndex
    startIndex = Math.max(0, endIndex - span)
  }

  return {
    start: (startIndex / total) * 100,
    end: ((endIndex + 1) / total) * 100,
  }
}

function handleNoticeSelect(notice: NoticeRecord) {
  selectedNoticeId.value = notice.id ?? null
  selectedNoticeDate.value = getNoticeTradeDate(notice)

  if (!selectedNoticeDate.value) {
    if (chartType.value !== 'kline') {
      chartType.value = 'kline'
    } else {
      updateChart()
    }
    return
  }

  if (chartType.value !== 'kline') {
    chartType.value = 'kline'
    nextTick(() => {
      focusKlineOnDate(selectedNoticeDate.value!)
      updateChart()
    })
    return
  }

  focusKlineOnDate(selectedNoticeDate.value)
  updateChart()
}

function makeKlineDataZoomHandler(source: 'kline' | 'volume' | 'indicator' | 'timeline') {
  let pendingPayload: any = null
  let rafId: number | null = null

  const flush = () => {
    rafId = null
    const payload = pendingPayload
    pendingPayload = null
    if (!payload) return

    const start = payload?.batch?.[0]?.start ?? payload?.start
    const end = payload?.batch?.[0]?.end ?? payload?.end
    if (start == null || end == null) return
    const constrained = constrainZoomRangeToLockedNotice({ start: Number(start), end: Number(end) })
    const adjusted =
      Math.abs(constrained.start - Number(start)) > 0.001 ||
      Math.abs(constrained.end - Number(end)) > 0.001
    const prev = klineDataZoomRange.value
    const unchanged =
      Math.abs(prev.start - constrained.start) <= 0.001 &&
      Math.abs(prev.end - constrained.end) <= 0.001
    if (unchanged) return
    klineDataZoomRange.value = constrained
    const optKline = buildKlineOptionOnly()
    const optVol = buildVolumeOptionOnly()
    const optIndicator = buildIndicatorOptionOnly()
    const optTimeline = buildTimelineOptionOnly()
    if (!optKline || !optVol || !optTimeline) return
    if ((source !== 'kline' || adjusted) && chartKline) {
      chartKline.setOption(optKline, { notMerge: false, lazyUpdate: true, silent: true })
    }
    if ((source !== 'volume' || adjusted) && chartVolume) {
      chartVolume.setOption(optVol, { notMerge: false, lazyUpdate: true, silent: true })
    }
    if ((source !== 'indicator' || adjusted) && chartIndicator && optIndicator) {
      chartIndicator.setOption(optIndicator, { notMerge: false, lazyUpdate: true, silent: true })
    }
    if ((source !== 'timeline' || adjusted) && chartTimeline) {
      chartTimeline.setOption(optTimeline, { notMerge: false, lazyUpdate: true, silent: true })
    }
  }

  return (payload: any) => {
    pendingPayload = payload
    if (rafId != null) return
    rafId = requestAnimationFrame(flush)
  }
}
const klineDataZoomHandlerKline = makeKlineDataZoomHandler('kline')
const klineDataZoomHandlerVolume = makeKlineDataZoomHandler('volume')
const klineDataZoomHandlerIndicator = makeKlineDataZoomHandler('indicator')
const klineDataZoomHandlerTimeline = makeKlineDataZoomHandler('timeline')

function initChart() {
  if (chart || !chartRef.value) return
  chart = echarts.init(chartRef.value)
  chart.on('click', handleChartClick as (event: any) => void)
}

function initKlineCharts() {
  if (!chartKlineRef.value || !chartVolumeRef.value || !chartIndicatorRef.value || !chartTimelineRef.value) return
  if (!chartKline) {
    chartKline = echarts.init(chartKlineRef.value)
    chartKline.on('click', handleChartClick as (event: any) => void)
    chartKline.on('dataZoom', klineDataZoomHandlerKline)
  }
  if (!chartVolume) {
    chartVolume = echarts.init(chartVolumeRef.value)
    chartVolume.on('dataZoom', klineDataZoomHandlerVolume)
  }
  if (!chartIndicator) {
    chartIndicator = echarts.init(chartIndicatorRef.value)
    chartIndicator.on('dataZoom', klineDataZoomHandlerIndicator)
  }
  if (!chartTimeline) {
    chartTimeline = echarts.init(chartTimelineRef.value)
    chartTimeline.on('dataZoom', klineDataZoomHandlerTimeline)
  }
}

function disposeChart() {
  if (chartResizeRafId != null) {
    cancelAnimationFrame(chartResizeRafId)
    chartResizeRafId = null
  }
  if (chart) {
    chart.off('click', handleChartClick as (event: any) => void)
    chart.dispose()
  }
  chart = null
  if (chartKline) {
    chartKline.off('click', handleChartClick as (event: any) => void)
    chartKline.off('dataZoom', klineDataZoomHandlerKline)
    chartKline.dispose()
    chartKline = null
  }
  if (chartVolume) {
    chartVolume.off('dataZoom', klineDataZoomHandlerVolume)
    chartVolume.dispose()
    chartVolume = null
  }
  if (chartIndicator) {
    chartIndicator.off('dataZoom', klineDataZoomHandlerIndicator)
    chartIndicator.dispose()
    chartIndicator = null
  }
  if (chartTimeline) {
    chartTimeline.off('dataZoom', klineDataZoomHandlerTimeline)
    chartTimeline.dispose()
    chartTimeline = null
  }
}

async function handleChartClick(params: any) {
  if (!params) return
  const anyParams = params as any
  if (anyParams.seriesName === '公告标记') {
    const data: any = anyParams.data
    const list = data?.notices as Array<{ id?: number; tDate?: string }> | undefined
    if (!list || !list.length) return
    const target = list[0]
    if (target.id != null) {
      const matched = notices.value.find((notice) => notice.id === target.id)
      if (matched) {
        handleNoticeSelect(matched)
        return
      }
    }
    if (!target.tDate) return
    selectedNoticeId.value = target.id ?? null
    selectedNoticeDate.value = target.tDate
    focusKlineOnDate(target.tDate)
    updateChart()
    return
  }

  if (anyParams.seriesName === 'K线' || anyParams.seriesType === 'candlestick') {
    const idx: number | undefined = anyParams.dataIndex
    if (idx == null) return
    const items = filteredHistoryByRange.value
    const row = items[idx]
    if (!row) return
    const date = normalizeDateKey(row.date)
    chartType.value = 'intraday'
    await loadIntradayForDate(date)
  }
}

function handleSwitchChartType(type: 'kline' | 'intraday') {
  if (type === chartType.value) return
  chartType.value = type
  if (type === 'intraday') {
    if (!intradayDate.value) {
      const snap = latestSnapshot.value
      if (snap?.date) {
        loadIntradayForDate(snap.date)
        return
      }
    }
  }
  nextTick(() => updateChart())
}

async function loadIntradayForDate(date: string) {
  if (!stockCode.value) return
  intradayDate.value = date
  intradayLoading.value = true
  intradayError.value = null
  try {
    const list = await getStockIntraday(stockCode.value, date, marketCode.value)
    intraday.value = Array.isArray(list) ? list : []
    if (!intraday.value.length) {
      intradayError.value = '暂未获取到该日的分时行情'
    }
  } catch (e) {
    intradayError.value = resolveCapabilityMessage(e, '数据接入中')
    intraday.value = []
  } finally {
    intradayLoading.value = false
    nextTick(() => {
      updateChart()
    })
  }
}

function normalizeDateKey(dateStr: string): string {
  if (!dateStr || typeof dateStr !== 'string') return dateStr
  const part = dateStr.trim().split('T')[0]
  return part || dateStr
}

function debounce<T extends (...args: any[]) => any>(fn: T, delay: number): T {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  return ((...args: any[]) => {
    if (timeoutId) clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }) as T
}

let debouncedUpdateChart = () => {}
const debouncedHoverKlineOptionUpdate = debounce(() => {
  if (chartType.value !== 'kline' || !chartKline) return
  const optKline = buildKlineOptionOnly()
  if (optKline) {
    chartKline.setOption(optKline, { notMerge: false, lazyUpdate: true, silent: true })
  }
}, 32)

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function formatVolume(v: number): string {
  if (v >= 1e8) return (v / 1e8).toFixed(2) + '亿'
  if (v >= 1e4) return (v / 1e4).toFixed(2) + '万'
  return String(v)
}

function formatPctChange(pct: number): string {
  const s = pct >= 0 ? '+' + pct.toFixed(2) : pct.toFixed(2)
  return s + '%'
}

const validHistorySorted = computed(() => {
  const raw = history.value
  const items = Array.isArray(raw) ? raw : []
  const filtered = items.filter(
    (d) =>
      isFiniteNumber(d.open) &&
      isFiniteNumber(d.close) &&
      isFiniteNumber(d.low) &&
      isFiniteNumber(d.high)
  )
  return [...filtered].sort((a, b) =>
    normalizeDateKey(a.date).localeCompare(normalizeDateKey(b.date))
  )
})

const filteredHistoryByRange = computed(() => {
  return validHistorySorted.value
})

const rangeMainAverage = computed(() => {
  const list = filteredHistoryByRange.value
  const indData = indicatorData.value
  if (!list.length || !indData) {
    return [] as Array<{ name: string; color: string; values: Array<number | null> }>
  }
  return currentMainAverageOption.value.series.map((series) => ({
    name: series.name,
    color: series.color,
    values: indData.map((d) => {
      const value = d?.[series.field]
      return typeof value === 'number' && Number.isFinite(value) ? value : null
    }),
  }))
})

const rangeMainAverageLast = computed(() => {
  return rangeMainAverage.value.map((series) => ({
    name: series.name,
    color: series.color,
    value: series.values.length ? series.values[series.values.length - 1] : null,
  }))
})

const subIndicatorSummary = computed(() => {
  const indData = indicatorData.value
  if (!indData?.length) return []
  const latest = indData[indData.length - 1]
  if (!latest) return []
  return currentSubIndicatorOption.value.series.map((series) => {
    const value = latest[series.field]
    return {
      name: series.name,
      color: series.color,
      value: typeof value === 'number' && Number.isFinite(value) ? value : null,
    }
  })
})

const rangeOhlc = computed(() => {
  const list = filteredHistoryByRange.value
  if (!list.length) return { open: null, close: null, high: null, low: null }
  const first = list[0]
  const last = list[list.length - 1]
  let high = first.high!
  let low = first.low!
  for (const d of list) {
    if (d.high! > high) high = d.high!
    if (d.low! < low) low = d.low!
  }
  return {
    open: first.open ?? null,
    close: last.close ?? null,
    high,
    low,
  }
})

const latestSnapshot = computed(() => {
  const list = validHistorySorted.value
  if (!list.length) return null
  const last = list[list.length - 1]
  const prevClose = list.length > 1 ? (list[list.length - 2].close as number) : null
  let openChgPct: number | null = null
  if (prevClose != null && prevClose !== 0 && isFiniteNumber(last.open)) {
    openChgPct = ((last.open! - prevClose) / prevClose) * 100
  }
  const change = prevClose != null ? last.close! - prevClose : null
  return {
    date: normalizeDateKey(last.date),
    open: last.open ?? null,
    close: last.close ?? null,
    high: last.high ?? null,
    low: last.low ?? null,
    volume: last.volume ?? null,
    pctChange: last.pctChange ?? null,
    prevClose,
    openChgPct,
    change,
  }
})

const intradayOhlc = computed(() => {
  const raw = intraday.value
  const list = Array.isArray(raw) ? raw : []
  if (!list.length) return { open: null, close: null, high: null, low: null }
  
  const items = list
    .map((d) => ({
      time: String(d.time ?? '').trim(),
      open: toNum(d.open),
      high: toNum(d.high),
      low: toNum(d.low),
      close: toNum(d.close),
    }))
    .filter((d) => d.open != null && d.close != null && d.high != null && d.low != null)
    .sort((a, b) => a.time.localeCompare(b.time))

  if (!items.length) return { open: null, close: null, high: null, low: null }

  const first = items[0]
  const last = items[items.length - 1]
  let high = first.high!
  let low = first.low!
  
  for (const d of items) {
    if (d.high! > high) high = d.high!
    if (d.low! < low) low = d.low!
  }
  
  return {
    open: first.open,
    close: last.close,
    high,
    low,
  }
})

function toNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    if (!v.trim()) return null
    const n = parseFloat(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function intradayTimeToLabel(t: string): string {
  const s = String(t ?? '').trim()
  const withSpace = s.indexOf(' ')
  if (withSpace >= 0) {
    const part = s.slice(withSpace + 1)
    return part.slice(0, 5)
  }
  return s.slice(0, 5)
}

function buildIntradayOption(): EChartsOption {
  const raw = intraday.value
  const list = Array.isArray(raw) ? raw : []
  if (!list.length) {
    return {
      title: {
        text: intradayLoading.value ? '加载分时行情中…' : '暂无该日分时行情',
        left: 'center',
        top: 'middle',
        textStyle: { color: '#9ca3af', fontSize: 14 },
      },
    }
  }

  const items = list
    .map((d) => ({
      time: String(d.time ?? '').trim(),
      open: toNum(d.open),
      high: toNum(d.high),
      low: toNum(d.low),
      close: toNum(d.close),
      volume: toNum(d.volume),
    }))
    .filter((d) => d.close != null)
    .sort((a, b) => a.time.localeCompare(b.time))

  if (!items.length) {
    return {
      title: {
        text: '暂无有效分时行情',
        left: 'center',
        top: 'middle',
        textStyle: { color: '#9ca3af', fontSize: 14 },
      },
    }
  }

  const times = items.map((d) => intradayTimeToLabel(d.time))
  const prices = items.map((d) => d.close!)
  const volumes = items.map((d) => d.volume ?? 0)

  const volColors = items.map((d, idx) => {
    if (idx === 0) return '#60a5fa'
    const prev = items[idx - 1]
    return d.close! >= prev.close! ? priceDownColor.value : priceUpColor.value
  })

  const dateKey = intradayDate.value
  const sameDayNotices =
    (dateKey &&
      (notices.value ?? []).filter((n) => {
        return getNoticeTradeDate(n) === dateKey
      })) ||
    []

  const timeIndexMap = new Map<string, number>()
  times.forEach((t, idx) => timeIndexMap.set(t, idx))

  function findTimeIndex(hhmm: string): number | null {
    if (times.length === 0) return null
    const first = times[0]
    const last = times[times.length - 1]
    if (hhmm < first || hhmm > last) return 0
    const exact = timeIndexMap.get(hhmm)
    if (exact != null) return exact
    let i = 0
    while (i < times.length && times[i] < hhmm) i++
    if (i >= times.length) return times.length - 1
    return i
  }

  const noticeByTime = new Map<
    string,
    { id?: number; title: string; publishTime: string }[]
  >()
  for (const n of sameDayNotices) {
    const raw = String(n.publishTime ?? '').trim()
    const parts = raw.split(' ')
    const timePart = (parts[1] ?? parts[0] ?? '').slice(0, 5)
    if (!timePart) continue
    const listAtTime =
      noticeByTime.get(timePart) ??
      []
    listAtTime.push({
      id: n.id,
      title: n.noticeTitle,
      publishTime: n.publishTime,
    })
    noticeByTime.set(timePart, listAtTime)
  }

  const firstTime = times[0]
  const lastTime = times[times.length - 1]
  const noticePoints: any[] = []
  const outOfRangeNotices: { id?: number; title: string; publishTime: string }[] = []
  for (const [t, listAtTime] of noticeByTime.entries()) {
    const idx = findTimeIndex(t)
    if (idx == null) continue
    if (t < firstTime || t > lastTime) {
      outOfRangeNotices.push(...listAtTime)
      continue
    }
    noticePoints.push({
      value: [times[idx], prices[idx]],
      notices: listAtTime,
    })
  }
  if (outOfRangeNotices.length > 0) {
    noticePoints.unshift({
      value: [firstTime, prices[0]],
      notices: outOfRangeNotices,
    })
  }

  return {
    animation: true,
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      backgroundColor: 'rgba(13, 19, 33, 0.95)',
      borderColor: 'var(--border)',
      borderWidth: 1,
      padding: [12, 16],
      textStyle: { fontSize: 12, color: '#f1f5f9', fontFamily: 'IBM Plex Sans, sans-serif' },
      extraCssText: 'backdrop-filter: blur(8px); border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);',
      formatter: (params: any) => {
        if (!Array.isArray(params) || !params.length) return ''
        const idx = params[0]?.dataIndex
        if (idx == null || idx < 0 || idx >= items.length) return ''
        const row = items[idx]
        const timeStr = times[idx] ?? ''
        const priceStr = row.close != null ? row.close.toFixed(2) : '—'
        const volStr = isFiniteNumber(row.volume) ? formatVolume(row.volume) : '—'
        const prevClose = idx > 0 ? items[idx - 1].close : null
        const lineColor = prevClose != null && row.close != null && row.close >= prevClose ? priceUpColor.value : priceDownColor.value
        return (
          '<div style="font-weight:600;margin-bottom:6px;color:#f1f5f9;font-size:13px;padding-bottom:8px;border-bottom:1px solid var(--border)">' + timeStr + '</div>' +
          '<table style="border-collapse:collapse;font-size:12px">' +
          '<tr><td style="padding:4px 12px 4px 0;color:#94a3b8">价格</td><td style="text-align:right;color:' + lineColor + '">' + priceStr + '</td></tr>' +
          '<tr><td style="padding:4px 12px 4px 0;color:#94a3b8">成交量</td><td style="text-align:right;color:#f1f5f9">' + volStr + '</td></tr>' +
          '</table>'
        )
      },
    },
    grid: [
      { left: 56, right: 16, top: 16, height: '56%' },
      { left: 56, right: 16, top: '68%', height: '22%' },
    ],
    xAxis: [
      {
        type: 'category',
        data: times,
        boundaryGap: false,
        axisLine: { lineStyle: { color: 'var(--border)' } },
        axisLabel: { color: 'var(--text-muted)', fontSize: 11, interval: 'auto' },
        axisTick: { show: false },
      },
      {
        type: 'category',
        gridIndex: 1,
        data: times,
        boundaryGap: false,
        axisLine: { lineStyle: { color: 'var(--border)' } },
        axisLabel: { color: 'var(--text-muted)', fontSize: 10, interval: 'auto' },
        axisTick: { show: false },
      },
    ],
    yAxis: [
      {
        scale: true,
        axisLine: { show: false },
        axisLabel: { color: 'var(--text-muted)', fontSize: 11 },
        splitLine: { lineStyle: { color: 'var(--border)', opacity: 0.3 } },
      },
      {
        gridIndex: 1,
        scale: true,
        axisLine: { show: false },
        axisLabel: {
          color: 'var(--text-muted)',
          fontSize: 10,
          formatter: (v: number) => formatVolume(v),
        },
        splitLine: { show: false },
      },
    ],
    dataZoom: [
      {
        type: 'inside',
        xAxisIndex: [0, 1],
        start: 0,
        end: 100,
      },
    ],
    series: [
      {
        name: '价格',
        type: 'line',
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: prices,
        showSymbol: false,
        smooth: true,
        lineStyle: { width: 2, color: '#0ea5e9' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(14,165,233,0.2)' },
              { offset: 1, color: 'rgba(14,165,233,0.02)' },
            ],
          },
        },
      },
      {
        name: '公告',
        type: 'scatter',
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: noticePoints,
        symbol: 'circle',
        symbolSize: 10,
        itemStyle: {
          color: '#f97316',
          borderColor: '#c2410c',
          borderWidth: 2,
        },
        tooltip: {
          trigger: 'item',
          formatter: (params: any) => {
            const data = params.data
            const list =
              (data?.notices as Array<{ title: string; publishTime: string }>) ||
              []
            if (!list.length) return '有公告'
            return list.slice(0, 5).map((n) => `${n.publishTime ?? ''} ${n.title}`).join('<br/>') + (list.length > 5 ? `<br/>… 等 ${list.length} 条` : '')
          },
        },
        zlevel: 3,
      },
      {
        name: '成交量',
        type: 'bar',
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: volumes,
        itemStyle: {
          color: (params: any) => volColors[params.dataIndex] ?? '#60a5fa',
        },
        barMaxWidth: 10,
      },
    ],
  }
}

function getKlineChartData(): {
  dates: string[]
  candlesticks: number[][]
  volumes: number[]
  validItems: StockHistoryItem[]
  mainAverageSeries: Array<{ name: string; color: string; values: Array<number | null> }>
  noticePoints: any[]
} | null {
  const validItems = filteredHistoryByRange.value
  if (!validItems.length) return null
  const dates = validItems.map((d) => normalizeDateKey(d.date))
  const candlesticks = validItems.map((d) => [d.open!, d.close!, d.low!, d.high!])
  const volumes = validItems.map((d) => (isFiniteNumber(d.volume) ? d.volume : 0))
  const mainAverageSeries = rangeMainAverage.value
  const noticePoints: any[] = []
  for (const item of validItems) {
    const dateKey = normalizeDateKey(item.date)
    const list = noticesByDate.value.get(dateKey)
    if (!list || !list.length) continue
    const high = isFiniteNumber(item.high) ? item.high : item.close
    const markerY = high != null ? high * 1.02 : item.close
    const isHovered = hoveredNoticeDate.value === dateKey
    const isSelected = selectedNoticeDate.value === dateKey || list.some((notice) => selectedNoticeId.value != null && notice.id === selectedNoticeId.value)
    const isEmphasized = isHovered || isSelected
    noticePoints.push({
      value: [dateKey, markerY],
      isHovered,
      isSelected,
      symbolSize: isEmphasized ? 12 : 10,
      itemStyle: {
        color: isEmphasized ? '#3b82f6' : '#f97316',
        borderColor: isEmphasized ? '#1d4ed8' : '#c2410c',
        borderWidth: 2,
      },
      notices: list.map((n) => ({
        id: n.id,
        title: n.noticeTitle,
        publishTime: n.publishTime,
        tDate: getNoticeTradeDate(n) ?? undefined,
      })),
    })
  }
  return { dates, candlesticks, volumes, validItems, mainAverageSeries, noticePoints }
}

function buildKlineOptionOnly(): EChartsOption | null {
  const data = getKlineChartData()
  if (!data) {
    return {
      title: {
        text: history.value.length ? '暂无有效行情数据' : '暂无行情数据',
        left: 'center',
        top: 'middle',
        textStyle: { color: 'var(--text-muted)', fontSize: 14 },
      },
    }
  }
  const { dates, candlesticks, validItems, mainAverageSeries, noticePoints } = data
  const { start, end } = klineDataZoomRange.value
  return {
    animation: true,
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross', lineStyle: { color: 'var(--accent)', width: 1, type: 'dashed' } },
      backgroundColor: 'rgba(13, 19, 33, 0.95)',
      borderColor: 'var(--border)',
      borderWidth: 1,
      padding: [12, 16],
      textStyle: { fontSize: 12, color: '#f1f5f9', fontFamily: 'IBM Plex Sans, sans-serif' },
      extraCssText: 'backdrop-filter: blur(8px); border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);',
      formatter: (params: any) => {
        if (!Array.isArray(params) || !params.length) return ''
        const idx = params[0]?.dataIndex
        if (idx == null || idx < 0 || idx >= validItems.length) return ''
        const row = validItems[idx]
        const dateStr = dates[idx] ?? ''
        let prevClose: number | null = null
        let openChgPct: number | null = null
        if (idx > 0) {
          const prev = validItems[idx - 1]
          if (isFiniteNumber(prev.close) && isFiniteNumber(row.open)) {
            prevClose = prev.close as number
            if (prevClose !== 0) openChgPct = ((row.open - prevClose) / prevClose) * 100
          }
        }
        const upColor = priceUpColor.value
        const downColor = priceDownColor.value
        const rowColor = row.close >= row.open ? upColor : downColor
        const parts: string[] = [
          '<div style="font-weight:600;margin-bottom:10px;color:#f1f5f9;font-size:13px;padding-bottom:8px;border-bottom:1px solid var(--border)">' + dateStr + '</div>',
          '<table style="border-collapse:collapse;font-size:12px;width:100%">',
          '<tr><td style="padding:4px 12px 4px 0;color:#94a3b8">开盘</td><td style="text-align:right;font-weight:600;color:#f1f5f9">' + (row.open != null ? (row.open as number).toFixed(2) : '—') + '</td></tr>',
          '<tr><td style="padding:4px 12px 4px 0;color:#94a3b8">收盘</td><td style="text-align:right;font-weight:600;color:' + rowColor + '">' + (row.close != null ? (row.close as number).toFixed(2) : '—') + '</td></tr>',
          '<tr><td style="padding:4px 12px 4px 0;color:#94a3b8">最高</td><td style="text-align:right;font-weight:600;color:#f1f5f9">' + (row.high != null ? (row.high as number).toFixed(2) : '—') + '</td></tr>',
          '<tr><td style="padding:4px 12px 4px 0;color:#94a3b8">最低</td><td style="text-align:right;font-weight:600;color:#f1f5f9">' + (row.low != null ? (row.low as number).toFixed(2) : '—') + '</td></tr>',
          prevClose != null ? '<tr><td style="padding:4px 12px 4px 0;color:#94a3b8">昨收</td><td style="text-align:right;color:#f1f5f9">' + prevClose.toFixed(2) + '</td></tr>' : '',
          openChgPct != null ? '<tr><td style="padding:4px 12px 4px 0;color:#94a3b8">开盘较昨收</td><td style="text-align:right;color:' + (openChgPct >= 0 ? upColor : downColor) + '">' + formatPctChange(openChgPct) + '</td></tr>' : '',
          isFiniteNumber(row.pctChange) ? '<tr><td style="padding:4px 12px 4px 0;color:#94a3b8">涨跌幅</td><td style="text-align:right;color:' + ((row.pctChange as number) >= 0 ? upColor : downColor) + '">' + formatPctChange(row.pctChange!) + '</td></tr>' : '',
          isFiniteNumber(row.volume) ? '<tr><td style="padding:4px 12px 4px 0;color:#94a3b8">成交量</td><td style="text-align:right;color:#f1f5f9">' + formatVolume(row.volume!) + '</td></tr>' : '',
          '</table>',
        ]
        const noticeList = noticesByDate.value.get(dateStr)
        if (noticeList?.length) parts.push('<div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--border);font-size:11px;color:#fbbf24">公告 ' + noticeList.length + ' 条</div>')
        return parts.join('')
      },
    },
    axisPointer: {
      link: [{ xAxisIndex: 'all' }],
      label: { backgroundColor: 'var(--accent)', color: '#070b14' },
    },
    grid: [{ left: 56, right: 16, top: 12, bottom: 12 }],
    dataZoom: [
      {
        type: 'inside',
        xAxisIndex: 0,
        start,
        end,
        minValueSpan: KLINE_MIN_VALUE_SPAN,
        maxValueSpan: KLINE_MAX_VALUE_SPAN,
      },
    ],
    xAxis: [{
      type: 'category',
      data: dates,
      boundaryGap: true,
      axisLine: { lineStyle: { color: 'var(--border)' } },
      axisLabel: { color: 'var(--text-muted)', fontSize: 11 },
      axisTick: { show: false },
      min: 'dataMin',
      max: 'dataMax',
    }],
    yAxis: [{
      scale: true,
      axisLine: { show: false },
      axisLabel: { color: 'var(--text-muted)', fontSize: 11 },
      splitLine: { lineStyle: { color: 'var(--border)', opacity: 0.3 } },
    }],
    series: [
      { name: 'K线', type: 'candlestick', data: candlesticks, itemStyle: { color: priceUpColor.value, color0: priceDownColor.value, borderColor: priceUpColor.value, borderColor0: priceDownColor.value } },
      ...mainAverageSeries.map((series) => ({
        name: series.name,
        type: 'line' as const,
        data: series.values,
        showSymbol: false,
        smooth: false,
        lineStyle: { width: 1.5, color: series.color },
      })),
      {
        name: '公告标记',
        type: 'scatter',
        data: noticePoints,
        symbol: 'circle',
        symbolSize: 10,
        itemStyle: { color: '#f97316', borderColor: '#c2410c', borderWidth: 2 },
        tooltip: {
          trigger: 'item',
          formatter: (params: any) => {
            const d = params.data
            const list = (d?.notices as Array<{ title: string; publishTime: string }>) || []
            if (!list.length) return '有公告'
            return list.slice(0, 5).map((n) => `${n.publishTime ?? ''} ${n.title}`).join('<br/>') + (list.length > 5 ? `<br/>… 等 ${list.length} 条` : '')
          },
        },
        zlevel: 3,
      },
    ],
  }
}

function buildIndicatorSeries(): SeriesOption[] {
  const indData = indicatorData.value
  if (!indData?.length) return []

  return currentSubIndicatorOption.value.series.map((series) => {
    const values = indData.map((row) => {
      const value = row?.[series.field]
      return typeof value === 'number' && Number.isFinite(value) ? value : null
    })
    return {
      name: series.name,
      type: series.type ?? 'line',
      data: values,
      showSymbol: false,
      smooth: false,
      lineStyle: series.type === 'bar' ? undefined : { width: 1.5, color: series.color },
      itemStyle: series.type === 'bar' ? { color: series.color } : undefined,
      emphasis: { focus: 'series' },
    }
  })
}

function buildIndicatorOptionOnly(): EChartsOption | null {
  const data = getKlineChartData()
  if (!data) return null
  const { dates } = data
  const { start, end } = klineDataZoomRange.value
  const series = buildIndicatorSeries()
  if (!series.length) return null

  return {
    animation: true,
    backgroundColor: 'transparent',
    grid: [{ left: 56, right: 16, top: 14, bottom: 12 }],
    dataZoom: [{
      type: 'inside',
      xAxisIndex: 0,
      start,
      end,
      minValueSpan: KLINE_MIN_VALUE_SPAN,
      maxValueSpan: KLINE_MAX_VALUE_SPAN,
    }],
    xAxis: [{
      type: 'category',
      data: dates,
      boundaryGap: true,
      axisLine: { lineStyle: { color: 'var(--border)' } },
      axisLabel: { show: false },
      axisTick: { show: false },
      min: 'dataMin',
      max: 'dataMax',
    }],
    yAxis: [{
      scale: true,
      axisLine: { show: false },
      axisLabel: {
        color: 'var(--text-muted)',
        fontSize: 10,
        formatter: (v: number) => {
          if (!Number.isFinite(v)) return '-'
          return Number(v.toFixed(3)).toFixed(3).replace(/\.?0+$/, '')
        },
      },
      splitLine: { lineStyle: { color: 'var(--border)', opacity: 0.3 } },
    }],
    series,
  }
}

function buildVolumeOptionOnly(): EChartsOption | null {
  const data = getKlineChartData()
  if (!data) return null
  const { dates, volumes, validItems } = data
  const { start, end } = klineDataZoomRange.value
  return {
    animation: true,
    backgroundColor: 'transparent',
    grid: [{ left: 56, right: 16, top: 6, bottom: 12 }],
    dataZoom: [{
      type: 'inside',
      xAxisIndex: 0,
      start,
      end,
      minValueSpan: KLINE_MIN_VALUE_SPAN,
      maxValueSpan: KLINE_MAX_VALUE_SPAN,
    }],
    xAxis: [{
      type: 'category',
      data: dates,
      boundaryGap: true,
      axisLine: { lineStyle: { color: 'var(--border)' } },
      axisLabel: { color: 'var(--text-muted)', fontSize: 10 },
      axisTick: { show: false },
      min: 'dataMin',
      max: 'dataMax',
    }],
    yAxis: [{
      scale: true,
      axisLine: { show: false },
      axisLabel: { 
        color: 'var(--text-muted)', 
        fontSize: 10,
        formatter: (v: number) => formatVolume(v),
      },
      splitLine: { lineStyle: { color: 'var(--border)', opacity: 0.3 } },
    }],
    series: [{
      name: '成交量',
      type: 'bar',
      data: volumes,
      itemStyle: {
        color: (params: any) => {
          const row = validItems[params.dataIndex]
          if (!row) return '#94a3b8'
          return row.close >= row.open ? priceDownColor.value : priceUpColor.value
        },
      },
      barMaxWidth: 10,
    }],
  }
}

function buildTimelineOptionOnly(): EChartsOption | null {
  const data = getKlineChartData()
  if (!data) return null
  const { dates } = data
  const { start, end } = klineDataZoomRange.value
  
  return {
    animation: true,
    backgroundColor: 'transparent',
    grid: [{ left: 56, right: 16, top: 0, bottom: 0, height: 0 }],
    dataZoom: [
      {
        type: 'inside',
        xAxisIndex: 0,
        start,
        end,
        minValueSpan: KLINE_MIN_VALUE_SPAN,
        maxValueSpan: KLINE_MAX_VALUE_SPAN,
      },
      { 
        show: true, 
        xAxisIndex: 0, 
        type: 'slider', 
        bottom: 6, 
        start, 
        end, 
        minValueSpan: KLINE_MIN_VALUE_SPAN,
        maxValueSpan: KLINE_MAX_VALUE_SPAN,
        height: 18,
        borderColor: 'transparent',
        backgroundColor: 'var(--bg-elevated)',
        fillerColor: 'rgba(99, 102, 241, 0.25)',
        borderRadius: 9,
        dataBackground: {
          lineStyle: { 
            color: 'var(--border)',
            width: 1,
            opacity: 0.3,
          },
          areaStyle: { 
            color: 'var(--border)',
            opacity: 0.1,
          },
        },
        selectedDataBackground: {
          lineStyle: { 
            color: 'rgba(99, 102, 241, 0.5)',
            width: 1,
            opacity: 0.8,
          },
          areaStyle: { 
            color: 'rgba(99, 102, 241, 0.15)',
            opacity: 1,
          },
        },
        handleStyle: {
          color: '#6366f1',
          borderColor: 'var(--bg-card)',
          borderWidth: 2,
          shadowBlur: 6,
          shadowColor: 'rgba(99, 102, 241, 0.4)',
        },
        moveHandleStyle: {
          color: '#6366f1',
          opacity: 0.9,
        },
        emphasis: {
          handleLabel: {
            show: false,
          },
          handleStyle: {
            color: '#6366f1',
            shadowBlur: 10,
            shadowColor: 'rgba(99, 102, 241, 0.5)',
          },
          moveHandleStyle: {
            color: '#6366f1',
            opacity: 1,
          },
        },
        textStyle: {
          color: 'var(--text-muted)',
          fontSize: 10,
        },
        showDetail: false,
      },
    ],
    xAxis: [{
      type: 'category',
      data: dates,
      boundaryGap: true,
      show: false,
    }],
    yAxis: [{ show: false }],
    series: [],
  }
}

function updateChart() {
  if (chartType.value === 'kline') {
    if (!chartKlineRef.value || !chartVolumeRef.value || !chartIndicatorRef.value || !chartTimelineRef.value) return
    initKlineCharts()
    const optKline = buildKlineOptionOnly()
    const optVol = buildVolumeOptionOnly()
    const optIndicator = buildIndicatorOptionOnly()
    const optTimeline = buildTimelineOptionOnly()
    if (optKline && chartKline) chartKline.setOption(optKline, true)
    if (optVol && chartVolume) chartVolume.setOption(optVol, true)
    if (optIndicator && chartIndicator) chartIndicator.setOption(optIndicator, true)
    if (optTimeline && chartTimeline) chartTimeline.setOption(optTimeline, true)
    scheduleChartResize('kline')
    return
  }
  if (!chartRef.value) return
  if (chartKline || chartVolume || chartIndicator || chartTimeline) {
    if (chartKline) { chartKline.off('click', handleChartClick as (event: any) => void); chartKline.off('dataZoom', klineDataZoomHandlerKline); chartKline.dispose(); chartKline = null }
    if (chartVolume) { chartVolume.off('dataZoom', klineDataZoomHandlerVolume); chartVolume.dispose(); chartVolume = null }
    if (chartIndicator) { chartIndicator.off('dataZoom', klineDataZoomHandlerIndicator); chartIndicator.dispose(); chartIndicator = null }
    if (chartTimeline) { chartTimeline.off('dataZoom', klineDataZoomHandlerTimeline); chartTimeline.dispose(); chartTimeline = null }
  }
  if (!chart) initChart()
  if (!chart) return
  const option = buildIntradayOption()
  chart.setOption(option, true)
  scheduleChartResize('intraday')
}

function handleResize() {
  scheduleChartResize()
}

function scheduleChartResize(mode: 'auto' | 'kline' | 'intraday' = 'auto') {
  if (chartResizeRafId != null) {
    cancelAnimationFrame(chartResizeRafId)
  }
  chartResizeRafId = requestAnimationFrame(() => {
    chartResizeRafId = null
    const currentMode = mode === 'auto' ? chartType.value : mode
    if (currentMode === 'kline') {
      chartKline?.resize()
      chartVolume?.resize()
      chartIndicator?.resize()
      chartTimeline?.resize()
      return
    }
    chart?.resize()
  })
}

onMounted(() => {
  debouncedUpdateChart = debounce(() => {
    nextTick(() => updateChart())
  }, 150)
  loadHistoryAndNotices()
  window.addEventListener('resize', handleResize)
})

watch(stockCode, () => {
  history.value = []
  notices.value = []
  hoveredNoticeDate.value = null
  selectedNoticeDate.value = null
  selectedNoticeId.value = null
  loadHistoryAndNotices()
})

watch(currentMarket, () => {
  history.value = []
  notices.value = []
  hoveredNoticeDate.value = null
  selectedNoticeDate.value = null
  selectedNoticeId.value = null
  intraday.value = []
  intradayDate.value = null
  historyError.value = null
  intradayError.value = null
  indicatorCache.clear()
  loadHistoryAndNotices()
})

watch(chartType, () => {
  debouncedUpdateChart()
})

watch(selectedIndicator, () => {
  debouncedUpdateChart()
})

watch(selectedMainAverage, () => {
  debouncedUpdateChart()
})

watch([selectedMainLayout, selectedSubLayout], () => {
  if (chartType.value !== 'kline') return
  debouncedUpdateChart()
})

watch(() => priceColorStore.mode, () => {
  debouncedUpdateChart()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  disposeChart()
})
</script>

<template>
  <div class="stock-quote-page terminal-page web-page">
    <Breadcrumb :items="breadcrumbItems" />
    
    <!-- 股票信息卡片 - 紧凑设计 -->
    <div class="stock-header">
      <div class="stock-header-main">
        <div class="stock-info">
          <template v-if="historyLoading">
            <div class="skeleton skeleton-title"></div>
            <div class="skeleton skeleton-price"></div>
          </template>
          <template v-else>
            <div class="stock-name-row">
              <span v-if="stockName" class="stock-name">{{ stockName }}</span>
              <span v-else class="stock-name">{{ stockCode }}</span>
              <span class="stock-code-badge">{{ stockCode }}</span>
            </div>
            
            <div v-if="latestSnapshot" class="price-row">
              <span class="price" :class="latestSnapshot.change != null && latestSnapshot.change >= 0 ? 'is-up' : 'is-down'">
                {{ latestSnapshot.close != null ? latestSnapshot.close.toFixed(2) : '—' }}
              </span>
              <span
                class="price-change"
                :class="{
                  'is-up': latestSnapshot.change != null && latestSnapshot.change >= 0,
                  'is-down': latestSnapshot.change != null && latestSnapshot.change < 0,
                }"
              >
                {{ latestSnapshot.change != null ? (latestSnapshot.change >= 0 ? '+' : '') + latestSnapshot.change.toFixed(2) : '—' }}
                <span class="change-pct">{{ latestSnapshot.pctChange != null ? ' (' + (latestSnapshot.pctChange >= 0 ? '+' : '') + latestSnapshot.pctChange.toFixed(2) + '%)' : '' }}</span>
              </span>
            </div>
          </template>
        </div>
        
        <div v-if="latestSnapshot" class="stock-stats">
          <div class="stat-item">
            <span class="stat-label">今开</span>
            <span class="stat-value">{{ latestSnapshot.open != null ? latestSnapshot.open.toFixed(2) : '—' }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">昨收</span>
            <span class="stat-value">{{ latestSnapshot.prevClose != null ? latestSnapshot.prevClose.toFixed(2) : '—' }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">最高</span>
            <span class="stat-value is-up">{{ latestSnapshot.high != null ? latestSnapshot.high.toFixed(2) : '—' }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">最低</span>
            <span class="stat-value is-down">{{ latestSnapshot.low != null ? latestSnapshot.low.toFixed(2) : '—' }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">成交量</span>
            <span class="stat-value">{{ latestSnapshot.volume != null ? formatVolume(latestSnapshot.volume) : '—' }}</span>
          </div>
          <div v-if="stockBasicInfo?.marketCap" class="stat-item">
            <span class="stat-label">市值</span>
            <span class="stat-value">{{ stockBasicInfo.marketCap }}亿</span>
          </div>
          <div v-if="stockBasicInfo?.pe" class="stat-item">
            <span class="stat-label">PE</span>
            <span class="stat-value">{{ stockBasicInfo.pe }}</span>
          </div>
          <div v-if="stockBasicInfo?.pb" class="stat-item">
            <span class="stat-label">PB</span>
            <span class="stat-value">{{ stockBasicInfo.pb }}</span>
          </div>
          <div v-if="stockBasicInfo?.industry" class="stat-item">
            <span class="stat-label">行业</span>
            <span class="stat-value">{{ stockBasicInfo.industry }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 主内容区域 - 左右布局 -->
    <div class="main-layout">
      <!-- 左侧：图表区域 -->
      <div class="chart-section">
        <div class="chart-header">
          <div class="chart-controls">
            <div class="control-field">
              <label class="control-label" for="chart-type-select">图表视图</label>
              <div class="control-select-wrap">
                <select id="chart-type-select" v-model="chartTypeSelectValue" class="control-select">
                  <option value="kline">K线</option>
                  <option value="intraday">分时</option>
                </select>
              </div>
            </div>
          </div>
        </div>
        
        <!-- OHLC 数据条 -->
        <div class="ohlc-bar">
          <template v-if="chartType === 'intraday'">
            <span v-if="intradayDate" class="ohlc-date">{{ intradayDate }}</span>
            <span class="ohlc-item">开 {{ intradayOhlc.open != null ? intradayOhlc.open.toFixed(2) : '—' }}</span>
            <span class="ohlc-item">收 {{ intradayOhlc.close != null ? intradayOhlc.close.toFixed(2) : '—' }}</span>
            <span class="ohlc-item is-up">高 {{ intradayOhlc.high != null ? intradayOhlc.high.toFixed(2) : '—' }}</span>
            <span class="ohlc-item is-down">低 {{ intradayOhlc.low != null ? intradayOhlc.low.toFixed(2) : '—' }}</span>
          </template>
          <template v-else-if="filteredHistoryByRange.length">
            <span class="ohlc-item">开 {{ rangeOhlc.open != null ? rangeOhlc.open.toFixed(2) : '—' }}</span>
            <span class="ohlc-item">收 {{ rangeOhlc.close != null ? rangeOhlc.close.toFixed(2) : '—' }}</span>
            <span class="ohlc-item is-up">高 {{ rangeOhlc.high != null ? rangeOhlc.high.toFixed(2) : '—' }}</span>
            <span class="ohlc-item is-down">低 {{ rangeOhlc.low != null ? rangeOhlc.low.toFixed(2) : '—' }}</span>
          </template>
        </div>
        
        <!-- 图表容器 -->
        <div class="chart-wrapper" :style="chartLayoutStyle">
          <template v-if="chartType === 'kline'">
            <section class="kline-main-module">
              <div class="module-toolbar module-toolbar-main">
                <div class="module-controls">
                  <div class="control-field control-field-module">
                    <label class="control-label" for="main-average-select">主图均线</label>
                    <div class="control-select-wrap control-select-wrap-module">
                      <select id="main-average-select" v-model="selectedMainAverage" class="control-select">
                        <option v-for="item in MAIN_AVERAGE_OPTIONS" :key="item.key" :value="item.key">
                          {{ item.label }}
                        </option>
                      </select>
                    </div>
                  </div>
                  <div class="control-field control-field-layout">
                    <label class="control-label" for="main-layout-select">主图布局</label>
                    <div class="control-select-wrap control-select-wrap-module">
                      <select id="main-layout-select" v-model="selectedMainLayout" class="control-select">
                        <option v-for="item in MAIN_LAYOUT_OPTIONS" :key="item.key" :value="item.key">
                          {{ item.label }}
                        </option>
                      </select>
                    </div>
                  </div>
                </div>
                <div v-if="filteredHistoryByRange.length" class="module-metrics">
                  <span class="metric-label">{{ currentMainAverageOption.label }}</span>
                  <span
                    v-for="item in rangeMainAverageLast"
                    :key="item.name"
                    class="metric-item"
                    :style="{ '--metric-color': item.color }"
                  >
                    <span class="metric-name">{{ item.name }}</span>
                    <span class="metric-value">{{ item.value != null ? item.value.toFixed(2) : '—' }}</span>
                  </span>
                </div>
              </div>
              <div class="chart-row kline-row">
                <div ref="chartKlineRef" class="chart-inner"></div>
              </div>
              <div class="chart-row volume-row">
                <div ref="chartVolumeRef" class="chart-inner"></div>
              </div>
            </section>

            <section class="kline-sub-module">
              <div class="module-toolbar module-toolbar-sub">
                <div class="module-controls">
                  <div class="control-field control-field-module">
                    <label class="control-label" for="sub-indicator-select">下方指标</label>
                    <div class="control-select-wrap control-select-wrap-module">
                      <select id="sub-indicator-select" v-model="selectedIndicator" class="control-select">
                        <option v-for="item in SUB_INDICATORS" :key="item.key" :value="item.key">
                          {{ item.label }}
                        </option>
                      </select>
                    </div>
                  </div>
                  <div class="control-field control-field-layout">
                    <label class="control-label" for="sub-layout-select">副图布局</label>
                    <div class="control-select-wrap control-select-wrap-module">
                      <select id="sub-layout-select" v-model="selectedSubLayout" class="control-select">
                        <option v-for="item in SUB_LAYOUT_OPTIONS" :key="item.key" :value="item.key">
                          {{ item.label }}
                        </option>
                      </select>
                    </div>
                  </div>
                </div>
                <div v-if="subIndicatorSummary.length" class="module-metrics">
                  <span class="metric-label">{{ currentSubIndicatorOption.label }}</span>
                  <span
                    v-for="item in subIndicatorSummary"
                    :key="item.name"
                    class="metric-item"
                    :style="{ '--metric-color': item.color }"
                  >
                    <span class="metric-name">{{ item.name }}</span>
                    <span class="metric-value">{{ item.value != null ? item.value.toFixed(3) : '—' }}</span>
                  </span>
                </div>
              </div>
              <div class="chart-row indicator-row">
                <div ref="chartIndicatorRef" class="chart-inner"></div>
              </div>
            </section>

            <div class="chart-row timeline-row">
              <div ref="chartTimelineRef" class="chart-inner"></div>
            </div>
          </template>
          <div v-else ref="chartRef" class="chart-inner single-chart"></div>
          
          <div v-if="(historyLoading && chartType === 'kline') || (intradayLoading && chartType === 'intraday')" class="chart-overlay">
            <div class="chart-loading">
              <span class="loading-spinner"></span>
              <span class="loading-text">加载行情数据中...</span>
            </div>
          </div>
          <div v-else-if="historyError && chartType === 'kline'" class="chart-overlay is-error">
            <span class="chart-state">{{ historyError }}</span>
          </div>
          <div v-else-if="intradayError && chartType === 'intraday'" class="chart-overlay is-error">
            <span class="chart-state">{{ intradayError }}</span>
          </div>
        </div>
      </div>

      <!-- 右侧：公告列表 -->
      <div class="sidebar-section">
        <div class="sidebar-header">
          <h3 class="sidebar-title">相关公告</h3>
          <span v-if="notices.length" class="notice-count">{{ notices.length }}</span>
        </div>
        
        <div v-if="noticesLoading" class="sidebar-state">
          <span class="loading-spinner"></span>
        </div>
        <div v-else-if="noticesError" class="sidebar-state is-error">{{ noticesError }}</div>
        
        <div v-else-if="notices.length" class="notice-list">
          <div
            v-for="(item, index) in notices"
            :key="item.id ?? item.uniqueKey ?? item.noticeTitle"
            class="notice-item"
            :class="[
              `timeline-${getNoticeTimelineStatus(item)}`,
              { 'is-selected': isNoticeLocked(item) },
              { 'is-first': index === 0, 'is-last': index === notices.length - 1 },
            ]"
            @mouseenter="handleNoticeHover(item)"
            @mouseleave="handleNoticeHover(null)"
            @click="handleNoticeSelect(item)"
          >
            <div class="notice-timeline" :class="`timeline-${getNoticeTimelineStatus(item)}`">
              <span class="timeline-dot"></span>
            </div>
            <div class="notice-main">
              <p class="notice-title">{{ item.noticeTitle }}</p>
              <div class="notice-meta">
                <span class="notice-time">{{ item.publishTime }}</span>
                <span
                  v-if="getNoticeTradeDate(item)"
                  class="notice-tdate-badge"
                  :class="`is-${getNoticeTimelineStatus(item)}`"
                >
                  <span class="tdate-label">T日</span>
                  <span class="tdate-value">{{ getNoticeTradeDate(item) }}</span>
                  <span v-if="getNoticeTimelineStatus(item) === 'future'" class="tdate-state">未来行情</span>
                </span>
                <span
                  v-if="getNoticePctT(item) != null"
                  class="notice-pct"
                  :class="(getNoticePctT(item) ?? 0) >= 0 ? 'is-up' : 'is-down'"
                >
                  T日涨幅 {{ (getNoticePctT(item) ?? 0) >= 0 ? '+' : '' }}{{ (getNoticePctT(item) ?? 0).toFixed(2) }}%
                </span>
              </div>
            </div>
            <button
              type="button"
              class="notice-detail-btn floating-detail-btn"
              @click.stop="goToAnalysisDetail(item)"
            >
              查看详细
            </button>
          </div>
        </div>
        
        <p v-else class="sidebar-empty">暂无相关公告</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stock-quote-page {
  max-width: var(--layout-content-max);
  margin: 0 auto;
  padding: var(--space-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.stock-header {
  background:
    linear-gradient(120deg, color-mix(in srgb, var(--accent-subtle) 52%, transparent) 0%, transparent 44%),
    linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 96%, transparent), var(--bg-card));
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-md);
  box-shadow: var(--shadow-sm);
}

.stock-header-main {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-md);
  flex-wrap: wrap;
}

.stock-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  min-width: 0;
}

.stock-name-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-sm);
  min-width: 0;
}

.stock-name {
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}

.stock-code-badge {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text-muted);
  background: color-mix(in srgb, var(--bg-elevated) 90%, transparent);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-full);
  padding: 0.16rem 0.52rem;
  white-space: nowrap;
}

.price-row {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: var(--space-sm);
}

.price {
  font-size: var(--text-2xl);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}

.price.is-up {
  color: var(--gain);
}

.price.is-down {
  color: var(--loss);
}

.price-change {
  font-size: var(--text-sm);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.price-change.is-up {
  color: var(--gain);
}

.price-change.is-down {
  color: var(--loss);
}

.change-pct {
  opacity: 0.8;
}

/* 统计数据 - 紧凑网格 */
.stock-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(84px, max-content));
  justify-content: flex-end;
  gap: var(--space-sm);
  min-width: min(660px, 100%);
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
  padding: 0 var(--space-sm);
  border-left: 1px solid var(--border-subtle);
}

.stat-label {
  font-size: var(--text-2xs);
  color: var(--text-muted);
  letter-spacing: 0.02em;
}

.stat-value {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.stat-value.is-up {
  color: var(--gain);
}

.stat-value.is-down {
  color: var(--loss);
}

/* 主布局 - 左右分栏 */
.main-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(330px, 360px);
  gap: var(--space-sm);
}

.chart-section {
  background:
    linear-gradient(115deg, color-mix(in srgb, var(--accent-subtle) 42%, transparent) 0%, transparent 40%),
    linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 96%, transparent) 0%, var(--bg-card) 100%);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-md);
  display: flex;
  flex-direction: column;
  min-height: 600px;
  box-shadow: var(--shadow-sm);
}

.chart-header {
  display: grid;
  grid-template-columns: 1fr;
  margin-bottom: var(--space-xs);
  padding-bottom: var(--space-xs);
  border-bottom: 1px solid color-mix(in srgb, var(--border) 90%, transparent);
}

.chart-controls {
  width: min(280px, 100%);
}

.control-field {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  min-width: 0;
}

.module-controls {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-wrap: wrap;
}

.control-label {
  flex-shrink: 0;
  font-size: var(--text-xs);
  color: var(--text-muted);
  font-weight: 600;
  letter-spacing: 0.01em;
}

.control-select-wrap {
  position: relative;
  flex: 1;
}

.control-field-module {
  width: min(220px, 100%);
}

.control-field-layout {
  width: min(190px, 100%);
}

.control-select-wrap-module {
  min-width: 120px;
}

.control-select {
  width: 100%;
  height: var(--control-h-sm);
  padding: 0 var(--space-lg) 0 var(--space-sm);
  font-size: var(--text-xs);
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--accent-subtle) 38%, transparent), transparent 52%),
    color-mix(in srgb, var(--bg-elevated) 92%, transparent);
  cursor: pointer;
  transition: border-color var(--transition-fast) ease, box-shadow var(--transition-fast) ease;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
}

.control-select:hover {
  border-color: color-mix(in srgb, var(--accent) 42%, var(--border));
}

.control-select:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 25%, transparent);
}

.module-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-sm);
  padding: var(--space-xs) 0 var(--space-2xs);
}

.module-toolbar-main {
  border-bottom: 1px solid color-mix(in srgb, var(--border) 88%, transparent);
}

.module-toolbar-sub {
  margin-bottom: var(--space-2xs);
}

.module-metrics {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: var(--space-xs);
  min-width: 0;
}

.metric-label {
  color: var(--text-muted);
  letter-spacing: 0.04em;
  font-size: var(--text-xs);
}

.metric-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--metric-color, var(--text-secondary));
  font-variant-numeric: tabular-nums;
  font-weight: 500;
  font-size: var(--text-xs);
}

.metric-name {
  color: var(--metric-color, var(--text-secondary));
  font-weight: 600;
}

.metric-value {
  color: var(--text-secondary);
}

.kline-main-module {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.kline-sub-module {
  display: flex;
  flex-direction: column;
  gap: var(--space-2xs);
  padding-top: var(--space-xs);
  border-top: 1px solid var(--border-subtle);
}

/* OHLC 数据条 */
.ohlc-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-xs);
  padding: var(--space-xs) 0;
  margin-bottom: var(--space-xs);
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.ohlc-date {
  font-weight: 600;
  color: var(--text-primary);
  padding-right: var(--space-sm);
  border-right: 1px solid var(--border);
}

.ohlc-item {
  display: inline-flex;
  align-items: center;
  min-height: 1.28rem;
  padding: 0 0.42rem;
  border-radius: var(--radius-xs);
  border: 1px solid var(--border-subtle);
  background: color-mix(in srgb, var(--bg-elevated) 78%, transparent);
  font-variant-numeric: tabular-nums;
}

.ohlc-item.is-up {
  color: var(--gain);
}

.ohlc-item.is-down {
  color: var(--loss);
}

/* 图表容器 */
.chart-wrapper {
  --quote-kline-main-min-height: 280px;
  --quote-kline-main-min-height-mobile: 220px;
  --quote-kline-volume-height: 80px;
  --quote-kline-volume-height-mobile: 66px;
  --quote-kline-indicator-height: 102px;
  --quote-kline-indicator-height-mobile: 90px;
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  min-height: 0;
}

.chart-row {
  width: 100%;
  flex-shrink: 0;
  border: 1px solid color-mix(in srgb, var(--border) 85%, transparent);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--bg-surface) 92%, transparent);
  overflow: hidden;
}

.kline-row {
  flex: 1;
  min-height: var(--quote-kline-main-min-height);
}

.volume-row {
  height: var(--quote-kline-volume-height);
}

.indicator-row {
  height: var(--quote-kline-indicator-height);
  position: relative;
}

.timeline-row {
  height: 36px;
}

.chart-inner {
  width: 100%;
  height: 100%;
}

.single-chart {
  flex: 1;
  min-height: 400px;
}

.chart-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--bg-card) 92%, transparent);
  z-index: 2;
}

.chart-overlay.is-error {
  background: color-mix(in srgb, var(--error-subtle) 28%, var(--bg-card));
}

.chart-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
}

.loading-text {
  font-size: var(--text-sm);
  color: var(--text-muted);
}

.chart-state {
  font-size: var(--text-sm);
  color: var(--text-muted);
}

/* 侧边栏 - 公告列表 */
.sidebar-section {
  background: linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 96%, transparent) 0%, var(--bg-card) 100%);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 200px);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-md);
  border-bottom: 1px solid var(--border);
  background:
    linear-gradient(112deg, color-mix(in srgb, var(--accent-subtle) 46%, transparent) 0%, transparent 42%),
    color-mix(in srgb, var(--bg-elevated) 95%, transparent);
}

.sidebar-title {
  margin: 0;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-primary);
}

.notice-count {
  min-height: 1.4rem;
  padding: 0 var(--space-sm);
  border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, var(--accent) 24%, transparent);
  background: color-mix(in srgb, var(--accent-subtle) 56%, transparent);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.sidebar-state {
  padding: var(--space-xl);
  text-align: center;
  font-size: var(--text-sm);
  color: var(--text-muted);
}

.sidebar-state.is-error {
  color: var(--error);
}

.sidebar-empty {
  margin: 0;
  padding: var(--space-xl);
  text-align: center;
  font-size: var(--text-sm);
  color: var(--text-muted);
}

.notice-list {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-xs);
}

.notice-item {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm);
  padding: var(--space-sm);
  border: 1px solid color-mix(in srgb, var(--border) 85%, transparent);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast) ease;
  margin-bottom: 0.24rem;
  background: color-mix(in srgb, var(--bg-card) 72%, transparent);
}

.notice-item:hover {
  background: color-mix(in srgb, var(--bg-hover) 72%, transparent);
  border-color: color-mix(in srgb, var(--accent) 28%, var(--border));
}

.notice-item.is-selected {
  background: color-mix(in srgb, var(--accent-subtle) 66%, transparent);
  border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 20%, transparent);
}

.notice-timeline {
  position: relative;
  flex: 0 0 16px;
  align-self: stretch;
  display: flex;
  justify-content: center;
}

.notice-timeline::before {
  content: '';
  position: absolute;
  left: 50%;
  top: -10px;
  bottom: -10px;
  width: 2px;
  transform: translateX(-50%);
  background: var(--timeline-line, var(--border));
  opacity: 0.8;
}

.notice-item.is-first .notice-timeline::before {
  top: 10px;
}

.notice-item.is-last .notice-timeline::before {
  bottom: 10px;
}

.timeline-dot {
  width: 10px;
  height: 10px;
  margin-top: 8px;
  border-radius: 50%;
  background: var(--timeline-dot, var(--text-muted));
  border: 2px solid var(--bg-card);
  box-shadow: 0 0 0 2px var(--bg-card);
}

.notice-item.timeline-future {
  --timeline-line: rgba(59, 130, 246, 0.55);
  --timeline-dot: #3b82f6;
}

.notice-item.timeline-today {
  --timeline-line: rgba(34, 197, 94, 0.5);
  --timeline-dot: #22c55e;
}

.notice-item.timeline-past {
  --timeline-line: color-mix(in srgb, var(--accent) 45%, var(--border));
  --timeline-dot: var(--accent);
}

.notice-item.timeline-unknown {
  --timeline-line: var(--border-subtle);
  --timeline-dot: var(--text-muted);
}

.notice-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.notice-title {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--text-primary);
  line-height: 1.5;
  padding-right: 84px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.notice-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-sm);
  font-size: var(--text-2xs);
  color: var(--text-muted);
}

.notice-tdate-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0.12rem 0.46rem;
  border-radius: 999px;
  border: 1px solid var(--border-subtle);
  background: color-mix(in srgb, var(--bg-elevated) 88%, transparent);
  font-size: 11px;
  line-height: 1.3;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.tdate-label {
  color: var(--text-muted);
  letter-spacing: 0.02em;
}

.tdate-value {
  font-weight: 700;
}

.tdate-state {
  padding: 1px 6px;
  border-radius: 999px;
  font-size: 10px;
  line-height: 1.2;
  background: rgba(59, 130, 246, 0.2);
  color: #bfdbfe;
}

.notice-tdate-badge.is-future {
  border-color: rgba(59, 130, 246, 0.35);
  background: rgba(59, 130, 246, 0.14);
  color: #93c5fd;
}

.notice-tdate-badge.is-today {
  border-color: rgba(34, 197, 94, 0.38);
  background: rgba(34, 197, 94, 0.14);
  color: #86efac;
}

.notice-tdate-badge.is-past {
  border-color: color-mix(in srgb, var(--accent) 35%, var(--border));
  background: color-mix(in srgb, var(--accent) 18%, transparent);
  color: var(--accent);
}

.notice-tdate-badge.is-unknown {
  border-color: var(--border-subtle);
  background: var(--bg-elevated);
  color: var(--text-muted);
}

.notice-pct {
  font-size: var(--text-xs);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.notice-pct.is-up {
  color: var(--gain);
}

.notice-pct.is-down {
  color: var(--loss);
}

.notice-detail-btn {
  position: absolute;
  top: var(--space-sm);
  right: var(--space-sm);
  min-height: 1.34rem;
  padding: 0 0.52rem;
  border: 1px solid color-mix(in srgb, var(--accent) 24%, transparent);
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--accent-subtle) 58%, transparent);
  color: var(--text-secondary);
  font-size: var(--text-2xs);
  font-weight: 600;
  z-index: 2;
  cursor: pointer;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transform: translateY(-2px);
  transition:
    opacity var(--transition-fast) ease,
    transform var(--transition-fast) ease,
    visibility 0s linear var(--transition-fast);
}

.notice-item:hover .notice-detail-btn,
.notice-item:focus-within .notice-detail-btn {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
  transform: translateY(0);
  transition-delay: 0s;
}

.loading-spinner {
  display: inline-block;
  width: 1rem;
  height: 1rem;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 骨架屏 */
.skeleton {
  background: linear-gradient(90deg, var(--bg-elevated) 25%, var(--bg-hover) 50%, var(--bg-elevated) 75%);
  background-size: 200% 100%;
  animation: skeleton-pulse 1.5s ease-in-out infinite;
  border-radius: var(--radius-xs);
}

@keyframes skeleton-pulse {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.skeleton-title {
  width: 120px;
  height: 20px;
  margin-bottom: var(--space-xs);
}

.skeleton-price {
  width: 180px;
  height: 32px;
}

/* 响应式 */
@media (max-width: 1200px) {
  .main-layout {
    grid-template-columns: 1fr;
  }
  
  .sidebar-section {
    max-height: 400px;
  }
}

@media (max-width: 768px) {
  .stock-quote-page {
    padding: var(--space-sm);
  }
  
  .stock-header-main {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .stock-stats {
    width: 100%;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-xs);
    min-width: 0;
  }
  
  .chart-controls {
    width: 100%;
  }

  .control-field {
    flex-wrap: wrap;
  }

  .control-select-wrap {
    width: 100%;
  }

  .module-toolbar {
    align-items: flex-start;
  }

  .module-controls {
    width: 100%;
  }

  .control-field-module,
  .control-field-layout {
    width: 100%;
  }

  .module-metrics {
    width: 100%;
    justify-content: flex-start;
  }
  
  .kline-row {
    min-height: var(--quote-kline-main-min-height-mobile);
  }

  .volume-row {
    height: var(--quote-kline-volume-height-mobile);
  }

  .indicator-row {
    height: var(--quote-kline-indicator-height-mobile);
  }
  
  .single-chart {
    min-height: 320px;
  }

  .notice-title {
    padding-right: 72px;
  }

}

@media (hover: none) {
  .notice-item.is-selected .notice-detail-btn {
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
    transform: none;
    transition-delay: 0s;
  }
}
</style>
