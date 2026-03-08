import axios from 'axios'
import type { AxiosRequestConfig } from 'axios'
import type {
  NoticeRecord,
  NoticeSyncResultVO,
  NoticeOriginalRecord,
  UploadResultVO,
  UploadPreviewVO,
  LoginRequest,
  LoginResponse,
  ApiResult,
  ApiErrorResponse,
  StockBasicInfo,
  StockHistoryItem,
  IntradayQuoteItem,
  SpotQuote,
  TodayWatchData,
  EmaTrackerData,
  TradeCalendarItem,
  StockTechIndicator,
} from './types'
import { API_CODE_SUCCESS } from './types'
import { API_BASE, STORAGE_KEYS } from '@/constants'
import { useGlobalErrorStore } from '@/stores/globalError'
import { getDesktopApi } from '@/platform/desktop/bridge'
import { getCurrentRoutePath, getRemoteApiBase, isDesktopRuntime, redirectToLogin } from '@/platform/runtime'

type WorkspaceMarketCode = 'A' | 'HK' | 'US'
export type ApiMarketCode = 'A' | 'H' | 'U'

const WORKSPACE_STORAGE_KEY = 'stock_assistant_workspace'
const DEFAULT_MARKET_CODE: ApiMarketCode = 'A'
const MARKET_ALIAS_TO_API: Record<string, ApiMarketCode> = {
  A: 'A',
  H: 'H',
  HK: 'H',
  U: 'U',
  US: 'U',
}

export const API_CODE_CAPABILITY_NOT_SUPPORTED = 'CAPABILITY_NOT_SUPPORTED'

export class ApiClientError extends Error {
  code?: string
  status?: number
  config?: AxiosRequestConfig

  constructor(message: string, options?: { code?: string; status?: number; config?: AxiosRequestConfig }) {
    super(message)
    this.name = 'ApiClientError'
    this.code = options?.code
    this.status = options?.status
    this.config = options?.config
  }
}

declare module 'axios' {
  interface AxiosRequestConfig {
    /** 为 true 时不在全局弹窗中展示错误（由页面自行展示，如登录、上传） */
    skipGlobalErrorModal?: boolean
  }
}

function normalizeMarketCode(code?: string | null): ApiMarketCode {
  if (!code) return DEFAULT_MARKET_CODE
  const normalized = String(code).trim().toUpperCase()
  return MARKET_ALIAS_TO_API[normalized] ?? DEFAULT_MARKET_CODE
}

/** 解析 API market 参数，优先使用显式传参，否则读取工作区市场并回退到 A。 */
export function resolveApiMarketCode(input?: string | null): ApiMarketCode {
  if (input) return normalizeMarketCode(input)
  if (typeof window === 'undefined') return DEFAULT_MARKET_CODE
  const saved = localStorage.getItem(WORKSPACE_STORAGE_KEY) as WorkspaceMarketCode | null
  return normalizeMarketCode(saved)
}

/** 为请求参数统一附带 market，避免页面层重复传参。 */
function withMarket<T extends Record<string, unknown>>(params: T, market?: string | null): T & { market: ApiMarketCode } {
  return {
    ...params,
    market: resolveApiMarketCode(market),
  }
}

const client = axios.create({
  baseURL: isDesktopRuntime() ? getRemoteApiBase() : API_BASE,
  timeout: 120_000,
  headers: { 'Content-Type': 'application/json' },
})

function getStoredToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.TOKEN)
}


function getDesktopMarketApi() {
  return getDesktopApi().market
}

async function ensureDesktopStockBundle(input: {
  stockCode: string
  market?: string
  startDate?: string
  endDate?: string
  intradayDate?: string
}) {
  if (!isDesktopRuntime()) return
  await getDesktopMarketApi().ensureStockBundle({
    stockCode: input.stockCode,
    market: input.market,
    token: getStoredToken(),
    historyRange: {
      startDate: input.startDate,
      endDate: input.endDate,
    },
    intradayDate: input.intradayDate,
  })
}

