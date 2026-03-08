<script setup lang="ts">
/**
 * K线图组件
 * 支持K线、成交量、技术指标、时间轴联动
 */
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { echarts } from '@/utils/echarts'
import type { EChartsOption, SeriesOption } from 'echarts'
import type { StockHistoryItem, StockTechIndicator, NoticeRecord } from '@/api/types'
import { usePriceColorStore } from '@/stores/priceColor'
import { storeToRefs } from 'pinia'

type MovingAverageKey = 'EMA' | 'MA'
type IndicatorKey = 'MACD' | 'KDJ' | 'BOLL' | 'RSI' | 'WR' | 'DMI' | 'CCI' | 'BIAS'
type MainLayoutMode = 'focus' | 'balanced' | 'compact'
type SubLayoutMode = 'compact' | 'balanced' | 'expanded'

interface IndicatorSeriesConfig {
  name: string
  field: keyof StockTechIndicator
  color: string
  type?: 'line' | 'bar'
}

interface MovingAverageOption {
  key: MovingAverageKey
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

const MOVING_AVERAGE_OPTIONS: MovingAverageOption[] = [
  {
    key: 'EMA',
    label: 'EMA',
    series: [
      { name: 'EMA13', field: 'ema13', color: '#6366f1' },
      { name: 'EMA34', field: 'ema34', color: '#eab308' },
      { name: 'EMA120', field: 'ema120', color: '#22c55e' },
    ],
  },
  {
    key: 'MA',
    label: 'MA',
    series: [
      { name: 'MA5', field: 'ma5', color: '#6366f1' },
      { name: 'MA10', field: 'ma10', color: '#f59e0b' },
      { name: 'MA20', field: 'ma20', color: '#22c55e' },
      { name: 'MA60', field: 'ma60', color: '#06b6d4' },
    ],
  },
]

const SUB_INDICATOR_OPTIONS: SubIndicatorOption[] = [
  {
    key: 'MACD',
    label: 'MACD',
    series: [
      { name: 'DIF', field: 'dif', color: '#6366f1' },
      { name: 'DEA', field: 'dea', color: '#eab308' },
      { name: 'MACD', field: 'macd', color: '#22c55e', type: 'bar' },
    ],
  },
  {
    key: 'KDJ',
    label: 'KDJ',
    series: [
      { name: 'K', field: 'kdjK', color: '#6366f1' },
      { name: 'D', field: 'kdjD', color: '#eab308' },
      { name: 'J', field: 'kdjJ', color: '#22c55e' },
    ],
  },
  {
    key: 'BOLL',
    label: '布林带',
    series: [
      { name: '上轨', field: 'bollUpper', color: '#6366f1' },
      { name: '中轨', field: 'bollMiddle', color: '#eab308' },
      { name: '下轨', field: 'bollLower', color: '#22c55e' },
    ],
  },
  {
    key: 'RSI',
    label: 'RSI',
    series: [
      { name: 'RSI6', field: 'rsi6', color: '#6366f1' },
      { name: 'RSI12', field: 'rsi12', color: '#eab308' },
      { name: 'RSI24', field: 'rsi24', color: '#22c55e' },
    ],
  },
  {
    key: 'WR',
    label: 'WR',
    series: [
      { name: 'WR6', field: 'wr6', color: '#6366f1' },
      { name: 'WR10', field: 'wr10', color: '#eab308' },
    ],
  },
  {
    key: 'DMI',
    label: 'DMI',
    series: [
      { name: 'PDI', field: 'dmiPdi', color: '#6366f1' },
      { name: 'MDI', field: 'dmiMdi', color: '#eab308' },
      { name: 'ADX', field: 'dmiAdx', color: '#22c55e' },
    ],
  },
  {
    key: 'CCI',
    label: 'CCI',
    series: [{ name: 'CCI', field: 'cci', color: '#6366f1' }],
  },
  {
    key: 'BIAS',
    label: 'BIAS',
    series: [
      { name: 'BIAS6', field: 'bias6', color: '#6366f1' },
      { name: 'BIAS12', field: 'bias12', color: '#eab308' },
      { name: 'BIAS24', field: 'bias24', color: '#22c55e' },
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
  mainHeight: number
  mainHeightMobile: number
  volumeHeight: number
  volumeHeightMobile: number
}> = {
  focus: {
    mainHeight: 410,
    mainHeightMobile: 276,
    volumeHeight: 88,
    volumeHeightMobile: 68,
  },
  balanced: {
    mainHeight: 360,
    mainHeightMobile: 244,
    volumeHeight: 80,
    volumeHeightMobile: 64,
  },
  compact: {
    mainHeight: 320,
    mainHeightMobile: 224,
    volumeHeight: 72,
    volumeHeightMobile: 60,
  },
}

const SUB_LAYOUT_STYLE_MAP: Record<SubLayoutMode, {
  indicatorHeight: number
  indicatorHeightMobile: number
}> = {
  compact: {
    indicatorHeight: 88,
    indicatorHeightMobile: 84,
  },
  balanced: {
    indicatorHeight: 108,
    indicatorHeightMobile: 96,
  },
  expanded: {
    indicatorHeight: 132,
    indicatorHeightMobile: 108,
  },
}

interface Props {
  stockCode: string
  history: StockHistoryItem[]
  indicators: StockTechIndicator[]
  indicator: IndicatorKey
  notices: NoticeRecord[]
  loading?: boolean
  selectedNoticeId?: number | null
  hoveredNoticeId?: number | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'dateSelect': [date: string]
  'noticeSelect': [notice: NoticeRecord]
  'update:indicator': [indicator: IndicatorKey]
}>()

// 暴露方法给父组件
defineExpose({
  focusOnDate
})

const priceColorStore = usePriceColorStore()
const { upColor, downColor } = storeToRefs(priceColorStore)

// 图表引用
const chartKlineRef = ref<HTMLElement | null>(null)
const chartVolumeRef = ref<HTMLElement | null>(null)
const chartIndicatorRef = ref<HTMLElement | null>(null)
const chartTimelineRef = ref<HTMLElement | null>(null)

let chartKline: echarts.ECharts | null = null
let chartVolume: echarts.ECharts | null = null
let chartIndicator: echarts.ECharts | null = null
let chartTimeline: echarts.ECharts | null = null
let isApplyingZoomConstraint = false

// 数据缩放范围
const klineDataZoomRange = ref({ start: 0, end: 100 })
const KLINE_MIN_VALUE_SPAN = 1
const KLINE_MAX_VALUE_SPAN = 365
const KLINE_DEFAULT_CALENDAR_DAYS = 30
const KLINE_DEFAULT_TRADING_DAYS = 21
const NOTICE_MARKER_BAND_Y = 0.88
const hasUserAdjustedZoom = ref(false)
const selectedMovingAverage = ref<MovingAverageKey>('EMA')
const selectedMainLayout = ref<MainLayoutMode>('balanced')
const selectedSubLayout = ref<SubLayoutMode>('balanced')

const chartLayoutStyle = computed<Record<string, string>>(() => {
  const mainLayout = MAIN_LAYOUT_STYLE_MAP[selectedMainLayout.value]
  const subLayout = SUB_LAYOUT_STYLE_MAP[selectedSubLayout.value]
  return {
    '--kline-main-height': `${mainLayout.mainHeight}px`,
    '--kline-main-height-mobile': `${mainLayout.mainHeightMobile}px`,
    '--kline-volume-height': `${mainLayout.volumeHeight}px`,
    '--kline-volume-height-mobile': `${mainLayout.volumeHeightMobile}px`,
    '--kline-indicator-height': `${subLayout.indicatorHeight}px`,
    '--kline-indicator-height-mobile': `${subLayout.indicatorHeightMobile}px`,
  }
})

const activeMovingAverageOption = computed(() => {
  return (
    MOVING_AVERAGE_OPTIONS.find((option) => option.key === selectedMovingAverage.value) ??
    MOVING_AVERAGE_OPTIONS[0]
  )
})

const activeSubIndicatorOption = computed(() => {
  return (
    SUB_INDICATOR_OPTIONS.find((option) => option.key === props.indicator) ??
    SUB_INDICATOR_OPTIONS[0]
  )
})

const selectedSubIndicator = computed<IndicatorKey>({
  get: () => props.indicator,
  set: (next) => emit('update:indicator', next),
})

function getNoticeTradeDate(notice: NoticeRecord): string | null {
  const anyNotice = notice as NoticeRecord & { t_date?: string; tdate?: string }
  const tDate = notice.tDate ?? anyNotice.t_date ?? anyNotice.tdate ?? null
  if (tDate && String(tDate).trim() !== '') return String(tDate).trim()
  return null
}

function isSameNoticeId(a: unknown, b: unknown): boolean {
  if (a == null || b == null) return false
  const aNum = Number(a)
  const bNum = Number(b)
  if (Number.isFinite(aNum) && Number.isFinite(bNum)) return aNum === bNum
  return String(a) === String(b)
}

function getLockedNoticeDateForZoom(): string | null {
  if (props.selectedNoticeId == null) return null
  const targetNotice = props.notices.find((notice) => isSameNoticeId(notice.id, props.selectedNoticeId))
  return targetNotice ? getNoticeTradeDate(targetNotice) : null
}

function constrainZoomRangeToLockedNotice(
  range: { start: number; end: number },
  dates: string[],
): { start: number; end: number } {
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
  if (!processedData.value?.dates?.length) return
  klineDataZoomRange.value = getDefaultMonthZoomRange(processedData.value.dates)
}

// 聚焦到指定日期（前后3天，共7天）
function focusOnDate(dateStr: string) {
  if (!chartKline || !processedData.value) return

  const dateIndex = processedData.value.dates.indexOf(dateStr)
  if (dateIndex === -1) return

  const total = processedData.value.dates.length

  // 计算聚焦范围：前后7天，共15天
  const focusDays = 7
  let startIndex = Math.max(0, dateIndex - focusDays)
  let endIndex = Math.min(total - 1, dateIndex + focusDays)

  // 确保至少有7天的数据
  const minVisibleDays = 15
  if (endIndex - startIndex + 1 < minVisibleDays) {
    if (startIndex === 0) {
      endIndex = Math.min(total - 1, startIndex + minVisibleDays - 1)
    } else if (endIndex === total - 1) {
      startIndex = Math.max(0, endIndex - minVisibleDays + 1)
    }
  }

  const startPercent = (startIndex / total) * 100
  const endPercent = ((endIndex + 1) / total) * 100

  // 更新数据缩放范围
  klineDataZoomRange.value = { start: startPercent, end: endPercent }

  // 触发图表更新
  chartKline.dispatchAction({
    type: 'dataZoom',
    start: startPercent,
    end: endPercent,
  })
}

// 监听选中公告变化，自动滚动到对应时间点
watch(() => props.selectedNoticeId, (noticeId) => {
  if (noticeId && chartKline && processedData.value) {
    // 查找公告对应的日期
    const targetNotice = props.notices.find(n => isSameNoticeId(n.id, noticeId))
    const targetDate = targetNotice ? getNoticeTradeDate(targetNotice) : null
    if (targetDate) {
      focusOnDate(targetDate)
    }
  }
  updateCharts()
})

watch(() => props.hoveredNoticeId, () => {
  updateCharts()
})

// 处理后的数据
const processedData = computed(() => {
  if (!props.history?.length) return null

  const items = props.history
  const dates = items.map((i) => i.date || '')
  const candlesticks = items.map((i) => [i.open, i.close, i.low, i.high])
  const volumes = items.map((i) => ({
    value: i.volume || 0,
    itemStyle: {
      color: (i.close || 0) >= (i.open || 0) ? upColor.value : downColor.value,
    },
  }))

  // 创建日期到索引的映射
  const dateToIndex = new Map<string, number>()
  items.forEach((item, index) => {
    if (item.date) {
      dateToIndex.set(item.date, index)
    }
  })

  // 按日期分组公告
  const noticesByDate = new Map<string, NoticeRecord[]>()
  props.notices.forEach((notice) => {
    const dateStr = getNoticeTradeDate(notice)
    if (!dateStr) return
    if (!noticesByDate.has(dateStr)) {
      noticesByDate.set(dateStr, [])
    }
    noticesByDate.get(dateStr)!.push(notice)
  })

  // 生成公告标记数据：放在顶部标记带，避免缩放时被价格轴裁剪
  const noticeMarkLineData: Array<{
    xAxis: number
    yAxis: number
    notices: NoticeRecord[]
    isHovered: boolean
    isSelected: boolean
    dateStr: string
  }> = []

  noticesByDate.forEach((noticesForDate, dateStr) => {
    const index = dateToIndex.get(dateStr)
    if (index === undefined) return

    // 检查是否有公告被悬停或选中
    const isHovered = noticesForDate.some(n => isSameNoticeId(n.id, props.hoveredNoticeId))
    const isSelected = noticesForDate.some(n => isSameNoticeId(n.id, props.selectedNoticeId))

    noticeMarkLineData.push({
      xAxis: index,
      yAxis: NOTICE_MARKER_BAND_Y,
      notices: noticesForDate,
      isHovered,
      isSelected,
      dateStr,
    })
  })

  return {
    dates,
    candlesticks,
    volumes,
    noticeMarkLineData,
    items,
  }
})

const indicatorByDate = computed(() => {
  const map = new Map<string, StockTechIndicator>()
  props.indicators.forEach((indicator) => {
    if (indicator.tradeDate) {
      map.set(indicator.tradeDate, indicator)
    }
  })
  return map
})

// 技术指标数据
const indicatorData = computed(() => {
  const data = processedData.value
  if (!data) return null

  const option = activeSubIndicatorOption.value
  const dates = data.dates
  const series = option.series.map((item) => ({
    ...item,
    data: dates.map((date) => {
      const row = indicatorByDate.value.get(date)
      return row?.[item.field] ?? null
    }),
  }))

  return { dates, series }
})

const movingAverageSummary = computed(() => {
  const data = processedData.value
  if (!data?.dates?.length) return []

  const latestDate = data.dates[data.dates.length - 1]
  const latestIndicator = indicatorByDate.value.get(latestDate)
  if (!latestIndicator) return []

  return activeMovingAverageOption.value.series.map((series) => ({
    name: series.name,
    color: series.color,
    value: getIndicatorNumberValue(latestIndicator, series.field),
  }))
})

const lowerIndicatorSummary = computed(() => {
  const data = processedData.value
  if (!data?.dates?.length) return []

  const latestDate = data.dates[data.dates.length - 1]
  const latestIndicator = indicatorByDate.value.get(latestDate)
  if (!latestIndicator) return []

  return activeSubIndicatorOption.value.series.map((series) => ({
    name: series.name,
    color: series.color,
    value: getIndicatorNumberValue(latestIndicator, series.field),
  }))
})

// 格式化函数
function formatVolume(v: number): string {
  if (!isFinite(v)) return '-'
  if (v >= 1e8) return (v / 1e8).toFixed(2) + '亿'
  if (v >= 1e4) return (v / 1e4).toFixed(2) + '万'
  return v.toString()
}

function formatIndicatorValue(v: number | null | undefined, digits = 3): string {
  if (v == null || !isFinite(v)) return '-'
  return Number(v.toFixed(digits)).toFixed(digits)
}

function formatAxisValue(v: number, digits = 2): string {
  if (!Number.isFinite(v)) return '-'
  const normalized = Number(v.toFixed(digits))
  return normalized.toFixed(digits).replace(/\.?0+$/, '')
}

function getIndicatorNumberValue(
  row: StockTechIndicator | undefined,
  field: keyof StockTechIndicator,
): number | null {
  if (!row) return null
  const raw = row[field]
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null
}

function getSeriesDataForDates(dates: string[], series: IndicatorSeriesConfig[]) {
  return series.map((item) => ({
    ...item,
    data: dates.map((date) => getIndicatorNumberValue(indicatorByDate.value.get(date), item.field)),
  }))
}

function computeAxisDigits(minValue: number, maxValue: number): number {
  const absMax = Math.max(Math.abs(minValue), Math.abs(maxValue))
  if (absMax < 1) return 4
  if (absMax < 20) return 3
  return 2
}

function roundAxisValue(value: number, digits: number, mode: 'floor' | 'ceil'): number {
  const factor = 10 ** digits
  if (!Number.isFinite(value)) return value
  return mode === 'floor'
    ? Math.floor(value * factor) / factor
    : Math.ceil(value * factor) / factor
}

function getVisibleIndexRange(total: number, startPercent: number, endPercent: number) {
  if (total <= 0) return { startIndex: 0, endIndex: -1 }

  const normalizedStart = isFinite(startPercent) ? startPercent : 0
  const normalizedEnd = isFinite(endPercent) ? endPercent : 100
  const low = Math.min(normalizedStart, normalizedEnd)
  const high = Math.max(normalizedStart, normalizedEnd)

  const startIndex = Math.max(0, Math.floor((low / 100) * total))
  const endIndex = Math.min(total - 1, Math.ceil((high / 100) * total) - 1)

  return {
    startIndex: Math.min(startIndex, total - 1),
    endIndex: Math.max(startIndex, endIndex),
  }
}

function getVisiblePriceBounds(items: StockHistoryItem[], startPercent: number, endPercent: number) {
  if (!items.length) return { min: 0, max: 1, digits: 2 }

  const { startIndex, endIndex } = getVisibleIndexRange(items.length, startPercent, endPercent)
  const visibleItems = items.slice(startIndex, endIndex + 1)

  let minLow = Number.POSITIVE_INFINITY
  let maxHigh = Number.NEGATIVE_INFINITY

  visibleItems.forEach((item) => {
    const low = item.low ?? item.close ?? item.open
    const high = item.high ?? item.close ?? item.open
    if (low != null && isFinite(low)) minLow = Math.min(minLow, low)
    if (high != null && isFinite(high)) maxHigh = Math.max(maxHigh, high)
  })

  if (!isFinite(minLow) || !isFinite(maxHigh)) {
    minLow = 0
    maxHigh = 1
  }

  const span = Math.max(maxHigh - minLow, Math.abs(maxHigh) * 0.01, 0.01)
  const bottomPadding = span * 0.08
  const topPadding = span * 0.18
  const digits = computeAxisDigits(minLow, maxHigh)

  let min = roundAxisValue(minLow - bottomPadding, digits, 'floor')
  let max = roundAxisValue(maxHigh + topPadding, digits, 'ceil')

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    min = 0
    max = 1
  }
  if (min === max) {
    max = min + 1 / 10 ** digits
  }

  return {
    min,
    max,
    digits,
  }
}

function buildIndicatorTooltipHtml(row: StockTechIndicator | undefined): string {
  if (!row) return ''

  const buildSection = (title: string, series: IndicatorSeriesConfig[]) => {
    if (!series.length) return ''
    const rows = series.map((item) => {
      const value = getIndicatorNumberValue(row, item.field)
      return `<tr><td style="padding:4px 12px 4px 0;color:${item.color}">${item.name}</td><td style="text-align:right;font-weight:600;color:#f1f5f9">${formatIndicatorValue(value)}</td></tr>`
    })
    return `
      <tr><td colspan="2" style="padding:8px 0 4px;color:#94a3b8;border-top:1px solid rgba(148,163,184,0.25)">${title}</td></tr>
      ${rows.join('')}
    `
  }

  const movingAverageRows = buildSection(activeMovingAverageOption.value.label, activeMovingAverageOption.value.series)
  const lowerIndicatorRows = buildSection(activeSubIndicatorOption.value.label, activeSubIndicatorOption.value.series)
  return `${movingAverageRows}${lowerIndicatorRows}`
}

function buildMovingAverageSeries(dates: string[]): SeriesOption[] {
  return getSeriesDataForDates(dates, activeMovingAverageOption.value.series).map((series) => ({
    name: series.name,
    type: 'line',
    data: series.data,
    showSymbol: false,
    smooth: false,
    lineStyle: { width: 1.5, color: series.color },
  }))
}

function syncVisibleYAxisRange() {
  if (!chartKline || !processedData.value) return
  const { start, end } = klineDataZoomRange.value
  const { min, max, digits } = getVisiblePriceBounds(processedData.value.items, start, end)
  chartKline.setOption({
    yAxis: [
      {
        id: 'price-axis',
        min,
        max,
        axisLabel: {
          formatter: (value: number) => formatAxisValue(value, digits),
        },
      },
      { id: 'notice-axis', min: 0, max: 1, show: false },
    ],
  })
}

// 初始化图表
function initCharts() {
  if (!chartKlineRef.value || !chartVolumeRef.value || !chartIndicatorRef.value || !chartTimelineRef.value) return

  chartKline = echarts.init(chartKlineRef.value)
  chartVolume = echarts.init(chartVolumeRef.value)
  chartIndicator = echarts.init(chartIndicatorRef.value)
  chartTimeline = echarts.init(chartTimelineRef.value)

  // 联动
  echarts.connect([chartKline, chartVolume, chartIndicator, chartTimeline])

  // 点击事件
  chartKline.on('click', (params: any) => {
    const data = processedData.value
    if (!data) return

    // 处理公告标记点击
    if (params.seriesName === '公告' && params.data?.notices?.length) {
      const notices: NoticeRecord[] = params.data.notices
      // 优先选择已选中的公告，否则选择第一个
      const targetNotice = notices.find(n => isSameNoticeId(n.id, props.selectedNoticeId)) || notices[0]
      if (targetNotice) {
        emit('noticeSelect', targetNotice)
      }
      return
    }

    // 处理K线点击（日期选择）
    if (params.dataIndex != null) {
      const date = data.dates[params.dataIndex]
      if (date) emit('dateSelect', date)
    }
  })

  // 监听数据缩放
  chartKline.on('dataZoom', (params: any) => {
    const data = processedData.value
    if (!data) return
    const opt = params.batch?.[0] || params
    const nextStart = typeof opt.start === 'number' ? opt.start : klineDataZoomRange.value.start
    const nextEnd = typeof opt.end === 'number' ? opt.end : klineDataZoomRange.value.end
    const constrained = constrainZoomRangeToLockedNotice({ start: nextStart, end: nextEnd }, data.dates)
    const adjusted =
      Math.abs(constrained.start - nextStart) > 0.001 ||
      Math.abs(constrained.end - nextEnd) > 0.001
    klineDataZoomRange.value = constrained
    hasUserAdjustedZoom.value = true
    if (adjusted && chartKline && !isApplyingZoomConstraint) {
      isApplyingZoomConstraint = true
      chartKline.dispatchAction({
        type: 'dataZoom',
        start: constrained.start,
        end: constrained.end,
      })
    } else if (!adjusted && isApplyingZoomConstraint) {
      isApplyingZoomConstraint = false
    }
    syncVisibleYAxisRange()
  })

  updateCharts()
}

// 更新图表
function updateCharts() {
  if (!chartKline || !chartVolume || !chartIndicator || !chartTimeline) return

  const klineOption = buildKlineOption()
  const volumeOption = buildVolumeOption()
  const indicatorOption = buildIndicatorOption()
  const timelineOption = buildTimelineOption()

  chartKline.setOption(klineOption, true)
  chartVolume.setOption(volumeOption, true)
  chartIndicator.setOption(indicatorOption, true)
  chartTimeline.setOption(timelineOption, true)
}

// 构建K线图配置
function buildKlineOption(): EChartsOption {
  const data = processedData.value
  if (!data) {
    return {
      title: {
        text: props.loading ? '加载中...' : '暂无数据',
        left: 'center',
        top: 'middle',
        textStyle: { color: 'var(--text-muted)', fontSize: 14 },
      },
    }
  }

  const { dates, candlesticks, noticeMarkLineData, items } = data
  const { start, end } = klineDataZoomRange.value
  const visiblePriceBounds = getVisiblePriceBounds(items, start, end)
  const movingAverageSeries = buildMovingAverageSeries(dates)

  return {
    animation: true,
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
        label: { show: false },
        lineStyle: { color: 'var(--accent)', width: 1, type: 'dashed' },
      },
      appendToBody: true,
      backgroundColor: 'rgba(13, 19, 33, 0.95)',
      borderColor: 'var(--border)',
      borderWidth: 1,
      padding: [12, 16],
      textStyle: { fontSize: 12, color: '#f1f5f9' },
      extraCssText: 'backdrop-filter: blur(8px); border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); z-index: 9999;',
      formatter: (params: any) => {
        if (!Array.isArray(params) || !params.length) return ''
        const idx = params[0]?.dataIndex
        if (idx == null || idx < 0 || idx >= data.items.length) return ''
        const row = data.items[idx]
        const dateStr = dates[idx] ?? ''
        const rowColor = (row.close || 0) >= (row.open || 0) ? upColor.value : downColor.value
        const indicatorRow = indicatorByDate.value.get(dateStr)
        const indicatorRows = buildIndicatorTooltipHtml(indicatorRow)

        return `
          <div style="font-weight:600;margin-bottom:8px;color:#f1f5f9;font-size:13px;padding-bottom:8px;border-bottom:1px solid var(--border)">${dateStr}</div>
          <table style="border-collapse:collapse;font-size:12px;width:100%">
            <tr><td style="padding:4px 12px 4px 0;color:#94a3b8">开盘</td><td style="text-align:right;font-weight:600;color:#f1f5f9">${row.open?.toFixed(2) ?? '-'}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#94a3b8">收盘</td><td style="text-align:right;font-weight:600;color:${rowColor}">${row.close?.toFixed(2) ?? '-'}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#94a3b8">最高</td><td style="text-align:right;font-weight:600;color:#f1f5f9">${row.high?.toFixed(2) ?? '-'}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#94a3b8">最低</td><td style="text-align:right;font-weight:600;color:#f1f5f9">${row.low?.toFixed(2) ?? '-'}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#94a3b8">成交量</td><td style="text-align:right;color:#f1f5f9">${formatVolume(row.volume || 0)}</td></tr>
            ${indicatorRows}
          </table>
        `
      },
    },
    axisPointer: {
      link: [{ xAxisIndex: 'all' }],
      label: { show: false },
    },
    grid: [{ left: 60, right: 20, top: 16, bottom: 16 }],
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
      axisLabel: { color: 'var(--text-muted)', fontSize: 11 },
      axisTick: { show: false },
      min: 'dataMin',
      max: 'dataMax',
    }],
    yAxis: [
      {
        id: 'price-axis',
        type: 'value',
        scale: true,
        min: visiblePriceBounds.min,
        max: visiblePriceBounds.max,
        axisLine: { show: false },
        axisLabel: {
          color: 'var(--text-muted)',
          fontSize: 11,
          formatter: (value: number) => formatAxisValue(value, visiblePriceBounds.digits),
        },
        splitLine: { lineStyle: { color: 'var(--border)', opacity: 0.3 } },
      },
      {
        id: 'notice-axis',
        type: 'value',
        min: 0,
        max: 1,
        show: false,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: 'K线',
        type: 'candlestick',
        data: candlesticks,
        itemStyle: {
          color: upColor.value,
          color0: downColor.value,
          borderColor: upColor.value,
          borderColor0: downColor.value,
        },
      },
      ...movingAverageSeries,
      // 公告标记 - 在K线上方显示公告数量和圆点
      {
        name: '公告',
        type: 'scatter',
        yAxisIndex: 1,
        data: noticeMarkLineData.map(item => ({
          value: [item.xAxis, item.yAxis],
          notices: item.notices,
          isHovered: item.isHovered,
          isSelected: item.isSelected,
          dateStr: item.dateStr,
        })),
        symbol: 'circle',
        symbolSize: (data: any) => {
          const item = data as { isHovered?: boolean; isSelected?: boolean }
          return (item?.isHovered || item?.isSelected) ? 12 : 8
        },
        label: {
          show: true,
          position: 'top',
          distance: 4,
          formatter: (params: any) => {
            const notices: NoticeRecord[] = params?.data?.notices || []
            if (notices.length <= 1) return ''
            const item = params?.data as { isHovered?: boolean; isSelected?: boolean }
            const style = (item?.isHovered || item?.isSelected) ? 'selected' : 'default'
            return `{${style}|${notices.length}}`
          },
          rich: {
            default: {
              color: '#FF8C00',
              fontSize: 10,
              fontWeight: 'bold',
            },
            selected: {
              color: '#3B82F6',
              fontSize: 10,
              fontWeight: 'bold',
            },
          },
        },
        itemStyle: {
          color: (params: any) => {
            const item = params?.data as { isHovered?: boolean; isSelected?: boolean }
            return (item?.isHovered || item?.isSelected) ? '#3B82F6' : '#FF8C00'
          },
          borderColor: '#FFFFFF',
          borderWidth: 2,
        },
        emphasis: {
          scale: 1.5,
          itemStyle: {
            color: '#3B82F6',
            shadowBlur: 8,
            shadowColor: 'rgba(59, 130, 246, 0.8)',
          },
        },
        tooltip: {
          trigger: 'item',
          formatter: (params: any) => {
            const notices: NoticeRecord[] = params?.data?.notices || []
            if (!notices.length) return ''
            const dateStr = getNoticeTradeDate(notices[0]) || ''
            let html = `<div style="font-weight:600;margin-bottom:8px;color:#f1f5f9;font-size:13px;padding-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.1);">${dateStr}</div>`
            html += `<div style="font-size:12px;color:#f1f5f9;margin-bottom:6px;">共 ${notices.length} 条公告</div>`
            notices.forEach((notice, idx) => {
              const title = notice.noticeTitle || '未命名公告'
              html += `<div style="font-size:11px;color:#94a3b8;margin-top:4px;line-height:1.5;word-break:break-all;">${idx + 1}. ${title}</div>`
            })
            return html
          },
          backgroundColor: 'rgba(13, 19, 33, 0.95)',
          borderColor: 'var(--border)',
          textStyle: { color: '#f1f5f9' },
          extraCssText: 'backdrop-filter: blur(8px); border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); z-index: 9999; max-width: 350px;',
        },
        zlevel: 11,
        animationDuration: 200,
        animationEasing: 'cubicOut',
      },
    ],
  }
}

