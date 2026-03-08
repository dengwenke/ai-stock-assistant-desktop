<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import dayjs from 'dayjs'

const props = withDefaults(
  defineProps<{
    /** 开始时间，格式 yyyy-MM-dd HH:mm:ss */
    start?: string
    /** 结束时间，同上 */
    end?: string
    placeholder?: string
  }>(),
  { placeholder: '选择时间范围' }
)

const emit = defineEmits<{
  (e: 'update:start', value: string): void
  (e: 'update:end', value: string): void
}>()

const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)

// 当前显示的月份（左面板）
const leftMonth = ref(dayjs().startOf('month'))
// 右面板显示左面板的下一个月
const rightMonth = computed(() => leftMonth.value.add(1, 'month'))

// 选中的日期范围
const selectedStart = ref<dayjs.Dayjs | null>(null)
const selectedEnd = ref<dayjs.Dayjs | null>(null)

// 快捷选项
const shortcuts = [
  { label: '明日', getRange: () => getDayRange(1) },
  { label: '今日', getRange: () => getDayRange(0) },
  { label: '近1周', getRange: () => getRecentRange(7, 'day') },
  { label: '近1月', getRange: () => getRecentRange(1, 'month') },
  { label: '近3月', getRange: () => getRecentRange(3, 'month') },
  { label: '近6月', getRange: () => getRecentRange(6, 'month') },
  { label: '近1年', getRange: () => getRecentRange(1, 'year') },
  { label: '近3年', getRange: () => getRecentRange(3, 'year') },
]

function getDayRange(offset: number) {
  const date = dayjs().add(offset, 'day').startOf('day')
  return { start: date, end: date.endOf('day') }
}

function getRecentRange(amount: number, unit: 'day' | 'month' | 'year') {
  const end = dayjs().endOf('day')
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

// 生成日历数据
function generateCalendar(month: dayjs.Dayjs) {
  const startOfMonth = month.startOf('month')
  const endOfMonth = month.endOf('month')
  const startDay = startOfMonth.day() // 0 = Sunday
  const daysInMonth = month.daysInMonth()
  
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
      date: endOfMonth.add(i, 'day'),
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

// 点击日期
function onDateClick(date: dayjs.Dayjs) {
  if (!selectedStart.value || (selectedStart.value && selectedEnd.value)) {
    // 开始新的选择
    selectedStart.value = date.startOf('day')
    selectedEnd.value = null
  } else {
    // 完成选择
    if (date.isBefore(selectedStart.value, 'day')) {
      selectedEnd.value = selectedStart.value.endOf('day')
      selectedStart.value = date.startOf('day')
    } else {
      selectedEnd.value = date.endOf('day')
    }
    apply()
  }
}

// 应用选择
function apply() {
  if (selectedStart.value) {
    emit('update:start', selectedStart.value.format('YYYY-MM-DD HH:mm:ss'))
  } else {
    emit('update:start', '')
  }
  if (selectedEnd.value) {
    emit('update:end', selectedEnd.value.format('YYYY-MM-DD HH:mm:ss'))
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
    return `${selectedStart.value.format('YYYY-MM-DD')} 至 ${selectedEnd.value.format('YYYY-MM-DD')}`
  }
  if (selectedStart.value) {
    return `${selectedStart.value.format('YYYY-MM-DD')} 开始`
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
  <div ref="rootRef" class="date-range-picker">
    <!-- 触发按钮 -->
    <button
      type="button"
      class="date-range-trigger"
      :class="{ active: open, filled: selectedStart || selectedEnd }"
      @click.stop="open = !open"
    >
      <svg class="calendar-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
      <span class="date-range-label">{{ displayText() }}</span>
    </button>

    <!-- 下拉面板 -->
    <Transition name="dropdown">
      <div v-show="open" class="date-range-dropdown">
        <div class="date-range-content">
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
          </div>

          <!-- 双日历面板 -->
          <div class="calendars-panel">
            <!-- 左侧面板 -->
            <div class="calendar">
              <div class="calendar-header">
                <button class="nav-btn" @click="prevYear">«</button>
                <button class="nav-btn" @click="prevMonth">‹</button>
                <span class="month-title">{{ leftMonth.format('YYYY 年 M 月') }}</span>
                <span class="spacer"></span>
              </div>
              <div class="calendar-grid">
                <div v-for="day in weekDays" :key="day" class="week-day">{{ day }}</div>
                <div
                  v-for="(item, index) in leftCalendar"
                  :key="index"
                  class="day-cell"
                  :class="{
                    'other-month': !item.isCurrentMonth,
                    'selected': isSelected(item.date),
                    'in-range': isInRange(item.date),
                    'today': isToday(item.date)
                  }"
                  @click="onDateClick(item.date)"
                >
                  {{ item.date.date() }}
                </div>
              </div>
            </div>

            <!-- 右侧面板 -->
            <div class="calendar">
              <div class="calendar-header">
                <span class="spacer"></span>
                <span class="month-title">{{ rightMonth.format('YYYY 年 M 月') }}</span>
                <button class="nav-btn" @click="nextMonth">›</button>
                <button class="nav-btn" @click="nextYear">»</button>
              </div>
              <div class="calendar-grid">
                <div v-for="day in weekDays" :key="day" class="week-day">{{ day }}</div>
                <div
                  v-for="(item, index) in rightCalendar"
                  :key="index"
                  class="day-cell"
                  :class="{
                    'other-month': !item.isCurrentMonth,
                    'selected': isSelected(item.date),
                    'in-range': isInRange(item.date),
                    'today': isToday(item.date)
                  }"
                  @click="onDateClick(item.date)"
                >
                  {{ item.date.date() }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 底部按钮 -->
        <div class="date-range-footer">
          <button type="button" class="btn btn-text" @click="clearRange">清空</button>
          <button type="button" class="btn btn-primary" @click="apply">确定</button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.date-range-picker {
  position: relative;
  display: inline-block;
}

/* 触发按钮 */
.date-range-trigger {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  height: var(--control-h-sm);
  padding: 0 var(--space-sm);
  font-size: var(--text-xs);
  color: var(--text-primary);
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: border-color var(--transition-fast);
  text-align: left;
  min-width: 10rem;
}

.date-range-trigger:hover {
  border-color: var(--border-strong);
}

.date-range-trigger.active,
.date-range-trigger.filled {
  border-color: var(--accent);
}

.calendar-icon {
  flex-shrink: 0;
  color: var(--text-muted);
  width: 12px;
  height: 12px;
}

.date-range-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.date-range-trigger:not(.filled) .date-range-label {
  color: var(--text-muted);
}

/* 下拉面板 */
.date-range-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  z-index: 200;
  min-width: 520px;
}

.date-range-content {
  display: flex;
}

/* 快捷选项面板 */
.shortcuts-panel {
  width: 72px;
  padding: var(--space-xs) 0;
  border-right: 1px solid var(--border-subtle);
  background: var(--bg-surface);
}

.shortcut-item {
  padding: var(--space-2xs) var(--space-sm);
  font-size: var(--text-xs);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.shortcut-item:hover {
  color: var(--accent);
  background: var(--bg-hover);
}

/* 日历面板 */
.calendars-panel {
  display: flex;
  padding: var(--space-sm);
  gap: var(--space-md);
}

.calendar {
  flex: 1;
}

.calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-xs);
}

.month-title {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text-primary);
}

