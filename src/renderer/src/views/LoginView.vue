<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import ThemeSwitcher from '@/components/ThemeSwitcher.vue'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

const from = computed(() => {
  const f = route.query.from
  return typeof f === 'string' ? f : '/'
})

async function onSubmit() {
  error.value = ''
  if (!username.value.trim()) {
    error.value = '请输入用户名'
    return
  }
  if (!password.value) {
    error.value = '请输入密码'
    return
  }
  loading.value = true
  try {
    await auth.login({ username: username.value.trim(), password: password.value })
    await router.replace(from.value || '/')
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '登录失败'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page terminal-auth-page web-auth-page">
    <div class="login-theme">
      <ThemeSwitcher />
    </div>
    <div class="login-card">
      <h1 class="login-title">公告助手</h1>
      <p class="login-desc">请登录后使用公告分析与导出功能</p>
      <form class="login-form" @submit.prevent="onSubmit">
        <div class="form-group">
          <label for="username">用户名</label>
          <input
            id="username"
            v-model="username"
            type="text"
            autocomplete="username"
            placeholder="请输入用户名"
            class="input"
          />
        </div>
        <div class="form-group">
          <label for="password">密码</label>
          <input
            id="password"
            v-model="password"
            type="password"
            autocomplete="current-password"
            placeholder="请输入密码"
            class="input"
          />
        </div>
        <p v-if="error" class="form-error">{{ error }}</p>
        <button type="submit" class="btn-submit" :disabled="loading">
          {{ loading ? '登录中…' : '登录' }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 60vh;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  padding: var(--space-xl);
}

.login-theme {
  position: absolute;
  top: 1.5rem;
  right: 1.5rem;
}

.login-card {
  width: 100%;
  max-width: 380px;
  padding: var(--space-2xl);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  background: var(--gradient-card);
  box-shadow: var(--shadow-lg);
  position: relative;
  overflow: hidden;
}

/* 卡片顶部高光 */
.login-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
}

/* 装饰性背景光晕 */
.login-card::after {
  content: '';
  position: absolute;
  top: -50%;
  right: -50%;
  width: 100%;
  height: 100%;
  background: radial-gradient(circle, var(--accent-subtle) 0%, transparent 70%);
  pointer-events: none;
  z-index: 0;
}

.login-title {
  margin: 0 0 var(--space-sm);
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
  text-align: center;
  position: relative;
  z-index: 1;
  background: linear-gradient(135deg, var(--text-primary) 0%, var(--accent) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.login-desc {
  margin: 0 0 var(--space-xl);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  text-align: center;
  position: relative;
  z-index: 1;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  position: relative;
  z-index: 1;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-secondary);
}

.input {
  height: var(--control-h-lg);
  padding: 0 1rem;
  font-size: var(--text-base);
  color: var(--text-primary);
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  outline: none;
  transition: all var(--transition-fast) var(--ease-out-expo);
  box-shadow: var(--shadow-inner);
}

.input:hover:not(:focus) {
  border-color: var(--border-strong);
}

.input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-subtle), var(--shadow-inner);
  background: color-mix(in srgb, var(--bg-elevated) 95%, var(--accent) 5%);
}

.input::placeholder {
  color: var(--text-muted);
}

.form-error {
  margin: 0;
  padding: var(--space-sm) var(--space-md);
  font-size: var(--text-sm);
  color: var(--error);
  background: var(--error-subtle);
  border: 1px solid color-mix(in srgb, var(--error) 30%, transparent);
  border-radius: var(--radius-md);
}

.btn-submit {
  margin-top: var(--space-sm);
  min-height: var(--control-h-lg);
  padding: 0 1.5rem;
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--text-on-accent);
  background: var(--gradient-accent);
  border: none;
  border-radius: var(--radius-md);
  transition: all var(--transition-fast) var(--ease-out-expo);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.1);
  position: relative;
  overflow: hidden;
}

.btn-submit::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(110deg, transparent 25%, rgba(255,255,255,0.15) 50%, transparent 75%);
  transform: translateX(-100%);
  transition: transform 0.5s var(--ease-out-expo);
}

.btn-submit:hover:not(:disabled)::before {
  transform: translateX(100%);
}

.btn-submit:hover:not(:disabled) {
  background: linear-gradient(135deg, var(--accent-bright) 0%, var(--accent) 100%);
  box-shadow: var(--shadow-glow-accent), 0 4px 12px rgba(0, 0, 0, 0.15);
  transform: translateY(-1px);
}

.btn-submit:active:not(:disabled) {
  transform: translateY(0);
}

.btn-submit:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}
</style>
