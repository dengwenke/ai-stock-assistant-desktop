<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { getDesktopApi } from '@/platform/desktop/bridge'
import type { UpdateStatus } from '@shared/desktop-api'

const loading = ref(false)
const updateLoading = ref(false)
const importMessage = ref('')
const error = ref('')
const appInfo = ref<{ version: string; dataDir: string; remoteApiBase: string } | null>(null)
const statuses = ref<Array<{ taskKey: string; lastSuccessAt?: string | null; lastAttemptAt?: string | null; retryCount: number; lastError?: string | null }>>([])
const updateStatus = ref<UpdateStatus | null>(null)
let unsubscribe: (() => void) | null = null

async function loadData() {
  loading.value = true
  error.value = ''
  try {
    const api = getDesktopApi()
    const [info, syncStatuses, updaterStatus] = await Promise.all([
      api.settings.getAppInfo(),
      api.market.getSyncStatuses(),
      api.updates.getStatus(),
    ])
    appInfo.value = info
    statuses.value = syncStatuses
    updateStatus.value = updaterStatus
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    loading.value = false
  }
}

async function importSeedPackage() {
  loading.value = true
  error.value = ''
  importMessage.value = ''
  try {
    const result = await getDesktopApi().market.importSeedPackage()
    importMessage.value = result.message
    await loadData()
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    loading.value = false
  }
}

async function checkUpdates() {
  updateLoading.value = true
  error.value = ''
  try {
    updateStatus.value = await getDesktopApi().updates.checkForUpdates()
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    updateLoading.value = false
  }
}

async function downloadUpdate() {
  updateLoading.value = true
  error.value = ''
  try {
    updateStatus.value = await getDesktopApi().updates.downloadUpdate()
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    updateLoading.value = false
  }
}

async function quitAndInstall() {
  updateLoading.value = true
  error.value = ''
  try {
    await getDesktopApi().updates.quitAndInstall()
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
    updateLoading.value = false
  }
}

async function openReleasePage() {
  try {
    await getDesktopApi().updates.openReleasePage()
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  }
}

onMounted(() => {
  unsubscribe = getDesktopApi().updates.subscribeStatusChanged((status) => {
    updateStatus.value = status
  })
  void loadData()
})

onUnmounted(() => {
  unsubscribe?.()
})
</script>

