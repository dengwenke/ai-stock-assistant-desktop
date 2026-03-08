<script setup lang="ts">
/**
 * 股票信息卡片组件
 * 固定展示于页面顶部，展示股票基本信息和模式切换
 */
import { computed } from 'vue'
import { usePriceColorStore } from '@/stores/priceColor'
import { storeToRefs } from 'pinia'
import { useGlobalCopy } from '@/composables'

const { copy, isCopied } = useGlobalCopy()

interface Props {
  stockCode: string
  stockName?: string
  currentPrice?: number
  prevClose?: number
  volume?: number
  marketCap?: string
  pe?: string
  pb?: string
  industry?: string
  mode: 'quote' | 'analysis'
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:mode': [mode: 'quote' | 'analysis']
}>()

const priceColorStore = usePriceColorStore()
const { upColor, downColor } = storeToRefs(priceColorStore)

// 计算涨跌幅
const changePercent = computed(() => {
  if (!props.currentPrice || !props.prevClose || props.prevClose === 0) return null
  return ((props.currentPrice - props.prevClose) / props.prevClose) * 100
})

const changeAmount = computed(() => {
  if (!props.currentPrice || !props.prevClose) return null
  return props.currentPrice - props.prevClose
})

// 格式化成交量
const formattedVolume = computed(() => {
  if (!props.volume) return '-'
  if (props.volume >= 1e8) return (props.volume / 1e8).toFixed(2) + '亿'
  if (props.volume >= 1e4) return (props.volume / 1e4).toFixed(2) + '万'
  return props.volume.toString()
})

// 切换模式
function switchMode(mode: 'quote' | 'analysis') {
  emit('update:mode', mode)
}
</script>

<template>
  <div class="stock-info-card">
    <div class="info-main">
      <!-- 左侧：股票基本信息 -->
      <div class="stock-basic">
        <div class="stock-title">
          <span class="stock-name-wrap">
            <span class="stock-name">{{ stockName || stockCode }}</span>
            <button 
              type="button" 
              class="copy-btn-sm" 
              :class="{ copied: isCopied(stockName || stockCode) }"
              @click="copy(stockName || stockCode)"
              :title="isCopied(stockName || stockCode) ? '已复制' : '复制名称'"
            >
              <span v-if="isCopied(stockName || stockCode)" class="copy-icon">✓</span>
              <span v-else class="copy-icon">⧉</span>
            </button>
          </span>
          <span class="stock-code-wrap">
            <span class="stock-code">{{ stockCode }}</span>
            <button 
              type="button" 
              class="copy-btn-sm" 
              :class="{ copied: isCopied(stockCode) }"
              @click="copy(stockCode)"
              :title="isCopied(stockCode) ? '已复制' : '复制代码'"
            >
              <span v-if="isCopied(stockCode)" class="copy-icon">✓</span>
              <span v-else class="copy-icon">⧉</span>
            </button>
          </span>
        </div>
        
        <div class="price-row">
          <span class="current-price" :style="{ color: changePercent && changePercent >= 0 ? upColor : downColor }">
            {{ currentPrice ? currentPrice.toFixed(2) : '-' }}
          </span>
          <span 
            class="change-percent" 
            :class="{ 'is-up': changePercent && changePercent >= 0, 'is-down': changePercent && changePercent < 0 }"
          >
            {{ changePercent ? (changePercent >= 0 ? '+' : '') + changePercent.toFixed(2) + '%' : '-' }}
          </span>
          <span 
            class="change-amount"
            :class="{ 'is-up': changeAmount && changeAmount >= 0, 'is-down': changeAmount && changeAmount < 0 }"
          >
            {{ changeAmount ? (changeAmount >= 0 ? '+' : '') + changeAmount.toFixed(2) : '-' }}
          </span>
        </div>
      </div>

      <!-- 中间：详细信息 -->
      <div class="stock-details">
        <div class="detail-item">
          <span class="detail-label">成交量</span>
          <span class="detail-value">{{ formattedVolume }}</span>
        </div>
        <div class="detail-item" v-if="marketCap">
          <span class="detail-label">市值</span>
          <span class="detail-value">{{ marketCap }}亿</span>
        </div>
        <div class="detail-item" v-if="pe">
          <span class="detail-label">PE</span>
          <span class="detail-value">{{ pe }}</span>
        </div>
        <div class="detail-item" v-if="pb">
          <span class="detail-label">PB</span>
          <span class="detail-value">{{ pb }}</span>
        </div>
        <div class="detail-item" v-if="industry">
          <span class="detail-label">行业</span>
          <span class="detail-value">{{ industry }}</span>
        </div>
      </div>

      <!-- 右侧：模式切换 -->
      <div class="mode-switch">
        <button 
          class="mode-btn" 
          :class="{ active: mode === 'quote' }"
          @click="switchMode('quote')"
        >
          <span class="mode-dot mode-dot--quote" aria-hidden="true"></span>
          <span class="mode-text">行情</span>
        </button>
        <button 
          class="mode-btn" 
          :class="{ active: mode === 'analysis' }"
          @click="switchMode('analysis')"
        >
          <span class="mode-dot mode-dot--analysis" aria-hidden="true"></span>
          <span class="mode-text">公告</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stock-info-card {
  background:
    linear-gradient(120deg, color-mix(in srgb, var(--accent-subtle) 52%, transparent) 0%, transparent 44%),
    linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 96%, transparent), var(--bg-card));
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-md);
  box-shadow: var(--shadow-sm);
  position: sticky;
  top: 0;
  z-index: 100;
}

