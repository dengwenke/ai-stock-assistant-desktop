<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { SortField, SortOrder, SortRule } from '@/api/client'
import type { NoticeRecord } from '@/api/types'
import { useGlobalCopy } from '@/composables'

const router = useRouter()
const { copy, isCopied } = useGlobalCopy()

// 列宽状态管理
type ColumnKey = 'code' | 'name' | 'industry' | 'cap' | 'title' | 'time' | 'tdate' | 'anomaly1' | 'anomaly2' | 'anomaly3' | 'anomaly4' | 'benefit' | 'score1' | 'score2' | 'score3' | 'score4' | 'rating'

const defaultColumnWidths: Record<ColumnKey, number> = {
  code: 88,
  name: 72,
  industry: 80,
  cap: 64,
  title: 200,
  time: 145,
  tdate: 90,
  anomaly1: 56,
  anomaly2: 56,
  anomaly3: 56,
  anomaly4: 56,
  benefit: 96,
  score1: 44,
  score2: 44,
  score3: 44,
  score4: 44,
  rating: 44
}

const columnWidths = reactive<Record<ColumnKey, number>>({ ...defaultColumnWidths })

// 拖动调整列宽逻辑
const resizing = ref<{ key: ColumnKey; startX: number; startWidth: number } | null>(null)

function onResizeStart(e: MouseEvent, key: ColumnKey) {
  e.preventDefault()
  e.stopPropagation()
  resizing.value = { key, startX: e.clientX, startWidth: columnWidths[key] }
  document.addEventListener('mousemove', onResizeMove)
  document.addEventListener('mouseup', onResizeEnd)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

function onResizeMove(e: MouseEvent) {
  if (!resizing.value) return
  const delta = e.clientX - resizing.value.startX
  const minWidth = 40
  columnWidths[resizing.value.key] = Math.max(minWidth, resizing.value.startWidth + delta)
}

function onResizeEnd() {
  resizing.value = null
  document.removeEventListener('mousemove', onResizeMove)
  document.removeEventListener('mouseup', onResizeEnd)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

const props = withDefaults(
  defineProps<{
    list: NoticeRecord[]
    loading?: boolean
    sortRules?: SortRule[]
  }>(),
  { sortRules: () => [] }
)

const emit = defineEmits<{
  (e: 'refresh'): void
  (e: 'update:sortRules', rules: SortRule[]): void
}>()

const effectiveRules = computed(() => {
  const r = props.sortRules
  return r && r.length > 0 ? r : [{ field: 'publishTime' as SortField, order: 'desc' as SortOrder }]
})

function getSortOrder(field: SortField): SortOrder | null {
  const rule = effectiveRules.value.find((x) => x.field === field)
  return rule ? rule.order : null
}

function onSortHeader(field: SortField) {
  const current = effectiveRules.value
  const idx = current.findIndex((x) => x.field === field)
  let next: SortRule[]
  if (idx < 0) {
    next = [{ field, order: 'desc' }, ...current]
  } else {
    const curOrder = current[idx].order
    if (curOrder === 'desc') {
      next = current.map((r, i) => (i === idx ? { ...r, order: 'asc' as SortOrder } : r))
    } else {
      next = current.filter((_, i) => i !== idx)
      if (next.length === 0) next = [{ field: 'publishTime', order: 'desc' }]
    }
  }
  emit('update:sortRules', next)
}

const rows = computed(() => props.list)

function displayAnomaly(value?: number | null): string {
  if (value == null || Number.isNaN(value)) return '—'
  return value === 1 ? '✓' : '○'
}

function getAnomalyClass(value?: number | null): string {
  if (value == null || Number.isNaN(value)) return 'anomaly-none'
  return value === 1 ? 'anomaly-active' : 'anomaly-inactive'
}

function getNumberValue(row: NoticeRecord, camelKey: keyof NoticeRecord, snakeKey: keyof NoticeRecord): number | null {
  const camelVal = row[camelKey]
  const snakeVal = row[snakeKey]
  if (typeof camelVal === 'number' && !Number.isNaN(camelVal)) return camelVal
  if (typeof snakeVal === 'number' && !Number.isNaN(snakeVal)) return snakeVal
  return null
}

function displayScore(score?: number | null): string {
  if (score == null || Number.isNaN(score)) return '—'
  return String(score)
}

function getScoreClass(score?: number | null): string {
  if (score == null || Number.isNaN(score)) return ''
  if (score >= 4) return 'score-high'
  if (score >= 3) return 'score-mid'
  return 'score-low'
}

function openDetail(row: NoticeRecord) {
  if (row.id != null && row.stockCode) {
    router.push({
      name: 'stock-detail',
      params: { stockCode: row.stockCode },
      query: { mode: 'analysis', noticeId: String(row.id) }
    })
  }
}

function openStockQuote(e: Event, row: NoticeRecord) {
  e.stopPropagation()
  if (row.stockCode) {
    router.push({
      name: 'stock-detail',
      params: { stockCode: row.stockCode },
      query: { mode: 'quote' }
    })
  }
}

function displayPct(pct?: number | null): string {
  if (pct == null || Number.isNaN(pct)) return '—'
  const n = Number(pct)
  const sign = n >= 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}

/** 格式化发布时间：显示完整年月日时分秒 YYYY-MM-DD HH:mm:ss */
function formatPublishTime(time?: string | null): string {
  if (!time) return '—'
  // 时间格式：2026-02-25 19:10:00
  const match = time.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/)
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]}:${match[6]}`
  }
  return time
}

/** 获取 T日日期（兼容 camelCase 和 snake_case） */
function getTDate(row: NoticeRecord): string | null {
  const r = row as NoticeRecord & { t_date?: string; tdate?: string }
  const v = row.tDate ?? r.t_date ?? r.tdate ?? null
  if (v == null || String(v).trim() === '') return null
  return String(v).trim()
}

/** 格式化 T日日期：显示年月日 YYYY-MM-DD */
function formatTDate(row: NoticeRecord): string {
  const tDate = getTDate(row)
  if (!tDate) return '—'
  // 日期格式：2026-02-27
  const match = tDate.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`
  }
  return tDate
}
</script>

