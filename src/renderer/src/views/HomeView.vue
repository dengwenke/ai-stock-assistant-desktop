<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useAnalysisStore } from '@/stores/analysis'
import type { SortRule } from '@/api/client'
import AnalysisTable from '@/components/AnalysisTable.vue'
import PaginationBar from '@/components/PaginationBar.vue'
import TradeCalendarDatePicker from '@/components/TradeCalendarDatePicker.vue'
import SmartFilter from '@/components/SmartFilter.vue'

const store = useAnalysisStore()

/** 默认排序：发布时间倒序 */
const DEFAULT_SORT_RULES: SortRule[] = [{ field: 'publishTime', order: 'desc' }]

/** 查询条件表单（与 store.filters 同步用于 v-model） */
const queryStockName = ref('')
const queryStockCode = ref('')
const queryStatus = ref('')
const queryIndustry = ref('')
const queryScoreMin = ref<number | ''>('')
const queryScoreMax = ref<number | ''>('')
const queryScoreFundamentalMin = ref<number | ''>('')
const queryScoreFundamentalMax = ref<number | ''>('')
const queryScoreNoveltyMin = ref<number | ''>('')
const queryScoreNoveltyMax = ref<number | ''>('')
const queryScoreBusinessMin = ref<number | ''>('')
const queryScoreBusinessMax = ref<number | ''>('')
const queryScoreElasticityMin = ref<number | ''>('')
const queryScoreElasticityMax = ref<number | ''>('')
const queryUserRatingMin = ref<number | ''>('')
const queryUserRatingMax = ref<number | ''>('')
/** T 日涨幅（%）范围，用于筛选有 T 日涨跌幅数据的记录 */
const queryPctTMin = ref<number | ''>('')
const queryPctTMax = ref<number | ''>('')
/** 市值（亿元）范围，用于筛选有市值标签的股票 */
const queryMarketCapMin = ref<number | ''>('')
const queryMarketCapMax = ref<number | ''>('')
/** 发布时间范围：使用交易日历选择日期，查询时补齐全天时间 */
const queryPublishTimeStart = ref('')
const queryPublishTimeEnd = ref('')

const doneCount = computed(() => store.list.filter((row) => row.status === 'DONE').length)
const processingCount = computed(() => store.list.filter((row) => row.status === 'PROCESSING').length)
const pendingCount = computed(() => store.list.filter((row) => row.status === 'PENDING').length)

function buildStartTime(value: string): string | undefined {
  const v = value.trim()
  return v ? `${v} 00:00:00` : undefined
}

function buildEndTime(value: string): string | undefined {
  const v = value.trim()
  return v ? `${v} 23:59:59` : undefined
}

function extractDate(value?: string): string {
  if (!value) return ''
  return value.split(' ')[0]
}

