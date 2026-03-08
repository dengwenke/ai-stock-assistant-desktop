<script setup lang="ts">
/**
 * 公告列表组件
 * 支持搜索、分页、时间筛选
 */
import { ref, computed, watch } from 'vue'
import type { NoticeRecord } from '@/api/types'
import { getAnalysisList } from '@/api/client'

interface Props {
  stockCode: string
  notices?: NoticeRecord[]
  total?: number
  page?: number
  pageSize?: number
  keyword?: string
  selectedId?: number | null
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  notices: () => [],
  total: 0,
  page: 1,
  pageSize: 10,
  keyword: '',
  selectedId: null,
  loading: false,
})

const emit = defineEmits<{
  'select': [notice: NoticeRecord]
  'detail': [notice: NoticeRecord]
  'hover': [notice: NoticeRecord | null]
  'pageChange': [page: number]
  'update:keyword': [keyword: string]
}>()

// 公告列表容器引用
const listContainerRef = ref<HTMLElement | null>(null)

// 本地搜索状态
const localKeyword = ref(props.keyword)
const isSearching = ref(false)
const searchResults = ref<NoticeRecord[]>([])
const searchTotal = ref(0)

// 是否使用搜索模式
const isSearchMode = computed(() => localKeyword.value.trim().length > 0)

// 显示的公告列表
const displayNotices = computed(() => {
  if (isSearchMode.value) {
    return searchResults.value
  }
  return props.notices
})

const displayTotal = computed(() => {
  if (isSearchMode.value) {
    return searchTotal.value
  }
  return props.total
})

// 总页数
const totalPages = computed(() => {
  return Math.ceil(displayTotal.value / props.pageSize)
})

// 搜索防抖
let searchTimeout: ReturnType<typeof setTimeout> | null = null

function handleKeywordChange(value: string) {
  localKeyword.value = value

  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }

  searchTimeout = setTimeout(() => {
    emit('update:keyword', value)
    if (value.trim()) {
      performSearch(1)
    } else {
      searchResults.value = []
      searchTotal.value = 0
      emit('pageChange', 1)
    }
  }, 300)
}

// 执行搜索
async function performSearch(searchPage: number = 1) {
  if (!localKeyword.value.trim()) return

  isSearching.value = true
  try {
    const result = await getAnalysisList({
      stockCode: props.stockCode,
      keyword: localKeyword.value.trim(),
      page: searchPage,
      size: props.pageSize,
    })
    searchResults.value = result.list
    searchTotal.value = result.total
  } catch (error) {
    console.error('搜索失败:', error)
    searchResults.value = []
    searchTotal.value = 0
  } finally {
    isSearching.value = false
  }
}

// 选择公告
function selectNotice(notice: NoticeRecord) {
  emit('select', notice)
}

// 查看公告详情
function viewNoticeDetail(notice: NoticeRecord) {
  emit('detail', notice)
}

// 悬停公告
function hoverNotice(notice: NoticeRecord | null) {
  emit('hover', notice)
}

// 切换页码
function goToPage(page: number) {
  if (page < 1 || page > totalPages.value) return
  emit('pageChange', page)
  if (isSearchMode.value) {
    performSearch(page)
  }
}

// 格式化日期时间（显示日期和时间）
function formatDateTime(dateStr?: string): string {
  if (!dateStr) return '-'
  return dateStr
}

function getNoticeTDate(notice: NoticeRecord): string | null {
  const r = notice as NoticeRecord & { t_date?: string; tdate?: string }
  const v = notice.tDate ?? r.t_date ?? r.tdate ?? null
  if (!v || String(v).trim() === '') return null
  return String(v).trim()
}

// 格式化 T日涨幅
function formatPctT(pctT?: number | null): string {
  if (pctT == null || Number.isNaN(pctT)) return ''
  const n = Number(pctT)
  const sign = n >= 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}