<template>
  <div class="table-wrapper" v-adaptive-height>
    <div v-if="loading && rows.length === 0" class="loading-state">
      <span class="loading-spinner"></span>
      <span>加载中...</span>
    </div>
    <table v-else class="data-table">
      <thead>
        <tr>
          <th class="col-code resizable" :style="{ width: columnWidths.code + 'px' }">
            代码
            <span class="resizer" @mousedown="onResizeStart($event, 'code')"></span>
          </th>
          <th class="col-name resizable" :style="{ width: columnWidths.name + 'px' }">
            名称
            <span class="resizer" @mousedown="onResizeStart($event, 'name')"></span>
          </th>
          <th class="col-industry resizable" :style="{ width: columnWidths.industry + 'px' }">
            行业
            <span class="resizer" @mousedown="onResizeStart($event, 'industry')"></span>
          </th>
          <th class="col-cap resizable" :style="{ width: columnWidths.cap + 'px' }">
            市值
            <span class="resizer" @mousedown="onResizeStart($event, 'cap')"></span>
          </th>
          <th class="col-title resizable" :style="{ width: columnWidths.title + 'px' }">
            事件
            <span class="resizer" @mousedown="onResizeStart($event, 'title')"></span>
          </th>
          <th class="col-time sortable resizable" :style="{ width: columnWidths.time + 'px' }" @click="onSortHeader('publishTime')">
            <span :class="{ active: getSortOrder('publishTime') }">发布时间</span>
            <span class="sort-arrow">{{ getSortOrder('publishTime') === 'desc' ? '↓' : getSortOrder('publishTime') === 'asc' ? '↑' : '' }}</span>
            <span class="resizer" @mousedown.stop="onResizeStart($event, 'time')"></span>
          </th>
          <th class="col-tdate resizable" :style="{ width: columnWidths.tdate + 'px' }">
            T日
            <span class="resizer" @mousedown="onResizeStart($event, 'tdate')"></span>
          </th>
          <th class="col-anomaly resizable" :style="{ width: columnWidths.anomaly1 + 'px' }">
            3日异动
            <span class="resizer" @mousedown="onResizeStart($event, 'anomaly1')"></span>
          </th>
          <th class="col-anomaly resizable" :style="{ width: columnWidths.anomaly2 + 'px' }">
            量能100
            <span class="resizer" @mousedown="onResizeStart($event, 'anomaly2')"></span>
          </th>
          <th class="col-anomaly resizable" :style="{ width: columnWidths.anomaly3 + 'px' }">
            量能240
            <span class="resizer" @mousedown="onResizeStart($event, 'anomaly3')"></span>
          </th>
          <th class="col-anomaly resizable" :style="{ width: columnWidths.anomaly4 + 'px' }">
            年新高
            <span class="resizer" @mousedown="onResizeStart($event, 'anomaly4')"></span>
          </th>
          <th class="col-benefit resizable" :style="{ width: columnWidths.benefit + 'px' }">
            受益方向
            <span class="resizer" @mousedown="onResizeStart($event, 'benefit')"></span>
          </th>
          <th class="col-score sortable resizable" :style="{ width: columnWidths.score1 + 'px' }" @click="onSortHeader('scoreFundamental')">
            <span :class="{ active: getSortOrder('scoreFundamental') }">基本面</span>
            <span class="sort-arrow">{{ getSortOrder('scoreFundamental') === 'desc' ? '↓' : getSortOrder('scoreFundamental') === 'asc' ? '↑' : '' }}</span>
            <span class="resizer" @mousedown.stop="onResizeStart($event, 'score1')"></span>
          </th>
          <th class="col-score sortable resizable" :style="{ width: columnWidths.score2 + 'px' }" @click="onSortHeader('scoreNovelty')">
            <span :class="{ active: getSortOrder('scoreNovelty') }">逻辑</span>
            <span class="sort-arrow">{{ getSortOrder('scoreNovelty') === 'desc' ? '↓' : getSortOrder('scoreNovelty') === 'asc' ? '↑' : '' }}</span>
            <span class="resizer" @mousedown.stop="onResizeStart($event, 'score2')"></span>
          </th>
          <th class="col-score sortable resizable" :style="{ width: columnWidths.score3 + 'px' }" @click="onSortHeader('scoreBusiness')">
            <span :class="{ active: getSortOrder('scoreBusiness') }">商业</span>
            <span class="sort-arrow">{{ getSortOrder('scoreBusiness') === 'desc' ? '↓' : getSortOrder('scoreBusiness') === 'asc' ? '↑' : '' }}</span>
            <span class="resizer" @mousedown.stop="onResizeStart($event, 'score3')"></span>
          </th>
          <th class="col-score sortable resizable" :style="{ width: columnWidths.score4 + 'px' }" @click="onSortHeader('scoreElasticity')">
            <span :class="{ active: getSortOrder('scoreElasticity') }">弹性</span>
            <span class="sort-arrow">{{ getSortOrder('scoreElasticity') === 'desc' ? '↓' : getSortOrder('scoreElasticity') === 'asc' ? '↑' : '' }}</span>
            <span class="resizer" @mousedown.stop="onResizeStart($event, 'score4')"></span>
          </th>
          <th class="col-rating sortable resizable" :style="{ width: columnWidths.rating + 'px' }" @click="onSortHeader('userRating')">
            <span :class="{ active: getSortOrder('userRating') }">评分</span>
            <span class="sort-arrow">{{ getSortOrder('userRating') === 'desc' ? '↓' : getSortOrder('userRating') === 'asc' ? '↑' : '' }}</span>
            <span class="resizer" @mousedown.stop="onResizeStart($event, 'rating')"></span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, i) in rows" :key="row.uniqueKey ?? row.id ?? i" class="data-row" @click="openDetail(row)">
          <td class="col-code">
            <span class="copyable-cell">
              <span class="link" @click.stop="openStockQuote($event, row)">{{ row.stockCode }}</span>
              <button 
                type="button" 
                class="copy-btn" 
                :class="{ copied: isCopied(row.stockCode) }"
                @click.stop="copy(row.stockCode)"
                :title="isCopied(row.stockCode) ? '已复制' : '复制代码'"
              >
                <span v-if="isCopied(row.stockCode)" class="copy-icon">✓</span>
                <span v-else class="copy-icon">⧉</span>
              </button>
            </span>
          </td>
          <td class="col-name">
            <span class="copyable-cell">
              <span class="link" @click.stop="openStockQuote($event, row)">{{ row.stockName }}</span>
              <button 
                type="button" 
                class="copy-btn" 
                :class="{ copied: isCopied(row.stockName) }"
                @click.stop="copy(row.stockName)"
                :title="isCopied(row.stockName) ? '已复制' : '复制名称'"
              >
                <span v-if="isCopied(row.stockName)" class="copy-icon">✓</span>
                <span v-else class="copy-icon">⧉</span>
              </button>
            </span>
          </td>
          <td class="col-industry" :data-tooltip="row.industry || row.industry2 || undefined">
            <span class="text-truncate-tip">{{ row.industry || row.industry2 || '—' }}</span>
          </td>
          <td class="col-cap">{{ row.marketCap ? row.marketCap + '亿' : '—' }}</td>
          <td class="col-title" :data-tooltip="row.noticeTitle || undefined">
            <a v-if="row.noticeLink" :href="row.noticeLink" target="_blank" class="title-link text-truncate-tip" @click.stop>
              {{ row.noticeTitle }}
            </a>
            <span v-else class="title-text text-truncate-tip">{{ row.noticeTitle }}</span>
          </td>
          <td class="col-time">{{ formatPublishTime(row.publishTime) }}</td>
          <td class="col-tdate">{{ formatTDate(row) }}</td>
          <td class="col-anomaly">
            <span class="anomaly-badge" :class="getAnomalyClass(getNumberValue(row, 'avgPrice3dAnomaly', 'avg_price_3d_anomaly'))">
              {{ displayAnomaly(getNumberValue(row, 'avgPrice3dAnomaly', 'avg_price_3d_anomaly')) }}
            </span>
          </td>
          <td class="col-anomaly">
            <span class="anomaly-badge" :class="getAnomalyClass(getNumberValue(row, 'ttVolAnomaly100d', 'tt_vol_anomaly_100d'))">
              {{ displayAnomaly(getNumberValue(row, 'ttVolAnomaly100d', 'tt_vol_anomaly_100d')) }}
            </span>
          </td>
          <td class="col-anomaly">
            <span class="anomaly-badge" :class="getAnomalyClass(getNumberValue(row, 'ttVolAnomaly240d', 'tt_vol_anomaly_240d'))">
              {{ displayAnomaly(getNumberValue(row, 'ttVolAnomaly240d', 'tt_vol_anomaly_240d')) }}
            </span>
          </td>
          <td class="col-anomaly">
            <span class="anomaly-badge" :class="getAnomalyClass(getNumberValue(row, 'ttYearHighAnomaly', 'tt_year_high_anomaly'))">
              {{ displayAnomaly(getNumberValue(row, 'ttYearHighAnomaly', 'tt_year_high_anomaly')) }}
            </span>
          </td>
          <td class="col-benefit" :data-tooltip="row.beneficialDirection || undefined">
            <span class="text-truncate-tip">{{ row.beneficialDirection || '—' }}</span>
          </td>
          <td class="col-score">
            <span class="score-badge" :class="getScoreClass(row.scoreFundamental)">{{ displayScore(row.scoreFundamental) }}</span>
          </td>
          <td class="col-score">
            <span class="score-badge" :class="getScoreClass(row.scoreNovelty)">{{ displayScore(row.scoreNovelty) }}</span>
          </td>
          <td class="col-score">
            <span class="score-badge" :class="getScoreClass(row.scoreBusiness)">{{ displayScore(row.scoreBusiness) }}</span>
          </td>
          <td class="col-score">
            <span class="score-badge" :class="getScoreClass(row.scoreElasticity)">{{ displayScore(row.scoreElasticity) }}</span>
          </td>
          <td class="col-rating">
            <span v-if="row.userRating" class="rating-badge">{{ row.userRating }}</span>
            <span v-else class="text-muted">—</span>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="!loading && rows.length === 0" class="empty-state">暂无数据</p>
  </div>
