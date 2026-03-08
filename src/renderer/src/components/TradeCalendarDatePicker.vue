<script setup lang="ts">
/**
 * 交易日历日期选择器
 * 支持显示交易日/休市日状态，使用对应市场的交易日历数据
 */
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import dayjs from 'dayjs'
import { getTradeCalendar } from '@/api/client'
import type { TradeCalendarItem } from '@/api/types'
import { useWorkspaceStore } from '@/stores/workspace'
import { storeToRefs } from 'pinia'

const props = withDefaults(
  defineProps<{
    /** 开始日期，格式 yyyy-MM-dd */
    start?: string
    /** 结束日期，同上 */
    end?: string
    placeholder?: string
  }>(),
  { placeholder: '选择日期范围' }
)

const emit = defineEmits<{
  (e: 'update:start', value: string): void
  (e: 'update:end', value: string): void
}>()

const workspaceStore = useWorkspaceStore()
const { currentMarket, currentConfig } = storeToRefs(workspaceStore)

const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)
const loading = ref(false)

// 交易日历数据缓存
const calendarCache = ref<Map<string, TradeCalendarItem>>(new Map())

// 当前显示的月份（左面板）
const leftMonth = ref(dayjs().startOf('month'))
// 右面板显示左面板的下一个月
const rightMonth = computed(() => leftMonth.value.add(1, 'month'))

// 选中的日期范围
const selectedStart = ref<dayjs.Dayjs | null>(null)
const selectedEnd = ref<dayjs.Dayjs | null>(null)

// 快捷选项
const shortcuts = [
  { label: '今日', getRange: () => getDayRange(0) },
  { label: '明日', getRange: () => getDayRange(1) },
  { label: '近1周', getRange: () => getRecentRange(7, 'day') },
  { label: '近1月', getRange: () => getRecentRange(1, 'month') },
  { label: '近3月', getRange: () => getRecentRange(3, 'month') },
  { label: '近6月', getRange: () => getRecentRange(6, 'month') },
  { label: '近1年', getRange: () => getRecentRange(1, 'year') },
]

function getDayRange(offset: number) {
  const date = dayjs().add(offset, 'day').startOf('day')
  return { start: date, end: date }
}

function getRecentRange(amount: number, unit: 'day' | 'month' | 'year') {
  const end = dayjs().startOf('day')
  const start = dayjs().subtract(amount, unit).startOf('day')
  return { start, end }
}

// 从 props 初始化选中值
watch(
  () => [props.start, props.end],
  () => {
    if (props.start) {
      selectedStart.value = dayjs(props.start)
      leftMonth.value = selectedStart.value.startOf('month')
    } else {
      selectedStart.value = null
    }
    if (props.end) {
      selectedEnd.value = dayjs(props.end)
    } else {
      selectedEnd.value = null
    }
  },
  { immediate: true }
)

// 监听市场变化，重新加载日历数据
watch(currentMarket, () => {
  calendarCache.value.clear()
  if (open.value) {
    loadCalendarData()
  }
})

// 监听月份变化，加载日历数据
watch([leftMonth, open], () => {
  if (open.value) {
    loadCalendarData()
  }
})

// 加载交易日历数据
async function loadCalendarData() {
  const startMonth = leftMonth.value.subtract(1, 'month')
  const endMonth = leftMonth.value.add(2, 'month')
  const startDate = startMonth.startOf('month').format('YYYY-MM-DD')
  const endDate = endMonth.endOf('month').format('YYYY-MM-DD')
  
  loading.value = true
  try {
    const data = await getTradeCalendar(currentMarket.value, startDate, endDate)
    data.forEach(item => {
      calendarCache.value.set(item.calDate, item)
    })
  } catch (error) {
    console.error('加载交易日历失败:', error)
  } finally {
    loading.value = false
  }
}

// 获取日期的交易日历信息
function getCalendarInfo(date: dayjs.Dayjs): TradeCalendarItem | undefined {
  return calendarCache.value.get(date.format('YYYY-MM-DD'))
}

// 判断是否为交易日
function isTradingDay(date: dayjs.Dayjs): boolean {
  const info = getCalendarInfo(date)
  return info?.isOpen === 1
}

// 判断是否为休市日
function isClosedDay(date: dayjs.Dayjs): boolean {
  const info = getCalendarInfo(date)
  return info?.isOpen === 0
}