/** 应用当前表单为查询条件并拉取第 1 页 */
function doQuery() {
  store.setFilters({
    stockName: queryStockName.value.trim() || undefined,
    stockCode: queryStockCode.value.trim() || undefined,
    status: queryStatus.value || undefined,
    scoreMin: typeof queryScoreMin.value === 'number' ? queryScoreMin.value : undefined,
    scoreMax: typeof queryScoreMax.value === 'number' ? queryScoreMax.value : undefined,
    industry: queryIndustry.value.trim() || undefined,
    scoreFundamentalMin: typeof queryScoreFundamentalMin.value === 'number' ? queryScoreFundamentalMin.value : undefined,
    scoreFundamentalMax: typeof queryScoreFundamentalMax.value === 'number' ? queryScoreFundamentalMax.value : undefined,
    scoreNoveltyMin: typeof queryScoreNoveltyMin.value === 'number' ? queryScoreNoveltyMin.value : undefined,
    scoreNoveltyMax: typeof queryScoreNoveltyMax.value === 'number' ? queryScoreNoveltyMax.value : undefined,
    scoreBusinessMin: typeof queryScoreBusinessMin.value === 'number' ? queryScoreBusinessMin.value : undefined,
    scoreBusinessMax: typeof queryScoreBusinessMax.value === 'number' ? queryScoreBusinessMax.value : undefined,
    scoreElasticityMin: typeof queryScoreElasticityMin.value === 'number' ? queryScoreElasticityMin.value : undefined,
    scoreElasticityMax: typeof queryScoreElasticityMax.value === 'number' ? queryScoreElasticityMax.value : undefined,
    userRatingMin: typeof queryUserRatingMin.value === 'number' ? queryUserRatingMin.value : undefined,
    userRatingMax: typeof queryUserRatingMax.value === 'number' ? queryUserRatingMax.value : undefined,
    pctTMin: typeof queryPctTMin.value === 'number' ? queryPctTMin.value : undefined,
    pctTMax: typeof queryPctTMax.value === 'number' ? queryPctTMax.value : undefined,
    marketCapMin: typeof queryMarketCapMin.value === 'number' ? queryMarketCapMin.value : undefined,
    marketCapMax: typeof queryMarketCapMax.value === 'number' ? queryMarketCapMax.value : undefined,
    publishTimeStart: buildStartTime(queryPublishTimeStart.value),
    publishTimeEnd: buildEndTime(queryPublishTimeEnd.value),
    sortRules: store.filters.sortRules && store.filters.sortRules.length > 0 ? store.filters.sortRules : DEFAULT_SORT_RULES,
  })
  store.fetchList(1).catch(() => {})
}

/** 表头排序变更：更新 store 并重新拉取第 1 页 */
function onSortRulesChange(rules: SortRule[]) {
  store.setFilters({ ...store.filters, sortRules: rules })
  store.fetchList(1).catch(() => {})
}

/** 清空查询条件并拉取第 1 页 */
function resetQuery() {
  queryStockName.value = ''
  queryStockCode.value = ''
  queryStatus.value = ''
  queryIndustry.value = ''
  queryScoreMin.value = ''
  queryScoreMax.value = ''
  queryScoreFundamentalMin.value = ''
  queryScoreFundamentalMax.value = ''
  queryScoreNoveltyMin.value = ''
  queryScoreNoveltyMax.value = ''
  queryScoreBusinessMin.value = ''
  queryScoreBusinessMax.value = ''
  queryScoreElasticityMin.value = ''
  queryScoreElasticityMax.value = ''
  queryUserRatingMin.value = ''
  queryUserRatingMax.value = ''
  queryPctTMin.value = ''
  queryPctTMax.value = ''
  queryMarketCapMin.value = ''
  queryMarketCapMax.value = ''
  queryPublishTimeStart.value = ''
  queryPublishTimeEnd.value = ''
  store.setFilters({ sortRules: DEFAULT_SORT_RULES })
  store.fetchList(1).catch(() => {})
}

onMounted(() => {
  /* 从 store 恢复查询条件（从详情页返回时保留筛选、排序与页码） */
  queryStockName.value = store.filters.stockName ?? ''
  queryStockCode.value = store.filters.stockCode ?? ''
  queryStatus.value = store.filters.status ?? ''
  queryIndustry.value = store.filters.industry ?? ''
  queryScoreMin.value = store.filters.scoreMin ?? ''
  queryScoreMax.value = store.filters.scoreMax ?? ''
  queryScoreFundamentalMin.value = store.filters.scoreFundamentalMin ?? ''
  queryScoreFundamentalMax.value = store.filters.scoreFundamentalMax ?? ''
  queryScoreNoveltyMin.value = store.filters.scoreNoveltyMin ?? ''
  queryScoreNoveltyMax.value = store.filters.scoreNoveltyMax ?? ''
  queryScoreBusinessMin.value = store.filters.scoreBusinessMin ?? ''
  queryScoreBusinessMax.value = store.filters.scoreBusinessMax ?? ''
  queryScoreElasticityMin.value = store.filters.scoreElasticityMin ?? ''
  queryScoreElasticityMax.value = store.filters.scoreElasticityMax ?? ''
  queryUserRatingMin.value = store.filters.userRatingMin ?? ''
  queryUserRatingMax.value = store.filters.userRatingMax ?? ''
  queryPctTMin.value = store.filters.pctTMin ?? ''
  queryPctTMax.value = store.filters.pctTMax ?? ''
  queryMarketCapMin.value = store.filters.marketCapMin ?? ''
  queryMarketCapMax.value = store.filters.marketCapMax ?? ''
  queryPublishTimeStart.value = extractDate(store.filters.publishTimeStart)
  queryPublishTimeEnd.value = extractDate(store.filters.publishTimeEnd)
  /* 使用当前 store 的 page/filters 拉取列表（返回时保持原页码与条件） */
  store.fetchList().catch(() => {})
  store.startListRefresh()
})