</template>

<style scoped>
.table-wrapper {
  --adaptive-height-min: var(--layout-table-min-height-dense);
  --adaptive-height-bottom: var(--layout-table-bottom-reserve);

  flex: 1;
  overflow: auto;
  background: var(--bg-card);
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  padding: var(--space-2xl);
  color: var(--text-muted);
  font-size: var(--text-xs);
}

.loading-spinner {
  display: inline-block;
  width: 1.25rem;
  height: 1.25rem;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 数据表格 - 紧凑专业风格 */
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-sm);
  table-layout: fixed;
}

.data-table thead {
  position: sticky;
  top: 0;
  z-index: 10;
  backdrop-filter: blur(8px);
}

.data-table th {
  padding: 0.45rem 0.45rem;
  font-weight: 600;
  font-size: var(--text-xs);
  color: var(--text-muted);
  background: color-mix(in srgb, var(--bg-card) 88%, var(--bg-surface));
  border-bottom: 1px solid var(--border-strong);
  white-space: nowrap;
  text-align: center;
  letter-spacing: 0.01em;
}

.data-table th:first-child {
  padding-left: var(--space-md);
}

.data-table th:last-child {
  padding-right: var(--space-md);
}

.data-table td {
  padding: 0.42rem 0.45rem;
  border-bottom: 1px solid var(--border-subtle);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.data-table td:first-child {
  padding-left: var(--space-md);
}

.data-table td:last-child {
  padding-right: var(--space-md);
}

.data-row {
  cursor: pointer;
  transition: background var(--transition-fast), border-color var(--transition-fast);
}

.data-row:hover {
  background: color-mix(in srgb, var(--accent-subtle) 40%, transparent);
}

.data-row:active {
  background: var(--bg-active);
}

/* 可排序表头 */
.sortable {
  cursor: pointer;
  user-select: none;
}

.sortable:hover {
  background: color-mix(in srgb, var(--accent-subtle) 50%, transparent);
}

.sortable .active {
  color: var(--accent);
}

.sort-arrow {
  margin-left: 3px;
  font-size: 0.6rem;
  opacity: 0.8;
}

/* 列宽定义 - 基础样式，实际宽度由 JS 动态控制 */
.col-code { text-align: center; }
.col-name { text-align: center; }
.col-industry { text-align: left; }
.col-cap { text-align: right; }
.col-time { text-align: center; font-variant-numeric: tabular-nums; }
.col-title { text-align: left; }
.col-tdate { text-align: center; font-variant-numeric: tabular-nums; }
.col-anomaly { text-align: center; font-variant-numeric: tabular-nums; }
.col-benefit { text-align: left; }
.col-score { text-align: center; }
.col-rating { text-align: center; }

/* 异动指标徽章 */
.anomaly-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.3rem;
  height: 1.25rem;
  font-size: var(--text-xs);
  font-weight: 600;
  border-radius: var(--radius-xs);
}