// 获取假日名称
function getHolidayName(date: dayjs.Dayjs): string | undefined {
  const info = getCalendarInfo(date)
  return info?.holidayName
}

// 生成日历数据
function generateCalendar(month: dayjs.Dayjs) {
  const startOfMonth = month.startOf('month')
  const daysInMonth = month.daysInMonth()
  const startDay = startOfMonth.day() // 0 = Sunday
  
  const days: { date: dayjs.Dayjs; isCurrentMonth: boolean }[] = []
  
  // 上个月的日期
  const prevMonthDays = startDay === 0 ? 6 : startDay - 1 // 调整为周一开始
  for (let i = prevMonthDays - 1; i >= 0; i--) {
    days.push({
      date: startOfMonth.subtract(i + 1, 'day'),
      isCurrentMonth: false
    })
  }
  
  // 当前月的日期
  for (let i = 1; i <= daysInMonth; i++) {
    days.push({
      date: startOfMonth.add(i - 1, 'day'),
      isCurrentMonth: true
    })
  }
  
  // 下个月的日期（补齐到 42 个格子 = 6行 x 7列）
  const remaining = 42 - days.length
  for (let i = 1; i <= remaining; i++) {
    days.push({
      date: month.endOf('month').add(i, 'day'),
      isCurrentMonth: false
    })
  }
  
  return days
}

const leftCalendar = computed(() => generateCalendar(leftMonth.value))
const rightCalendar = computed(() => generateCalendar(rightMonth.value))

// 判断日期是否被选中
function isSelected(date: dayjs.Dayjs) {
  if (!selectedStart.value && !selectedEnd.value) return false
  if (selectedStart.value && date.isSame(selectedStart.value, 'day')) return true
  if (selectedEnd.value && date.isSame(selectedEnd.value, 'day')) return true
  return false
}

// 判断日期是否在范围内
function isInRange(date: dayjs.Dayjs) {
  if (!selectedStart.value || !selectedEnd.value) return false
  return date.isAfter(selectedStart.value, 'day') && date.isBefore(selectedEnd.value, 'day')
}

// 判断是否是今天
function isToday(date: dayjs.Dayjs) {
  return date.isSame(dayjs(), 'day')
}

// 判断是否是周末
function isWeekend(date: dayjs.Dayjs) {
  const day = date.day()
  return day === 0 || day === 6
}

// 点击日期
function onDateClick(date: dayjs.Dayjs) {
  if (!selectedStart.value || (selectedStart.value && selectedEnd.value)) {
    // 开始新的选择
    selectedStart.value = date.startOf('day')
    selectedEnd.value = null
  } else {
    // 完成选择
    if (date.isBefore(selectedStart.value, 'day')) {
      selectedEnd.value = selectedStart.value
      selectedStart.value = date.startOf('day')
    } else {
      selectedEnd.value = date
    }
    apply()
  }
}

// 应用选择
function apply() {
  if (selectedStart.value) {
    emit('update:start', selectedStart.value.format('YYYY-MM-DD'))
  } else {
    emit('update:start', '')
  }
  if (selectedEnd.value) {
    emit('update:end', selectedEnd.value.format('YYYY-MM-DD'))
  } else {
    emit('update:end', '')
  }
  open.value = false
}

// 清空选择
function clearRange() {
  selectedStart.value = null
  selectedEnd.value = null
  emit('update:start', '')
  emit('update:end', '')
  open.value = false
}

// 选择快捷选项
function selectShortcut(shortcut: typeof shortcuts[0]) {
  const range = shortcut.getRange()
  selectedStart.value = range.start
  selectedEnd.value = range.end
  leftMonth.value = range.start.startOf('month')
  apply()
}

// 月份导航
function prevMonth() {
  leftMonth.value = leftMonth.value.subtract(1, 'month')
}

function nextMonth() {
  leftMonth.value = leftMonth.value.add(1, 'month')
}

function prevYear() {
  leftMonth.value = leftMonth.value.subtract(1, 'year')
}

function nextYear() {
  leftMonth.value = leftMonth.value.add(1, 'year')
}

