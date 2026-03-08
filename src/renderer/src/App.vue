<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import dayjs from 'dayjs'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import { usePriceColorStore } from '@/stores/priceColor'
import { useWorkspaceStore } from '@/stores/workspace'
import { storeToRefs } from 'pinia'
import ThemeSwitcher from '@/components/ThemeSwitcher.vue'
import WorkspaceSwitcher from '@/components/WorkspaceSwitcher.vue'
import GlobalErrorModal from '@/components/GlobalErrorModal.vue'
import TradeDatePicker from '@/components/TradeDatePicker.vue'
import { isDesktopRuntime } from '@/platform/runtime'
import { getDesktopApi } from '@/platform/desktop/bridge'
import type { UpdateStatus } from '@shared/desktop-api'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const themeStore = useThemeStore()
const priceColorStore = usePriceColorStore()
const workspaceStore = useWorkspaceStore()
const { isLoggedIn, username } = storeToRefs(auth)
const { currentConfig } = storeToRefs(workspaceStore)

const userMenuOpen = ref(false)
const userMenuRef = ref<HTMLElement | null>(null)
const calendarOpen = ref(false)
const calendarRef = ref<HTMLElement | null>(null)
const calendarDate = ref(dayjs().format('YYYY-MM-DD'))
const updateStatus = ref<UpdateStatus | null>(null)
let unsubscribeUpdate: (() => void) | null = null

function closeUserMenu() {
  userMenuOpen.value = false
}

function toggleUserMenu() {
  userMenuOpen.value = !userMenuOpen.value
}

function toggleCalendar() {
  calendarOpen.value = !calendarOpen.value
}

function onDocumentClick(e: MouseEvent) {
  const target = e.target as Node
  if (userMenuRef.value && !userMenuRef.value.contains(target)) {
    closeUserMenu()
  }
  if (calendarRef.value && !calendarRef.value.contains(target)) {
    calendarOpen.value = false
  }
}

onMounted(() => {
  themeStore.initTheme()
  priceColorStore.init()
  workspaceStore.init()
  document.addEventListener('click', onDocumentClick, true)

  if (desktopMode) {
    const updates = getDesktopApi().updates
    void updates.getStatus().then((status) => {
      updateStatus.value = status
    }).catch(() => {})
    unsubscribeUpdate = updates.subscribeStatusChanged((status) => {
      updateStatus.value = status
    })
  }
})

onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick, true)
  unsubscribeUpdate?.()
})

function logout() {
  closeUserMenu()
  auth.clearAuth()
  router.push('/login')
}

const routeSubtitleMap: Record<string, string> = {
  'today-watch': '聚焦盘中机会，优先处理强信号标的',
  announcements: '追踪公告分析结论，快速筛选重点公司',
  'ema-tracker': '筛选一周内回踩 EMA120 的趋势标的',
  'notice-original': '回溯原始公告文本，确保信息完整性',
  'stock-detail': '汇总个股画像、公告、技术与分析结论',
  'stock-quote': '查看实时行情与分时变化',
  'analysis-detail': '深入查看单条公告的结构化分析',
  'desktop-data': '查看本地行情库、导入状态与同步记录',
}

const pageTitle = computed(() => (route.meta?.title as string) || 'AI 交易助手')
const pageSubtitle = computed(() => routeSubtitleMap[String(route.name)] || '数据驱动决策')
const subtitleHiddenRoutes = new Set(['today-watch', 'announcements', 'notice-original'])
const showPageSubtitle = computed(() => !subtitleHiddenRoutes.has(String(route.name)))
const pageHeadHiddenRoutes = new Set(['today-watch', 'announcements', 'notice-original'])
const showPageHead = computed(() => !pageHeadHiddenRoutes.has(String(route.name)))
const desktopMode = isDesktopRuntime()

const showUpdateChip = computed(() => desktopMode && !!updateStatus.value)

const updateChipLabel = computed(() => {
  const status = updateStatus.value
  if (!status) return '检查更新'
  switch (status.stage) {
    case 'checking':
      return '检查更新中'
    case 'available':
      return status.availableVersion ? `发现 ${status.availableVersion}` : '发现更新'
    case 'downloading':
      return status.progressPercent != null ? `更新 ${status.progressPercent.toFixed(0)}%` : '下载更新中'
    case 'downloaded':
      return '更新已就绪'
    case 'not-available':
      return '已是最新'
    case 'error':
      return '更新失败'
    case 'disabled':
      return '更新未启用'
    default:
      return '检查更新'
  }
})