onUnmounted(() => {
  store.stopListRefresh()
})

function goPage(p: number) {
  store.setPage(p)
  store.fetchList().catch(() => {})
}

function changePageSize(s: number) {
  store.setPageSize(s)
  store.setPage(1)
  store.fetchList().catch(() => {})
}

/** 主动刷新当前页列表 */
function refreshList() {
  store.fetchList().catch(() => {})
}

</script>

<template>
  <div class="home terminal-page web-page web-page--dense">
    <section class="view-intro">
      <div class="view-intro-main">
        <h2 class="view-intro-title">公告与热点机会池</h2>
        <p class="view-intro-desc">
          从公告、产业新闻与异动数据中做前置筛选，优先定位高质量交易线索。
        </p>
        <div class="view-intro-tags">
          <span class="intro-tag">公告驱动</span>
          <span class="intro-tag">事件热度</span>
          <span class="intro-tag">结构化评分</span>
        </div>
      </div>
      <div class="view-intro-metrics">
        <div class="intro-metric is-done">
          <span class="metric-label">已完成</span>
          <span class="metric-value">{{ doneCount }}</span>
        </div>
        <div class="intro-metric is-processing">
          <span class="metric-label">处理中</span>
          <span class="metric-value">{{ processingCount }}</span>
        </div>
        <div class="intro-metric is-pending">
          <span class="metric-label">待执行</span>
          <span class="metric-value">{{ pendingCount }}</span>
        </div>
      </div>
    </section>

    <!-- 查询工具栏 -->
    <header class="toolbar">
      <div class="toolbar-main">
        <input
          v-model="queryStockName"
          type="text"
          class="input"
          placeholder="证券简称"
          @keydown.enter="doQuery"
        />
        <input
          v-model="queryStockCode"
          type="text"
          class="input"
          placeholder="证券代码"
          @keydown.enter="doQuery"
        />
        <input
          v-model="queryIndustry"
          type="text"
          class="input"
          placeholder="行业"
          @keydown.enter="doQuery"
        />
        <select v-model="queryStatus" class="input select">
          <option value="">全部状态</option>
          <option value="PENDING">待执行</option>
          <option value="PROCESSING">处理中</option>
          <option value="DONE">已完成</option>
        </select>
        <SmartFilter
          :min-bound="0"
          :max-bound="40"
          :start="queryScoreMin"
          :end="queryScoreMax"
          placeholder="总分"
          type="score"
          :step="1"
          @update:start="queryScoreMin = $event ?? ''"
          @update:end="queryScoreMax = $event ?? ''"
        />
        <SmartFilter
          :min-bound="-30"
          :max-bound="999"
          :start="queryPctTMin"
          :end="queryPctTMax"
          placeholder="T日涨幅%"
          type="percent"
          @update:start="queryPctTMin = $event ?? ''"
          @update:end="queryPctTMax = $event ?? ''"
        />
        <SmartFilter
          :min-bound="0"
          :max-bound="10000"
          :start="queryMarketCapMin"
          :end="queryMarketCapMax"
          placeholder="市值(亿)"
          type="marketCap"
          @update:start="queryMarketCapMin = $event ?? ''"
          @update:end="queryMarketCapMax = $event ?? ''"
        />
        <TradeCalendarDatePicker
          :start="queryPublishTimeStart"
          :end="queryPublishTimeEnd"
          placeholder="发布时间"
          @update:start="queryPublishTimeStart = $event"
          @update:end="queryPublishTimeEnd = $event"
        />
      </div>
      
      <div class="toolbar-scores">
        <SmartFilter
          :min-bound="1"
          :max-bound="5"
          :start="queryScoreFundamentalMin"
          :end="queryScoreFundamentalMax"
          label="基本面"
          placeholder="1-5"
          type="score"
          :step="0.1"
          @update:start="queryScoreFundamentalMin = $event ?? ''"
          @update:end="queryScoreFundamentalMax = $event ?? ''"
        />
        <SmartFilter
          :min-bound="1"
          :max-bound="5"
          :start="queryScoreNoveltyMin"
          :end="queryScoreNoveltyMax"
          label="逻辑"
          placeholder="1-5"
          type="score"
          :step="0.1"
          @update:start="queryScoreNoveltyMin = $event ?? ''"
          @update:end="queryScoreNoveltyMax = $event ?? ''"
        />
        <SmartFilter
          :min-bound="1"
          :max-bound="5"
          :start="queryScoreBusinessMin"
          :end="queryScoreBusinessMax"
          label="商业"
          placeholder="1-5"
          type="score"
          :step="0.1"
          @update:start="queryScoreBusinessMin = $event ?? ''"
          @update:end="queryScoreBusinessMax = $event ?? ''"
        />
        <SmartFilter
          :min-bound="1"
          :max-bound="5"
          :start="queryScoreElasticityMin"
          :end="queryScoreElasticityMax"
          label="弹性"
          placeholder="1-5"
          type="score"
          :step="0.1"
          @update:start="queryScoreElasticityMin = $event ?? ''"
          @update:end="queryScoreElasticityMax = $event ?? ''"
        />
        <SmartFilter
          :min-bound="1"
          :max-bound="5"
          :start="queryUserRatingMin"
          :end="queryUserRatingMax"
          label="评分"
          placeholder="1-5"
          type="score"
          :step="0.1"
          @update:start="queryUserRatingMin = $event ?? ''"
          @update:end="queryUserRatingMax = $event ?? ''"
        />
      </div>
      
      <div class="toolbar-actions">
        <button type="button" class="btn btn-primary" @click="doQuery">查询</button>
        <button type="button" class="btn btn-secondary" @click="refreshList">刷新</button>
        <button type="button" class="btn btn-secondary" @click="resetQuery">重置</button>
      </div>
    </header>

    <!-- 数据表格 -->
    <div class="table-container">
      <div class="table-panel-header">
        <div>
          <div class="table-panel-title">公告分析</div>
          <div class="table-panel-subtitle">保持高信息密度，专注筛选与快速决策</div>
        </div>
        <div class="table-panel-kpis">
          <span class="table-panel-kpi">本页 {{ store.list.length }}</span>
        </div>
      </div>
      <AnalysisTable
        :list="store.list"
        :loading="store.loading"
        :sort-rules="store.filters.sortRules && store.filters.sortRules.length > 0 ? store.filters.sortRules : DEFAULT_SORT_RULES"
        @refresh="refreshList"
        @update:sort-rules="onSortRulesChange"
      />
      <PaginationBar
        v-if="store.total > 0"
        :total="store.total"
        :page="store.page"
        :page-size="store.pageSize"
        :total-pages="store.totalPages"
        :loading="store.loading"
        @update:page="goPage"
        @update:pageSize="changePageSize"
      />
    </div>
  </div>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  min-height: 0;
  overflow: auto;
}