function createEmptyStockInfo(stockCode: string): StockBasicInfo {
  return {
    stockCode,
    stockName: '',
    market: '',
    industry: '',
    marketCap: '',
    pe: '',
    pb: '',
  }
}

/** 从错误对象中提取后端业务错误码（如 CAPABILITY_NOT_SUPPORTED）。 */
function getErrorCode(err: unknown): string | undefined {
  if (err instanceof ApiClientError && err.code) return err.code
  const ax = err as { response?: { data?: ApiErrorResponse & ApiResult } }
  const code = ax.response?.data?.code
  if (!code || code === API_CODE_SUCCESS) return undefined
  return code
}

/** 统一构建带 code/status/config 的客户端错误对象。 */
function toApiClientError(
  message: string,
  options?: { code?: string; status?: number; config?: AxiosRequestConfig }
): ApiClientError {
  return new ApiClientError(message, options)
}

/** 判断错误是否为指定后端错误码。 */
export function isApiErrorCode(err: unknown, code: string): boolean {
  return getErrorCode(err) === code
}

/** 对“能力未接入”错误返回后端文案，其他错误返回调用方给定兜底文案。 */
export function resolveCapabilityMessage(err: unknown, fallback: string): string {
  if (isApiErrorCode(err, API_CODE_CAPABILITY_NOT_SUPPORTED)) {
    if (err instanceof Error && err.message) return err.message
    return '当前市场暂未接入该能力'
  }
  return fallback
}

client.interceptors.request.use((config) => {
  const t = getStoredToken()
  if (t) config.headers.Authorization = `Bearer ${t}`
  return config
})

/** 从后端 ApiResult 或 axios 错误中取出用户可读信息 */
function getErrorMessage(err: unknown): string {
  const ax = err as { response?: { data?: ApiErrorResponse & ApiResult; status?: number }; message?: string }
  if (ax.response?.data?.message) return ax.response.data.message
  if (ax.response?.data?.code && ax.response.data.code !== API_CODE_SUCCESS && ax.response.data.message)
    return ax.response.data.message
  if (ax.response?.status === 401) return '未登录或登录已过期'
  if (ax.response?.status === 403) return '无权限'
  if (ax.response?.status && ax.response.status >= 500) return '服务异常，请稍后重试'
  return ax.message ?? '请求失败'
}

/** 从响应中取出 config，用于判断是否跳过全局弹窗（如从 success 里 reject 时需带上 config） */
function getConfig(err: unknown): AxiosRequestConfig | undefined {
  return (err as { config?: AxiosRequestConfig }).config
}

client.interceptors.response.use(
  (res) => {
    const body = res.data as ApiResult<unknown> | undefined
    if (body && typeof body === 'object' && body.code !== undefined && body.code !== API_CODE_SUCCESS) {
      return Promise.reject(
        toApiClientError(body.message || '请求失败', {
          code: body.code,
          status: res.status,
          config: res.config,
        })
      )
    }
    return res
  },
  (err) => {
    const status = err.response?.status
    const isLoginUrl = err.config?.url?.includes('/auth/login')
    // 401/403（未登录、token 过期、无权限）时清空登录态并跳转登录页，不再弹「无权限」等提示
    if ((status === 401 || status === 403) && !isLoginUrl) {
      localStorage.removeItem(STORAGE_KEYS.TOKEN)
      localStorage.removeItem(STORAGE_KEYS.USERNAME)
      const path = getCurrentRoutePath()
      if (path !== '/login') {
        redirectToLogin(path)
      }
      return Promise.reject(
        toApiClientError(status === 401 ? '未登录或登录已过期' : '无权限', {
          status,
          code: getErrorCode(err),
          config: getConfig(err),
        })
      )
    }
    const message = getErrorMessage(err)
    if (!getConfig(err)?.skipGlobalErrorModal) {
      useGlobalErrorStore().show(message)
    }
    return Promise.reject(
      toApiClientError(message, {
        status,
        code: getErrorCode(err),
        config: getConfig(err),
      })
    )
  }
)

