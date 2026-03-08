<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import Breadcrumb from '@/components/Breadcrumb.vue'
import { getTradeCalendar } from '@/api/client'
import type { TradeCalendarItem } from '@/api/types'
import { useWorkspaceStore, MARKETS } from '@/stores/workspace'
import { storeToRefs } from 'pinia'

const workspaceStore = useWorkspaceStore()
const { currentMarket } = storeToRefs(workspaceStore)

const loading = ref(false)
const calendarData = ref<TradeCalendarItem[]>([])
const currentYear = ref<number>(new Date().getFullYear())
const currentMonth = ref<number>(new Date().getMonth())

const breadcrumbItems = [
  { text: '首页', to: '/' },
  { text: '交易日历' },
]

const WEEK_DAYS = ['日', '一', '二', '三', '四', '五', '六']

const currentMonthName = computed(() => {
  const date = new Date(currentYear.value, currentMonth.value, 1)
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' })
})

const currentMarketLabel = computed(() => {
  const market = MARKETS.find((m) => m.key === currentMarket.value)
  return market?.label ?? currentMarket.value
})

const calendarMap = computed(() => {
  const map = new Map<string, TradeCalendarItem>()
  calendarData.value.forEach(item => {
    map.set(item.calDate, item)
  })
  return map
})

function getCalendarDays() {
  const year = currentYear.value
  const month = currentMonth.value
  
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const daysInMonth = lastDay.getDate()
  const firstDayOfWeek = firstDay.getDay()
  
  const days: Array<{
    date: string
    day: number
    isCurrentMonth: boolean
    data?: TradeCalendarItem
  }> = []
  
  const prevMonthLastDay = new Date(year, month, 0).getDate()
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const day = prevMonthLastDay - i
    const date = new Date(year, month - 1, day)
    days.push({
      date: formatDate(date),
      day,
      isCurrentMonth: false,
    })
  }
  
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day)
    const dateStr = formatDate(date)
    days.push({
      date: dateStr,
      day,
      isCurrentMonth: true,
      data: calendarMap.value.get(dateStr),
    })
  }
  
  const remainingDays = 42 - days.length
  for (let day = 1; day <= remainingDays; day++) {
    const date = new Date(year, month + 1, day)
    days.push({
      date: formatDate(date),
      day,
      isCurrentMonth: false,
    })
  }
  
  return days
}

function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function isToday(dateStr: string): boolean {
  const today = new Date()
  const d = new Date(dateStr)
  return d.toDateString() === today.toDateString()
}

function isWeekend(dateStr: string): boolean {
  const d = new Date(dateStr)
  const day = d.getDay()
  return day === 0 || day === 6
}

function prevMonth() {
  if (currentMonth.value === 0) {
    currentMonth.value = 11
    currentYear.value--
  } else {
    currentMonth.value--
  }
  loadCalendar()
}

function nextMonth() {
  if (currentMonth.value === 11) {
    currentMonth.value = 0
    currentYear.value++
  } else {
    currentMonth.value++
  }
  loadCalendar()
}

function goToToday() {
  const today = new Date()
  currentYear.value = today.getFullYear()
  currentMonth.value = today.getMonth()
  loadCalendar()
}

async function loadCalendar() {
  const year = currentYear.value
  const month = currentMonth.value
  
  const startDate = formatDate(new Date(year, month, 1))
  const endDate = formatDate(new Date(year, month + 1, 0))
  
  loading.value = true
  try {
    const data = await getTradeCalendar(currentMarket.value, startDate, endDate)
    calendarData.value = data || []
  } finally {
    loading.value = false
  }
}

const stats = computed(() => {
  const currentMonthDays = getCalendarDays().filter(d => d.isCurrentMonth && d.data)
  const tradingDays = currentMonthDays.filter(d => d.data?.isOpen === 1).length
  const closedDays = currentMonthDays.filter(d => d.data?.isOpen === 0).length
  return { tradingDays, closedDays }
})

onMounted(() => {
  loadCalendar()
})

watch(currentMarket, () => {
  loadCalendar()
})
</script>

