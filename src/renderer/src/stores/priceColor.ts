import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { STORAGE_KEYS } from '@/constants'

export type PriceColorMode = 'default' | 'reversed'

const STORAGE_KEY = STORAGE_KEYS.PRICE_COLOR_MODE

function readStoredMode(): PriceColorMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'default' || v === 'reversed') return v
  } catch {
    /* ignore */
  }
  return 'default'
}

function applyPriceColorMode(mode: PriceColorMode) {
  document.documentElement.dataset.priceColorMode = mode
}

export const usePriceColorStore = defineStore('priceColor', () => {
  const mode = ref<PriceColorMode>(readStoredMode())

  const isReversed = computed(() => mode.value === 'reversed')

  const upColor = computed(() => {
    return isReversed.value ? '#ef4444' : '#22c55e'
  })

  const downColor = computed(() => {
    return isReversed.value ? '#22c55e' : '#ef4444'
  })

  function setMode(newMode: PriceColorMode) {
    mode.value = newMode
    localStorage.setItem(STORAGE_KEY, newMode)
    applyPriceColorMode(newMode)
  }

  function toggle() {
    setMode(mode.value === 'default' ? 'reversed' : 'default')
  }

  function init() {
    applyPriceColorMode(mode.value)
  }

  return { mode, isReversed, upColor, downColor, setMode, toggle, init }
})