// 获取 T日涨幅数值（兼容 camelCase 和 snake_case）
function getPctT(notice: NoticeRecord): number | null {
  const r = notice as NoticeRecord & { pct_t?: number }
  const v = notice.pctT ?? r.pct_t
  if (v == null || Number.isNaN(v)) return null
  return Number(v)
}

// 获取 T日涨幅 CSS 类
function getPctTClass(pctT: number | null): string {
  if (pctT == null) return ''
  return pctT >= 0 ? 'pct-up' : 'pct-down'
}

// 获取异动指标（兼容 camelCase 和 snake_case）
function getAnomaly3d(notice: NoticeRecord): boolean {
  const r = notice as NoticeRecord & { avg_price_3d_anomaly?: number }
  return (notice.avgPrice3dAnomaly ?? r.avg_price_3d_anomaly ?? 0) === 1
}

function getVolAnomaly100d(notice: NoticeRecord): boolean {
  const r = notice as NoticeRecord & { tt_vol_anomaly_100d?: number }
  return (notice.ttVolAnomaly100d ?? r.tt_vol_anomaly_100d ?? 0) === 1
}

function getVolAnomaly240d(notice: NoticeRecord): boolean {
  const r = notice as NoticeRecord & { tt_vol_anomaly_240d?: number }
  return (notice.ttVolAnomaly240d ?? r.tt_vol_anomaly_240d ?? 0) === 1
}

function getYearHigh(notice: NoticeRecord): boolean {
  const r = notice as NoticeRecord & { tt_year_high_anomaly?: number }
  return (notice.ttYearHighAnomaly ?? r.tt_year_high_anomaly ?? 0) === 1
}

// 获取评分（1-5）
function getScore(notice: NoticeRecord, field: 'scoreFundamental' | 'scoreNovelty' | 'scoreBusiness' | 'scoreElasticity'): string {
  const val = notice[field]
  return val != null ? String(val) : '-'
}

// 获取总评分
function getScoreTotal(notice: NoticeRecord): string {
  const f = notice.scoreFundamental
  const n = notice.scoreNovelty
  const b = notice.scoreBusiness
  const e = notice.scoreElasticity
  if (f == null && n == null && b == null && e == null) return '-'
  const total = (f ?? 0) + (n ?? 0) + (b ?? 0) + (e ?? 0)
  return String(total)
}

// 获取总评分 CSS 类
function getScoreTotalClass(notice: NoticeRecord): string {
  const total = getScoreTotal(notice)
  if (total === '-') return ''
  const val = parseInt(total, 10)
  if (val >= 16) return 'score-high'
  if (val >= 12) return 'score-mid'
  return 'score-low'
}

// 监听外部 keyword 变化
watch(() => props.keyword, (newVal) => {
  localKeyword.value = newVal
})

// 监听外部 page 变化
watch(() => props.page, (newPage) => {
  if (isSearchMode.value && newPage) {
    performSearch(newPage)
  }
})

// 监听 stockCode 变化，重置搜索状态
watch(() => props.stockCode, () => {
  localKeyword.value = ''
  searchResults.value = []
  searchTotal.value = 0
  emit('update:keyword', '')
  emit('pageChange', 1)
})
</script>