// 构建成交量图配置
function buildVolumeOption(): EChartsOption {
  const data = processedData.value
  if (!data) return { grid: [{ left: 60, right: 20, top: 10, bottom: 20 }] }

  const { dates, volumes } = data
  const { start, end } = klineDataZoomRange.value

  return {
    animation: true,
    backgroundColor: 'transparent',
    tooltip: { show: false },
    axisPointer: {
      link: [{ xAxisIndex: 'all' }],
      label: { show: false },
    },
    grid: [{ left: 60, right: 20, top: 10, bottom: 20 }],
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
      axisLine: { show: false },
      axisLabel: { show: false },
      axisTick: { show: false },
      axisPointer: { label: { show: false } },
    }],
    yAxis: [{
      axisLine: { show: false },
      axisLabel: { color: 'var(--text-muted)', fontSize: 10 },
      splitLine: { lineStyle: { color: 'var(--border)', opacity: 0.2 } },
      axisPointer: { label: { show: false } },
    }],
    series: [{
      name: '成交量',
      type: 'bar',
      data: volumes,
      barWidth: '60%',
    }],
  }
}

// 构建技术指标图配置
function buildIndicatorOption(): EChartsOption {
  const data = indicatorData.value
  if (!data) return { grid: [{ left: 60, right: 20, top: 10, bottom: 20 }] }

  const { dates, series } = data
  const { start, end } = klineDataZoomRange.value

  return {
    animation: true,
    backgroundColor: 'transparent',
    tooltip: { show: false },
    axisPointer: {
      link: [{ xAxisIndex: 'all' }],
      label: { show: false },
    },
    grid: [{ left: 60, right: 20, top: 10, bottom: 20 }],
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
      axisLine: { show: false },
      axisLabel: { show: false },
      axisTick: { show: false },
      axisPointer: { label: { show: false } },
    }],
    yAxis: [{
      axisLine: { show: false },
      axisLabel: {
        color: 'var(--text-muted)',
        fontSize: 10,
        formatter: (value: number) => formatAxisValue(value, 3),
      },
      splitLine: { lineStyle: { color: 'var(--border)', opacity: 0.2 } },
      axisPointer: { label: { show: false } },
    }],
    series: series.map((s) => ({
      name: s.name,
      type: s.type || 'line',
      data: s.data,
      showSymbol: false,
      smooth: false,
      lineStyle: s.type === 'bar' ? undefined : { width: 1.5, color: s.color },
      itemStyle: s.type === 'bar' ? { color: s.color } : undefined,
    })),
  }
}

