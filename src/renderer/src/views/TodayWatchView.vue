<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getTodayWatch } from '@/api/client'
import type { NoticeWithIndicatorsVO, NoticeRecord } from '@/api/types'
import { STORAGE_KEYS } from '@/constants'
import { useGlobalCopy } from '@/composables'
import TradeDatePicker from '@/components/TradeDatePicker.vue'
import dayjs from 'dayjs'
import { useWorkspaceStore } from '@/stores/workspace'
import { storeToRefs } from 'pinia'

const router = useRouter()
const { copy, isCopied } = useGlobalCopy()
const workspaceStore = useWorkspaceStore()
const { currentMarket } = storeToRefs(workspaceStore)
const list = ref<NoticeWithIndicatorsVO[]>([])
const totalCount = ref(0)
const loading = ref(false)

/** 从缓存读取日期，默认使用当天 */
function getInitialDate(): string {
  const cached = localStorage.getItem(STORAGE_KEYS.TODAY_WATCH_DATE)
  if (cached && dayjs(cached).isValid()) {
    return cached
  }
  return dayjs().format('YYYY-MM-DD')
}

const queryDate = ref(getInitialDate())
const updateTime = ref('-')

const page = ref(1)
const pageSize = ref(50)
const totalPages = ref(0)

const autoRefresh = ref(false)
const refreshInterval = ref(60)
let refreshTimer: number | null = null
const maxNoticesPerRow = 4
const expandedNoticeRows = ref<Set<number | string>>(new Set())

const visiblePages = computed(() => {
  const pages: number[] = []
  const total = totalPages.value
  const current = page.value
  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i)
  } else {
    if (current <= 4) {
      for (let i = 1; i <= 5; i++) pages.push(i)
      pages.push(-1)
      pages.push(total)
    } else if (current >= total - 3) {
      pages.push(1)
      pages.push(-1)
      for (let i = total - 4; i <= total; i++) pages.push(i)
    } else {
      pages.push(1)
      pages.push(-1)
      for (let i = current - 1; i <= current + 1; i++) pages.push(i)
      pages.push(-1)
      pages.push(total)
    }
  }
  return pages
})

const risingCount = computed(() => list.value.filter((row) => (row.tPctChg ?? 0) > 0).length)
const fallingCount = computed(() => list.value.filter((row) => (row.tPctChg ?? 0) < 0).length)
const highSignalCount = computed(
  () => list.value.filter((row) => (row.anomalyScore ?? 0) > 0 || getYearHighAnomaly(row) > 0).length
)
const sortedList = computed(() => {
  const rows = [...list.value]
  rows.sort((a, b) => {
    const anomalyDiff = Number(b.anomalyScore ?? 0) - Number(a.anomalyScore ?? 0)
    if (anomalyDiff !== 0) return anomalyDiff
    return Number(b.tPctChg ?? 0) - Number(a.tPctChg ?? 0)
  })
  return rows
})

async function loadData() {
  loading.value = true
  try {
    const result = await getTodayWatch(queryDate.value, page.value, pageSize.value, currentMarket.value)
    const records = result.records ?? result.list ?? []
    list.value = records

    const resolvedTotal = result.total ?? result.totalCount ?? records.length
    totalCount.value = resolvedTotal

    const resolvedPageSize = result.size ?? pageSize.value
    const resolvedPages = result.pages ?? Math.ceil((resolvedTotal || 0) / (resolvedPageSize || 20))
    totalPages.value = Math.max(resolvedPages || 1, 1)

    const resolvedCurrentPage = result.current ?? result.page ?? page.value
    page.value = Math.min(Math.max(resolvedCurrentPage || 1, 1), totalPages.value)

    updateTime.value = result.updateTime || dayjs().format('YYYY-MM-DD HH:mm:ss')
  } catch (e) {
    console.error('加载当日看盘数据失败', e)
  } finally {
    loading.value = false
  }
}

function handleDateChange() {
  page.value = 1
  // 缓存用户选择的日期
  localStorage.setItem(STORAGE_KEYS.TODAY_WATCH_DATE, queryDate.value)
  loadData()
}

function goToPage(p: number) {
  if (p < 1 || p > totalPages.value || p === page.value) return
  page.value = p
  loadData()
}

function changePageSize(s: number) {
  pageSize.value = s
  page.value = 1
  loadData()
}