<template>
  <div class="notice-list-container">
    <!-- 标题栏 -->
    <div class="list-header">
      <div class="header-top">
        <h3 class="list-title">
          相关公告
          <span class="notice-count">({{ displayTotal }})</span>
        </h3>
        <!-- 分页控件（集成到标题栏） -->
        <div v-if="totalPages > 1 && !loading" class="pagination-inline">
          <button
            class="page-btn"
            :class="{ 'is-loading': isSearching }"
            :disabled="page === 1 || isSearching"
            @click="goToPage(page - 1)"
            title="上一页"
          >
            ‹
          </button>
          <span class="page-info">
            <template v-if="isSearching">...</template>
            <template v-else>{{ page }}/{{ totalPages }}</template>
          </span>
          <button
            class="page-btn"
            :class="{ 'is-loading': isSearching }"
            :disabled="page === totalPages || isSearching"
            @click="goToPage(page + 1)"
            title="下一页"
          >
            ›
          </button>
        </div>
      </div>
    </div>

    <!-- 搜索栏 -->
    <div class="search-bar">
      <div class="search-input-wrapper">
        <input
          v-model="localKeyword"
          type="text"
          placeholder="搜索公告标题..."
          class="search-input"
          @input="handleKeywordChange(($event.target as HTMLInputElement).value)"
        />
        <span class="search-icon" aria-hidden="true"></span>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading || isSearching" class="loading-state">
      <div class="loading-spinner"></div>
      <span>加载中...</span>
    </div>

    <!-- 公告列表（固定高度，独立滚动） -->
    <div
      v-else
      ref="listContainerRef"
      class="notice-list"
    >
      <div
        v-for="notice in displayNotices"
        :key="notice.id"
        class="notice-item"
        :class="{ active: notice.id === selectedId }"
        @click="selectNotice(notice)"
        @mouseenter="hoverNotice(notice)"
        @mouseleave="hoverNotice(null)"
      >
        <!-- 第一行：股票标识 + 公告标题 -->
        <div class="notice-header">
          <span class="notice-stock">{{ notice.stockCode }} {{ notice.stockName }}</span>
          <span class="notice-title-text" :title="notice.noticeTitle">{{ notice.noticeTitle }}</span>
        </div>
        
        <!-- 第二行：时间和日期信息 -->
        <div class="notice-meta">
          <span class="notice-datetime">{{ formatDateTime(notice.publishTime) }}</span>
          <span v-if="getNoticeTDate(notice)" class="notice-tdate">T日: {{ getNoticeTDate(notice) }}</span>
          <span 
            v-if="getPctT(notice) != null" 
            class="notice-pct" 
            :class="getPctTClass(getPctT(notice))"
          >T日涨幅 {{ formatPctT(getPctT(notice)) }}</span>
        </div>
        
        <!-- 第三行：受益方向标签 -->
        <div class="notice-tags">
          <span v-if="notice.beneficialDirection" class="notice-direction">{{ notice.beneficialDirection }}</span>
        </div>

        <!-- 第四行：异动指标 -->
        <div class="notice-indicators">
          <span class="indicator-label">异动:</span>
          <span class="indicator-item" :class="{ active: getAnomaly3d(notice) }">3日</span>
          <span class="indicator-item" :class="{ active: getVolAnomaly100d(notice) }">量100</span>
          <span class="indicator-item" :class="{ active: getVolAnomaly240d(notice) }">量240</span>
          <span class="indicator-item" :class="{ active: getYearHigh(notice) }">年高</span>
        </div>

        <!-- 第五行：多维评分 -->
        <div class="notice-scores">
          <span class="score-label">评分:</span>
          <span class="score-item">基{{ getScore(notice, 'scoreFundamental') }}</span>
          <span class="score-item">逻{{ getScore(notice, 'scoreNovelty') }}</span>
          <span class="score-item">商{{ getScore(notice, 'scoreBusiness') }}</span>
          <span class="score-item">弹{{ getScore(notice, 'scoreElasticity') }}</span>
          <span class="score-total" :class="getScoreTotalClass(notice)">{{ getScoreTotal(notice) }}</span>
        </div>

        <button
          type="button"
          class="notice-detail-btn floating-detail-btn"
          @click.stop="viewNoticeDetail(notice)"
        >
          查看详细
        </button>
      </div>

      <!-- 空状态 -->
      <div v-if="displayNotices.length === 0" class="empty-state">
        <span class="empty-icon" aria-hidden="true"></span>
        <span class="empty-text">
          {{ isSearchMode ? '未找到匹配的公告' : '暂无公告数据' }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.notice-list-container {
  background:
    linear-gradient(112deg, color-mix(in srgb, var(--accent-subtle) 42%, transparent) 0%, transparent 44%),
    linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 96%, transparent), var(--bg-card));
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-sm);
  height: 100%;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-sm);
}

