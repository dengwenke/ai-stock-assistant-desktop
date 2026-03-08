<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useGlobalErrorStore } from '@/stores/globalError'

const store = useGlobalErrorStore()
const { message, visible } = storeToRefs(store)
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="visible" class="global-error-overlay" @click.self="store.close()">
        <div class="global-error-modal" role="alertdialog" aria-labelledby="global-error-title">
          <h3 id="global-error-title" class="global-error-title">提示</h3>
          <p class="global-error-message">{{ message }}</p>
          <button type="button" class="global-error-btn" @click="store.close()">确定</button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.global-error-overlay {
  position: fixed;
  inset: 0;
  background: var(--bg-overlay);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.global-error-modal {
  min-width: 320px;
  max-width: 90vw;
  padding: var(--space-xl) var(--space-2xl);
  background: var(--gradient-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
  position: relative;
  overflow: hidden;
}

/* 模态框顶部高光 */
.global-error-modal::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
}

/* 警告图标装饰 */
.global-error-modal::after {
  content: '⚠';
  position: absolute;
  top: -30px;
  right: -30px;
  font-size: 120px;
  opacity: 0.03;
  pointer-events: none;
}

.global-error-title {
  margin: 0 0 var(--space-md);
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.global-error-title::before {
  content: '⚠';
  font-size: var(--text-xl);
  color: var(--warning);
}

.global-error-message {
  margin: 0 0 var(--space-xl);
  font-size: var(--text-base);
  color: var(--text-secondary);
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  padding: var(--space-md);
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
  border-left: 3px solid var(--warning);
}

.global-error-btn {
  display: block;
  width: 100%;
  min-height: var(--control-h-lg);
  padding: var(--space-md) var(--space-lg);
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--text-on-accent);
  background: var(--gradient-accent);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast) var(--ease-out-expo);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.1);
  position: relative;
  overflow: hidden;
}

.global-error-btn::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(110deg, transparent 25%, rgba(255,255,255,0.15) 50%, transparent 75%);
  transform: translateX(-100%);
  transition: transform 0.5s var(--ease-out-expo);
}

.global-error-btn:hover::before {
  transform: translateX(100%);
}

.global-error-btn:hover {
  box-shadow: var(--shadow-glow-accent), 0 4px 12px rgba(0, 0, 0, 0.15);
  transform: translateY(-1px);
}

.global-error-btn:active {
  transform: translateY(0);
}

/* 动画增强 */
.modal-enter-active,
.modal-leave-active {
  transition: opacity var(--transition-normal) var(--ease-out-expo);
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .global-error-modal,
.modal-leave-active .global-error-modal {
  transition: transform var(--transition-normal) var(--ease-out-back);
}

.modal-enter-from .global-error-modal {
  transform: scale(0.9) translateY(20px);
}

.modal-leave-to .global-error-modal {
  transform: scale(0.95) translateY(-10px);
}
</style>
