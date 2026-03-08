<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import dayjs from 'dayjs'
import { getEmaTracker } from '@/api/client'
import type { EmaTrackerItem } from '@/api/types'
import { useWorkspaceStore } from '@/stores/workspace'
import { storeToRefs } from 'pinia'

const router = useRouter()
const workspaceStore = useWorkspaceStore()
const { currentMarket, currentConfig } = storeToRefs(workspaceStore)

const loading = ref(false)
const list = ref<EmaTrackerItem[]>([])
const total = ref(0)
const page = ref(1)
const size = ref(50)
const pages = ref(0)
const lookbackDays = ref(7)
const tolerancePct = ref(2)
const updateTime = ref('-')

const hitCount = computed(() => list.value.length)
const avgDeviation = computed(() => {
  if (!list.value.length) return 0
  const sum = list.value.reduce((acc, item) => acc + Number(item.deviationPct ?? 0), 0)
  return sum / list.value.length
})

const visiblePages = computed(() => {
  const all: number[] = []
  const totalPages = pages.value || 1
  const current = page.value
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i += 1) all.push(i)
    return all
  }
  if (current <= 4) {
    return [1, 2, 3, 4, 5, -1, totalPages]
  }
  if (current >= totalPages - 3) {
    return [1, -1, totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
  }
  return [1, -1, current - 1, current, current + 1, -1, totalPages]
})

async function loadData() {
  loading.value = true
  try {
    const res = await getEmaTracker({
      market: currentMarket.value,
      lookbackDays: lookbackDays.value,
      tolerancePct: tolerancePct.value,
      page: page.value,
      size: size.value,
    })
    list.value = res.list ?? []
    total.value = res.total ?? 0
    pages.value = res.pages ?? Math.ceil((total.value || 0) / (size.value || 1))
    updateTime.value = dayjs().format('YYYY-MM-DD HH:mm:ss')
  } catch (e) {
    console.error('加载 EMA 指标追踪失败', e)
    list.value = []
    total.value = 0
    pages.value = 0
  } finally {
    loading.value = false
  }
}

function search() {
  page.value = 1
  loadData()
}

function toPage(p: number) {
  if (p < 1 || p > (pages.value || 1) || p === page.value) return
  page.value = p
  loadData()
}

function openStock(item: EmaTrackerItem) {
  router.push({
    name: 'stock-detail',
    params: { stockCode: item.stockCode },
    query: { mode: 'quote', market: currentMarket.value },
  })
}

function fmtPrice(value?: number) {
  if (value == null || Number.isNaN(value)) return '—'
  return Number(value).toFixed(3)
}

function fmtDeviation(value?: number) {
  if (value == null || Number.isNaN(value)) return '—'
  return `${Number(value).toFixed(3)}%`
}

watch(currentMarket, () => {
  page.value = 1
  loadData()
})

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="ema-tracker terminal-page web-page web-page--dense">
    <section class="result-section">
      <div class="result-card">
        <div class="table-panel-header tracker-header">
          <div class="tracker-head-main">
            <div class="table-panel-title">EMA指标追踪</div>
            <div class="table-panel-subtitle">筛选一周内回踩 EMA120 的趋势标的，优先关注低偏离高流动性个股</div>
            <div class="tracker-meta">市场：{{ currentConfig.label }} · 更新时间：{{ updateTime }}</div>
          </div>
          <div class="table-panel-kpis">
            <span class="table-panel-kpi">命中 {{ hitCount }}</span>
            <span class="table-panel-kpi">均偏离 {{ fmtDeviation(avgDeviation) }}</span>
            <span class="table-panel-kpi">总量 {{ total }}</span>
          </div>
        </div>

        <div class="query-bar">
          <div class="query-field">
            <label class="query-field-label">回看范围</label>
            <select v-model.number="lookbackDays" class="input-like">
              <option :value="5">5天</option>
              <option :value="7">7天</option>
              <option :value="10">10天</option>
              <option :value="14">14天</option>
            </select>
          </div>
          <div class="query-field">
            <label class="query-field-label">接近阈值</label>
            <div class="input-with-suffix">
              <input v-model.number="tolerancePct" class="input-like" type="number" min="0.1" max="10" step="0.1" />
              <span class="suffix">%</span>
            </div>
          </div>
          <button class="btn btn-primary" :disabled="loading" @click="search">
            {{ loading ? '查询中...' : '查询信号' }}
          </button>
          <div class="query-meta">
            <div class="stat-pill">容差 {{ Number(tolerancePct).toFixed(1) }}%</div>
          </div>
        </div>

        <div class="table-wrap" v-adaptive-height>
          <table class="tracker-table">
            <thead>
              <tr>
                <th>股票</th>
                <th>市场</th>
                <th>触发日期</th>
                <th>收盘价</th>
                <th>M120</th>
                <th>偏离度</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td colspan="6" class="empty">正在计算 EMA120，请稍候...</td>
              </tr>
              <tr v-else-if="!list.length">
                <td colspan="6" class="empty">暂无满足条件的标的</td>
              </tr>
              <tr v-for="item in list" :key="`${item.stockCode}-${item.tradeDate}`" class="row-clickable" @click="openStock(item)">
                <td>
                  <div class="stock-main">{{ item.stockCode }}</div>
                  <div class="stock-sub">{{ item.stockName || '--' }}</div>
                </td>
                <td>{{ item.market }}</td>
                <td>{{ item.tradeDate }}</td>
                <td>{{ fmtPrice(item.closePrice) }}</td>
                <td>{{ fmtPrice(item.ema120) }}</td>
                <td class="deviation">{{ fmtDeviation(item.deviationPct) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="pager" v-if="pages > 1">
          <button class="pager-btn" :disabled="page <= 1" @click="toPage(page - 1)">上一页</button>
          <button
            v-for="p in visiblePages"
            :key="`p-${p}`"
            class="pager-btn"
            :class="{ active: p === page, dot: p === -1 }"
            :disabled="p === -1"
            @click="toPage(p)"
          >
            {{ p === -1 ? '...' : p }}
          </button>
          <button class="pager-btn" :disabled="page >= pages" @click="toPage(page + 1)">下一页</button>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.ema-tracker {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding: var(--space-md);
  max-width: var(--layout-content-max);
  margin: 0 auto;
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
  background: linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 96%, transparent) 0%, var(--bg-card) 100%);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.tracker-header {
  align-items: flex-start;
}

.tracker-head-main {
  min-width: 0;
}

.tracker-meta {
  margin-top: var(--space-2xs);
  color: var(--text-secondary);
  font-size: var(--text-xs);
}

.query-meta {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  margin-left: auto;
}

.query-bar {
  display: flex;
  align-items: flex-end;
  gap: var(--space-sm);
  flex-wrap: wrap;
  padding: var(--space-md);
  border-bottom: 1px solid var(--border);
  background:
    linear-gradient(112deg, color-mix(in srgb, var(--accent-subtle) 48%, transparent) 0%, transparent 40%),
    color-mix(in srgb, var(--bg-elevated) 95%, transparent);
}

.query-field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  min-width: 0;
}