// 显示文本
function displayText(): string {
  if (selectedStart.value && selectedEnd.value) {
    return `${selectedStart.value.format('MM-DD')} 至 ${selectedEnd.value.format('MM-DD')}`
  }
  if (selectedStart.value) {
    return `${selectedStart.value.format('MM-DD')} 开始`
  }
  return props.placeholder
}

// 点击外部关闭
function onDocumentClick(e: MouseEvent) {
  if (rootRef.value && !rootRef.value.contains(e.target as Node)) {
    open.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
})
onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick)
})

const weekDays = ['一', '二', '三', '四', '五', '六', '日']
</script>

<template>
  <div ref="rootRef" class="trade-date-picker">
    <!-- 触发按钮 -->
    <button
      type="button"
      class="date-trigger"
      :class="{ active: open, filled: selectedStart || selectedEnd }"
      @click.stop="open = !open"
    >
      <span class="market-badge">{{ currentConfig.flag }}</span>
      <svg class="calendar-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
      <span class="date-label">{{ displayText() }}</span>
    </button>

    <!-- 下拉面板 -->
    <Transition name="dropdown">
      <div v-show="open" class="date-dropdown">
        <!-- 图例说明 -->
        <div class="legend-bar">
          <span class="legend-item">
            <span class="legend-dot trading"></span>
            <span>交易日</span>
          </span>
          <span class="legend-item">
            <span class="legend-dot closed"></span>
            <span>休市</span>
          </span>
          <span v-if="loading" class="loading-hint">加载中...</span>
        </div>
        
        <div class="date-content">
          <!-- 左侧快捷选项 -->
          <div class="shortcuts-panel">
            <div
              v-for="shortcut in shortcuts"
              :key="shortcut.label"
              class="shortcut-item"
              @click="selectShortcut(shortcut)"
            >
              {{ shortcut.label }}
            </div>
            <div class="shortcut-item clear" @click="clearRange">清空</div>
          </div>

          <!-- 双日历面板 -->
          <div class="calendars-panel">
            <!-- 左侧面板 -->
            <div class="calendar">
              <div class="calendar-header">
                <button type="button" class="nav-btn" @click="prevYear" title="上一年">«</button>
                <button type="button" class="nav-btn" @click="prevMonth" title="上一月">‹</button>
                <span class="month-title">{{ leftMonth.format('YYYY 年 M 月') }}</span>
                <span class="spacer"></span>
              </div>
              <div class="calendar-grid">
                <div v-for="day in weekDays" :key="day" class="week-day">{{ day }}</div>
                <div
                  v-for="(item, index) in leftCalendar"
                  :key="'L' + index"
                  class="day-cell"
                  :class="{
                    'other-month': !item.isCurrentMonth,
                    'selected': isSelected(item.date),
                    'in-range': isInRange(item.date),
                    'today': isToday(item.date),
                    'weekend': isWeekend(item.date),
                    'trading': isTradingDay(item.date),
                    'closed': isClosedDay(item.date),
                  }"
                  :title="getHolidayName(item.date) || (isTradingDay(item.date) ? '交易日' : isClosedDay(item.date) ? '休市' : '')"
                  @click="onDateClick(item.date)"
                >
                  <span class="day-num">{{ item.date.date() }}</span>
                  <span v-if="isTradingDay(item.date)" class="trade-indicator trading"></span>
                  <span v-else-if="isClosedDay(item.date)" class="trade-indicator closed"></span>
                </div>
              </div>
            </div>

            <!-- 右侧面板 -->
            <div class="calendar">
              <div class="calendar-header">
                <span class="spacer"></span>
                <span class="month-title">{{ rightMonth.format('YYYY 年 M 月') }}</span>
                <button type="button" class="nav-btn" @click="nextMonth" title="下一月">›</button>
                <button type="button" class="nav-btn" @click="nextYear" title="下一年">»</button>
              </div>
              <div class="calendar-grid">
                <div v-for="day in weekDays" :key="day" class="week-day">{{ day }}</div>
                <div
                  v-for="(item, index) in rightCalendar"
                  :key="'R' + index"
                  class="day-cell"
                  :class="{
                    'other-month': !item.isCurrentMonth,
                    'selected': isSelected(item.date),
                    'in-range': isInRange(item.date),
                    'today': isToday(item.date),
                    'weekend': isWeekend(item.date),
                    'trading': isTradingDay(item.date),
                    'closed': isClosedDay(item.date),
                  }"
                  :title="getHolidayName(item.date) || (isTradingDay(item.date) ? '交易日' : isClosedDay(item.date) ? '休市' : '')"
                  @click="onDateClick(item.date)"
                >
                  <span class="day-num">{{ item.date.date() }}</span>
                  <span v-if="isTradingDay(item.date)" class="trade-indicator trading"></span>
                  <span v-else-if="isClosedDay(item.date)" class="trade-indicator closed"></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.trade-date-picker {
  position: relative;
  display: inline-block;
}