.anomaly-active {
  color: var(--success-bright);
  background: var(--success-subtle);
}

.anomaly-inactive {
  color: var(--text-muted);
  background: transparent;
  opacity: 0.5;
}

.anomaly-none {
  color: var(--text-muted);
  background: transparent;
}

/* 可调整列宽样式 */
.resizable {
  position: relative;
}

.resizer {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  cursor: col-resize;
  background: transparent;
  transition: background var(--transition-fast);
}

.resizer:hover {
  background: var(--accent);
}

/* 链接样式 */
.link {
  color: var(--accent);
  cursor: pointer;
  transition: color var(--transition-fast);
}

.link:hover {
  color: var(--accent-bright);
  text-decoration: underline;
}

/* 标题文本 - 支持截断 + tooltip */
.title-link,
.title-text {
  display: block;
  color: var(--text-primary);
}

.title-link {
  text-decoration: none;
}

.title-link:hover {
  color: var(--accent);
}

/* 截断文本样式 */
.text-truncate-tip {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 评分徽章 - 简洁风格 */
.score-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.3rem;
  height: 1.25rem;
  padding: 0 0.25rem;
  font-size: var(--text-xs);
  font-weight: 600;
  border-radius: var(--radius-xs);
  font-variant-numeric: tabular-nums;
}