<template>
  <div class="desktop-data-page terminal-page web-page">
    <section class="desktop-card">
      <div class="desktop-card-head">
        <div>
          <h2>本地行情数据</h2>
          <p>管理 Windows 本地行情库、初始化包导入和同步状态。</p>
        </div>
        <div class="desktop-card-actions">
          <button class="action-btn" :disabled="loading" @click="loadData">刷新状态</button>
          <button class="action-btn action-btn--primary" :disabled="loading" @click="importSeedPackage">导入初始化包</button>
        </div>
      </div>
      <div v-if="appInfo" class="meta-grid">
        <div class="meta-item"><span class="meta-label">应用版本</span><span class="meta-value">{{ appInfo.version }}</span></div>
        <div class="meta-item"><span class="meta-label">远程服务</span><span class="meta-value">{{ appInfo.remoteApiBase }}</span></div>
        <div class="meta-item meta-item--full"><span class="meta-label">数据目录</span><span class="meta-value">{{ appInfo.dataDir }}</span></div>
      </div>
      <div v-if="importMessage" class="hint success">{{ importMessage }}</div>
      <div v-if="error" class="hint error">{{ error }}</div>
    </section>

    <section class="desktop-card">
      <div class="desktop-card-head">
        <div>
          <h3>应用更新</h3>
          <p>更新流量允许直连 GitHub Releases；业务流量仍然只走你的服务器。</p>
        </div>
        <div class="desktop-card-actions">
          <button class="action-btn" :disabled="updateLoading || loading" @click="checkUpdates">检查更新</button>
          <button class="action-btn" :disabled="updateLoading || updateStatus?.stage !== 'available'" @click="downloadUpdate">下载更新</button>
          <button class="action-btn action-btn--primary" :disabled="updateLoading || updateStatus?.stage !== 'downloaded'" @click="quitAndInstall">立即安装</button>
        </div>
      </div>
      <div v-if="updateStatus" class="meta-grid">
        <div class="meta-item"><span class="meta-label">当前版本</span><span class="meta-value">{{ updateStatus.currentVersion }}</span></div>
        <div class="meta-item"><span class="meta-label">更新状态</span><span class="meta-value">{{ updateStatus.stage }}</span></div>
        <div class="meta-item"><span class="meta-label">仓库</span><span class="meta-value">{{ updateStatus.owner && updateStatus.repo ? `${updateStatus.owner}/${updateStatus.repo}` : '未配置' }}</span></div>
        <div class="meta-item"><span class="meta-label">可用版本</span><span class="meta-value">{{ updateStatus.availableVersion || '—' }}</span></div>
        <div class="meta-item"><span class="meta-label">上次检查</span><span class="meta-value">{{ updateStatus.lastCheckedAt || '—' }}</span></div>
        <div class="meta-item"><span class="meta-label">下载进度</span><span class="meta-value">{{ updateStatus.progressPercent != null ? `${updateStatus.progressPercent.toFixed(1)}%` : '—' }}</span></div>
        <div class="meta-item meta-item--full"><span class="meta-label">状态说明</span><span class="meta-value">{{ updateStatus.message || '—' }}</span></div>
        <div v-if="updateStatus.releaseNotes" class="meta-item meta-item--full"><span class="meta-label">更新说明</span><pre class="release-notes">{{ updateStatus.releaseNotes }}</pre></div>
      </div>
      <div class="desktop-card-actions desktop-card-actions--inline">
        <button class="action-btn" @click="openReleasePage">打开 Releases 页面</button>
      </div>
    </section>

    <section class="desktop-card">
      <div class="desktop-card-head">
        <div>
          <h3>同步任务</h3>
          <p>页面读本地，下面是桌面端已执行过的同步状态。</p>
        </div>
      </div>
      <div v-if="!statuses.length" class="empty-state">尚无同步记录。打开股票行情页后会自动按需同步。</div>
      <div v-else class="status-list">
        <article v-for="item in statuses" :key="item.taskKey" class="status-item">
          <div class="status-title">{{ item.taskKey }}</div>
          <div class="status-meta">最近成功：{{ item.lastSuccessAt || '—' }}</div>
          <div class="status-meta">最近尝试：{{ item.lastAttemptAt || '—' }}</div>
          <div class="status-meta">重试次数：{{ item.retryCount }}</div>
          <div class="status-meta status-meta--error">最近错误：{{ item.lastError || '—' }}</div>
        </article>
      </div>
    </section>
  </div>
</template>

<style scoped>
.desktop-data-page {
  display: grid;
  gap: 20px;
}

.desktop-card {
  border: 1px solid var(--border);
  background: var(--bg-panel);
  border-radius: 18px;
  padding: 20px;
  box-shadow: var(--shadow-soft);
}

.desktop-card-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  margin-bottom: 16px;
}

.desktop-card-head h2,
.desktop-card-head h3 {
  margin: 0 0 8px;
}

.desktop-card-head p {
  margin: 0;
  color: var(--text-secondary);
}

.desktop-card-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.desktop-card-actions--inline {
  margin-top: 14px;
}

.action-btn {
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text-primary);
  border-radius: 12px;
  padding: 10px 16px;
  cursor: pointer;
}

.action-btn:disabled {
  opacity: 0.56;
  cursor: not-allowed;
}

.action-btn--primary {
  background: var(--accent-primary);
  border-color: var(--accent-primary);
  color: #fff;
}

.meta-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.meta-item {
  display: grid;
  gap: 6px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--bg-elevated);
}

.meta-item--full {
  grid-column: 1 / -1;
}

.meta-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.meta-value {
  font-size: 14px;
  line-height: 1.5;
  word-break: break-all;
}

.release-notes {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  color: var(--text-primary);
}

.hint {
  margin-top: 14px;
  padding: 12px 14px;
  border-radius: 12px;
}

.hint.success {
  background: rgba(16, 185, 129, 0.12);
  color: #10b981;
}

.hint.error {
  background: rgba(239, 68, 68, 0.12);
  color: #ef4444;
}

.empty-state {
  padding: 18px;
  border: 1px dashed var(--border);
  border-radius: 14px;
  color: var(--text-secondary);
}

.status-list {
  display: grid;
  gap: 12px;
}

.status-item {
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--bg-elevated);
}

.status-title {
  font-weight: 600;
  margin-bottom: 8px;
}

.status-meta {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
}

.status-meta--error {
  color: #f59e0b;
}

@media (max-width: 960px) {
  .desktop-card-head {
    flex-direction: column;
  }

  .desktop-card-actions,
  .meta-grid {
    width: 100%;
  }

  .meta-grid {
    grid-template-columns: 1fr;
  }
}
</style>