<template>
  <div class="trade-calendar-page terminal-page web-page">
    <Breadcrumb :items="breadcrumbItems" />
    
    <div class="page-header">
      <div class="page-header-main">
        <h1 class="page-title">交易日历查询</h1>
        <p class="page-subtitle">查询 A股、港股、美股 的交易日与休市分布</p>
      </div>
      <div class="page-header-kpis">
        <span class="header-kpi">市场 {{ currentMarketLabel }}</span>
        <span class="header-kpi">{{ currentMonthName }}</span>
      </div>
    </div>

    <div class="filter-card">
      <div class="filter-row">
        <div class="filter-item">
          <label class="filter-label">市场</label>
          <div class="market-tabs">
            <button
              v-for="m in MARKETS"
              :key="m.key"
              type="button"
              class="market-tab"
              :class="{ active: currentMarket === m.key }"
              @click="workspaceStore.setMarket(m.key)"
            >
              {{ m.label }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="calendar-card">
      <div class="table-panel-header calendar-panel-head">
        <div>
          <div class="table-panel-title">交易日历</div>
          <div class="table-panel-subtitle">按月查看开市/休市结构，辅助交易节奏规划</div>
        </div>
        <div class="table-panel-kpis" v-if="!loading && calendarData.length">
          <span class="table-panel-kpi">交易日 {{ stats.tradingDays }}</span>
          <span class="table-panel-kpi">休市日 {{ stats.closedDays }}</span>
        </div>
      </div>
      <div class="calendar-header">
        <div class="calendar-nav">
          <button type="button" class="nav-btn" @click="prevMonth">
            <span class="nav-icon">‹</span>
          </button>
          <div class="month-title">
            {{ currentMonthName }}
          </div>
          <button type="button" class="nav-btn" @click="nextMonth">
            <span class="nav-icon">›</span>
          </button>
        </div>
        <div class="calendar-actions">
          <button type="button" class="today-btn" @click="goToToday">
            今天
          </button>
        </div>
      </div>

      <div v-if="loading" class="loading-state">
        <span class="loading-text">加载中…</span>
      </div>

      <div v-else class="calendar-grid">
        <div class="week-header">
          <div
            v-for="(day, idx) in WEEK_DAYS"
            :key="idx"
            class="week-day"
            :class="{ 'is-weekend': idx === 0 || idx === 6 }"
          >
            {{ day }}
          </div>
        </div>
        <div class="days-grid">
          <div
            v-for="(day, idx) in getCalendarDays()"
            :key="day.date + '-' + idx"
            class="calendar-day"
            :class="{
              'is-other-month': !day.isCurrentMonth,
              'is-open': day.data?.isOpen === 1,
              'is-closed': day.data?.isOpen === 0,
              'is-today': isToday(day.date),
              'is-holiday': !!day.data?.holidayName,
              'is-weekend': isWeekend(day.date),
            }"
          >
            <div class="day-number">{{ day.day }}</div>
            <div v-if="day.data" class="day-info">
              <span v-if="day.data.isOpen === 1" class="status-badge is-open">
                交易
              </span>
              <span v-else-if="day.data.isOpen === 0" class="status-badge is-closed">
                休市
              </span>
            </div>
            <div v-if="day.data?.holidayName" class="day-holiday">
              {{ day.data.holidayName }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="legend-card">
      <div class="legend-title">图例说明</div>
      <div class="legend-items">
        <div class="legend-item">
          <span class="legend-dot is-open"></span>
          <span class="legend-text">交易日</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot is-closed"></span>
          <span class="legend-text">休市日</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot is-holiday"></span>
          <span class="legend-text">节假日</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot is-today"></span>
          <span class="legend-text">今天</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.trade-calendar-page {
  max-width: var(--layout-content-max);
  margin: 0 auto;
  padding: var(--space-md);
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  box-sizing: border-box;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background:
    linear-gradient(112deg, color-mix(in srgb, var(--accent-subtle) 46%, transparent) 0%, transparent 42%),
    color-mix(in srgb, var(--bg-card) 96%, transparent);
  flex-shrink: 0;
}

.page-header-main {
  min-width: 0;
}

.page-title {
  margin: 0 0 2px;
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}

.page-subtitle {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.page-header-kpis {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  flex-wrap: wrap;
  margin-left: auto;
}

.header-kpi {
  display: inline-flex;
  align-items: center;
  min-height: 1.45rem;
  padding: 0 var(--space-sm);
  border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, var(--accent) 24%, transparent);
  background: color-mix(in srgb, var(--accent-subtle) 58%, transparent);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  font-weight: 600;
  white-space: nowrap;
}

.filter-card {
  background:
    linear-gradient(112deg, color-mix(in srgb, var(--accent-subtle) 44%, transparent) 0%, transparent 44%),
    linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 96%, transparent), var(--bg-card));
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-sm) var(--space-md);
  box-shadow: var(--shadow-sm);
  flex-shrink: 0;
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  align-items: flex-end;
}