.score-high {
  color: var(--success-bright);
  background: var(--success-subtle);
}

.score-mid {
  color: var(--warning-bright);
  background: var(--warning-subtle);
}

.score-low {
  color: var(--text-muted);
  background: var(--bg-elevated);
}

/* 用户评分徽章 */
.rating-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.3rem;
  height: 1.25rem;
  padding: 0 0.25rem;
  border-radius: var(--radius-xs);
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--accent);
  background: var(--accent-subtle);
}

/* 文本样式 */
.text-muted {
  color: var(--text-muted);
}

.text-gain {
  color: var(--gain);
}

.text-loss {
  color: var(--loss);
}

/* 空状态 */
.empty-state {
  padding: var(--space-2xl);
  text-align: center;
  color: var(--text-muted);
  font-size: var(--text-xs);
}

/* 可复制单元格 */
.copyable-cell {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2xs);
}

.copy-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.1rem;
  height: 1.1rem;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  opacity: 0;
  transition: opacity var(--transition-fast), color var(--transition-fast), transform var(--transition-fast);
  flex-shrink: 0;
}

.copyable-cell:hover .copy-btn,
.copy-btn:focus {
  opacity: 1;
}

.copy-btn:hover {
  color: var(--accent);
  transform: scale(1.1);
}

.copy-btn.copied {
  opacity: 1;
  color: var(--success);
}

.copy-icon {
  font-size: var(--text-xs);
  line-height: 1;
}

/* 响应式 - 优先隐藏非核心列 */
@media (max-width: 1400px) {
  .col-benefit { display: none; }
}

@media (max-width: 1200px) {
  .col-industry { display: none; }
}

@media (max-width: 992px) {
  .col-cap { display: none; }
}

@media (max-width: 768px) {
  .col-anomaly:nth-child(8),
  .col-anomaly:nth-child(9) {
    display: none;
  }
}
</style>