// 构建时间轴图配置
function buildTimelineOption(): EChartsOption {
  const data = processedData.value
  if (!data) return { grid: [{ left: 60, right: 20, top: 10, bottom: 20 }] }

  const { dates } = data
  const { start, end } = klineDataZoomRange.value

  return {
    animation: true,
    backgroundColor: 'transparent',
    tooltip: { show: false },
    axisPointer: {
      link: [{ xAxisIndex: 'all' }],
      label: { show: false },
    },
    grid: [{ left: 60, right: 20, top: 10, bottom: 20 }],
    dataZoom: [{
      type: 'slider',
      xAxisIndex: 0,
      start,
      end,
      minValueSpan: KLINE_MIN_VALUE_SPAN,
      maxValueSpan: KLINE_MAX_VALUE_SPAN,
      height: 20,
      bottom: 0,
      handleSize: '80%',
      showDetail: false,
      borderColor: 'var(--border)',
      fillerColor: 'color-mix(in srgb, var(--accent) 30%, transparent)',
      handleStyle: { color: 'var(--accent)' },
      textStyle: { color: 'var(--text-muted)' },
    }],
    xAxis: [{
      type: 'category',
      data: dates,
      axisLine: { lineStyle: { color: 'var(--border)' } },
      axisLabel: { color: 'var(--text-muted)', fontSize: 10 },
      axisTick: { show: false },
      axisPointer: { label: { show: false } },
    }],
    yAxis: [{ show: false }],
    series: [{ type: 'line', data: [], showSymbol: false }],
  }
}

