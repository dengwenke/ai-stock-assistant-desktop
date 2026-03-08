import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as api from '@/api/client'
import type { SortRule } from '@/api/client'
import type { NoticeRecord, UploadPreviewVO } from '@/api/types'

/** 已上传记录列表自动刷新间隔（毫秒） */
const LIST_REFRESH_MS = 30_000

const DEFAULT_PAGE_SIZE = 20
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

/** 列表查询条件：公司名称/代码模糊，状态，行业，四维评分(1-5)范围，用户评分范围，发布时间区间，排序 */
export interface ListFilters {
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
  /** 组合排序规则，如 [{ field: 'publishTime', order: 'desc' }, { field: 'score', order: 'asc' }] */
  sortRules?: SortRule[]
}

export const useAnalysisStore = defineStore('analysis', () => {
  const list = ref<NoticeRecord[]>([])
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(DEFAULT_PAGE_SIZE)
  const loading = ref(false)
  const uploadStatus = ref<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const uploadMessage = ref('')
  const uploadPreview = ref<UploadPreviewVO | null>(null)

  /** 当前查询条件（公司名称、代码模糊，状态精确，评分范围） */
  const filters = ref<ListFilters>({})

  const totalPages = computed(() =>
    Math.max(1, Math.ceil(total.value / pageSize.value))
  )

  /**
   * 拉取当前页已上传记录列表，不传参时使用 store 的 page/pageSize 与 filters。
   * @param silent 为 true 时不置 loading，用于定时自动刷新，避免页面抖动
   */
  async function fetchList(pageNum?: number, size?: number, silent = false) {
    const p = pageNum ?? page.value
    const s = size ?? pageSize.value
    if (!silent) loading.value = true
    try {
      const f = filters.value
      const res = await api.getAnalysisList({
        page: p,
        size: s,
        stockName: f.stockName?.trim() || undefined,
        stockCode: f.stockCode?.trim() || undefined,
        status: f.status || undefined,
        scoreMin: f.scoreMin,
        scoreMax: f.scoreMax,
        industry: f.industry?.trim() || undefined,
        scoreFundamentalMin: f.scoreFundamentalMin,
        scoreFundamentalMax: f.scoreFundamentalMax,
        scoreNoveltyMin: f.scoreNoveltyMin,
        scoreNoveltyMax: f.scoreNoveltyMax,
        scoreBusinessMin: f.scoreBusinessMin,
        scoreBusinessMax: f.scoreBusinessMax,
        scoreElasticityMin: f.scoreElasticityMin,
        scoreElasticityMax: f.scoreElasticityMax,
        userRatingMin: f.userRatingMin,
        userRatingMax: f.userRatingMax,
        pctTMin: f.pctTMin,
        pctTMax: f.pctTMax,
        marketCapMin: f.marketCapMin,
        marketCapMax: f.marketCapMax,
        publishTimeStart: f.publishTimeStart?.trim() || undefined,
        publishTimeEnd: f.publishTimeEnd?.trim() || undefined,
        sortBy: api.sortRulesToSortBy(f.sortRules && f.sortRules.length > 0 ? f.sortRules : [{ field: 'publishTime', order: 'desc' }]),
      })
      list.value = res.list
      total.value = res.total
      page.value = p
      pageSize.value = s
    } finally {
      if (!silent) loading.value = false
    }
  }

  /** 设置查询条件并拉取第 1 页 */
  function setFilters(newFilters: ListFilters) {
    filters.value = { ...newFilters }
    page.value = 1
  }

  /** 启动列表 30 秒自动刷新（静默刷新，不触发 loading 避免抖动） */
  function startListRefresh() {
    if (listRefreshTimer != null) return
    fetchList(undefined, undefined, false).catch(() => {})
    listRefreshTimer = setInterval(() => {
      fetchList(undefined, undefined, true).catch(() => {})
    }, LIST_REFRESH_MS)
  }

  /** 停止列表自动刷新（离开首页时调用） */
  function stopListRefresh() {
    if (listRefreshTimer != null) {
      clearInterval(listRefreshTimer)
      listRefreshTimer = null
    }
  }

  let listRefreshTimer: ReturnType<typeof setInterval> | null = null

  function setPage(p: number) {
    page.value = Math.max(1, p)
  }

  function setPageSize(s: number) {
    pageSize.value = Math.max(10, Math.min(100, s))
  }

  /** 上传 Excel 预览：支持单文件或批量上传，解析后返回预览数据，不保存到数据库 */
  async function uploadAndPreview(files: File | File[]) {
    uploadStatus.value = 'uploading'
    uploadMessage.value = ''
    uploadPreview.value = null
    try {
      const res = await api.uploadPreview(files)
      uploadPreview.value = res
      uploadStatus.value = 'success'
      uploadMessage.value = `解析完成：共 ${res.totalFiles} 个文件，解析 ${res.totalParsedCount} 条，新增 ${res.totalNewCount} 条`
    } catch (e: unknown) {
      uploadStatus.value = 'error'
      uploadMessage.value = e instanceof Error ? e.message : '上传预览失败'
    }
  }

  /** 确认上传：用户确认预览数据后，保存到数据库 */
  async function confirmUpload() {
    if (!uploadPreview.value?.batchId) {
      uploadStatus.value = 'error'
      uploadMessage.value = '没有待确认的上传数据'
      return
    }
    
    uploadStatus.value = 'uploading'
    uploadMessage.value = ''
    try {
      const res = await api.uploadConfirm(uploadPreview.value.batchId)
      uploadStatus.value = 'success'
      uploadMessage.value = res.message ?? '上传成功'
      uploadPreview.value = null
      await fetchList(1)
    } catch (e: unknown) {
      uploadStatus.value = 'error'
      uploadMessage.value = e instanceof Error ? e.message : '确认上传失败'
    }
  }

  /** 取消上传预览 */
  function cancelUploadPreview() {
    uploadPreview.value = null
    uploadStatus.value = 'idle'
    uploadMessage.value = ''
  }

  /** 上传 Excel（旧接口，直接入库）：支持单文件或批量上传，后端按唯一标识去重入库并标记为待执行，定时任务自动扫描；上传成功后刷新列表 */
  async function uploadAndAnalyze(files: File | File[]) {
    uploadStatus.value = 'uploading'
    uploadMessage.value = ''
    try {
      const res = await api.upload(files)
      uploadStatus.value = 'success'
      uploadMessage.value = res.message ?? (res.addedCount === 0 ? '无新增记录，全部已在库中。' : '已入库，定时任务将自动执行分析。')
      await fetchList(1)
    } catch (e: unknown) {
      uploadStatus.value = 'error'
      uploadMessage.value = e instanceof Error ? e.message : '上传失败'
    }
  }

  /** 仅设置上传错误状态与提示（如前端校验文件过大），不发起请求 */
  function setUploadError(message: string) {
    uploadStatus.value = 'error'
    uploadMessage.value = message
  }

  function resetUploadStatus() {
    uploadStatus.value = 'idle'
    uploadMessage.value = ''
  }

  return {
    list,
    total,
    page,
    pageSize,
    totalPages,
    loading,
    filters,
    uploadStatus,
    uploadMessage,
    uploadPreview,
    fetchList,
    startListRefresh,
    stopListRefresh,
    setPage,
    setPageSize,
    setFilters,
    uploadAndPreview,
    confirmUpload,
    cancelUploadPreview,
    uploadAndAnalyze,
    setUploadError,
    resetUploadStatus,
  }
})

export { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS }
