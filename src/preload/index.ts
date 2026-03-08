import { contextBridge, ipcRenderer } from 'electron'
import type { DesktopBridgeApi, UpdateStatus } from '@shared/desktop-api'

const api: DesktopBridgeApi = {
  market: {
    getStockInfo: (input) => ipcRenderer.invoke('market:getStockInfo', input),
    getStockHistory: (input) => ipcRenderer.invoke('market:getStockHistory', input),
    getStockIntraday: (input) => ipcRenderer.invoke('market:getStockIntraday', input),
    getStockIndicator: (input) => ipcRenderer.invoke('market:getStockIndicator', input),
    getTradeCalendar: (input) => ipcRenderer.invoke('market:getTradeCalendar', input),
    batchSpotQuote: (input) => ipcRenderer.invoke('market:batchSpotQuote', input),
    ensureStockBundle: (input) => ipcRenderer.invoke('market:ensureStockBundle', input),
    syncTradeCalendar: (input) => ipcRenderer.invoke('market:syncTradeCalendar', input),
    refreshSpotQuotes: (input) => ipcRenderer.invoke('market:refreshSpotQuotes', input),
    importSeedPackage: () => ipcRenderer.invoke('market:importSeedPackage'),
    getSyncStatuses: () => ipcRenderer.invoke('market:getSyncStatuses'),
  },
  updates: {
    getStatus: () => ipcRenderer.invoke('updates:getStatus'),
    checkForUpdates: () => ipcRenderer.invoke('updates:checkForUpdates'),
    downloadUpdate: () => ipcRenderer.invoke('updates:downloadUpdate'),
    quitAndInstall: () => ipcRenderer.invoke('updates:quitAndInstall'),
    openReleasePage: () => ipcRenderer.invoke('updates:openReleasePage'),
    subscribeStatusChanged: (listener) => {
      const subscription = (_event: Electron.IpcRendererEvent, status: UpdateStatus) => listener(status)
      ipcRenderer.on('updates:status-changed', subscription)
      return () => ipcRenderer.removeListener('updates:status-changed', subscription)
    },
  },
  settings: {
    getAppInfo: () => ipcRenderer.invoke('settings:getAppInfo'),
    setAuthToken: (token) => ipcRenderer.invoke('settings:setAuthToken', token),
  },
}

contextBridge.exposeInMainWorld('desktopApp', api)