.query-field-label {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text-muted);
}

.input-like {
  min-width: 6rem;
  height: var(--control-h-sm);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--bg-card) 92%, var(--bg-elevated));
  color: var(--text-primary);
  padding: 0 0.55rem;
  font-size: var(--text-sm);
  font-variant-numeric: tabular-nums;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.input-like:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-subtle) 64%, transparent);
}

.input-with-suffix {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
}

.suffix {
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.btn {
  height: var(--control-h-sm);
  min-width: 5rem;
  padding: 0 0.95rem;
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
  transition: transform var(--transition-fast), box-shadow var(--transition-fast), filter var(--transition-fast);
}

.btn-primary {
  background: var(--gradient-accent);
  color: var(--text-on-accent);
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: var(--shadow-glow);
  filter: saturate(1.06);
}

.btn-primary:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.stat-pill {
  min-height: 1.55rem;
  padding: 0 var(--space-sm);
  border: 1px solid color-mix(in srgb, var(--accent) 24%, transparent);
  border-radius: var(--radius-full);
  display: inline-flex;
  align-items: center;
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text-secondary);
  background: color-mix(in srgb, var(--accent-subtle) 58%, transparent);
  font-variant-numeric: tabular-nums;
}

.table-wrap {
  --adaptive-height-min: var(--layout-table-min-height);
  --adaptive-height-bottom: var(--layout-table-bottom-reserve-compact);

  overflow: auto;
  background: color-mix(in srgb, var(--bg-surface) 92%, transparent);
}

.tracker-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  min-width: 740px;
}

.tracker-table th,
.tracker-table td {
  border-bottom: 1px solid var(--border);
  padding: var(--space-sm) var(--space-md);
  text-align: left;
  font-size: var(--text-sm);
  font-variant-numeric: tabular-nums;
}

.tracker-table th {
  position: sticky;
  top: 0;
  z-index: 2;
  background: color-mix(in srgb, var(--bg-elevated) 92%, transparent);
  color: var(--text-secondary);
  font-weight: 600;
  letter-spacing: 0.01em;
}

.stock-main {
  font-weight: 600;
  color: var(--text-primary);
}

.stock-sub {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.deviation {
  color: var(--secondary);
  font-weight: 600;
}

.row-clickable {
  cursor: pointer;
}

.row-clickable:hover {
  background: color-mix(in srgb, var(--accent-subtle) 52%, transparent);
}

.empty {
  text-align: center;
  color: var(--text-muted);
  padding: var(--space-xl) 0;
}

.pager {
  border-top: 1px solid var(--border);
  padding: var(--space-sm) var(--space-md);
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  flex-wrap: wrap;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--bg-elevated) 75%, transparent) 0%, var(--bg-card) 100%);
}

.pager-btn {
  min-width: 1.85rem;
  height: var(--control-h-sm);
  padding: 0 0.55rem;
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--bg-card) 88%, var(--bg-elevated));
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.pager-btn:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
}

.pager-btn.active {
  border-color: color-mix(in srgb, var(--accent) 80%, transparent);
  background: var(--gradient-accent);
  color: var(--text-on-accent);
}

.pager-btn.dot {
  cursor: default;
}

@media (max-width: 900px) {
  .query-meta {
    margin-left: 0;
  }
}

@media (max-width: 768px) {
  .ema-tracker {
    padding: var(--space-sm);
  }

  .query-bar {
    padding: var(--space-sm);
  }

  .query-field {
    width: 100%;
  }

  .input-like {
    width: 100%;
  }

  .query-meta {
    width: 100%;
    justify-content: flex-end;
  }

  .table-panel-kpis {
    display: none;
  }
}
</style>