const updateChipClass = computed(() => {
  const stage = updateStatus.value?.stage
  return {
    'is-checking': stage === 'checking' || stage === 'downloading',
    'is-available': stage === 'available',
    'is-ready': stage === 'downloaded',
    'is-error': stage === 'error',
    'is-idle': stage === 'idle' || stage === 'not-available' || stage === 'disabled' || !stage,
  }
})

const updateChipTitle = computed(() => updateStatus.value?.message || '检查和安装桌面端更新')

function openUpdateCenter() {
  router.push('/desktop/data')
}
</script>

<template>
  <div class="app">
    <header v-if="isLoggedIn" class="header">
      <div class="header-inner">
        <div class="header-left">
          <router-link to="/" class="nav-logo">
            <span class="logo-icon" aria-hidden="true">◇</span>
            <span class="logo-text">公告助手</span>
          </router-link>
          <div ref="calendarRef" class="workspace-calendar-group" :class="{ 'is-open': calendarOpen }">
            <WorkspaceSwitcher :fused-right="true" />
            <button
              type="button"
              class="workspace-calendar-btn"
              :class="{ active: calendarOpen }"
              aria-haspopup="dialog"
              :aria-expanded="calendarOpen"
              title="打开交易日历"
              @click.stop="toggleCalendar"
            >
              <span class="workspace-calendar-icon" aria-hidden="true"></span>
              <span class="workspace-calendar-label">交易日历</span>
            </button>
            <div v-show="calendarOpen" class="calendar-panel calendar-panel--workspace">
              <div class="calendar-panel-title">交易日历查看</div>
              <TradeDatePicker
                v-model="calendarDate"
                placeholder="选择交易日"
                :inline="true"
              />
              <div class="calendar-panel-info">
                市场：{{ currentConfig.label }} · 已选日期：{{ calendarDate }}
              </div>
            </div>
          </div>
          <nav class="nav-main">
            <router-link to="/" class="nav-link" :class="{ active: $route.name === 'today-watch' }">
              <span class="nav-link-icon nav-link-icon--watch" aria-hidden="true"></span>
              <span>当日看盘</span>
            </router-link>
            <router-link to="/announcements" class="nav-link" :class="{ active: $route.name === 'announcements' }">
              <span class="nav-link-icon nav-link-icon--analysis" aria-hidden="true"></span>
              <span>公告分析</span>
            </router-link>
            <router-link
              to="/ema-tracker"
              class="nav-link"
              :class="{ active: $route.name === 'ema-tracker' }"
            >
              <span class="nav-link-icon nav-link-icon--track" aria-hidden="true"></span>
              <span>EMA追踪</span>
            </router-link>
            <router-link to="/notice-original" class="nav-link" :class="{ active: $route.name === 'notice-original' }">
              <span class="nav-link-icon nav-link-icon--notice" aria-hidden="true"></span>
              <span>公告原文</span>
            </router-link>
            <router-link v-if="desktopMode" to="/desktop/data" class="nav-link" :class="{ active: $route.name === 'desktop-data' }">
              <span class="nav-link-icon nav-link-icon--notice" aria-hidden="true"></span>
              <span>本地数据</span>
            </router-link>
          </nav>
        </div>
        <nav class="nav-util">
          <button
            type="button"
            class="price-color-toggle"
            :class="{ reversed: priceColorStore.isReversed }"
            title="切换涨跌颜色"
            @click="priceColorStore.toggle()"
          >
            <span class="toggle-arrow up">↑</span>
            <span class="toggle-arrow down">↓</span>
          </button>
          <button
            v-if="showUpdateChip"
            type="button"
            class="nav-item nav-update"
            :class="updateChipClass"
            :title="updateChipTitle"
            @click="openUpdateCenter"
          >
            <span class="nav-update-dot" aria-hidden="true"></span>
            <span>{{ updateChipLabel }}</span>
          </button>
          <span class="nav-item-wrap">
            <ThemeSwitcher />
          </span>
          <div ref="userMenuRef" class="user-menu">
            <button
              type="button"
              class="nav-item nav-user"
              :title="username ?? undefined"
              aria-haspopup="true"
              :aria-expanded="userMenuOpen"
              @click="toggleUserMenu"
            >
              {{ username }}
            </button>
            <div v-show="userMenuOpen" class="user-menu-dropdown">
              <button type="button" class="user-menu-item" @click="logout">退出</button>
            </div>
          </div>
        </nav>
      </div>
    </header>
    <main class="main" :class="{ 'main-full': !isLoggedIn }">
      <section v-if="isLoggedIn && showPageHead" class="page-head">
        <div class="page-head-title">{{ pageTitle }}</div>
        <div v-if="showPageSubtitle" class="page-head-subtitle">{{ pageSubtitle }}</div>
      </section>
      <router-view v-slot="{ Component }">
        <transition name="page-fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
    <GlobalErrorModal />
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.header {
  position: sticky;
  top: 0;
  z-index: 1400;
  border-bottom: 1px solid var(--border);
  background: var(--bg-glass);
  backdrop-filter: blur(16px) saturate(1.5);
  -webkit-backdrop-filter: blur(16px) saturate(1.5);
}

