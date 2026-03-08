import { EventEmitter } from 'node:events'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { app, shell } from 'electron'
import log from 'electron-log'
import { NsisUpdater, type AppUpdater, type UpdateInfo } from 'electron-updater'
import type { UpdateStatus } from '@shared/desktop-api'

interface UpdateRepoConfig {
  provider: 'github'
  owner: string
  repo: string
}

function normalizeReleaseNotes(input: UpdateInfo['releaseNotes']): string | null {
  if (!input) return null
  if (typeof input === 'string') return input
  if (Array.isArray(input)) {
    return input
      .map((item) => {
        if (typeof item === 'string') return item
        if (!item) return ''
        return `${item.version ?? ''}`.trim() + (item.note ? `\n${item.note}` : '')
      })
      .filter(Boolean)
      .join('\n\n')
  }
  return null
}

export class AppUpdaterService {
  private readonly emitter = new EventEmitter()
  private updater: AppUpdater | null = null
  private readonly isDevEnabled = process.env.ENABLE_DESKTOP_UPDATER_DEV === 'true'
  private periodicTimer: NodeJS.Timeout | null = null
  private status: UpdateStatus = {
    stage: 'idle',
    supported: false,
    autoCheckEnabled: false,
    currentVersion: app.getVersion(),
    message: '更新服务尚未初始化',
    provider: 'github',
    owner: null,
    repo: null,
  }

  initialize() {
    const repoConfig = this.resolveRepoConfig()
    if (process.platform !== 'win32') {
      this.updateStatus({
        stage: 'disabled',
        supported: false,
        autoCheckEnabled: false,
        message: '自动更新仅在 Windows 安装包中启用',
        owner: repoConfig?.owner ?? null,
        repo: repoConfig?.repo ?? null,
      })
      return
    }
    if (!app.isPackaged && !this.isDevEnabled) {
      this.updateStatus({
        stage: 'disabled',
        supported: false,
        autoCheckEnabled: false,
        message: '开发模式默认禁用自动更新',
        owner: repoConfig?.owner ?? null,
        repo: repoConfig?.repo ?? null,
      })
      return
    }
    if (!repoConfig) {
      this.updateStatus({
        stage: 'disabled',
        supported: false,
        autoCheckEnabled: false,
        message: '缺少 GitHub Releases 仓库配置',
      })
      return
    }

    const updater = new NsisUpdater({
      provider: 'github',
      owner: repoConfig.owner,
      repo: repoConfig.repo,
      private: false,
    })
    log.transports.file.level = 'info'
    updater.logger = log
    updater.autoDownload = false
    updater.autoInstallOnAppQuit = false
    this.updater = updater

    updater.on('checking-for-update', () => {
      log.info('[updater] checking for update')
      this.updateStatus({
        stage: 'checking',
        supported: true,
        autoCheckEnabled: true,
        message: '正在检查更新…',
      })
    })

    updater.on('update-available', (info) => {
      log.info('[updater] update available', info.version)
      this.updateStatus({
        stage: 'available',
        supported: true,
        autoCheckEnabled: true,
        availableVersion: info.version,
        releaseDate: info.releaseDate ?? null,
        releaseName: info.releaseName ?? null,
        releaseNotes: normalizeReleaseNotes(info.releaseNotes),
        message: `发现新版本 ${info.version}，开始后台下载`,
      })
      void this.downloadUpdate().catch((error) => {
        this.updateStatus({
          stage: 'error',
          supported: true,
          autoCheckEnabled: true,
          message: error instanceof Error ? error.message : String(error),
        })
      })
    })

    updater.on('update-not-available', () => {
      log.info('[updater] no update available')
      this.updateStatus({
        stage: 'not-available',
        supported: true,
        autoCheckEnabled: true,
        message: '当前已经是最新版本',
      })
    })

    updater.on('download-progress', (progress) => {
      log.info('[updater] download progress', progress.percent)
      this.updateStatus({
        stage: 'downloading',
        supported: true,
        autoCheckEnabled: true,
        progressPercent: progress.percent,
        bytesPerSecond: progress.bytesPerSecond,
        transferred: progress.transferred,
        total: progress.total,
        message: `更新下载中 ${progress.percent.toFixed(1)}%`,
      })
    })

    updater.on('update-downloaded', (event) => {
      log.info('[updater] update downloaded', event.version)
      this.updateStatus({
        stage: 'downloaded',
        supported: true,
        autoCheckEnabled: true,
        availableVersion: event.version,
        releaseDate: event.releaseDate ?? null,
        releaseName: event.releaseName ?? null,
        releaseNotes: normalizeReleaseNotes(event.releaseNotes),
        downloadedFile: event.downloadedFile ?? null,
        progressPercent: 100,
        message: `更新 ${event.version} 已下载完成，可立即安装`,
      })
    })

    updater.on('error', (error) => {
      log.error('[updater] error', error)
      this.updateStatus({
        stage: 'error',
        supported: true,
        autoCheckEnabled: true,
        message: error?.message || String(error),
      })
    })

    this.updateStatus({
      stage: 'idle',
      supported: true,
      autoCheckEnabled: true,
      message: '更新服务已就绪',
      owner: repoConfig.owner,
      repo: repoConfig.repo,
      provider: 'github',
    })
  }

