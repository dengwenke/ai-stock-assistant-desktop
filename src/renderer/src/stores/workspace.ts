import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type MarketKey = 'A' | 'HK' | 'US'

export interface MarketConfig {
  key: MarketKey
  label: string
  labelShort: string
  flag: string
}

export const MARKETS: MarketConfig[] = [
  { key: 'A', label: 'A股', labelShort: 'A', flag: '🇨🇳' },
  { key: 'HK', label: '港股', labelShort: 'H', flag: '🇭🇰' },
  { key: 'US', label: '美股', labelShort: 'U', flag: '🇺🇸' },
]

const STORAGE_KEY = 'stock_assistant_workspace'

export const useWorkspaceStore = defineStore('workspace', () => {
  const currentMarket = ref<MarketKey>('A')

  // 从 localStorage 初始化
  function init() {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && ['A', 'HK', 'US'].includes(saved)) {
      currentMarket.value = saved as MarketKey
    }
  }

  // 切换市场
  function setMarket(market: MarketKey) {
    currentMarket.value = market
    localStorage.setItem(STORAGE_KEY, market)
  }

  // 当前市场配置
  const currentConfig = computed(() => {
    return MARKETS.find(m => m.key === currentMarket.value) || MARKETS[0]
  })

  return {
    currentMarket,
    currentConfig,
    init,
    setMarket,
    MARKETS,
  }
})