function handleAutoRefreshChange(enabled: boolean) {
  if (enabled) {
    startAutoRefresh()
  } else {
    stopAutoRefresh()
  }
}

function startAutoRefresh() {
  stopAutoRefresh()
  refreshTimer = window.setInterval(() => {
    loadData()
  }, refreshInterval.value * 1000)
}

function stopAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}

function openStockQuote(e: Event, row: NoticeWithIndicatorsVO) {
  e.stopPropagation()
  if (!row.stockCode) return
  router.push({
    name: 'stock-detail',
    params: { stockCode: row.stockCode },
    query: { mode: 'quote', market: currentMarket.value }
  })
}

function openNoticeDetail(row: NoticeWithIndicatorsVO, notice: NoticeRecord) {
  if (!row.stockCode || !notice.id) return
  router.push({
    name: 'stock-detail',
    params: { stockCode: row.stockCode },
    query: { mode: 'analysis', noticeId: String(notice.id), market: currentMarket.value }
  })
}

function displayPct(pct?: number | null): string {
  if (pct == null || Number.isNaN(pct)) return '—'
  const n = Number(pct)
  const sign = n >= 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}

function getPctClass(pct?: number | null): string {
  if (pct == null || Number.isNaN(pct)) return ''
  return pct >= 0 ? 'pct-up' : 'pct-down'
}

function displayMarketCap(marketCap?: number): string {
  if (marketCap == null) return '—'
  return marketCap.toFixed(1)
}

function formatShortTime(dateStr?: string): string {
  if (!dateStr) return '—'
  const parsed = dayjs(dateStr)
  if (!parsed.isValid()) return dateStr
  return parsed.format('MM-DD HH:mm')
}

function displayNumber(value?: number | null): string {
  if (value == null || Number.isNaN(value)) return '—'
  return Number(value).toFixed(2)
}

function displayVolume(value?: number | null): string {
  if (value == null || Number.isNaN(value)) return '—'
  const n = Number(value)
  if (Math.abs(n) >= 100000000) return `${(n / 100000000).toFixed(1)}亿`
  if (Math.abs(n) >= 10000) return `${(n / 10000).toFixed(1)}万`
  return n.toLocaleString('zh-CN')
}

function statusLabel(status?: string): string {
  if (status === 'PENDING') return '待执行'
  if (status === 'PROCESSING') return '处理中'
  if (status === 'DONE') return '已完成'
  return status ?? '—'
}

function getYearHighAnomaly(row: NoticeWithIndicatorsVO): number {
  return Number(row.ttYearHighAnomaly ?? row.tt_year_high_anomaly ?? 0)
}

function getAvgPriceAnomaly(row: NoticeWithIndicatorsVO): number {
  const legacy = row as NoticeWithIndicatorsVO & { avg_price_3d_anomaly?: number; isAvgPriceAnomaly?: number }
  return Number(row.avgPrice3dAnomaly ?? legacy.avg_price_3d_anomaly ?? legacy.isAvgPriceAnomaly ?? 0)
}

function getVolAnomaly100d(row: NoticeWithIndicatorsVO): number {
  const legacy = row as NoticeWithIndicatorsVO & { tt_vol_anomaly_100d?: number; isVolumeAnomaly100d?: number }
  return Number(row.ttVolAnomaly100d ?? legacy.tt_vol_anomaly_100d ?? legacy.isVolumeAnomaly100d ?? 0)
}

function getVolAnomaly240d(row: NoticeWithIndicatorsVO): number {
  const legacy = row as NoticeWithIndicatorsVO & { tt_vol_anomaly_240d?: number; isVolumeAnomaly240d?: number }
  return Number(row.ttVolAnomaly240d ?? legacy.tt_vol_anomaly_240d ?? legacy.isVolumeAnomaly240d ?? 0)
}

function activeSignalCount(row: NoticeWithIndicatorsVO): number {
  return [getAvgPriceAnomaly(row), getVolAnomaly100d(row), getVolAnomaly240d(row), getYearHighAnomaly(row)].filter(
    (v) => v > 0,
  ).length
}

function getNoticeStatusClass(status?: string): string {
  if (status === 'PROCESSING') return 'status-processing'
  if (status === 'DONE') return 'status-done'
  return 'status-pending'
}

