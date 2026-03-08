<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'

const props = withDefaults(
  defineProps<{
    /** 范围最小值（如 0 或 1） */
    minBound: number
    /** 范围最大值（如 40 或 5） */
    maxBound: number
    /** 当前选中的最小值 */
    start?: number | ''
    /** 当前选中的最大值 */
    end?: number | ''
    /** 触发器上显示的标签，如「总分」「基本面」 */
    label?: string
    placeholder?: string
  }>(),
  { label: '', placeholder: '选择范围' }
)

const emit = defineEmits<{
  (e: 'update:start', value: number | undefined): void
  (e: 'update:end', value: number | undefined): void
}>()

const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)
const innerStart = ref<number | ''>('')
const innerEnd = ref<number | ''>('')

function fromStore() {
  innerStart.value = props.start === undefined || props.start === '' ? '' : props.start
  innerEnd.value = props.end === undefined || props.end === '' ? '' : props.end
}

watch(
  () => [props.start, props.end],
  () => fromStore(),
  { immediate: true }
)

function displayText(): string {
  const s = props.start
  const e = props.end
  const hasStart = typeof s === 'number' && s >= props.minBound && s <= props.maxBound
  const hasEnd = typeof e === 'number' && e >= props.minBound && e <= props.maxBound
  if (hasStart && hasEnd) return `${s} ～ ${e}`
  if (hasStart) return `${s} ～`
  if (hasEnd) return `～ ${e}`
  return props.placeholder
}

function apply() {
  const s = innerStart.value
  const e = innerEnd.value
  emit(
    'update:start',
    typeof s === 'number' && s >= props.minBound && s <= props.maxBound ? s : undefined
  )
  emit(
    'update:end',
    typeof e === 'number' && e >= props.minBound && e <= props.maxBound ? e : undefined
  )
  open.value = false
}

function clearRange() {
  innerStart.value = ''
  innerEnd.value = ''
  emit('update:start', undefined)
  emit('update:end', undefined)
  open.value = false
}

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
</script>

<template>
  <div ref="rootRef" class="score-range-picker">
    <button
      type="button"
      class="score-range-trigger"
      :class="{ active: open, filled: (start !== undefined && start !== '') || (end !== undefined && end !== '') }"
      @click.stop="open = !open"
    >
      <span v-if="label" class="score-range-label-prefix">{{ label }}</span>
      <span class="score-range-label">{{ displayText() }}</span>
      <span class="score-range-arrow">{{ open ? '▲' : '▼' }}</span>
    </button>
    <Transition name="dropdown">
      <div v-show="open" class="score-range-dropdown">
        <div class="score-range-row">
          <label class="score-range-field-label">开始</label>
          <input
            v-model.number="innerStart"
            type="number"
            class="score-range-input"
            :min="minBound"
            :max="maxBound"
            :placeholder="String(minBound)"
            @keydown.enter="apply"
          />
        </div>
        <div class="score-range-row">
          <label class="score-range-field-label">结束</label>
          <input
            v-model.number="innerEnd"
            type="number"
            class="score-range-input"
            :min="minBound"
            :max="maxBound"
            :placeholder="String(maxBound)"
            @keydown.enter="apply"
          />
        </div>
        <div class="score-range-actions">
          <button type="button" class="score-range-btn secondary" @click="clearRange">清空</button>
          <button type="button" class="score-range-btn primary" @click="apply">确定</button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.score-range-picker {
  position: relative;
  display: inline-block;
}

.score-range-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.25rem;
  min-width: 100px;
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
}

.score-range-trigger:hover {
  border-color: var(--border-strong);
}

.score-range-trigger.active,
.score-range-trigger.filled {
  border-color: var(--accent);
}

.score-range-label-prefix {
  flex-shrink: 0;
  color: var(--text-muted);
  margin-right: 2px;
}

.score-range-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: inherit;
}

.score-range-trigger:not(.filled) .score-range-label {
  color: var(--text-muted);
}

.score-range-arrow {
  flex-shrink: 0;
  font-size: 0.5rem;
  color: var(--text-muted);
}

.score-range-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  min-width: 100%;
  padding: var(--space-sm);
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  z-index: 200;
}

.score-range-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: var(--space-xs);
}

.score-range-row:last-of-type {
  margin-bottom: var(--space-sm);
}

.score-range-field-label {
  font-size: var(--text-2xs);
  font-weight: 500;
  color: var(--text-muted);
}

.score-range-input {
  height: var(--control-h-sm);
  width: 100%;
  padding: 0 var(--space-sm);
  font-size: var(--text-xs);
  color: var(--text-primary);
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  transition: border-color var(--transition-fast);
  font-variant-numeric: tabular-nums;
}

.score-range-input:focus {
  outline: none;
  border-color: var(--accent);
}

.score-range-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-xs);
}

.score-range-btn {
  height: var(--control-h-sm);
  padding: 0 var(--space-sm);
  font-size: var(--text-xs);
  font-weight: 500;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.score-range-btn.primary {
  color: var(--text-on-accent);
  background: var(--accent);
  border: none;
}

.score-range-btn.primary:hover {
  background: var(--accent-dim);
}

.score-range-btn.secondary {
  color: var(--text-secondary);
  background: var(--bg-elevated);
  border: 1px solid var(--border);
}

.score-range-btn.secondary:hover {
  color: var(--text-primary);
  border-color: var(--border-strong);
}

.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity var(--transition-fast), transform var(--transition-fast);
}
.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
