<script setup lang="ts">
/**
 * 交易日历单日期选择器
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
    /** 选中的日期，格式 yyyy-MM-dd */
    modelValue?: string
    placeholder?: string
    /** 内联模式：直接展开日历，不显示触发按钮 */
    inline?: boolean
  }>(),
  { placeholder: '选择日期', inline: false }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'change', value: string): void
}>()

const workspaceStore = useWorkspaceStore()
const { currentMarket, currentConfig } = storeToRefs(workspaceStore)

const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)
const loading = ref(false)
const panelVisible = computed(() => props.inline || open.value)

// 交易日历数据缓存
const calendarCache = ref<Map<string, TradeCalendarItem>>(new Map())

// 当前显示的月份
const currentMonth = ref(dayjs().startOf('month'))

// 选中的日期
const selectedDate = ref<dayjs.Dayjs | null>(null)

// 快捷选项
const shortcuts = [
  { label: '今日', getDate: () => dayjs() },
  { label: '昨日', getDate: () => dayjs().subtract(1, 'day') },
  { label: '前日', getDate: () => dayjs().subtract(2, 'day') },
]

// 从 props 初始化选中值
watch(
  () => props.modelValue,
  () => {
    if (props.modelValue) {
      selectedDate.value = dayjs(props.modelValue)
      currentMonth.value = selectedDate.value.startOf('month')
    } else {
      selectedDate.value = null
    }
  },
  { immediate: true }
)

// 监听市场变化，重新加载日历数据
watch(currentMarket, () => {
  calendarCache.value.clear()
  if (panelVisible.value) {
    loadCalendarData()
  }
})

// 监听月份变化，加载日历数据
watch([currentMonth, panelVisible], () => {
  if (panelVisible.value) {
    loadCalendarData()
  }
})

// 加载交易日历数据
async function loadCalendarData() {
  const startMonth = currentMonth.value.subtract(1, 'month')
  const endMonth = currentMonth.value.add(1, 'month')
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

const calendarDays = computed(() => generateCalendar(currentMonth.value))

// 判断日期是否被选中
function isSelected(date: dayjs.Dayjs) {
  if (!selectedDate.value) return false
  return date.isSame(selectedDate.value, 'day')
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
  selectedDate.value = date
  apply()
}

// 应用选择
function apply() {
  if (selectedDate.value) {
    const value = selectedDate.value.format('YYYY-MM-DD')
    emit('update:modelValue', value)
    emit('change', value)
  } else {
    emit('update:modelValue', '')
    emit('change', '')
  }
  open.value = false
}

// 选择快捷选项
function selectShortcut(shortcut: typeof shortcuts[0]) {
  selectedDate.value = shortcut.getDate().startOf('day')
  currentMonth.value = selectedDate.value.startOf('month')
  apply()
}

// 跳转到今天
function goToToday() {
  const today = dayjs()
  selectedDate.value = today
  currentMonth.value = today.startOf('month')
  apply()
}

// 月份导航
function prevMonth() {
  currentMonth.value = currentMonth.value.subtract(1, 'month')
}

function nextMonth() {
  currentMonth.value = currentMonth.value.add(1, 'month')
}

// 显示文本
function displayText(): string {
  if (selectedDate.value) {
    return selectedDate.value.format('YYYY/MM/DD')
  }
  return props.placeholder
}

// 获取选中日期的交易日状态文本
const tradingStatus = computed(() => {
  if (!selectedDate.value) return ''
  const info = getCalendarInfo(selectedDate.value)
  if (!info) return ''
  if (info.isOpen === 1) return '交易'
  if (info.holidayName) return info.holidayName
  return '休市'
})

const tradingStatusClass = computed(() => {
  if (!selectedDate.value) return ''
  const info = getCalendarInfo(selectedDate.value)
  if (!info) return ''
  return info.isOpen === 1 ? 'status-trading' : 'status-closed'
})

// 点击外部关闭
function onDocumentClick(e: MouseEvent) {
  if (props.inline) return
  if (rootRef.value && !rootRef.value.contains(e.target as Node)) {
    open.value = false
  }
}

onMounted(() => {
  if (panelVisible.value) {
    loadCalendarData()
  }
  document.addEventListener('click', onDocumentClick, true)
})
onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick, true)
})

const weekDays = ['一', '二', '三', '四', '五', '六', '日']
</script>

<template>
  <div
    ref="rootRef"
    class="trade-date-single-picker"
    :class="{ 'is-open': panelVisible }"
  >
    <!-- 触发按钮 -->
    <button
      v-if="!props.inline"
      type="button"
      class="date-trigger"
      :class="{ active: open, filled: selectedDate }"
      @click.stop="open = !open"
    >
      <svg class="calendar-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
      <span class="date-label">{{ displayText() }}</span>
      <span v-if="tradingStatus" class="trading-status" :class="tradingStatusClass">{{ tradingStatus }}</span>
    </button>

    <!-- 下拉面板 -->
    <Transition name="dropdown">
      <div v-show="props.inline || open" class="date-dropdown" :class="{ 'date-dropdown-inline': props.inline }">
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
            <div class="shortcut-item today-btn" @click="goToToday">今天</div>
          </div>

          <!-- 日历面板 -->
          <div class="calendar-panel">
            <div class="calendar-header">
              <button type="button" class="nav-btn" @click="prevMonth" title="上一月">‹</button>
              <span class="month-title">{{ currentMonth.format('YYYY 年 M 月') }}</span>
              <button type="button" class="nav-btn" @click="nextMonth" title="下一月">›</button>
            </div>
            <div class="calendar-grid">
              <div v-for="day in weekDays" :key="day" class="week-day">{{ day }}</div>
              <div
                v-for="(item, index) in calendarDays"
                :key="index"
                class="day-cell"
                :class="{
                  'other-month': !item.isCurrentMonth,
                  'selected': isSelected(item.date),
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
    </Transition>
  </div>
</template>

<style scoped>
.trade-date-single-picker {
  position: relative;
  display: inline-block;
  z-index: 1;
}

.trade-date-single-picker.is-open {
  z-index: 24;
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

.calendar-icon {
  flex-shrink: 0;
  color: var(--text-muted);
}

.date-label {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.trading-status {
  font-size: var(--text-xs);
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  font-weight: 500;
}

.trading-status.status-trading {
  color: var(--success);
  background: color-mix(in srgb, var(--success) 15%, transparent);
}

.trading-status.status-closed {
  color: var(--text-muted);
  background: var(--bg-card);
}

/* 下拉面板 */
.date-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 1200;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

.date-dropdown-inline {
  position: static;
  top: auto;
  left: auto;
  width: 100%;
  border-radius: var(--radius-md);
  box-shadow: none;
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

.shortcut-item.today-btn {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
  color: var(--accent);
  font-weight: 500;
}

/* 日历面板 */
.calendar-panel {
  padding: 12px;
  width: 260px;
}

.calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  font-size: var(--text-md);
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

.day-cell.trading {
  background: color-mix(in srgb, var(--success) 10%, transparent);
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
</style>