function displayScore(score?: number | null): string {
  if (score == null || Number.isNaN(score)) return '-'
  return String(score)
}

function displayDirection(direction?: string): string {
  if (!direction) return '—'
  const normalized = direction.replace(/\s+/g, ' ').trim()
  if (!normalized) return '—'
  return normalized.length > 12 ? `${normalized.slice(0, 12)}…` : normalized
}

function rowKey(row: NoticeWithIndicatorsVO): number | string {
  return row.id ?? row.stockCode
}

function isNoticeExpanded(row: NoticeWithIndicatorsVO): boolean {
  return expandedNoticeRows.value.has(rowKey(row))
}

function toggleNoticeExpand(row: NoticeWithIndicatorsVO): void {
  const key = rowKey(row)
  if (expandedNoticeRows.value.has(key)) {
    expandedNoticeRows.value.delete(key)
  } else {
    expandedNoticeRows.value.add(key)
  }
}

function displayedNotices(row: NoticeWithIndicatorsVO): NoticeRecord[] {
  const notices = row.notices ?? []
  if (isNoticeExpanded(row)) return notices
  return notices.slice(0, maxNoticesPerRow)
}

function hiddenNoticeCount(row: NoticeWithIndicatorsVO): number {
  const total = row.notices?.length ?? 0
  if (total <= maxNoticesPerRow) return 0
  return total - maxNoticesPerRow
}

onMounted(() => {
  loadData()
})

watch(currentMarket, () => {
  page.value = 1
  loadData()
})

onUnmounted(() => {
  stopAutoRefresh()
})
</script>