.view-intro {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: stretch;
  gap: var(--space-md);
  padding: var(--space-md);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background:
    linear-gradient(110deg, color-mix(in srgb, var(--accent-subtle) 62%, transparent) 0%, transparent 48%),
    linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 96%, transparent), var(--bg-card));
  box-shadow: var(--shadow-xs);
}

.view-intro-main {
  min-width: 0;
}

.view-intro-title {
  font-size: var(--text-xl);
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--text-primary);
}

.view-intro-desc {
  margin-top: var(--space-2xs);
  font-size: var(--text-xs);
  line-height: 1.45;
  color: var(--text-secondary);
}

.view-intro-tags {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-xs);
  margin-top: var(--space-sm);
}

.intro-tag {
  display: inline-flex;
  align-items: center;
  min-height: 1.4rem;
  padding: 0 var(--space-sm);
  border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, var(--accent) 24%, transparent);
  background: color-mix(in srgb, var(--accent-subtle) 62%, transparent);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  font-weight: 600;
  white-space: nowrap;
}

.view-intro-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(88px, 1fr));
  gap: var(--space-xs);
}

.intro-metric {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.1rem;
  min-width: 0;
  padding: var(--space-xs) var(--space-sm);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--bg-elevated) 84%, transparent);
}

.metric-label {
  font-size: var(--text-2xs);
  color: var(--text-muted);
}