.list-header {
  margin-bottom: var(--space-xs);
  padding-bottom: var(--space-xs);
  border-bottom: 1px solid var(--border);
}

.header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.list-title {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.notice-count {
  font-size: var(--text-xs);
  color: var(--text-muted);
  font-weight: 500;
}

.search-bar {
  margin-bottom: var(--space-xs);
}

.search-input-wrapper {
  position: relative;
}

.search-input {
  width: 100%;
  height: var(--control-h-sm);
  padding: 0 var(--space-sm) 0 1.95rem;
  font-size: var(--text-sm);
  color: var(--text-primary);
  background: color-mix(in srgb, var(--bg-elevated) 92%, transparent);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  outline: none;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.search-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-subtle) 65%, transparent);
}

.search-input::placeholder {
  color: var(--text-muted);
}

.search-icon {
  position: absolute;
  left: 0.65rem;
  top: 50%;
  width: 0.9rem;
  height: 0.9rem;
  border: 2px solid var(--text-muted);
  border-radius: 999px;
  transform: translateY(-50%);
  opacity: 0.75;
}

.search-icon::after {
  content: '';
  position: absolute;
  right: -0.26rem;
  bottom: -0.2rem;
  width: 0.38rem;
  height: 2px;
  border-radius: 2px;
  background: var(--text-muted);
  transform: rotate(45deg);
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-xl) 0;
  color: var(--text-muted);
  gap: var(--space-sm);
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* 公告列表 */
.notice-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  padding-right: var(--space-2xs);
}

/* 自定义滚动条样式 */
.notice-list::-webkit-scrollbar {
  width: 6px;
}

.notice-list::-webkit-scrollbar-track {
  background: var(--bg-elevated);
  border-radius: var(--radius-sm);
}

.notice-list::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: var(--radius-sm);
}

.notice-list::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}

.notice-item {
  position: relative;
  padding: var(--space-sm);
  background: color-mix(in srgb, var(--bg-elevated) 84%, transparent);
  border: 1px solid color-mix(in srgb, var(--border) 88%, transparent);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast) ease;
  display: flex;
  flex-direction: column;
  gap: var(--space-2xs);
}

.notice-item:hover {
  border-color: color-mix(in srgb, var(--accent) 34%, var(--border));
  background: color-mix(in srgb, var(--bg-hover) 72%, transparent);
}

.notice-item.active {
  border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
  background: color-mix(in srgb, var(--accent-subtle) 66%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 18%, transparent);
}

/* 第一行：股票标识 + 公告标题 */
.notice-header {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-height: 20px;
}

.notice-stock {
  flex-shrink: 0;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  min-width: 110px;
}

.notice-title-text {
  flex: 1;
  font-size: var(--text-sm);
  color: var(--text-primary);
  line-height: 1.4;
  padding-right: 88px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

/* 第二行：时间和日期信息 */
.notice-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  font-size: var(--text-xs);
  color: var(--text-muted);
  min-height: 18px;
}

.notice-datetime {
  flex-shrink: 0;
  white-space: nowrap;
}

.notice-tdate {
  flex-shrink: 0;
  white-space: nowrap;
}