/** 解包后端 ApiResult，成功返回 data（可为 undefined，如 void 接口），失败抛错 */
function unwrap<T>(res: { data: ApiResult<T> }): T {
  const body = res.data
  if (body.code !== API_CODE_SUCCESS) {
    throw toApiClientError(body.message || '请求失败', { code: body.code })
  }
  return body.data as T
}

/** 登录，返回 token 与 username。错误由页面直接展示，不弹窗。 */
export async function login(req: LoginRequest): Promise<LoginResponse> {
  const res = await client.post<ApiResult<LoginResponse>>('/auth/login', req, { skipGlobalErrorModal: true })
  return unwrap(res)
}

/** 主动触发一次 iFinD 公告同步：从 iFinD 拉取最新公告并入库为 PENDING。 */
export async function syncIfindNotices(): Promise<NoticeSyncResultVO> {
  const res = await client.post<ApiResult<NoticeSyncResultVO>>('/notice/sync', {})
  return unwrap(res)
}

/** 上传 Excel 预览，返回解析结果供用户确认。支持单文件或批量上传。错误由上传区直接展示，不弹窗。 */
export async function uploadPreview(files: File | File[]): Promise<UploadPreviewVO> {
  const form = new FormData()
  const fileArray = Array.isArray(files) ? files : [files]
  fileArray.forEach(file => {
    form.append('files', file)
  })
  const res = await client.post<ApiResult<UploadPreviewVO>>('/notice/upload/preview', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120_000,
    skipGlobalErrorModal: true,
  })
  return unwrap(res)
}

/** 确认上传：用户确认预览数据后，根据批次 ID 保存到数据库 */
export async function uploadConfirm(batchId: string): Promise<UploadResultVO> {
  const res = await client.post<ApiResult<UploadResultVO>>('/notice/upload/confirm', { batchId }, {
    timeout: 60_000,
    skipGlobalErrorModal: true,
  })
  return unwrap(res)
}

/** 上传 Excel（旧接口，直接入库），后端按唯一标识去重入库并标记为待执行（PENDING），定时任务自动扫描执行。支持单文件或批量上传。错误由上传区直接展示，不弹窗。 */
export async function upload(files: File | File[]): Promise<UploadResultVO> {
  const form = new FormData()
  const fileArray = Array.isArray(files) ? files : [files]
  fileArray.forEach(file => {
    form.append('files', file)
  })
  const res = await client.post<ApiResult<UploadResultVO>>('/notice/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120_000,
    skipGlobalErrorModal: true,
  })
  return unwrap(res)
}

/** 排序字段：createTime=入库时间, publishTime=发布时间, score=总分, 四维分数等 */
export type SortField =
  | 'createTime'
  | 'publishTime'
  | 'score'
  | 'scoreFundamental'
  | 'scoreNovelty'
  | 'scoreBusiness'
  | 'scoreElasticity'
  | 'userRating'
  | 'id'
/** 排序方向 */
export type SortOrder = 'asc' | 'desc'

/** 单条排序规则，用于组合排序 */
export interface SortRule {
  field: SortField
  order: SortOrder
}

/** 将 sortRules 序列化为后端 sortBy 参数，格式 "field1:order1,field2:order2" */
export function sortRulesToSortBy(rules: SortRule[]): string | undefined {
  if (!rules.length) return undefined
  return rules.map((r) => `${r.field}:${r.order}`).join(',')
}