  scheduleStartupCheck(delayMs = 8000) {
    if (!this.updater) return
    setTimeout(() => {
      void this.checkForUpdates().catch((error) => {
        this.updateStatus({
          stage: 'error',
          message: error instanceof Error ? error.message : String(error),
        })
      })
    }, delayMs)
  }

  schedulePeriodicCheck(intervalMs = 6 * 60 * 60 * 1000) {
    if (!this.updater || this.periodicTimer) return
    this.periodicTimer = setInterval(() => {
      void this.checkForUpdates().catch((error) => {
        log.error('[updater] periodic check failed', error)
      })
    }, intervalMs)
  }

  stopPeriodicCheck() {
    if (!this.periodicTimer) return
    clearInterval(this.periodicTimer)
    this.periodicTimer = null
  }

  subscribe(listener: (status: UpdateStatus) => void) {
    this.emitter.on('status', listener)
    listener(this.status)
    return () => this.emitter.off('status', listener)
  }

  getStatus() {
    return this.status
  }

  async checkForUpdates() {
    if (!this.updater) return this.status
    if (this.status.stage === 'checking' || this.status.stage === 'downloading') return this.status
    await this.updater.checkForUpdates()
    return this.status
  }

  async downloadUpdate() {
    if (!this.updater) return this.status
    if (this.status.stage === 'downloading' || this.status.stage === 'downloaded') return this.status
    await this.updater.downloadUpdate()
    return this.status
  }

  async quitAndInstall() {
    if (!this.updater) return
    this.updater.quitAndInstall(false, true)
  }

  async openReleasePage() {
    const repo = this.resolveRepoConfig()
    if (!repo) return
    await shell.openExternal(`https://github.com/${repo.owner}/${repo.repo}/releases`)
  }

  private resolveRepoConfig(): UpdateRepoConfig | null {
    const envOwner = process.env.GH_UPDATE_OWNER?.trim()
    const envRepo = process.env.GH_UPDATE_REPO?.trim()
    if (envOwner && envRepo) {
      return { provider: 'github', owner: envOwner, repo: envRepo }
    }

    try {
      const packageJsonPath = join(app.getAppPath(), 'package.json')
      const raw = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as {
        config?: Record<string, string | undefined>
      }
      const owner = raw.config?.auto_update_owner?.trim()
      const repo = raw.config?.auto_update_repo?.trim()
      const provider = raw.config?.auto_update_provider?.trim()
      if (provider === 'github' && owner && repo) {
        return { provider: 'github', owner, repo }
      }
    } catch {
      return null
    }

    return null
  }

  private updateStatus(patch: Partial<UpdateStatus>) {
    const shouldStamp = patch.stage === 'checking' || patch.stage === 'available' || patch.stage === 'not-available' || patch.stage === 'downloaded' || patch.stage === 'error'
    this.status = {
      ...this.status,
      ...patch,
      currentVersion: app.getVersion(),
      lastCheckedAt: shouldStamp ? new Date().toISOString() : this.status.lastCheckedAt ?? null,
    }
    this.emitter.emit('status', this.status)
  }
}