<template>
  <div class="today-watch terminal-page web-page web-page--dense">
    <section class="result-section">
      <div class="result-card">
        <div class="table-panel-header watch-header">
          <div class="watch-header-main">
            <div class="table-panel-title">当日看盘</div>
            <div class="table-panel-subtitle">公告催化 + 价格异动 + 成交量信号，快速锁定高优先级标的</div>
          </div>
          <div class="table-panel-kpis">
            <span class="table-panel-kpi">上涨 {{ risingCount }}</span>
            <span class="table-panel-kpi">下跌 {{ fallingCount }}</span>
            <span class="table-panel-kpi">高信号 {{ highSignalCount }}</span>
          </div>
        </div>
        <div class="query-bar">
          <div class="query-row">
            <div class="query-field query-field--date">
              <label class="query-field-label">选择日期</label>
              <TradeDatePicker
                v-model="queryDate"
                placeholder="选择日期"
                @change="handleDateChange"
              />
            </div>
            <div class="query-field">
              <label class="query-field-label">当前页数量</label>
              <span class="stat-value">{{ sortedList.length }} 只</span>
            </div>
            <div class="query-field">
              <label class="query-field-label">更新时间</label>
              <span class="stat-value">{{ updateTime }}</span>
            </div>
            <div class="query-field auto-refresh">
              <label class="query-field-label">自动刷新</label>
              <div class="refresh-controls">
                <label class="switch">
                  <input type="checkbox" v-model="autoRefresh" @change="handleAutoRefreshChange(autoRefresh)">
                  <span class="slider"></span>
                </label>
                <select v-model="refreshInterval" :disabled="!autoRefresh" @change="autoRefresh && startAutoRefresh()">
                  <option :value="30">30秒</option>
                  <option :value="60">1分钟</option>
                  <option :value="300">5分钟</option>
                </select>
              </div>
            </div>
            <div class="query-actions">
              <button type="button" class="btn-query" @click="loadData" :disabled="loading">
                {{ loading ? '刷新中...' : '刷新' }}
              </button>
            </div>
          </div>
        </div>

        <div class="result-list-wrap" v-adaptive-height>
          <div v-if="loading && sortedList.length === 0" class="empty-state">加载中...</div>
          <div v-else-if="sortedList.length === 0" class="empty-state">暂无数据</div>
          
          <div v-for="item in sortedList" :key="item.id || item.stockCode" class="stock-item">
            <div class="stock-inline-row" :class="{ expanded: isNoticeExpanded(item) }">
              <div class="inline-block stock-basic">
                <div class="stock-identity">
                  <div class="stock-header">
                    <div class="stock-title-row">
                      <button type="button" class="stock-title-btn" @click="openStockQuote($event, item)">
                        <span class="stock-name">{{ item.stockName || '—' }}</span>
                        <code class="stock-code">{{ item.stockCode }}</code>
                      </button>
                      <div class="copy-actions">
                        <button 
                          type="button" 
                          class="copy-btn-inline" 
                          :class="{ copied: isCopied(item.stockName || '') }"
                          @click.stop="copy(item.stockName || '')"
                          :title="isCopied(item.stockName || '') ? '已复制' : '复制名称'"
                        >
                          <span v-if="isCopied(item.stockName || '')" class="copy-icon">✓</span>
                          <span v-else class="copy-icon">名</span>
                        </button>
                        <button 
                          type="button" 
                          class="copy-btn-inline" 
                          :class="{ copied: isCopied(item.stockCode) }"
                          @click.stop="copy(item.stockCode)"
                          :title="isCopied(item.stockCode) ? '已复制' : '复制代码'"
                        >
                          <span v-if="isCopied(item.stockCode)" class="copy-icon">✓</span>
                          <span v-else class="copy-icon">码</span>
                        </button>
                      </div>
                    </div>
                    <div class="stock-tags">
                      <span class="tag tag-industry">{{ item.industry || '—' }}</span>
                      <span class="tag tag-cap">市值 {{ displayMarketCap(item.marketCap) }}亿</span>
                    </div>
                  </div>
                </div>

                <div class="stock-market-line">
                  <span class="pct-chip" :class="getPctClass(item.tPctChg)">
                    {{ displayPct(item.tPctChg) }}
                  </span>
                  <div class="quote-strip">
                    <span class="quote-item"><em>开</em>{{ displayNumber(item.tOpen) }}</span>
                    <span class="quote-item"><em>收</em>{{ displayNumber(item.tClose) }}</span>
                    <span class="quote-item quote-high"><em>高</em>{{ displayNumber(item.tHigh) }}</span>
                    <span class="quote-item quote-low"><em>低</em>{{ displayNumber(item.tLow) }}</span>
                    <span class="quote-item quote-volume"><em>量</em>{{ displayVolume(item.tVolume) }}</span>
                  </div>
                </div>

                <div class="stock-signal-line">
                  <span class="signal-count">信号 {{ activeSignalCount(item) }}/4</span>
                  <span class="signal-chip" :class="{ active: getAvgPriceAnomaly(item) > 0 }">3日</span>
                  <span class="signal-chip" :class="{ active: getVolAnomaly100d(item) > 0 }">100量</span>
                  <span class="signal-chip" :class="{ active: getVolAnomaly240d(item) > 0 }">240量</span>
                  <span class="signal-chip" :class="{ active: getYearHighAnomaly(item) > 0 }">年高</span>
                </div>
              </div>

              <div class="inline-block notice-inline" v-if="item.notices && item.notices.length">
                <button
                  v-for="(notice, noticeIndex) in displayedNotices(item)"
                  :key="notice.id ?? `${item.stockCode}-${noticeIndex}`"
                  type="button"
                  class="notice-inline-item"
                  @click="openNoticeDetail(item, notice)"
                >
                  <span class="notice-title-inline" :title="notice.noticeTitle || '—'">{{ notice.noticeTitle || '—' }}</span>
                  <span class="notice-direction-tag" :title="notice.beneficialDirection || ''">
                    <span class="direction-icon">➔</span>
                    {{ displayDirection(notice.beneficialDirection) }}
                  </span>
                  <span class="notice-scores">
                    <span class="score-chip score-f">F{{ displayScore(notice.scoreFundamental) }}</span>
                    <span class="score-chip score-n">N{{ displayScore(notice.scoreNovelty) }}</span>
                    <span class="score-chip score-b">B{{ displayScore(notice.scoreBusiness) }}</span>
                    <span class="score-chip score-e">E{{ displayScore(notice.scoreElasticity) }}</span>
                    <span class="score-chip score-u">U{{ displayScore(notice.userRating) }}</span>
                  </span>
                  <span class="status-badge" :class="getNoticeStatusClass(notice.status)">{{ statusLabel(notice.status) }}</span>
                  <span class="notice-time-inline">{{ formatShortTime(notice.publishTime) }}</span>
                </button>
                <button
                  v-if="hiddenNoticeCount(item) > 0 && !isNoticeExpanded(item)"
                  type="button"
                  class="notice-expand-btn"
                  @click="toggleNoticeExpand(item)"
                >
                  查看更多 +{{ hiddenNoticeCount(item) }}
                </button>
                <button
                  v-if="isNoticeExpanded(item)"
                  type="button"
                  class="notice-expand-btn"
                  @click="toggleNoticeExpand(item)"
                >
                  收起公告
                </button>
              </div>
              <div v-else class="inline-block no-notices">暂无公告</div>
            </div>
          </div>
        </div>

        <div class="pagination-bar">
          <div class="pagination-info">
            共 {{ totalCount }} 只，第 {{ page }}/{{ totalPages }} 页
          </div>
          <div class="pagination-controls">
            <button type="button" class="btn-page" :disabled="page <= 1" @click="goToPage(page - 1)">上一页</button>
            <span class="page-numbers">
              <button
                v-for="p in visiblePages"
                :key="p"
                type="button"
                class="btn-page-number"
                :class="{ active: p === page, ellipsis: p < 0 }"
                :disabled="p < 0"
                @click="goToPage(p)"
              >
                {{ p < 0 ? '...' : p }}
              </button>
            </span>
            <button type="button" class="btn-page" :disabled="page >= totalPages" @click="goToPage(page + 1)">下一页</button>
            <select v-model="pageSize" @change="changePageSize(pageSize)" class="page-size-select">
              <option :value="50">50条/页</option>
              <option :value="20">20条/页</option>
              <option :value="100">100条/页</option>
            </select>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.today-watch {
  --tw-col-basic: 34%;
  --tw-col-notice: 66%;
  --tw-notice-col-time: 5.4rem;

  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding: var(--space-md);
  max-width: var(--layout-content-max);
  margin: 0 auto;
  overflow: visible;
}

