import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'
import type { DesktopAppInfo, EnsureStockBundleInput } from '@shared/desktop-api'
import { MarketDatabase } from './services/market-database'
import { MarketRepository } from './services/market-repository'
import { MarketSyncService } from './services/market-sync-service'
import { SeedImportService } from './services/seed-import-service'
import { SessionState } from './services/session-state'
import { SyncScheduler } from './services/sync-scheduler'
import { AppUpdaterService } from './services/app-updater-service'

const remoteApiBase = process.env.REMOTE_API_BASE || 'http://127.0.0.1:8000/api'
let mainWindow: BrowserWindow | null = null
let promptedDownloadedVersion: string | null = null

const userDataDir = app.getPath('userData')
const marketDataDir = join(userDataDir, 'market-data')
mkdirSync(marketDataDir, { recursive: true })

const database = new MarketDatabase(marketDataDir)
const repository = new MarketRepository(database)
const syncService = new MarketSyncService(repository, remoteApiBase)
const seedImportService = new SeedImportService(database, repository)
const sessionState = new SessionState()
const appUpdater = new AppUpdaterService()
const scheduler = new SyncScheduler(async () => {
  const token = sessionState.getAuthToken()
  if (!token) return
  await syncService.runScheduledSync(token)
}, 15 * 60 * 1000)

database.initialize()

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1200,
    minHeight: 760,
    autoHideMenuBar: true,
    title: 'AI Stock Assistant Desktop',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false,
    },
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()
  scheduler.start()
  appUpdater.initialize()
  appUpdater.subscribe((status) => {
    mainWindow?.webContents.send('updates:status-changed', status)

    if (status.stage === 'downloaded' && status.availableVersion && status.availableVersion !== promptedDownloadedVersion) {
      promptedDownloadedVersion = status.availableVersion
      void dialog.showMessageBox(mainWindow!, {
        type: 'info',
        title: '更新已下载',
        message: `新版本 ${status.availableVersion} 已下载完成`,
        detail: '现在重启应用并安装更新，或选择稍后安装。',
        buttons: ['稍后', '立即安装'],
        defaultId: 1,
        cancelId: 0,
      }).then((result) => {
        if (result.response === 1) {
          void appUpdater.quitAndInstall()
        }
      }).catch(() => {})
    }
  })
  appUpdater.scheduleStartupCheck()
  appUpdater.schedulePeriodicCheck()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  scheduler.stop()
  appUpdater.stopPeriodicCheck()
  database.close()
})

ipcMain.handle('settings:getAppInfo', async (): Promise<DesktopAppInfo> => ({
  version: app.getVersion(),
  dataDir: marketDataDir,
  remoteApiBase,
}))
ipcMain.handle('settings:setAuthToken', async (_event, token: string | null) => {
  sessionState.setAuthToken(token)
})

ipcMain.handle('updates:getStatus', async () => appUpdater.getStatus())
ipcMain.handle('updates:checkForUpdates', async () => appUpdater.checkForUpdates())
ipcMain.handle('updates:downloadUpdate', async () => appUpdater.downloadUpdate())
ipcMain.handle('updates:quitAndInstall', async () => appUpdater.quitAndInstall())
ipcMain.handle('updates:openReleasePage', async () => appUpdater.openReleasePage())

ipcMain.handle('market:getStockInfo', async (_event, input: { stockCode: string }) => repository.getStockInfo(input.stockCode))
ipcMain.handle('market:getStockHistory', async (_event, input: { stockCode: string; market?: string; startDate?: string; endDate?: string }) => repository.getStockHistory(input.stockCode, input.market, input.startDate, input.endDate))
ipcMain.handle('market:getStockIntraday', async (_event, input: { stockCode: string; date: string; market?: string; intervalMinutes?: number }) => repository.getStockIntraday(input.stockCode, input.date, input.intervalMinutes ?? 1, input.market ?? 'A'))
ipcMain.handle('market:getStockIndicator', async (_event, input: { stockCode: string; market?: string; startDate?: string; endDate?: string }) => repository.getStockIndicators(input.stockCode, input.market, input.startDate, input.endDate))
ipcMain.handle('market:getTradeCalendar', async (_event, input: { market: string; startDate: string; endDate: string }) => repository.getTradeCalendar(input.market, input.startDate, input.endDate))
ipcMain.handle('market:batchSpotQuote', async (_event, input: { codes: string[]; market?: string }) => repository.getSpotQuotes(input.codes, input.market))
ipcMain.handle('market:getSyncStatuses', async () => repository.getSyncStatuses())
ipcMain.handle('market:ensureStockBundle', async (_event, input: EnsureStockBundleInput) => syncService.ensureStockBundle(input))
ipcMain.handle('market:syncTradeCalendar', async (_event, input: { market: string; startDate: string; endDate: string; token?: string | null }) => syncService.syncTradeCalendar(input.market, input.startDate, input.endDate, input.token))
ipcMain.handle('market:refreshSpotQuotes', async (_event, input: { codes: string[]; market?: string; token?: string | null }) => syncService.refreshSpotQuotes(input.codes, input.market ?? 'A', input.token))
ipcMain.handle('market:importSeedPackage', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: '选择行情初始化包目录或文件',
    properties: ['openFile', 'openDirectory'],
    filters: [
      { name: 'Seed Package', extensions: ['json', 'db'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  })
  if (result.canceled || !result.filePaths[0]) {
    return { imported: false, message: '已取消导入' }
  }
  return seedImportService.importFromPath(result.filePaths[0])
})