.info-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-lg);
}

.stock-basic {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  min-width: 0;
}

.stock-title {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: var(--space-sm);
  min-width: 0;
}

.stock-name {
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--text-primary);
}

.stock-code {
  font-size: var(--text-sm);
  color: var(--text-muted);
  font-family: var(--font-mono);
  padding: 0.15rem 0.48rem;
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-full);
}

.stock-name-wrap,
.stock-code-wrap {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
}

.copy-btn-sm {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.3rem;
  height: 1.3rem;
  padding: 0;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xs);
  background: color-mix(in srgb, var(--bg-surface) 85%, transparent);
  color: var(--text-muted);
  cursor: pointer;
  opacity: 0;
  transition: all var(--transition-fast);
}

.stock-name-wrap:hover .copy-btn-sm,
.stock-code-wrap:hover .copy-btn-sm {
  opacity: 1;
}

.copy-btn-sm:hover {
  background: var(--accent-subtle);
  border-color: var(--accent);
  color: var(--accent);
  transform: scale(1.06);
}

.copy-btn-sm.copied {
  opacity: 1;
  background: var(--success-subtle);
  border-color: var(--success);
  color: var(--success);
}

.copy-btn-sm .copy-icon {
  font-size: var(--text-xs);
  line-height: 1;
}

.price-row {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: var(--space-sm);
}

.current-price {
  font-size: var(--text-2xl);
  font-weight: 700;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.change-percent,
.change-amount {
  font-size: var(--text-base);
  font-weight: 600;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.change-percent.is-up,
.change-amount.is-up {
  color: var(--gain);
}

.change-percent.is-down,
.change-amount.is-down {
  color: var(--loss);
}

.stock-details {
  display: flex;
  gap: var(--space-lg);
  flex-wrap: wrap;
  flex: 1;
  min-width: 0;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  padding: 0 var(--space-xs);
  border-left: 1px solid var(--border-subtle);
}

.detail-label {
  font-size: var(--text-2xs);
  color: var(--text-muted);
  letter-spacing: 0.03em;
}

.detail-value {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.mode-switch {
  display: flex;
  gap: var(--space-xs);
  background: color-mix(in srgb, var(--bg-elevated) 88%, transparent);
  padding: var(--space-2xs);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}

.mode-btn {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  min-height: var(--control-h-sm);
  padding: 0 var(--space-md);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-muted);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.mode-btn:hover {
  color: var(--text-primary);
  background: color-mix(in srgb, var(--bg-card) 82%, transparent);
  border-color: var(--border);
}

.mode-btn.active {
  color: var(--text-on-accent);
  background: var(--gradient-accent);
  border-color: color-mix(in srgb, var(--accent) 75%, transparent);
  box-shadow: var(--shadow-glow);
}

.mode-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: var(--radius-full);
  background: var(--text-muted);
}

.mode-dot--quote {
  background: var(--accent);
}

.mode-dot--analysis {
  background: var(--secondary);
}

@media (max-width: 1200px) {
  .info-main {
    flex-wrap: wrap;
    align-items: flex-start;
  }

  .stock-details {
    order: 3;
    width: 100%;
    justify-content: flex-start;
  }
}

@media (max-width: 768px) {
  .stock-info-card {
    padding: var(--space-sm);
  }

  .stock-name {
    font-size: var(--text-lg);
  }

  .current-price {
    font-size: var(--text-xl);
  }

  .stock-details {
    gap: var(--space-sm);
  }

  .mode-btn {
    padding: 0 var(--space-sm);
  }

  .mode-dot {
    width: 0.45rem;
    height: 0.45rem;
  }

  .mode-text {
    display: none;
  }
}
</style>