.result-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  min-height: 0;
}

.result-card {
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 96%, transparent) 0%, var(--bg-card) 100%);
  overflow: visible;
  box-shadow: var(--shadow-sm);
  position: relative;
}

.watch-header {
  align-items: flex-start;
}

.watch-header-main {
  min-width: 0;
}

.query-bar {
  padding: var(--space-md);
  border-bottom: 1px solid var(--border);
  background:
    linear-gradient(112deg, color-mix(in srgb, var(--accent-subtle) 52%, transparent) 0%, transparent 40%),
    color-mix(in srgb, var(--bg-elevated) 96%, transparent);
  position: relative;
  isolation: isolate;
  z-index: 2;
}

.query-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-xs) var(--space-md);
}

.query-field {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  min-width: 0;
}

.query-field--date {
  position: relative;
  z-index: 6;
}

.query-field--date :deep(.trade-date-single-picker) {
  position: relative;
  z-index: 6;
}

.query-field--date :deep(.date-dropdown) {
  z-index: 1600;
}

.query-field-label {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text-muted);
  white-space: nowrap;
}

.stat-value {
  display: inline-flex;
  align-items: center;
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.refresh-controls {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.switch {
  position: relative;
  display: inline-block;
  width: 34px;
  height: 19px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: color-mix(in srgb, var(--border-strong) 92%, transparent);
  transition: .2s;
  border-radius: 18px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 13px;
  width: 13px;
  left: 3px;
  bottom: 3px;
  background-color: var(--text-primary);
  transition: .2s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: var(--accent);
}

input:checked + .slider:before {
  transform: translateX(14px);
}

.refresh-controls select {
  height: var(--control-h-sm);
  padding: 0 0.5rem;
  font-size: var(--text-xs);
  color: var(--text-primary);
  background: color-mix(in srgb, var(--bg-card) 90%, var(--bg-elevated));
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.refresh-controls select:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-subtle) 65%, transparent);
}

.refresh-controls select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.query-actions {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  margin-left: auto;
}

.btn-query {
  height: var(--control-h-sm);
  min-width: 4.8rem;
  padding: 0 0.9rem;
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text-on-accent);
  background: var(--gradient-accent);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: transform var(--transition-fast), box-shadow var(--transition-fast), filter var(--transition-fast);
}

.btn-query:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: var(--shadow-glow);
  filter: saturate(1.05);
}