.notice-pct {
  flex-shrink: 0;
  font-size: var(--text-xs);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.notice-pct.pct-up {
  color: var(--gain);
}

.notice-pct.pct-down {
  color: var(--loss);
}

.notice-detail-btn {
  position: absolute;
  top: var(--space-sm);
  right: var(--space-sm);
  min-height: 1.3rem;
  padding: 0 var(--space-sm);
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

/* 第三行：行业标签和市值 */
.notice-tags {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  min-height: 22px;
}

.notice-industry {
  font-size: var(--text-xs);
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  white-space: nowrap;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.notice-direction {
  font-size: var(--text-xs);
  color: var(--accent-bright);
  background: color-mix(in srgb, var(--accent-subtle) 62%, transparent);
  padding: 0.14rem 0.45rem;
  border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, var(--accent) 20%, transparent);
  white-space: nowrap;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.notice-metric {
  font-size: var(--text-xs);
  color: var(--text-muted);
  white-space: nowrap;
}

/* 第四行：异动指标 */
.notice-indicators {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 18px;
  font-size: var(--text-xs);
}

.indicator-label {
  color: var(--text-muted);
  flex-shrink: 0;
}

.indicator-item {
  padding: 0.08rem 0.38rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-subtle);
  background: color-mix(in srgb, var(--bg-card) 84%, transparent);
  color: var(--text-muted);
  transition: all 0.15s ease;
}

.indicator-item.active {
  background: color-mix(in srgb, var(--accent-subtle) 66%, transparent);
  border-color: color-mix(in srgb, var(--accent) 36%, transparent);
  color: var(--accent);
  font-weight: 500;
}

/* 第五行：多维评分 */
.notice-scores {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 18px;
  font-size: var(--text-xs);
}

.score-label {
  color: var(--text-muted);
  flex-shrink: 0;
}

.score-item {
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.score-total {
  padding: 0.08rem 0.36rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-subtle);
  background: color-mix(in srgb, var(--bg-card) 84%, transparent);
  color: var(--text-muted);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.score-total.score-high {
  background: color-mix(in srgb, var(--gain) 15%, transparent);
  color: var(--gain);
}

.score-total.score-mid {
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  color: var(--accent);
}

.score-total.score-low {
  background: var(--bg-elevated);
  color: var(--text-muted);
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-xl) 0;
  color: var(--text-muted);
  gap: var(--space-xs);
}

.empty-icon {
  width: 1.5rem;
  height: 1.5rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--bg-elevated) 88%, transparent);
  opacity: 0.72;
}

.empty-text {
  font-size: var(--text-sm);
}

/* 分页按钮 */
.page-btn {
  min-width: 32px;
  height: 32px;
  padding: 0 8px;
  font-size: var(--text-sm);
  color: var(--text-muted);
  background: color-mix(in srgb, var(--bg-elevated) 88%, transparent);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.page-btn:hover:not(:disabled) {
  color: var(--text-primary);
  border-color: var(--accent);
}

.page-btn.active {
  color: var(--text-on-accent);
  background: var(--gradient-accent);
  border-color: color-mix(in srgb, var(--accent) 80%, transparent);
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 内联分页控件 */
.pagination-inline {
  display: flex;
  align-items: center;
  gap: 6px;
}

.pagination-inline .page-btn {
  min-width: 28px;
  height: 28px;
  padding: 0 6px;
  font-size: 14px;
}

.pagination-inline .page-btn.is-loading {
  opacity: 0.6;
}

.page-info {
  font-size: var(--text-sm);
  color: var(--text-muted);
  min-width: 40px;
  text-align: center;
}

/* 响应式 */
@media (max-width: 768px) {
  .notice-list-container {
    padding: var(--space-sm);
  }

  .notice-title-text {
    -webkit-line-clamp: 3;
  }

  .header-top {
    flex-direction: column;
    align-items: flex-start;
  }

  .pagination-inline {
    width: 100%;
    justify-content: flex-start;
    margin-top: 8px;
  }

  .pagination-inline .page-btn {
    min-width: 32px;
    height: 32px;
  }

  .page-info {
    font-size: 13px;
  }

  .notice-title-text {
    padding-right: 72px;
  }
}

@media (hover: none) {
  .notice-item.active .notice-detail-btn {
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
    transform: none;
    transition-delay: 0s;
  }
}
</style>