/** 分页获取已上传记录列表。支持筛选与排序；sortBy 优先（组合排序），否则按 sortField/sortOrder。默认按入库时间倒序。 */
export async function getAnalysisList(params: {
  page?: number
  size?: number
  market?: string
  stockName?: string
  stockCode?: string
  status?: string
  scoreMin?: number
  scoreMax?: number
  industry?: string
  scoreFundamentalMin?: number
  scoreFundamentalMax?: number
  scoreNoveltyMin?: number
  scoreNoveltyMax?: number
  scoreBusinessMin?: number
  scoreBusinessMax?: number
  scoreElasticityMin?: number
  scoreElasticityMax?: number
  userRatingMin?: number
  userRatingMax?: number
  /** T 日涨幅（%）下限 */
  pctTMin?: number
  /** T 日涨幅（%）上限 */
  pctTMax?: number
  /** 市值（亿元）下限 */
  marketCapMin?: number
  /** 市值（亿元）上限 */
  marketCapMax?: number
  publishTimeStart?: string
  publishTimeEnd?: string
  sortField?: SortField
  sortOrder?: SortOrder
  sortBy?: string
  /** 公告标题关键字，支持模糊搜索 */
  keyword?: string
}): Promise<{ list: NoticeRecord[]; total: number }> {
  const query = {
    ...params,
    market: resolveApiMarketCode(params.market),
  }
  if (params.pctTMin !== undefined && params.pctTMin !== null) query.pctTMin = params.pctTMin
  if (params.pctTMax !== undefined && params.pctTMax !== null) query.pctTMax = params.pctTMax
  if (params.marketCapMin !== undefined && params.marketCapMin !== null) query.marketCapMin = params.marketCapMin
  if (params.marketCapMax !== undefined && params.marketCapMax !== null) query.marketCapMax = params.marketCapMax
  const res = await client.get<ApiResult<{ list: NoticeRecord[]; total: number }>>('/notice/list', { params: query })
  return unwrap(res)
}

/** 按 id 获取单条记录详情 */
export async function getNoticeById(id: number): Promise<NoticeRecord> {
  const res = await client.get<ApiResult<NoticeRecord>>(`/notice/${id}`)
  return unwrap(res)
}

/** 用户评分 1-5 */
export async function rateNotice(id: number, rating: number): Promise<void> {
  await client.post<ApiResult<void>>(`/notice/${id}/rate`, { rating })
}

/** 生成深度报告 */
export async function generateDeepReport(id: number): Promise<void> {
  await client.post<ApiResult<void>>(`/notice/${id}/deep-report`)
}

/** 触发公告 AI 解析（用户手动请求解析未解析的公告） */
export async function triggerNoticeAnalysis(id: number): Promise<{ triggered: boolean }> {
  const res = await client.post<ApiResult<{ triggered: boolean }>>(`/notice/${id}/analyze`)
  return unwrap(res)
}

/** 获取深度报告内容 */
export async function getDeepReport(id: number): Promise<{ deepReport: string; deepReportTime: string }> {
  const res = await client.get<ApiResult<{ deepReport: string; deepReportTime: string }>>(`/notice/${id}/deep-report`)
  return unwrap(res)
}

/** 获取公告解析详情 */
export async function getAnalysisDetail(id: number): Promise<NoticeRecord> {
  const res = await client.get<ApiResult<NoticeRecord>>(`/notice/${id}`)
  return unwrap(res)
}

/** 深度报告下载 URL（需带 token 的 GET，浏览器打开或 a 标签 download） */
export function getDeepReportDownloadUrl(id: number): string {
  const base = isDesktopRuntime() ? getRemoteApiBase() : ''
  return `${base}/notice/${id}/deep-report/download`
}

/** 股票基本信息（名称、行业、市值、PE、PB）。供行情页展示。 */
export async function getStockInfo(stockCode: string): Promise<StockBasicInfo> {
  if (isDesktopRuntime()) {
    const marketApi = getDesktopMarketApi()
    let result = await marketApi.getStockInfo({ stockCode })
    if (!result) {
      await ensureDesktopStockBundle({ stockCode })
      result = await marketApi.getStockInfo({ stockCode })
    }
    return result ?? createEmptyStockInfo(stockCode)
  }
  const res = await client.get<ApiResult<StockBasicInfo>>(`/stock/${stockCode}/info`, {
    skipGlobalErrorModal: true,
  })
  return unwrap(res)
}