.btn-query:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.result-list-wrap {
  --adaptive-height-min: var(--layout-table-min-height);
  --adaptive-height-bottom: var(--layout-table-bottom-reserve);

  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-height: 18rem;
  padding: var(--space-sm);
  overflow-y: auto;
  overflow-x: hidden;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--bg-surface) 94%, transparent) 0%, var(--bg-surface) 100%);
  position: relative;
  z-index: 1;
}

.empty-state {
  padding: var(--space-xl);
  text-align: center;
  color: var(--text-muted);
  font-size: var(--text-sm);
}

.stock-item {
  flex: 0 0 auto;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  overflow: hidden;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast), transform var(--transition-fast);
}

.stock-item:hover {
  border-color: color-mix(in srgb, var(--accent) 24%, var(--border));
  box-shadow: var(--shadow-sm);
  transform: translateY(-1px);
}

.stock-inline-row {
  display: grid;
  grid-template-columns: var(--tw-col-basic) var(--tw-col-notice);
  align-items: start;
  gap: var(--space-md);
  padding: var(--space-sm);
  min-height: auto;
  white-space: normal;
  overflow: hidden;
  background: var(--bg-card);
}

.stock-inline-row.expanded {
  max-height: none;
}

.inline-block {
  display: flex;
  gap: var(--space-xs);
}

.stock-basic {
  flex-direction: column;
  justify-content: flex-start;
  align-items: stretch;
  padding: 0 var(--space-sm) 0 0;
  border-right: 1px solid var(--border);
  align-self: stretch;
  gap: var(--space-xs);
}

.stock-header {
  display: flex;
  align-items: flex-start;
  gap: var(--space-xs);
  flex-wrap: wrap;
  min-width: 0;
}

.stock-title-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  padding: 0;
  cursor: pointer;
  transition: opacity var(--transition-fast), filter var(--transition-fast);
}

.stock-title-btn:hover {
  opacity: 0.9;
  filter: saturate(1.1);
}

.stock-title-row {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  min-width: 0;
}

.copy-actions {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2xs);
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.stock-header:hover .copy-actions {
  opacity: 1;
}

.copy-btn-inline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.3rem;
  height: 1.3rem;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-xs);
  background: color-mix(in srgb, var(--bg-surface) 90%, transparent);
  color: var(--text-muted);
  cursor: pointer;
  font-size: var(--text-2xs);
  transition: all var(--transition-fast);
}

.copy-btn-inline:hover {
  background: var(--accent-subtle);
  border-color: var(--accent);
  color: var(--accent);
  transform: scale(1.06);
}

.copy-btn-inline.copied {
  background: var(--success-subtle);
  border-color: var(--success);
  color: var(--success);
}

.copy-btn-inline .copy-icon {
  line-height: 1;
}

.stock-tags {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-xs);
  min-width: 0;
}

.tag {
  display: inline-flex;
  align-items: center;
  min-height: 1.25rem;
  font-size: var(--text-2xs);
  padding: 0 0.4rem;
  border-radius: var(--radius-full);
  white-space: nowrap;
  font-weight: 600;
}

.tag-industry {
  background: color-mix(in srgb, var(--accent-subtle) 76%, transparent);
  color: var(--accent-bright);
  border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
}

.tag-cap {
  background: color-mix(in srgb, var(--warning-subtle) 78%, transparent);
  color: var(--warning-bright);
  border: 1px solid color-mix(in srgb, var(--warning) 32%, transparent);
}

.stock-name {
  font-size: var(--text-base);
  font-weight: 700;
  color: var(--text-primary);
}

.stock-code {
  font-size: var(--text-xs);
  color: var(--accent);
  background: var(--accent-subtle);
  padding: 0.15rem 0.4rem;
  border-radius: var(--radius-xs);
  font-family: var(--font-mono);
  font-weight: 600;
}

.stock-market-line {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  min-width: 0;
}

.pct-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 1.5rem;
  min-width: 4.8rem;
  padding: 0 0.6rem;
  border-radius: var(--radius-xs);
  color: var(--text-secondary);
  background: var(--bg-elevated);
  font-size: var(--text-base);
  font-weight: 700;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  border: 1px solid color-mix(in srgb, var(--border) 85%, transparent);
}

.pct-chip.pct-up {
  color: var(--gain);
  background: color-mix(in srgb, var(--gain-subtle) 88%, transparent);
  border: 1px solid rgba(239, 68, 68, 0.35);
}

