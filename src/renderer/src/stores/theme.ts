import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { STORAGE_KEYS } from '@/constants'

export type ThemeId = 'light' | 'dark' | 'eye-care'

const STORAGE_KEY = STORAGE_KEYS.THEME

function readStoredTheme(): ThemeId {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'light' || v === 'dark' || v === 'eye-care') return v
  } catch {
    /* ignore */
  }
  return 'dark'
}

function applyTheme(theme: ThemeId) {
  document.documentElement.dataset.theme = theme
}

export const useThemeStore = defineStore('theme', () => {
  const theme = ref<ThemeId>(readStoredTheme())

  /** 设置主题并持久化 */
  function setTheme(id: ThemeId) {
    theme.value = id
    localStorage.setItem(STORAGE_KEY, id)
    applyTheme(id)
  }

  /** 初始化时应用已保存的主题（在 app 挂载时调用一次） */
  function initTheme() {
    applyTheme(theme.value)
  }

  watch(theme, applyTheme, { immediate: false })

  return { theme, setTheme, initTheme }
})
