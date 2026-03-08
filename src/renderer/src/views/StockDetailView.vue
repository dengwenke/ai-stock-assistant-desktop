<script setup lang="ts">
/**
 * 股票详情页面 - 统一入口
 * 支持两种模式：行情模式(quote) 和 公告解析模式(analysis)
 * 通过 URL 参数 ?mode=quote|analysis 控制
 */
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePriceColorStore } from '@/stores/priceColor'
import { storeToRefs } from 'pinia'
import Breadcrumb from '@/components/Breadcrumb.vue'
import StockInfoCard from '@/components/stock/StockInfoCard.vue'
import KLineChart from '@/components/stock/KLineChart.vue'
import NoticeList from '@/components/stock/NoticeList.vue'
import NoticeAnalysis from '@/components/stock/NoticeAnalysis.vue'
import { useStockData } from '@/composables/useStockData'
import type { NoticeRecord } from '@/api/types'
import { useWorkspaceStore } from '@/stores/workspace'

// 模式类型
type ViewMode = 'quote' | 'analysis'

// 技术指标类型
type IndicatorKey = 'MACD' | 'KDJ' | 'BOLL' | 'RSI' | 'WR' | 'DMI' | 'CCI' | 'BIAS'

const route = useRoute()
const router = useRouter()
const priceColorStore = usePriceColorStore()
storeToRefs(priceColorStore)
const workspaceStore = useWorkspaceStore()
const { currentMarket } = storeToRefs(workspaceStore)

// K线图组件引用
const klineChartRef = ref<InstanceType<typeof KLineChart> | null>(null)

// 从 URL 获取参数
const stockCode = computed(() => {
  const code = route.params.stockCode
  return typeof code === 'string' ? code : ''
})

const mode = computed<ViewMode>({
  get: () => {
    const m = route.query.mode
    return m === 'analysis' ? 'analysis' : 'quote'
  },
  set: (val) => {
    router.replace({
      query: { ...route.query, mode: val },
    })
  },
})

// 技术指标
const fixedTimeRange = ref('1y')
const selectedIndicator = ref<IndicatorKey>('MACD')

// 公告相关
const selectedNoticeId = ref<number | null>(null)
const hoveredNoticeId = ref<number | null>(null)
const noticeKeyword = ref('')
const noticePage = ref(1)
const NOTICE_PAGE_SIZE = 10

// 使用 composable 获取数据
const {
  loading,
  error,
  stockInfo,
  history,
  indicators,
  notices,
  noticesTotal,
  refreshAll,
  fetchNotices,
} = useStockData({
  stockCode,
  timeRange: fixedTimeRange,
  market: currentMarket,
})

// 面包屑
const breadcrumbItems = computed(() => [
  { text: '首页', to: '/' },
  { text: '公告分析', to: '/announcements' },
  { text: `${effectiveStockName.value || stockCode.value} ${mode.value === 'quote' ? '行情' : '公告'}` },
])

// 股票名称（优先 stockInfo，备选 notices 中的首条记录）
const effectiveStockName = computed(() => {
  if (stockInfo.value?.stockName) return stockInfo.value.stockName
  if (notices.value.length > 0 && notices.value[0].stockName) return notices.value[0].stockName
  return ''
})

// 当前选中的公告
const selectedNotice = computed(() => {
  if (!selectedNoticeId.value) return null
  return notices.value.find((n) => n.id === selectedNoticeId.value) || null
})

// 当前页的公告列表（后端分页，直接使用）
const paginatedNotices = computed(() => {
  return notices.value
})

const totalNoticePages = computed(() => {
  return Math.ceil(noticesTotal.value / NOTICE_PAGE_SIZE)
})

function getNoticeTradeDate(notice: NoticeRecord): string | null {
  const anyNotice = notice as NoticeRecord & { t_date?: string; tdate?: string }
  const tDate = notice.tDate ?? anyNotice.t_date ?? anyNotice.tdate ?? null
  if (tDate && String(tDate).trim() !== '') return String(tDate).trim()
  return null
}