.metric-value {
  font-size: var(--text-base);
  font-family: var(--font-mono);
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.intro-metric.is-done .metric-value {
  color: var(--success);
}

.intro-metric.is-processing .metric-value {
  color: var(--accent);
}

.intro-metric.is-pending .metric-value {
  color: var(--warning);
}

.toolbar {
  padding: var(--space-md);
  background:
    linear-gradient(175deg, color-mix(in srgb, var(--bg-elevated) 88%, transparent) 0%, transparent 32%),
    var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  box-shadow: var(--shadow-xs);
}

.toolbar-main {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(138px, 1fr));
  align-items: center;
  gap: var(--space-xs);
}

.toolbar-main .input {
  width: 100%;
  height: var(--control-h);
  padding: 0 var(--space-sm);
  font-size: var(--text-sm);
}

.toolbar-main .select {
  width: 100%;
  height: var(--control-h);
  padding: 0 var(--space-sm);
  padding-right: 1.25rem;
  font-size: var(--text-sm);
}

.toolbar-scores {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(118px, 1fr));
  align-items: center;
  gap: var(--space-xs);
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  border-top: 1px solid color-mix(in srgb, var(--border) 90%, transparent);
  padding-top: var(--space-sm);
}

.table-container {
  flex: 1 1 auto;
  overflow: hidden;
  min-height: 0;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 95%, transparent) 0%, var(--bg-card) 100%);
  margin: 0;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: var(--control-h);
  padding: 0 var(--space-md);
  font-size: var(--text-sm);
  font-weight: 500;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
  white-space: nowrap;
  cursor: pointer;
}

.btn-primary {
  border: 1px solid transparent;
  background: var(--gradient-accent);
  color: var(--text-on-accent);
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-glow);
}

.btn-secondary {
  background: var(--bg-elevated);
  color: var(--text-secondary);
  border: 1px solid var(--border);
}

.btn-secondary:hover {
  background: var(--bg-card);
  border-color: color-mix(in srgb, var(--accent) 35%, var(--border));
  color: var(--text-primary);
}

.input {
  height: var(--control-h);
  padding: 0 var(--space-sm);
  font-size: var(--text-sm);
  color: var(--text-primary);
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  transition: border-color var(--transition-fast);
}

.input:hover:not(:focus) {
  border-color: var(--border-strong);
}

.input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-subtle) 65%, transparent);
}

.input::placeholder {
  color: var(--text-muted);
}

.select {
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'%3E%3Cpath fill='%2364748b' d='M5 7L1.5 3h7z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.375rem center;
  padding-right: 1.25rem;
}

@media (max-width: 1120px) {
  .view-intro {
    grid-template-columns: 1fr;
  }

  .view-intro-metrics {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .home {
    gap: var(--space-sm);
  }

  .view-intro {
    padding: var(--space-sm);
  }

  .view-intro-title {
    font-size: var(--text-lg);
  }

  .view-intro-metrics {
    grid-template-columns: 1fr;
  }

  .toolbar {
    padding: var(--space-sm);
  }

  .toolbar-main .input {
    min-width: 0;
  }
  
  .toolbar-actions {
    flex-wrap: wrap;
  }
}
</style>