.filter-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.filter-label {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text-secondary);
  letter-spacing: 0.02em;
}

.market-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  background: color-mix(in srgb, var(--bg-elevated) 88%, transparent);
  padding: 3px;
  border-radius: 8px;
  border: 1px solid var(--border-subtle);
}

.market-tab {
  min-height: var(--control-h-sm);
  padding: 0 20px;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-muted);
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.market-tab:hover {
  color: var(--text-primary);
  background: color-mix(in srgb, var(--bg-card) 50%, transparent);
}

.market-tab.active {
  color: var(--text-on-accent);
  background: var(--gradient-accent);
  box-shadow: var(--shadow-glow);
}

.calendar-card {
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 96%, transparent) 0%, var(--bg-card) 100%);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 0;
  box-shadow: var(--shadow-sm);
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.calendar-panel-head {
  border-bottom: 1px solid var(--border);
}

.calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-sm) var(--space-md);
  margin-bottom: 0;
  border-bottom: 1px solid var(--border-subtle);
  flex-wrap: wrap;
  gap: var(--space-sm);
  flex-shrink: 0;
  background: color-mix(in srgb, var(--bg-elevated) 92%, transparent);
}

.calendar-nav {
  display: flex;
  align-items: center;
  gap: 12px;
}

.nav-btn {
  width: var(--control-h-sm);
  height: var(--control-h-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 17px;
  font-weight: 600;
  color: var(--text-secondary);
  background: color-mix(in srgb, var(--bg-elevated) 88%, transparent);
  border: 1px solid var(--border);
  border-radius: 8px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.nav-btn:hover {
  color: var(--text-primary);
  background: var(--bg-card);
  border-color: var(--text-muted);
}

.nav-icon {
  line-height: 1;
}

.month-title {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--text-primary);
  min-width: 130px;
  text-align: center;
}

.calendar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.today-btn {
  min-height: var(--control-h-sm);
  padding: 0 var(--space-md);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-secondary);
  background: color-mix(in srgb, var(--accent-subtle) 58%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 28%, transparent);
  border-radius: var(--radius-full);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.today-btn:hover {
  color: var(--accent);
  border-color: color-mix(in srgb, var(--accent) 44%, transparent);
  background: color-mix(in srgb, var(--accent-subtle) 70%, transparent);
}

.loading-state {
  padding: 60px 20px;
  text-align: center;
}

.loading-text {
  font-size: var(--text-sm);
  color: var(--text-muted);
}

.calendar-grid {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  padding: var(--space-sm);
}

.week-header {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
  margin-bottom: 6px;
  flex-shrink: 0;
}

.week-day {
  padding: 8px 4px;
  text-align: center;
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text-secondary);
  letter-spacing: 0.02em;
}

.week-day.is-weekend {
  color: var(--text-muted);
}

.days-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
  flex: 1;
  min-height: 0;
}

.calendar-day {
  min-height: 0;
  height: 100%;
  padding: 8px;
  background: color-mix(in srgb, var(--bg-elevated) 88%, transparent);
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--border) 86%, transparent);
  transition: all var(--transition-fast);
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow: hidden;
}

.calendar-day:hover {
  border-color: color-mix(in srgb, var(--accent) 30%, var(--border));
  background: color-mix(in srgb, var(--bg-hover) 70%, transparent);
}