/** 个股历史 K 线。stockCode 为 6 位代码，startDate/endDate 为 yyyy-MM-dd（可选）。 */
export async function getStockHistory(
  stockCode: string,
  params?: { startDate?: string; endDate?: string; market?: string }
): Promise<StockHistoryItem[]> {
  const requestParams = withMarket(
    {
      startDate: params?.startDate,
      endDate: params?.endDate,
    },
    params?.market
  )
  if (isDesktopRuntime()) {
    const marketApi = getDesktopMarketApi()
    let result = await marketApi.getStockHistory({ stockCode, ...requestParams })
    if (!result.length) {
      await ensureDesktopStockBundle({
        stockCode,
        market: requestParams.market,
        startDate: requestParams.startDate,
        endDate: requestParams.endDate,
      })
      result = await marketApi.getStockHistory({ stockCode, ...requestParams })
    }
    return result
  }
  const res = await client.get<ApiResult<StockHistoryItem[]>>(`/stock/${stockCode}/history`, {
    params: requestParams,
    skipGlobalErrorModal: true,
  })
  return unwrap(res)
}

/** 个股日内分时行情（分钟级）。date 为 yyyy-MM-dd。 */
export async function getStockIntraday(
  stockCode: string,
  date: string,
  market?: string
): Promise<IntradayQuoteItem[]> {
  const requestParams = withMarket({ date }, market)
  if (isDesktopRuntime()) {
    const marketApi = getDesktopMarketApi()
    let result = await marketApi.getStockIntraday({ stockCode, market: requestParams.market, date: requestParams.date })
    if (!result.length) {
      await ensureDesktopStockBundle({ stockCode, market: requestParams.market, intradayDate: requestParams.date })
      result = await marketApi.getStockIntraday({ stockCode, market: requestParams.market, date: requestParams.date })
    }
    return result
  }
  const res = await client.get<ApiResult<IntradayQuoteItem[]>>(`/stock/${stockCode}/intraday`, {
    params: requestParams,
    skipGlobalErrorModal: true,
  })
  return unwrap(res)
}

/** 个股技术指标。返回 MACD、KDJ、BOLL、RSI、WR、DMI、EMA、MA 等指标。stockCode 为 6 位代码。 */
export async function getStockIndicator(
  stockCode: string,
  params?: { startDate?: string; endDate?: string; market?: string }
): Promise<StockTechIndicator[]> {
  const requestParams = withMarket(
    {
      startDate: params?.startDate,
      endDate: params?.endDate,
    },
    params?.market
  )
  if (isDesktopRuntime()) {
    const marketApi = getDesktopMarketApi()
    let result = await marketApi.getStockIndicator({ stockCode, ...requestParams })
    if (!result.length) {
      await ensureDesktopStockBundle({
        stockCode,
        market: requestParams.market,
        startDate: requestParams.startDate,
        endDate: requestParams.endDate,
      })
      result = await marketApi.getStockIndicator({ stockCode, ...requestParams })
    }
    return result as unknown as StockTechIndicator[]
  }
  const res = await client.get<ApiResult<StockTechIndicator[]>>(`/stock/${stockCode}/indicator`, {
    params: requestParams,
    skipGlobalErrorModal: true,
  })
  return unwrap(res)
}

/** 按股票代码获取公告列表（最多 100 条），用于股票行情页关联公告。 */
export async function getNoticesByStockCode(
  stockCode: string,
  options?: { market?: string }
): Promise<{ list: NoticeRecord[]; total: number }> {
  const requestParams = withMarket(
    {
      page: 1,
      size: 100,
      stockCode,
      sortBy: 'publishTime:desc',
    },
    options?.market
  )
  const res = await client.get<ApiResult<{ list: NoticeRecord[]; total: number }>>('/notice/list', {
    params: requestParams,
  })
  return unwrap(res)
}

