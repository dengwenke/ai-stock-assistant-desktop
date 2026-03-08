<script setup lang="ts">
/**
 * 工作空间切换组件
 * 在 A股/港股/美股 之间切换
 */
import { useWorkspaceStore, type MarketKey } from '@/stores/workspace'
import { storeToRefs } from 'pinia'

const props = withDefaults(
  defineProps<{
    fusedRight?: boolean
  }>(),
  {
    fusedRight: false,
  },
)

const workspaceStore = useWorkspaceStore()
const { currentMarket } = storeToRefs(workspaceStore)

function switchMarket(market: MarketKey) {
  workspaceStore.setMarket(market)
}
</script>

<template>
  <div class="workspace-switcher" :class="{ 'fused-right': props.fusedRight }">
    <button
      v-for="market in workspaceStore.MARKETS"
      :key="market.key"
      type="button"
      class="workspace-btn"
      :class="{ active: currentMarket === market.key }"
      :title="`切换到${market.label}`"
      :aria-label="`切换到${market.label}`"
      :aria-pressed="currentMarket === market.key"
      @click="switchMarket(market.key)"
    >
      <span class="market-flag" aria-hidden="true">{{ market.flag }}</span>
      <span class="market-code">{{ market.labelShort }}</span>
    </button>
  </div>
</template>

<style scoped>
.workspace-switcher {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  min-height: var(--control-h);
  padding: 3px;
  background: color-mix(in srgb, var(--bg-elevated) 90%, var(--text-faint) 10%);
  border: 1px solid var(--border);
  border-radius: calc(var(--radius-md) + 2px);
}

.workspace-switcher.fused-right {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
  border-right-color: transparent;
}

.workspace-switcher.fused-right .workspace-btn:last-child {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}

.workspace-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.32rem;
  min-height: calc(var(--control-h) - 8px);
  min-width: 3.7rem;
  padding: 0 0.56rem;
  font-family: inherit;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-secondary);
  background: transparent;
  border: 1px solid transparent;
  border-radius: calc(var(--radius-sm) + 1px);
  cursor: pointer;
  transition:
    color var(--transition-fast) var(--ease-out-expo),
    background var(--transition-fast) var(--ease-out-expo),
    border-color var(--transition-fast) var(--ease-out-expo),
    box-shadow var(--transition-fast) var(--ease-out-expo);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.workspace-btn:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
  border-color: color-mix(in srgb, var(--accent) 14%, transparent);
}

.workspace-btn.active {
  color: var(--accent);
  background: color-mix(in srgb, var(--accent-subtle) 70%, var(--bg-elevated));
  border-color: color-mix(in srgb, var(--accent) 30%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 20%, transparent);
}

.market-flag {
  font-size: 0.95em;
  line-height: 1;
}

.market-code {
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.08em;
  line-height: 1;
}

@media (max-width: 1100px) {
  .workspace-btn {
    min-width: 3.45rem;
    padding: 0 0.5rem;
    font-size: var(--text-xs);
  }
}

@media (max-width: 768px) {
  .workspace-btn {
    min-height: 1.74rem;
    min-width: 3.2rem;
    padding: 0 0.42rem;
    font-size: var(--text-xs);
    border-radius: var(--radius-sm);
  }
}

@media (max-width: 480px) {
  .workspace-btn {
    min-width: 2.95rem;
    padding: 0 0.36rem;
  }
}

.workspace-btn:focus-visible {
  outline: none;
  box-shadow:
    0 0 0 2px color-mix(in srgb, var(--accent) 42%, transparent),
    0 0 0 4px color-mix(in srgb, var(--accent) 14%, transparent);
}

.workspace-btn:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.workspace-btn:disabled .market-code,
.workspace-btn:disabled .market-flag {
  opacity: 0.68;
}

@media (prefers-reduced-motion: reduce) {
  .workspace-btn {
    transition: color var(--transition-fast) linear, background var(--transition-fast) linear,
      border-color var(--transition-fast) linear, box-shadow var(--transition-fast) linear;
  }
}
</style>