/* header 底部渐变边框 */
.header::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--accent-subtle), transparent);
}

.header-inner {
  max-width: var(--layout-content-max, var(--max-content));
  margin: 0 auto;
  padding: var(--space-sm) var(--layout-page-gutter, var(--space-lg));
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--space-lg);
  min-width: 0;
}

/* Logo：增强视觉效果 */
.nav-logo {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-height: var(--control-h);
  padding: 0 0.5rem 0 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  text-decoration: none;
  transition: all var(--transition-fast) var(--ease-out-expo);
  white-space: nowrap;
}

.nav-logo:hover {
  color: var(--accent);
  text-decoration: none;
}

.nav-logo:hover .logo-icon {
  transform: rotate(45deg) scale(1.1);
  filter: drop-shadow(0 0 8px var(--accent-glow));
}

.logo-icon {
  color: var(--accent);
  font-size: 1.25rem;
  line-height: 1;
  transition: all var(--transition-normal) var(--ease-out-back);
}

.logo-text {
  line-height: 1;
  background: linear-gradient(135deg, var(--text-primary) 0%, var(--text-secondary) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.nav-logo:hover .logo-text {
  background: linear-gradient(135deg, var(--accent) 0%, var(--accent-bright) 100%);
  -webkit-background-clip: text;
  background-clip: text;
}

/* 主导航：增强交互 */
.nav-main {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.nav-link {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: var(--control-h);
  padding: 0 1rem;
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-secondary);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  text-decoration: none;
  transition: all var(--transition-fast) var(--ease-out-expo);
  white-space: nowrap;
  position: relative;
}

/* 悬停下划线效果 */
.nav-link::after {
  content: '';
  position: absolute;
  bottom: 4px;
  left: 50%;
  width: 0;
  height: 2px;
  background: var(--accent);
  border-radius: 1px;
  transition: all var(--transition-fast) var(--ease-out-expo);
  transform: translateX(-50%);
}

.nav-link:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
  text-decoration: none;
}

.nav-link:hover::after {
  width: 60%;
}

.nav-link.active {
  color: var(--accent);
  background: var(--accent-subtle);
  border-color: color-mix(in srgb, var(--accent) 30%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 15%, transparent);
}

.nav-link.active::after {
  width: 60%;
  background: var(--accent-bright);
}

.nav-link-icon {
  width: 0.625rem;
  height: 0.625rem;
  border-radius: 2px;
  opacity: 0.9;
  transition: all var(--transition-fast);
  background: linear-gradient(135deg, var(--text-muted), var(--text-secondary));
}

.nav-link:hover .nav-link-icon {
  opacity: 1;
  transform: rotate(8deg) scale(1.05);
}

.nav-link-icon--watch {
  background: linear-gradient(135deg, #0ea5e9, #3b82f6);
}

.nav-link-icon--analysis {
  background: linear-gradient(135deg, #10b981, #34d399);
}

.nav-link-icon--track {
  background: linear-gradient(135deg, #f59e0b, #f97316);
}

.nav-link-icon--notice {
  background: linear-gradient(135deg, #8b5cf6, #6366f1);
}

.workspace-calendar-group {
  position: relative;
  display: inline-flex;
  align-items: stretch;
  z-index: 1;
}

.workspace-calendar-group.is-open {
  z-index: 6;
}

.workspace-calendar-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: var(--control-h);
  padding: 0 0.72rem;
  font-family: inherit;
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-secondary);
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-left: 1px solid var(--border-subtle);
  border-radius: 0 var(--radius-md) var(--radius-md) 0;
  cursor: pointer;
  transition:
    color var(--transition-fast) var(--ease-out-expo),
    background var(--transition-fast) var(--ease-out-expo),
    border-color var(--transition-fast) var(--ease-out-expo),
    box-shadow var(--transition-fast) var(--ease-out-expo),
    transform 0.2s var(--ease-out-back);
  transform-origin: center left;
}

.workspace-calendar-btn:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
  border-color: color-mix(in srgb, var(--accent) 18%, var(--border));
  transform: translateY(-1px);
}

.workspace-calendar-btn.active {
  color: var(--accent);
  background: var(--accent-subtle);
  border-color: color-mix(in srgb, var(--accent) 28%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 14%, transparent);
}

.workspace-calendar-btn:active {
  transform: scale(0.98);
}

.workspace-calendar-btn:focus-visible {
  outline: none;
  z-index: 1;
  box-shadow:
    0 0 0 2px color-mix(in srgb, var(--accent) 42%, transparent),
    0 0 0 4px color-mix(in srgb, var(--accent) 14%, transparent);
}

.workspace-calendar-icon {
  width: 0.625rem;
  height: 0.625rem;
  border-radius: 2px;
  opacity: 0.92;
  background: linear-gradient(135deg, #f59e0b, #fbbf24);
  transition: transform var(--transition-fast) var(--ease-out-back), opacity var(--transition-fast);
}

.workspace-calendar-btn:hover .workspace-calendar-icon {
  opacity: 1;
  transform: rotate(8deg) scale(1.05);
}

@media (max-width: 1260px) {
  .workspace-calendar-label {
    display: none;
  }

  .workspace-calendar-btn {
    padding: 0 0.56rem;
  }
}

@media (max-width: 1100px) {
  .workspace-calendar-btn {
    padding: 0 0.5rem;
    font-size: var(--text-xs);
  }
}

.nav-util {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.price-color-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.15rem;
  min-height: var(--control-h);
  padding: 0 0.5rem;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: color var(--transition-fast), background var(--transition-fast), border-color var(--transition-fast);
}

.price-color-toggle:hover {
  background: var(--bg-card);
  border-color: var(--text-muted);
}

.toggle-arrow {
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1;
}

.toggle-arrow.up {
  color: var(--price-up);
}

.toggle-arrow.down {
  color: var(--price-down);
}

.price-color-toggle.reversed .toggle-arrow.up {
  color: var(--price-down);
}

.price-color-toggle.reversed .toggle-arrow.down {
  color: var(--price-up);
}

.nav-item-wrap {
  display: inline-flex;
  align-items: center;
  min-height: var(--control-h);
}

.nav-update {
  cursor: pointer;
}

.nav-update:hover {
  color: var(--text-primary);
  background: var(--bg-card);
}

.nav-update-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 999px;
  background: var(--text-muted);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--text-muted) 35%, transparent);
}

