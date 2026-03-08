<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useThemeStore, type ThemeId } from '@/stores/theme'

const themeStore = useThemeStore()
const { theme } = storeToRefs(themeStore)

/** 三套主题顺序，点击按钮时循环切换 */
const order: ThemeId[] = ['light', 'dark', 'eye-care']

function cycleTheme() {
  const current = theme.value
  const idx = order.indexOf(current)
  const next = order[(idx + 1) % order.length]
  themeStore.setTheme(next)
}
</script>

<template>
  <div class="theme-switcher">
    <button
      type="button"
      class="theme-btn"
      :aria-label="`色系切换，当前：${theme === 'light' ? '白色' : theme === 'dark' ? '黑色' : '护眼'}`"
      @click="cycleTheme"
    >
      <span class="theme-btn-swatch" />
    </button>
  </div>
</template>

<style scoped>
.theme-switcher {
  display: inline-flex;
  align-items: center;
}

/* 圆形按钮：增强视觉效果 */
.theme-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  padding: 0;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 50%;
  cursor: pointer;
  transition: all var(--transition-fast) var(--ease-out-expo);
  box-shadow: var(--shadow-sm);
  position: relative;
  overflow: hidden;
}

.theme-btn::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.15), transparent 70%);
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.theme-btn:hover {
  border-color: var(--accent);
  box-shadow: var(--shadow-md), 0 0 0 3px var(--accent-subtle);
  transform: scale(1.05);
}

.theme-btn:hover::before {
  opacity: 1;
}

.theme-btn:active {
  transform: scale(0.95);
}

/* 三色圆形：conic 渐变 + 旋转动画 */
.theme-btn-swatch {
  display: block;
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 50%;
  background: conic-gradient(
    from 0deg,
    var(--preview-bg-light) 0deg 120deg,
    var(--preview-bg-dark) 120deg 240deg,
    var(--preview-bg-eye) 240deg 360deg
  );
  flex-shrink: 0;
  transition: transform var(--transition-normal) var(--ease-out-back);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.1);
}

.theme-btn:hover .theme-btn-swatch {
  transform: rotate(120deg);
}

@media (max-width: 480px) {
  .theme-btn {
    width: 2rem;
    height: 2rem;
  }

  .theme-btn-swatch {
    width: 1.1rem;
    height: 1.1rem;
  }
}
</style>