.pct-chip.pct-down {
  color: var(--loss);
  background: color-mix(in srgb, var(--loss-subtle) 88%, transparent);
  border: 1px solid rgba(16, 185, 129, 0.35);
}

.quote-strip {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.2rem;
  min-width: 0;
}

.quote-item {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  min-height: 1.3rem;
  padding: 0 0.4rem;
  border-radius: var(--radius-xs);
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  color: var(--text-primary);
  font-size: calc(var(--text-xs) - 0.01rem);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.quote-item em {
  font-size: var(--text-xs);
  color: var(--text-muted);
  font-style: normal;
  font-weight: 500;
}

.quote-item.quote-high {
  color: var(--gain);
}

.quote-item.quote-low {
  color: var(--loss);
}

.quote-item.quote-volume {
  min-width: 4.8rem;
  justify-content: center;
}

.stock-signal-line {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.18rem;
  min-width: 0;
}

.signal-count {
  display: inline-flex;
  align-items: center;
  padding: 0 0.42rem;
  min-height: 1.34rem;
  border-radius: var(--radius-xs);
  border: 1px solid var(--border-subtle);
  color: var(--text-primary);
  background: color-mix(in srgb, var(--bg-elevated) 84%, transparent);
  font-size: var(--text-2xs);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.signal-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2.58rem;
  min-height: 1.34rem;
  padding: 0 0.3rem;
  border-radius: var(--radius-xs);
  border: 1px solid var(--border-subtle);
  color: var(--text-secondary);
  background: color-mix(in srgb, var(--bg-elevated) 72%, transparent);
  font-size: var(--text-2xs);
  font-weight: 600;
  font-family: var(--font-mono);
  letter-spacing: 0.01em;
}

.signal-chip.active {
  color: var(--accent);
  border-color: color-mix(in srgb, var(--accent) 35%, transparent);
  background: color-mix(in srgb, var(--accent-subtle) 65%, transparent);
}

.pct-up { color: var(--gain); font-weight: 600; }
.pct-down { color: var(--loss); font-weight: 600; }

.no-notices {
  font-size: var(--text-2xs);
  color: var(--text-faint);
  padding: 0 var(--space-xs);
  display: flex;
  align-items: center;
}

.notice-inline {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
  gap: 0.22rem;
  flex: 1 1 auto;
  min-width: 0;
  overflow-y: auto;
  padding-left: var(--space-sm);
}

.stock-inline-row.expanded .notice-inline {
  overflow-y: visible;
}

.notice-inline-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) max-content max-content max-content var(--tw-notice-col-time);
  align-items: center;
  text-align: left;
  gap: 0.32rem;
  width: 100%;
  max-width: none;
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--bg-card) 72%, transparent);
  border: 1px solid color-mix(in srgb, var(--border) 85%, transparent);
  padding: 0.28rem 0.45rem;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.notice-inline-item:hover {
  background: color-mix(in srgb, var(--bg-elevated) 78%, transparent);
  border-color: color-mix(in srgb, var(--accent) 22%, var(--border));
}

.notice-expand-btn {
  min-height: 1.26rem;
  padding: 0 0.42rem;
  border: 1px dashed var(--border);
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--text-faint);
  font-size: var(--text-2xs);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.notice-expand-btn:hover {
  color: var(--accent);
  border-color: var(--accent);
  background: var(--accent-subtle);
}

.notice-time-inline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  justify-self: end;
  min-height: 1.15rem;
  padding: 0 0.35rem;
  border-radius: var(--radius-xs);
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  font-size: var(--text-2xs);
  color: var(--text-muted);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.01em;
}

.notice-title-inline {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text-primary);
  min-width: 0;
  justify-self: start;
  text-align: left;
  max-width: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notice-direction-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  font-size: var(--text-2xs);
  color: var(--accent-bright);
  background: color-mix(in srgb, var(--accent-subtle) 60%, transparent);
  padding: 0.08rem 0.32rem;
  border-radius: var(--radius-xs);
  white-space: nowrap;
  max-width: 6rem;
  overflow: hidden;
  text-overflow: ellipsis;
}

.direction-icon {
  font-size: 0.54rem;
  opacity: 0.75;
}

.notice-scores {
  display: inline-flex;
  gap: 0.14rem;
  flex-shrink: 0;
}