.nav-update.is-idle .nav-update-dot {
  background: var(--text-muted);
}

.nav-update.is-checking {
  border-color: color-mix(in srgb, #3b82f6 35%, var(--border));
  color: #3b82f6;
}

.nav-update.is-checking .nav-update-dot {
  background: #3b82f6;
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.14);
}

.nav-update.is-available {
  border-color: color-mix(in srgb, #f59e0b 38%, var(--border));
  color: #f59e0b;
}

.nav-update.is-available .nav-update-dot {
  background: #f59e0b;
  box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.14);
}

.nav-update.is-ready {
  border-color: color-mix(in srgb, #10b981 38%, var(--border));
  color: #10b981;
  background: rgba(16, 185, 129, 0.08);
}

.nav-update.is-ready .nav-update-dot {
  background: #10b981;
  box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.14);
}

.nav-update.is-error {
  border-color: color-mix(in srgb, #ef4444 38%, var(--border));
  color: #ef4444;
}

.nav-update.is-error .nav-update-dot {
  background: #ef4444;
  box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.14);
}

.nav-item {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  min-height: var(--control-h);
  padding: 0 0.75rem;
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-secondary);
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  text-decoration: none;
  transition: color var(--transition-fast), background var(--transition-fast), border-color var(--transition-fast);
  white-space: nowrap;
}

.nav-item:hover {
  text-decoration: none;
}

/* 用户名 + 下拉菜单（退出） */
.user-menu {
  position: relative;
  display: inline-flex;
}

.nav-user {
  max-width: 8rem;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--text-muted);
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
}

.nav-user:hover {
  color: var(--text-primary);
  border-color: var(--text-muted);
  background: var(--bg-card);
}

.user-menu-dropdown {
  position: absolute;
  top: calc(100% + var(--space-xs));
  right: 0;
  min-width: 100%;
  padding: var(--space-xs);
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  z-index: 50;
}