.calendar-day.is-other-month {
  opacity: 0.35;
  pointer-events: none;
}

.calendar-day.is-today {
  border-color: color-mix(in srgb, var(--accent) 44%, transparent);
  background: color-mix(in srgb, var(--accent-subtle) 72%, var(--bg-elevated));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 22%, transparent);
}

.calendar-day.is-open {
  border-left: 2px solid var(--gain);
  background: color-mix(in srgb, var(--gain) 8%, var(--bg-elevated));
}

.calendar-day.is-closed {
  border-left: 2px solid var(--loss);
  background: color-mix(in srgb, var(--loss) 8%, var(--bg-elevated));
}

.calendar-day.is-holiday {
  background: color-mix(in srgb, var(--loss) 10%, var(--bg-elevated));
}

.calendar-day.is-open.is-today {
  background: color-mix(in srgb, var(--accent) 8%, color-mix(in srgb, var(--gain) 8%, var(--bg-elevated)));
}

.calendar-day.is-closed.is-today {
  background: color-mix(in srgb, var(--accent) 8%, color-mix(in srgb, var(--loss) 8%, var(--bg-elevated)));
}

.day-number {
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

.day-info {
  flex: 1;
  min-height: 0;
}

.status-badge {
  display: inline-block;
  padding: 2px 6px;
  font-size: 10px;
  font-weight: 600;
  border-radius: 4px;
}

.status-badge.is-open {
  color: var(--gain);
  background: color-mix(in srgb, var(--gain) 15%, transparent);
  border: 1px solid color-mix(in srgb, var(--gain) 30%, transparent);
}

.status-badge.is-closed {
  color: var(--loss);
  background: color-mix(in srgb, var(--loss) 15%, transparent);
  border: 1px solid color-mix(in srgb, var(--loss) 30%, transparent);
}

.day-holiday {
  font-size: 10px;
  color: var(--text-secondary);
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.legend-card {
  background:
    linear-gradient(112deg, color-mix(in srgb, var(--accent-subtle) 40%, transparent) 0%, transparent 46%),
    linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 96%, transparent), var(--bg-card));
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-sm) var(--space-md);
  box-shadow: var(--shadow-sm);
  flex-shrink: 0;
}

.legend-title {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.legend-items {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 1px solid color-mix(in srgb, currentColor 30%, transparent);
}

.legend-dot.is-open {
  background: var(--gain);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--gain) 20%, transparent);
}

.legend-dot.is-closed {
  background: var(--loss);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--loss) 20%, transparent);
}

.legend-dot.is-holiday {
  background: var(--loss);
  opacity: 0.7;
}

.legend-dot.is-today {
  background: var(--accent);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 20%, transparent);
}

.legend-text {
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

@media (max-width: 1200px) {
  .trade-calendar-page {
    padding: var(--space-sm);
  }

  .calendar-day {
    padding: 6px 8px;
  }

  .day-number {
    font-size: var(--text-xs);
  }
}

@media (max-width: 960px) {
  .trade-calendar-page {
    padding: var(--space-sm);
  }

  .filter-row {
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
  }

  .market-tabs {
    width: 100%;
  }

  .market-tab {
    flex: 1;
    text-align: center;
  }

  .calendar-header {
    flex-direction: column;
    align-items: stretch;
  }

  .calendar-nav {
    width: 100%;
    justify-content: space-between;
  }

  .month-title {
    min-width: auto;
  }

  .calendar-actions {
    width: 100%;
    justify-content: center;
  }

  .calendar-day {
    padding: 6px;
  }

  .day-number {
    font-size: var(--text-xs);
  }
}

@media (max-width: 640px) {
  .trade-calendar-page {
    padding: var(--space-sm);
  }

  .page-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .page-header-kpis {
    margin-left: 0;
  }

  .calendar-day {
    padding: 4px;
  }

  .day-number {
    font-size: var(--text-2xs);
  }

  .status-badge {
    font-size: 9px;
    padding: 1px 4px;
  }

  .day-holiday {
    display: none;
  }

  .legend-items {
    gap: 12px;
  }
}
</style>