/** 批量获取实时行情（用于当日看盘） */
export async function batchSpotQuote(codes: string[], market?: string): Promise<SpotQuote[]> {
  const requestParams = withMarket({ codes: codes.join(',') }, market)
  if (isDesktopRuntime()) {
    const marketApi = getDesktopMarketApi()
    let result = await marketApi.batchSpotQuote({ codes, market: requestParams.market })
    const shouldRefresh = !result.length || result.every((item) => !item.updateTime)
    if (shouldRefresh) {
      result = await marketApi.refreshSpotQuotes({ codes, market: requestParams.market, token: getStoredToken() })
    }
    return result as SpotQuote[]
  }
  const res = await client.get<ApiResult<SpotQuote[]>>('/stock/spot/batch', {
    params: requestParams,
    skipGlobalErrorModal: true,
  })
  return unwrap(res)
}

/** 当日看盘：获取T日=今日的公告列表，附带实时涨幅
 * @param tDate T日（yyyy-MM-dd），可选，默认当日
 * @param page 页码，可选
 * @param size 每页大小，可选
 */
export async function getTodayWatch(tDate?: string, page?: number, size?: number, market?: string): Promise<TodayWatchData> {
  const requestParams = withMarket(
    {
      ...(tDate && { tDate }),
      ...(page && { page }),
      ...(size && { size }),
    },
    market
  )
  const res = await client.get<ApiResult<TodayWatchData>>('/notice/today-watch', {
    params: requestParams
  })
  return unwrap(res)
}

/** EMA 指标追踪：查询一周内股价回踩 M120 附近的股票。 */
export async function getEmaTracker(params?: {
  market?: string
  lookbackDays?: number
  tolerancePct?: number
  page?: number
  size?: number
}): Promise<EmaTrackerData> {
  const requestParams = withMarket(
    {
      lookbackDays: params?.lookbackDays ?? 7,
      tolerancePct: params?.tolerancePct ?? 2,
      page: params?.page ?? 1,
      size: params?.size ?? 50,
    },
    params?.market
  )
  const res = await client.get<ApiResult<EmaTrackerData>>('/ema-tracker/list', {
    params: requestParams,
  })
  return unwrap(res)
}

export async function getTradeCalendar(
  market: string,
  startDate: string,
  endDate: string
): Promise<TradeCalendarItem[]> {
  const marketCode = resolveApiMarketCode(market)
  if (isDesktopRuntime()) {
    const marketApi = getDesktopMarketApi()
    let result = await marketApi.getTradeCalendar({ market: marketCode, startDate, endDate })
    if (!result.length) {
      await marketApi.syncTradeCalendar({ market: marketCode, startDate, endDate, token: getStoredToken() })
      result = await marketApi.getTradeCalendar({ market: marketCode, startDate, endDate })
    }
    return result
  }
  const res = await client.get<ApiResult<TradeCalendarItem[]>>('/trade-calendar/list', {
    params: { market: marketCode, startDate, endDate },
  })
  return unwrap(res)
}

/** 分页查询公告原文 */
export async function getNoticeOriginalList(params: {
  page?: number
  size?: number
  stockCode?: string
  stockName?: string
  startDate?: string
  endDate?: string
  categoryCode?: string
  noticeTitle?: string
  market?: string
}): Promise<{ list: NoticeOriginalRecord[]; total: number }> {
  const requestParams = withMarket(
    {
      page: params.page,
      size: params.size,
      stockCode: params.stockCode,
      stockName: params.stockName,
      startDate: params.startDate,
      endDate: params.endDate,
      categoryCode: params.categoryCode,
      noticeTitle: params.noticeTitle,
    },
    params.market
  )
  const res = await client.get<ApiResult<{ list: NoticeOriginalRecord[]; total: number }>>('/notice-original/list', {
    params: requestParams,
  })
  return unwrap(res)
}

export { client }
export { unwrap }