function parseNoticeId(rawValue: unknown): number | null {
  const raw = Array.isArray(rawValue) ? rawValue[0] : rawValue
  if (typeof raw !== 'string') return null
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) ? parsed : null
}

function syncNoticeIdQuery(noticeId: number | null) {
  const currentNoticeId = parseNoticeId(route.query.noticeId)
  if (currentNoticeId === noticeId) return
  const nextQuery = { ...route.query }
  if (noticeId) {
    nextQuery.noticeId = String(noticeId)
  } else {
    delete nextQuery.noticeId
  }
  router.replace({ query: nextQuery })
}

// 切换模式
function switchMode(newMode: ViewMode) {
  mode.value = newMode
}

// 选择公告
function selectNotice(notice: NoticeRecord) {
  const nextNoticeId = notice.id || null
  selectedNoticeId.value = nextNoticeId
  syncNoticeIdQuery(nextNoticeId)
}

// 查看公告详情（切换到解析模式）
function viewNoticeDetail(notice: NoticeRecord) {
  selectNotice(notice)
  if (mode.value !== 'analysis') {
    switchMode('analysis')
  }
}

// 从K线图选择日期
function onDateSelect(date: string) {
  // 筛选该日期附近的公告
  const targetNotices = notices.value.filter((n) => {
    const noticeDate = getNoticeTradeDate(n)
    return noticeDate === date
  })

  if (targetNotices.length > 0) {
    selectNotice(targetNotices[0])
  }
}

// 处理公告悬停
function onNoticeHover(notice: NoticeRecord | null) {
  // 更新悬停的公告ID
  hoveredNoticeId.value = notice?.id || null
  
  // 聚焦到对应日期
  if (!notice || !klineChartRef.value) return
  const dateStr = getNoticeTradeDate(notice)
  if (!dateStr) return
  klineChartRef.value.focusOnDate(dateStr)
}

// 初始化
onMounted(() => {
  refreshAll()
})

watch(
  () => route.query.noticeId,
  (newNoticeId) => {
    selectedNoticeId.value = parseNoticeId(newNoticeId)
  },
  { immediate: true },
)

// 监听股票代码变化
watch(stockCode, () => {
  refreshAll()
  selectedNoticeId.value = parseNoticeId(route.query.noticeId)
  noticePage.value = 1
})

watch(currentMarket, () => {
  refreshAll()
  selectedNoticeId.value = null
  syncNoticeIdQuery(null)
  noticePage.value = 1
})

// 监听分页变化，重新获取公告
watch(noticePage, (newPage) => {
  fetchNotices(newPage, NOTICE_PAGE_SIZE)
})
</script>

