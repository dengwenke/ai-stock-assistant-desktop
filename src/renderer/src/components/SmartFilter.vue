<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElPopover, ElSlider, ElInputNumber, ElButton, ElTag } from 'element-plus'

const props = withDefaults(
  defineProps<{
    start?: number | ''
    end?: number | ''
    minBound?: number
    maxBound?: number
    label?: string
    placeholder?: string
    type?: 'score' | 'marketCap' | 'percent' | 'default'
    step?: number
  }>(),
  {
    start: '',
    end: '',
    minBound: 0,
    maxBound: 100,
    label: '',
    placeholder: '选择范围',
    type: 'default',
    step: 1
  }
)

const emit = defineEmits<{
  (e: 'update:start', value: number | ''): void
  (e: 'update:end', value: number | ''): void
}>()

const visible = ref(false)
const innerMin = ref<number | undefined>()
const innerMax = ref<number | undefined>()

// 同步 props 到内部状态
watch(
  () => [props.start, props.end],
  ([s, e]) => {
    innerMin.value = s === '' || s === undefined ? undefined : Number(s)
    innerMax.value = e === '' || e === undefined ? undefined : Number(e)
  },
  { immediate: true }
)

// 计算属性用于 slider 绑定
const sliderValue = computed({
  get: () => [
    typeof innerMin.value === 'number' ? innerMin.value : props.minBound,
    typeof innerMax.value === 'number' ? innerMax.value : props.maxBound
  ],
  set: (val: number[]) => {
    innerMin.value = val[0]
    innerMax.value = val[1]
  }
})

const presets = computed(() => {
  switch (props.type) {
    case 'score':
      return [
        { label: '≥ 3分', min: 3, max: 5 },
        { label: '≥ 4分', min: 4, max: 5 },
        { label: '4-5分', min: 4, max: 5 },
        { label: '3-4分', min: 3, max: 4 }
      ]
    case 'marketCap':
      return [
        { label: '< 50亿', min: 0, max: 50 },
        { label: '50-200亿', min: 50, max: 200 },
        { label: '200-500亿', min: 200, max: 500 },
        { label: '> 500亿', min: 500, max: 10000 }
      ]
    case 'percent':
      return [
        { label: '> 0%', min: 0, max: 999 },
        { label: '> 3%', min: 3, max: 999 },
        { label: '> 5%', min: 5, max: 999 },
        { label: '> 9.9%', min: 9.9, max: 999 },
        { label: '涨停', min: 9.9, max: 20 }
      ]
    default:
      return []
  }
})

const displayText = computed(() => {
  const s = props.start
  const e = props.end
  const hasStart = s !== '' && s !== undefined
  const hasEnd = e !== '' && e !== undefined

  if (hasStart && hasEnd) return `${s} - ${e}`
  if (hasStart) return `≥ ${s}`
  if (hasEnd) return `≤ ${e}`
  return props.placeholder
})

const apply = () => {
  emit('update:start', innerMin.value ?? '')
  emit('update:end', innerMax.value ?? '')
  visible.value = false
}

const clear = () => {
  innerMin.value = undefined
  innerMax.value = undefined
  emit('update:start', '')
  emit('update:end', '')
  visible.value = false
}

const applyPreset = (preset: { min: number; max: number }) => {
  innerMin.value = preset.min
  innerMax.value = preset.max
}

const isPresetActive = (preset: { min: number; max: number }) => {
  return innerMin.value === preset.min && innerMax.value === preset.max
}

const formatTooltip = (val: number) => {
  if (props.type === 'percent') return `${val}%`
  if (props.type === 'marketCap') return `${val}亿`
  return `${val}`
}
</script>

<template>
  <el-popover
    v-model:visible="visible"
    placement="bottom-start"
    :width="340"
    trigger="click"
    popper-class="smart-filter-popper"
  >
    <template #reference>
      <div 
        class="smart-filter-trigger" 
        :class="{ active: visible, filled: (start !== '' && start !== undefined) || (end !== '' && end !== undefined) }"
      >
        <span v-if="label" class="label-prefix">{{ label }}</span>
        <span class="value-text">{{ displayText }}</span>
        <span class="arrow-icon">{{ visible ? '▲' : '▼' }}</span>
      </div>
    </template>

    <div class="filter-content">
      <div v-if="presets.length > 0" class="presets-area">
        <div class="section-title">快捷筛选</div>
        <div class="tags-container">
          <el-tag
            v-for="(preset, index) in presets"
            :key="index"
            class="preset-tag"
            :effect="isPresetActive(preset) ? 'dark' : 'plain'"
            cursor="pointer"
            @click="applyPreset(preset)"
          >
            {{ preset.label }}
          </el-tag>
        </div>
      </div>

      <div class="inputs-area">
        <div class="section-title">自定义范围 ({{ type === 'marketCap' ? '亿' : type === 'percent' ? '%' : '分' }})</div>
        <div class="input-group">
          <el-input-number
            v-model="innerMin"
            :min="minBound"
            :max="innerMax ?? maxBound"
            :step="step"
            controls-position="right"
            placeholder="Min"
            class="range-input"
            size="small"
          />
          <span class="separator">至</span>
          <el-input-number
            v-model="innerMax"
            :min="innerMin ?? minBound"
            :max="maxBound"
            :step="step"
            controls-position="right"
            placeholder="Max"
            class="range-input"
            size="small"
          />
        </div>
      </div>

      <div v-if="type === 'score' || (maxBound - minBound <= 100)" class="slider-area">
        <el-slider
          v-model="sliderValue"
          range
          :min="minBound"
          :max="maxBound"
          :step="step"
          :format-tooltip="formatTooltip"
          size="small"
        />
      </div>

      <div class="actions-area">
        <el-button size="small" @click="clear">清空</el-button>
        <el-button type="primary" size="small" @click="apply">确定</el-button>
      </div>
    </div>
  </el-popover>
</template>

<style scoped>
.smart-filter-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  min-width: 100px;
  height: var(--control-h-sm, 32px);
  padding: 0 8px;
  font-size: 12px;
  color: var(--text-primary, #333);
  background: var(--bg-card, #fff);
  border: 1px solid var(--border, #dcdfe6);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  user-select: none;
}

.smart-filter-trigger:hover {
  border-color: var(--border-strong, #c0c4cc);
}

.smart-filter-trigger.active,
.smart-filter-trigger.filled {
  border-color: var(--accent, #409eff);
  color: var(--accent, #409eff);
  background-color: var(--bg-accent-subtle, #ecf5ff);
}

.label-prefix {
  color: var(--text-muted, #909399);
  margin-right: 4px;
}

.smart-filter-trigger.filled .label-prefix {
  color: inherit;
}

.value-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.arrow-icon {
  font-size: 10px;
  color: var(--text-muted, #909399);
}

.filter-content {
  padding: 4px;
}

.section-title {
  font-size: 12px;
  color: #909399;
  margin-bottom: 8px;
}

.presets-area {
  margin-bottom: 16px;
}

.tags-container {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.preset-tag {
  cursor: pointer;
  user-select: none;
  border-radius: 12px;
}

.inputs-area {
  margin-bottom: 16px;
}

.input-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.range-input {
  width: 130px;
}

.separator {
  color: #909399;
  font-size: 12px;
}

.slider-area {
  padding: 0 8px;
  margin-bottom: 16px;
}

.actions-area {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid #ebeef5;
}
</style>

<style>
.smart-filter-popper {
  padding: 12px !important;
}
</style>