/* 触发按钮 */
.date-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  height: var(--control-h);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.date-trigger:hover {
  border-color: var(--accent);
  background: var(--bg-hover);
}

.date-trigger.active {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 20%, transparent);
}

.date-trigger.filled {
  color: var(--text-primary);
}

.market-badge {
  font-size: var(--text-sm);
}

.calendar-icon {
  flex-shrink: 0;
  color: var(--text-muted);
}

.date-label {
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 下拉面板 */
.date-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 100;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

/* 图例栏 */
.legend-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 12px;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border);
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.legend-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.legend-dot.trading {
  background: var(--success);
}

.legend-dot.closed {
  background: var(--text-muted);
}

.loading-hint {
  margin-left: auto;
  color: var(--accent);
}

.date-content {
  display: flex;
}

/* 快捷选项面板 */
.shortcuts-panel {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px;
  border-right: 1px solid var(--border);
  background: var(--bg-elevated);
}

.shortcut-item {
  padding: 6px 12px;
  font-size: var(--text-xs);
  color: var(--text-secondary);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.shortcut-item:hover {
  color: var(--accent);
  background: var(--bg-hover);
}

.shortcut-item.clear {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
  color: var(--text-muted);
}

.shortcut-item.clear:hover {
  color: var(--loss);
}

/* 日历面板 */
.calendars-panel {
  display: flex;
  gap: 16px;
  padding: 12px;
}

.calendar {
  width: 240px;
}

.calendar-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  font-size: var(--text-sm);
  color: var(--text-muted);
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.nav-btn:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.month-title {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-primary);
}

.spacer {
  flex: 1;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}

.week-day {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 28px;
  font-size: var(--text-2xs);
  font-weight: 600;
  color: var(--text-muted);
}

.day-cell {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 32px;
  font-size: var(--text-xs);
  color: var(--text-primary);
  background: transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.day-cell:hover {
  background: var(--bg-hover);
}

.day-cell.other-month {
  color: var(--text-muted);
  opacity: 0.5;
}

.day-cell.weekend {
  color: var(--text-muted);
}

.day-cell.today {
  font-weight: 600;
}

.day-cell.today::after {
  content: '';
  position: absolute;
  bottom: 2px;
  left: 50%;
  transform: translateX(-50%);
  width: 4px;
  height: 4px;
  background: var(--accent);
  border-radius: 50%;
}

.day-cell.selected {
  color: white;
  background: var(--accent);
  font-weight: 600;
}

.day-cell.in-range {
  background: color-mix(in srgb, var(--accent) 15%, transparent);
}

.day-cell.trading {
  background: color-mix(in srgb, var(--success) 8%, transparent);
}

.day-cell.closed.other-month {
  background: transparent;
}

.day-cell.selected.trading,
.day-cell.selected.closed {
  background: var(--accent);
}

/* 交易日指示器 */
.day-num {
  line-height: 1;
}

.trade-indicator {
  position: absolute;
  top: 3px;
  right: 3px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
}

.trade-indicator.trading {
  background: var(--success);
}

.trade-indicator.closed {
  background: var(--text-muted);
  opacity: 0.5;
}

/* 下拉动画 */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* 响应式 */
@media (max-width: 768px) {
  .date-dropdown {
    position: fixed;
    top: auto;
    bottom: 0;
    left: 0;
    right: 0;
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    max-height: 80vh;
    overflow-y: auto;
  }
  
  .date-content {
    flex-direction: column;
  }
  
  .shortcuts-panel {
    flex-direction: row;
    flex-wrap: wrap;
    border-right: none;
    border-bottom: 1px solid var(--border);
  }
  
  .calendars-panel {
    flex-direction: column;
  }
  
  .calendar {
    width: 100%;
  }
}
</style>