.user-menu-item {
  display: block;
  width: 100%;
  padding: var(--space-sm) 0.75rem;
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-secondary);
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  transition: color var(--transition-fast), background var(--transition-fast);
}

.user-menu-item:hover {
  color: var(--text-primary);
  background: var(--bg-elevated);
}

.main {
  flex: 1;
  max-width: var(--layout-content-max, var(--max-content));
  margin: 0 auto;
  padding: var(--layout-page-top, var(--space-xl)) var(--layout-page-gutter, var(--space-lg));
  width: 100%;
}

.main-full {
  max-width: none;
}

.calendar-panel {
  position: absolute;
  top: calc(100% + 0.45rem);
  left: 0;
  z-index: 80;
  min-width: 360px;
  padding: var(--space-sm);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-card);
  box-shadow: var(--shadow-lg);
}

.calendar-panel--workspace {
  position: absolute;
  top: calc(100% + var(--space-xs));
  right: 0;
  left: auto;
  transform: none;
  z-index: 120;
}

.calendar-panel-title {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--space-xs);
}

.calendar-panel-info {
  margin-top: var(--space-xs);
  font-size: var(--text-xs);
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.page-head {
  margin-bottom: var(--space-md);
  padding: var(--space-md) var(--space-lg);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background:
    linear-gradient(120deg, color-mix(in srgb, var(--accent-subtle) 40%, transparent) 0%, transparent 45%),
    var(--bg-card);
  box-shadow: var(--shadow-sm);
}

.page-head-title {
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}

.page-head-subtitle {
  margin-top: 0.15rem;
  font-size: var(--text-xs);
  color: var(--text-muted);
}

/* 移动端导航：仅 Logo + 色系 + 用户下拉，统一胶囊风格 */
@media (max-width: 768px) {
  .header-inner {
    padding: var(--space-sm) var(--space-md);
  }

  .nav-item {
    min-height: 2rem;
    padding: 0 0.6rem;
    font-size: 0.8125rem;
  }

  .logo-text {
    font-size: 0.9375rem;
  }

  .workspace-calendar-btn {
    min-height: 1.78rem;
    padding: 0 0.45rem;
    font-size: var(--text-xs);
  }

  .nav {
    gap: 0.4rem;
  }

  .nav-user {
    max-width: 6rem;
  }

  .user-menu-dropdown {
    min-width: 7rem;
  }

  .main {
    padding: var(--space-md);
  }

  .page-head {
    margin-bottom: var(--space-sm);
    padding: var(--space-sm) var(--space-md);
  }

  .calendar-panel {
    left: auto;
    right: 0;
    min-width: 290px;
  }

  .calendar-panel--workspace {
    right: 0;
    left: auto;
  }
}

@media (max-width: 480px) {
  .header-inner {
    padding: var(--space-sm) max(0.75rem, env(safe-area-inset-left));
    padding-right: max(0.75rem, env(safe-area-inset-right));
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .nav-item {
    min-height: 2rem;
    padding: 0 0.5rem;
    font-size: 0.75rem;
  }

  .logo-text {
    font-size: 0.875rem;
  }

  .workspace-calendar-btn {
    padding: 0 0.42rem;
  }

  .nav {
    flex: 1;
    justify-content: flex-end;
    flex-wrap: nowrap;
    gap: 0.35rem;
  }

  .nav-user {
    max-width: 5rem;
  }

  .user-menu-dropdown {
    right: 0;
    min-width: 6rem;
  }

  .main {
    padding: 0.75rem max(0.75rem, env(safe-area-inset-left));
    padding-right: max(0.75rem, env(safe-area-inset-right));
  }

  .calendar-panel--workspace {
    right: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .workspace-calendar-btn {
    transition:
      color var(--transition-fast) linear,
      background var(--transition-fast) linear,
      border-color var(--transition-fast) linear,
      box-shadow var(--transition-fast) linear;
  }

  .workspace-calendar-btn:hover,
  .workspace-calendar-btn:active {
    transform: none;
  }

  .workspace-calendar-btn:hover .workspace-calendar-icon {
    transform: none;
  }
}

/* 页面切换过渡：淡入淡出，提升流程顺畅感 */
.page-fade-enter-active,
.page-fade-leave-active {
  transition: opacity var(--transition-fast) ease, transform 0.2s ease;
}
.page-fade-enter-from {
  opacity: 0;
  transform: translateY(4px);
}
.page-fade-leave-to {
  opacity: 0;
  transform: translateY(-2px);
}
</style>
