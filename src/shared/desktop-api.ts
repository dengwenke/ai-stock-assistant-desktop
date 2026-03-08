export interface StockBasicInfo {
  stockCode: string
  stockName: string
  market: string
  industry: string
  marketCap: string
  pe: string
  pb: string
}

export interface StockHistoryItem {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  pctChange: number
  amount?: number
  preClose?: number
  changeAmount?: number
}

export interface IntradayQuoteItem {
  time: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  amount: number
}

export interface TradeCalendarItem {
  calDate: string
  isOpen: number
  holidayName?: string
}

export interface SpotQuote {
  stockCode: string
  stockName?: string
  latestPrice?: number
  currentPrice?: number
  pctChange?: number
  changeAmount?: number
  change?: number
  volume?: number
  amount?: number
  market?: string
  updateTime?: string
}

export interface LocalSyncStatus {
  taskKey: string
  lastSuccessAt?: string | null
  lastAttemptAt?: string | null
  lastCursor?: string | null
  retryCount: number
  lastError?: string | null
}

export interface SeedPackageManifest {
  schemaVersion: number
  packageVersion: string
  generatedAt: string
  markets?: string[]
  dateRange?: { start?: string; end?: string }
}

export interface DesktopAppInfo {
  version: string
  dataDir: string
  remoteApiBase: string
}

export interface EnsureStockBundleInput {
  stockCode: string
  market?: string
  token?: string | null
  historyRange?: {
    startDate?: string
    endDate?: string
  }
  intradayDate?: string
}

export type UpdateStage =
  | 'disabled'
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'

export interface UpdateStatus {
  stage: UpdateStage
  supported: boolean
  autoCheckEnabled: boolean
  currentVersion: string
  availableVersion?: string | null
  releaseDate?: string | null
  releaseName?: string | null
  releaseNotes?: string | null
  downloadedFile?: string | null
  progressPercent?: number | null
  bytesPerSecond?: number | null
  transferred?: number | null
  total?: number | null
  lastCheckedAt?: string | null
  message?: string | null
  provider?: string | null
  owner?: string | null
  repo?: string | null
}

export interface MarketBridgeApi {
  getStockInfo: (input: { stockCode: string }) => Promise<StockBasicInfo | null>
  getStockHistory: (input: { stockCode: string; market?: string; startDate?: string; endDate?: string }) => Promise<StockHistoryItem[]>
  getStockIntraday: (input: { stockCode: string; date: string; market?: string; intervalMinutes?: number }) => Promise<IntradayQuoteItem[]>
  getStockIndicator: (input: { stockCode: string; market?: string; startDate?: string; endDate?: string }) => Promise<Record<string, unknown>[]>
  getTradeCalendar: (input: { market: string; startDate: string; endDate: string }) => Promise<TradeCalendarItem[]>
  batchSpotQuote: (input: { codes: string[]; market?: string }) => Promise<SpotQuote[]>
  ensureStockBundle: (input: EnsureStockBundleInput) => Promise<{ synced: boolean; reasons: string[] }>
  syncTradeCalendar: (input: { market: string; startDate: string; endDate: string; token?: string | null }) => Promise<number>
  refreshSpotQuotes: (input: { codes: string[]; market?: string; token?: string | null }) => Promise<SpotQuote[]>
  importSeedPackage: () => Promise<{ imported: boolean; message: string }>
  getSyncStatuses: () => Promise<LocalSyncStatus[]>
}

export interface UpdateBridgeApi {
  getStatus: () => Promise<UpdateStatus>
  checkForUpdates: () => Promise<UpdateStatus>
  downloadUpdate: () => Promise<UpdateStatus>
  quitAndInstall: () => Promise<void>
  openReleasePage: () => Promise<void>
  subscribeStatusChanged: (listener: (status: UpdateStatus) => void) => () => void
}

export interface SettingsBridgeApi {
  getAppInfo: () => Promise<DesktopAppInfo>
  setAuthToken: (token: string | null) => Promise<void>
}

export interface DesktopBridgeApi {
  market: MarketBridgeApi
  updates: UpdateBridgeApi
  settings: SettingsBridgeApi
}