.score-chip {
  font-size: var(--text-2xs);
  font-weight: 600;
  padding: 0.08rem 0.2rem;
  border-radius: var(--radius-xs);
  font-family: var(--font-mono);
  white-space: nowrap;
}

.score-f { color: #3b82f6; background: rgba(59, 130, 246, 0.12); }
.score-n { color: #f59e0b; background: rgba(245, 158, 11, 0.12); }
.score-b { color: #10b981; background: rgba(16, 185, 129, 0.12); }
.score-e { color: #ef4444; background: rgba(239, 68, 68, 0.12); }
.score-u { color: var(--secondary); background: var(--secondary-subtle); }

.status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 1.18rem;
  padding: 0 0.32rem;
  border-radius: var(--radius-xs);
  font-size: var(--text-2xs);
  font-weight: 600;
  white-space: nowrap;
}

.status-badge.status-pending,
.status-badge.status-processing {
  background: var(--accent-subtle);
  color: var(--accent);
}

.status-badge.status-done {
  background: var(--success-subtle);
  color: var(--success);
}

.pagination-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  border-top: 1px solid var(--border);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--bg-elevated) 76%, transparent) 0%, var(--bg-card) 100%);
}

.pagination-info {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.page-numbers {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.btn-page,
.btn-page-number {
  height: var(--control-h-sm);
  min-width: 1.7rem;
  padding: 0 0.44rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--bg-card) 88%, var(--bg-elevated));
  color: var(--text-secondary);
  font-size: var(--text-xs);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-page:hover:not(:disabled),
.btn-page-number:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
}

.btn-page-number.active {
  background: var(--gradient-accent);
  border-color: color-mix(in srgb, var(--accent) 85%, transparent);
  color: var(--text-on-accent);
}

.btn-page:disabled,
.btn-page-number:disabled,
.btn-page-number.ellipsis {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-size-select {
  height: var(--control-h-sm);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--bg-card) 90%, var(--bg-elevated));
  color: var(--text-secondary);
  font-size: var(--text-xs);
  padding: 0 0.375rem;
}

@media (max-width: 1280px) {
  .today-watch {
    --tw-col-basic: 38%;
    --tw-col-notice: 62%;
  }
}

@media (max-width: 1024px) {
  .today-watch {
    --tw-col-basic: 1fr;
    --tw-col-notice: 1fr;
  }

  .stock-inline-row {
    grid-template-columns: 1fr;
    gap: var(--space-sm);
  }

  .stock-basic {
    border-right: none;
    border-bottom: 1px solid var(--border);
    padding-right: 0;
    padding-bottom: var(--space-sm);
  }

  .notice-inline {
    padding-left: 0;
  }
}

@media (max-width: 768px) {
  .today-watch {
    padding: var(--space-sm);
  }

  .result-list-wrap {
    min-height: 12rem;
  }

  .query-row {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-sm);
  }

  .query-field {
    width: 100%;
    flex-direction: row;
    justify-content: space-between;
  }

  .query-actions {
    width: 100%;
    margin-left: 0;
    flex-wrap: wrap;
  }

  .btn-query {
    width: 100%;
  }

  .watch-header {
    align-items: center;
  }

  .watch-header .table-panel-kpis {
    display: none;
  }

  .inline-block {
    width: 100%;
  }

  .stock-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-xs);
  }

  .stock-market-line {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-xs);
  }

  .pct-chip {
    width: 100%;
    justify-content: flex-start;
    min-width: 0;
    padding: 0 var(--space-sm);
  }

  .quote-strip {
    width: 100%;
  }

  .notice-inline-item {
    max-width: 100%;
    grid-template-columns: minmax(0, 1fr) auto;
    row-gap: 0.2rem;
  }

  .notice-time-inline {
    grid-column: 2;
    grid-row: 1;
  }

  .notice-direction-tag,
  .notice-scores,
  .status-badge {
    grid-column: 1 / -1;
  }

  .pagination-bar {
    flex-direction: column;
    align-items: stretch;
    padding: var(--space-sm);
    gap: var(--space-sm);
  }

  .pagination-controls {
    flex-wrap: wrap;
    justify-content: center;
  }
}

@media (max-width: 560px) {
  .table-panel-subtitle {
    display: none;
  }

  .notice-title-inline {
    white-space: normal;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
}
</style>