// 处理窗口大小变化
function handleResize() {
  chartKline?.resize()
  chartVolume?.resize()
  chartIndicator?.resize()
  chartTimeline?.resize()
}

// 生命周期
onMounted(() => {
  initCharts()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  chartKline?.dispose()
  chartVolume?.dispose()
  chartIndicator?.dispose()
  chartTimeline?.dispose()
})

// 监听数据变化
watch(() => props.stockCode, () => {
  hasUserAdjustedZoom.value = false
})

watch(() => props.history, () => {
  if (!hasUserAdjustedZoom.value) {
    applyDefaultMonthZoom()
  }
  updateCharts()
}, { deep: true })
watch(() => props.indicators, updateCharts, { deep: true })
watch(() => props.indicator, updateCharts)
watch(() => props.notices, updateCharts, { deep: true })
watch(selectedMovingAverage, () => {
  updateCharts()
})
watch([selectedMainLayout, selectedSubLayout], () => {
  nextTick(() => {
    handleResize()
  })
})
</script>

<template>
  <div class="kline-chart-container" :style="chartLayoutStyle">
    <!-- 图表区域 -->
    <div class="charts-wrapper">
      <section class="kline-main-module">
        <div class="module-toolbar module-toolbar-main">
          <div class="module-controls">
            <div class="toolbar-field toolbar-field-module">
              <label class="toolbar-label" for="main-average-select">主图均线</label>
              <div class="toolbar-select-wrap toolbar-select-wrap-module">
                <select
                  id="main-average-select"
                  v-model="selectedMovingAverage"
                  class="toolbar-select"
                >
                  <option
                    v-for="item in MOVING_AVERAGE_OPTIONS"
                    :key="item.key"
                    :value="item.key"
                  >
                    {{ item.label }}
                  </option>
                </select>
              </div>
            </div>
            <div class="toolbar-field toolbar-field-layout">
              <label class="toolbar-label" for="main-layout-select">主图布局</label>
              <div class="toolbar-select-wrap toolbar-select-wrap-module">
                <select
                  id="main-layout-select"
                  v-model="selectedMainLayout"
                  class="toolbar-select"
                >
                  <option
                    v-for="item in MAIN_LAYOUT_OPTIONS"
                    :key="item.key"
                    :value="item.key"
                  >
                    {{ item.label }}
                  </option>
                </select>
              </div>
            </div>
          </div>
          <div v-if="movingAverageSummary.length" class="module-metrics">
            <span class="metric-label">{{ activeMovingAverageOption.label }}</span>
            <span
              v-for="item in movingAverageSummary"
              :key="item.name"
              class="metric-item"
              :style="{ '--metric-color': item.color }"
            >
              <span class="metric-name">{{ item.name }}</span>
              <span class="metric-value">{{ formatIndicatorValue(item.value, 2) }}</span>
            </span>
          </div>
        </div>

        <div class="chart-row kline-row">
          <div ref="chartKlineRef" class="chart-container"></div>
        </div>

        <div class="chart-row volume-row">
          <div ref="chartVolumeRef" class="chart-container"></div>
        </div>
      </section>

      <section class="kline-sub-module">
        <div class="module-toolbar module-toolbar-sub">
          <div class="module-controls">
            <div class="toolbar-field toolbar-field-module">
              <label class="toolbar-label" for="sub-indicator-select">下方指标</label>
              <div class="toolbar-select-wrap toolbar-select-wrap-module">
                <select
                  id="sub-indicator-select"
                  v-model="selectedSubIndicator"
                  class="toolbar-select"
                >
                  <option
                    v-for="item in SUB_INDICATOR_OPTIONS"
                    :key="item.key"
                    :value="item.key"
                  >
                    {{ item.label }}
                  </option>
                </select>
              </div>
            </div>
            <div class="toolbar-field toolbar-field-layout">
              <label class="toolbar-label" for="sub-layout-select">副图布局</label>
              <div class="toolbar-select-wrap toolbar-select-wrap-module">
                <select
                  id="sub-layout-select"
                  v-model="selectedSubLayout"
                  class="toolbar-select"
                >
                  <option
                    v-for="item in SUB_LAYOUT_OPTIONS"
                    :key="item.key"
                    :value="item.key"
                  >
                    {{ item.label }}
                  </option>
                </select>
              </div>
            </div>
          </div>
          <div v-if="lowerIndicatorSummary.length" class="module-metrics">
            <span class="metric-label">{{ activeSubIndicatorOption.label }}</span>
            <span
              v-for="item in lowerIndicatorSummary"
              :key="item.name"
              class="metric-item"
              :style="{ '--metric-color': item.color }"
            >
              <span class="metric-name">{{ item.name }}</span>
              <span class="metric-value">{{ formatIndicatorValue(item.value, 3) }}</span>
            </span>
          </div>
        </div>

        <div class="chart-row indicator-row">
          <div ref="chartIndicatorRef" class="chart-container"></div>
        </div>
      </section>

      <!-- 时间轴 -->
      <div class="chart-row timeline-row">
        <div ref="chartTimelineRef" class="chart-container"></div>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="chart-overlay">
      <span class="loading-text">加载中...</span>
    </div>
  </div>