<template>
  <div class="stock-detail-page terminal-page web-page">
    <Breadcrumb :items="breadcrumbItems" />

    <!-- 股票信息卡片 -->
    <StockInfoCard
      :stock-code="stockCode"
      :stock-name="effectiveStockName"
      :current-price="history[history.length - 1]?.close"
      :prev-close="history[history.length - 2]?.close"
      :volume="history[history.length - 1]?.volume"
      :market-cap="stockInfo?.marketCap"
      :pe="stockInfo?.pe"
      :pb="stockInfo?.pb"
      :industry="stockInfo?.industry"
      :mode="mode"
      @update:mode="switchMode"
    />

    <!-- 模式容器 -->
    <div class="mode-container" :class="mode">
      <!-- 行情模式 -->
      <template v-if="mode === 'quote'">
        <div class="quote-layout">
          <!-- K线图区域 (70%) -->
          <div class="chart-section">
            <KLineChart
              ref="klineChartRef"
              :stock-code="stockCode"
              :history="history"
              :indicators="indicators"
              :indicator="selectedIndicator"
              :notices="notices"
              :selected-notice-id="selectedNoticeId"
              :hovered-notice-id="hoveredNoticeId"
              :loading="loading.history || loading.indicator"
              @date-select="onDateSelect"
              @notice-select="selectNotice"
              @update:indicator="selectedIndicator = $event"
            />
          </div>

          <!-- 公告侧边栏 (30%) -->
          <div class="notice-sidebar">
            <NoticeList
              :stock-code="stockCode"
              :notices="paginatedNotices"
              :total="noticesTotal"
              :page="noticePage"
              :page-size="NOTICE_PAGE_SIZE"
              :keyword="noticeKeyword"
              :selected-id="selectedNoticeId"
              :loading="loading.notices"
              @select="selectNotice"
              @detail="viewNoticeDetail"
              @hover="onNoticeHover"
              @page-change="noticePage = $event"
              @update:keyword="noticeKeyword = $event"
            />
          </div>
        </div>
      </template>

      <!-- 公告模式 -->
      <template v-else>
        <div class="analysis-layout">
          <!-- 公告列表 (30%) -->
          <div class="notice-list-section">
            <NoticeList
              :stock-code="stockCode"
              :notices="paginatedNotices"
              :total="noticesTotal"
              :page="noticePage"
              :page-size="NOTICE_PAGE_SIZE"
              :keyword="noticeKeyword"
              :selected-id="selectedNoticeId"
              :loading="loading.notices"
              @select="selectNotice"
              @detail="viewNoticeDetail"
              @page-change="noticePage = $event"
              @update:keyword="noticeKeyword = $event"
            />
          </div>

          <!-- 解析详情 (70%) -->
          <div class="analysis-section">
            <NoticeAnalysis
              :notice="selectedNotice"
              :loading="loading.notices"
            />
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.stock-detail-page {
  --detail-notice-panel-h: min(72vh, 720px);

  max-width: var(--layout-content-max);
  margin: 0 auto;
  padding: var(--space-md);
  min-height: calc(100vh - 120px);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.mode-container {
  margin-top: 0;
}

.quote-layout {
  display: grid;
  grid-template-columns: minmax(0, 2.1fr) minmax(320px, 1fr);
  gap: var(--space-sm);
  align-items: flex-start;
}

.chart-section {
  min-width: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background:
    linear-gradient(120deg, color-mix(in srgb, var(--accent-subtle) 42%, transparent) 0%, transparent 40%),
    linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 96%, transparent) 0%, var(--bg-card) 100%);
  padding: var(--space-sm);
  box-shadow: var(--shadow-sm);
}

.notice-sidebar {
  min-width: 0;
  height: var(--detail-notice-panel-h);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 95%, transparent) 0%, var(--bg-card) 100%);
  padding: var(--space-sm);
  box-shadow: var(--shadow-sm);
}

.analysis-layout {
  display: grid;
  grid-template-columns: minmax(320px, 1fr) minmax(0, 2.1fr);
  gap: var(--space-sm);
  min-height: min(76vh, 900px);
  align-items: stretch;
}

.notice-list-section {
  min-width: 0;
  height: var(--detail-notice-panel-h);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 95%, transparent) 0%, var(--bg-card) 100%);
  padding: var(--space-sm);
  box-shadow: var(--shadow-sm);
}

.analysis-section {
  min-width: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background:
    linear-gradient(115deg, color-mix(in srgb, var(--accent-subtle) 38%, transparent) 0%, transparent 42%),
    linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 95%, transparent) 0%, var(--bg-card) 100%);
  padding: var(--space-sm);
  box-shadow: var(--shadow-sm);
}

@media (max-width: 1200px) {
  .stock-detail-page {
    --detail-notice-panel-h: min(56vh, 520px);
  }

  .quote-layout,
  .analysis-layout {
    grid-template-columns: 1fr;
  }

  .chart-section,
  .notice-sidebar,
  .notice-list-section,
  .analysis-section {
    width: 100%;
  }
}

@media (max-width: 768px) {
  .stock-detail-page {
    padding: var(--space-sm);
  }

  .quote-layout,
  .analysis-layout {
    gap: var(--space-sm);
  }

  .notice-sidebar,
  .notice-list-section,
  .analysis-section,
  .chart-section {
    padding: var(--space-xs);
  }
}
</style>