.nav-btn {
  width: 1.25rem;
  height: 1.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-xs);
  color: var(--text-secondary);
  background: transparent;
  border: none;
  border-radius: var(--radius-xs);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.nav-btn:hover {
  color: var(--accent);
  background: var(--bg-hover);
}

.spacer {
  width: 2.5rem;
}

/* 日历网格 */
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1px;
}

.week-day {
  text-align: center;
  padding: 2px;
  font-size: var(--text-2xs);
  color: var(--text-muted);
  font-weight: 500;
}

.day-cell {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-xs);
  color: var(--text-primary);
  cursor: pointer;
  border-radius: var(--radius-xs);
  transition: all var(--transition-fast);
}

.day-cell:hover:not(.selected):not(.in-range) {
  background: var(--bg-hover);
}

.day-cell.other-month {
  color: var(--text-muted);
}

.day-cell.today {
  color: var(--accent);
  font-weight: 600;
}

.day-cell.selected {
  background: var(--accent);
  color: var(--text-on-accent);
}

.day-cell.in-range {
  background: var(--accent-subtle);
  color: var(--accent);
}

/* 底部按钮 */
.date-range-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-xs);
  padding: var(--space-xs) var(--space-sm);
  border-top: 1px solid var(--border-subtle);
}

.btn {
  height: var(--control-h-sm);
  padding: 0 var(--space-sm);
  font-size: var(--text-xs);
  font-weight: 500;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-primary {
  background: var(--accent);
  color: var(--text-on-accent);
  border: none;
}

.btn-primary:hover {
  background: var(--accent-dim);
}

.btn-text {
  background: transparent;
  color: var(--text-secondary);
  border: none;
}

.btn-text:hover {
  color: var(--text-primary);
}

/* 动画 */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity var(--transition-fast), transform var(--transition-fast);
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* 响应式 */
@media (max-width: 640px) {
  .date-range-dropdown {
    min-width: auto;
    left: 0;
    right: 0;
  }
  
  .calendars-panel {
    flex-direction: column;
    gap: var(--space-md);
  }
  
  .shortcuts-panel {
    width: 100%;
    display: flex;
    flex-wrap: wrap;
    border-right: none;
    border-bottom: 1px solid var(--border-subtle);
    padding: var(--space-xs);
  }
  
  .shortcut-item {
    padding: var(--space-xs) var(--space-sm);
  }
  
  .date-range-content {
    flex-direction: column;
  }
}
</style>