</template>

<style scoped>
.kline-chart-container {
  --kline-main-height: 360px;
  --kline-main-height-mobile: 244px;
  --kline-volume-height: 80px;
  --kline-volume-height-mobile: 64px;
  --kline-indicator-height: 108px;
  --kline-indicator-height-mobile: 96px;
  background: linear-gradient(
    160deg,
    color-mix(in srgb, var(--bg-card) 94%, var(--accent-subtle)),
    var(--bg-card)
  );
  border: 1px solid color-mix(in srgb, var(--border) 88%, var(--accent-subtle));
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  position: relative;
  box-shadow: var(--shadow-xs);
}

.toolbar-field {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.module-controls {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-wrap: wrap;
}

.toolbar-label {
  flex-shrink: 0;
  font-size: var(--text-xs);
  color: var(--text-muted);
  letter-spacing: 0.04em;
}

.toolbar-select-wrap {
  position: relative;
  flex: 1;
}

.toolbar-field-module {
  width: min(220px, 100%);
}

.toolbar-field-layout {
  width: min(190px, 100%);
}

.toolbar-select-wrap-module {
  min-width: 120px;
}

.toolbar-select {
  width: 100%;
  height: var(--control-h-sm);
  padding: 0 var(--space-lg) 0 var(--space-sm);
  font-size: var(--text-xs);
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--bg-elevated) 88%, var(--accent-subtle)),
    var(--bg-elevated)
  );
  cursor: pointer;
  transition: border-color var(--transition-fast) ease, box-shadow var(--transition-fast) ease;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
}

.toolbar-select:hover {
  border-color: color-mix(in srgb, var(--accent) 42%, var(--border));
}

.toolbar-select:focus {
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
  padding: var(--space-xs) 0;
}

.module-toolbar-main {
  border-bottom: 1px solid var(--border-subtle);
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

.charts-wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
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

.chart-row {
  position: relative;
  border-radius: var(--radius-xs);
  overflow: hidden;
}

.kline-row {
  height: var(--kline-main-height);
}

.volume-row {
  height: var(--kline-volume-height);
}

.indicator-row {
  height: var(--kline-indicator-height);
}

.timeline-row {
  height: 48px;
}

.chart-container {
  width: 100%;
  height: 100%;
}

.chart-overlay {
  position: absolute;
  inset: 0;
  background: color-mix(in srgb, var(--bg-card) 90%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-lg);
}

.loading-text {
  color: var(--text-muted);
  font-size: var(--text-base);
}

/* 响应式 */
@media (max-width: 768px) {
  .kline-chart-container {
    padding: var(--space-md);
  }

  .toolbar-field {
    flex-wrap: wrap;
  }

  .toolbar-select-wrap {
    width: 100%;
  }

  .module-toolbar {
    align-items: flex-start;
  }

  .module-controls {
    width: 100%;
  }

  .toolbar-field-module,
  .toolbar-field-layout {
    width: 100%;
  }

  .module-metrics {
    width: 100%;
    justify-content: flex-start;
  }

  .kline-row {
    height: var(--kline-main-height-mobile);
  }

  .volume-row {
    height: var(--kline-volume-height-mobile);
  }

  .indicator-row {
    height: var(--kline-indicator-height-mobile);
  }
}
</style>
