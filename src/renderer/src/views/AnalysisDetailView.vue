<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import Breadcrumb from '@/components/Breadcrumb.vue'
import * as api from '@/api/client'
import type { NoticeRecord, AnalysisResultJson } from '@/api/types'
import { normalizeNoticeLink } from '@/utils/noticeLink'

const breadcrumbItems = [
  { text: '首页', to: '/' },
  { text: '公告分析', to: '/announcements' },
  { text: '解析详情' },
]

/** 将深度报告 Markdown 转为安全 HTML（兼容纯文本：无 Markdown 时按原样换行显示） */
function deepReportToHtml(raw: string | null | undefined): string {
  if (raw == null || String(raw).trim() === '') return ''
  const text = String(raw).trim()
  const html = marked.parse(text, { async: false }) as string
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'b', 'em', 'i', 'u', 'code', 'pre', 'blockquote', 'ul', 'ol', 'li', 'hr', 'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
  })
}

const route = useRoute()
const router = useRouter()

const id = computed(() => {
  const p = route.params.id
  if (typeof p === 'string' && /^\d+$/.test(p)) return parseInt(p, 10)
  return null
})

const record = ref<NoticeRecord | null>(null)
const loading = ref(true)
const loadError = ref<string | null>(null)

/** 原文查看模式：左侧 PDF，右侧为当前摘要和解析内容 */
const showOriginal = ref(false)

/** 公告原文链接（优先驼峰 noticeLink，兼容后端 notice_link） */
const noticeLink = computed(() => {
  const r = record.value as (NoticeRecord & { notice_link?: string; noticeLink?: string }) | null
  if (!r) return ''
  return normalizeNoticeLink(r.noticeLink || r.notice_link || '')
})

/** 用于取消「进入页面时发现报告生成中」的后台轮询（id 变更或组件卸载时递增，轮询内检查后退出） */
const deepReportPollRunId = ref(0)

async function fetchRecord() {
  const sid = id.value
  if (sid == null) {
    loadError.value = '无效的 ID'
    loading.value = false
    return
  }
  deepReportPollRunId.value += 1
  loading.value = true
  loadError.value = null
  try {
    record.value = await api.getNoticeById(sid)
    startDeepReportPollOnlyWhenGenerating()
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : '加载失败'
    record.value = null
  } finally {
    loading.value = false
  }
}

/** 仅当深度报告处于生成中（PENDING/PROCESSING）且尚未有内容时启动轮询；已生成则不轮询 */
function startDeepReportPollOnlyWhenGenerating() {
  const r = record.value
  if (!r?.id) return
  const sid = r.id
  const s = r.deepReportStatus
  const hasContent = r.deepReport != null && r.deepReport.trim() !== ''
  if (s !== 'PENDING' && s !== 'PROCESSING') return
  if (hasContent) return
  const myRunId = deepReportPollRunId.value
  const deadline = Date.now() + POLL_MAX_MS
  ;(async () => {
    while (myRunId === deepReportPollRunId.value && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
      if (myRunId !== deepReportPollRunId.value) return
      const next = await api.getNoticeById(sid)
      if (myRunId !== deepReportPollRunId.value) return
      record.value = next
      if (next.deepReportStatus === 'DONE' || (next.deepReport != null && next.deepReport.trim() !== '')) return
    }
  })()
}

onMounted(() => fetchRecord())
watch(id, () => fetchRecord())
onUnmounted(() => {
  deepReportPollRunId.value += 1
})

function goBack() {
  router.push('/announcements')
}

/** 从公告详情跳转到该股票行情页 */
function goToStockQuote() {
  const code = record.value?.stockCode
  const noticeId = record.value?.id
  if (code) {
    router.push({
      name: 'stock-detail',
      params: { stockCode: code },
      query: { mode: 'quote', noticeId: noticeId ? String(noticeId) : undefined }
    })
  }
}

/** 进入/退出原文查看模式 */
function toggleOriginalView() {
  if (!noticeLink.value) return
  showOriginal.value = !showOriginal.value
}

/** 解析 analysisResult JSON */
function parseAnalysis(row: NoticeRecord): AnalysisResultJson | null {
  const raw = row.analysisResult
  if (!raw || typeof raw !== 'string') return null
  try {
    const parsed = JSON.parse(raw) as AnalysisResultJson
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function getTDate(row: NoticeRecord): string | null {
  const r = row as NoticeRecord & { t_date?: string }
  const v = row.tDate ?? r.t_date ?? null
  if (v == null || String(v).trim() === '') return null
  return String(v).trim()
}

function displayTDate(tDate?: string | null): string {
  if (tDate != null && String(tDate).trim() !== '') return String(tDate).trim()
  return '—'
}

/** 展示涨跌幅（%）：有值则格式化为 +1.23% / -0.50%，否则 — */
function displayPct(pct?: number | null): string {
  if (pct == null || Number.isNaN(pct)) return '—'
  const n = Number(pct)
  const sign = n >= 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}

function subScoreDisplay(
  parsed: AnalysisResultJson | null,
  row: NoticeRecord,
  key: keyof AnalysisResultJson,
  backKey: 'scoreFundamental' | 'scoreNovelty' | 'scoreBusiness' | 'scoreElasticity'
): string {
  const rv = row[backKey]
  if (rv != null && rv >= 1 && rv <= 5) return String(rv)
  if (!parsed) return '—'
  const v = parsed[key]
  if (v == null || v === '') return '—'
  const n = Number(v)
  return Number.isNaN(n) ? '—' : String(n)
}

const deepReportGenerating = ref(false)
const POLL_INTERVAL_MS = 2500
const POLL_MAX_MS = 5 * 60 * 1000

async function submitRating(rating: number) {
  if (record.value?.id == null) return
  await api.rateNotice(record.value.id, rating)
  record.value = await api.getNoticeById(record.value.id)
}

/** 是否处于「深度报告生成中」状态（本地提交中或后端 PENDING/PROCESSING） */
function isDeepReportInProgress(): boolean {
  const r = record.value
  if (!r) return false
  const s = r.deepReportStatus
  return s === 'PENDING' || s === 'PROCESSING' || deepReportGenerating.value
}

async function doGenerateDeepReport() {
  if (record.value?.id == null) return
  deepReportGenerating.value = true
  try {
    await api.generateDeepReport(record.value.id)
    record.value = await api.getNoticeById(record.value.id)
    const sid = record.value?.id
    if (sid == null) return
    const deadline = Date.now() + POLL_MAX_MS
    while (Date.now() < deadline) {
      const next = await api.getNoticeById(sid)
      record.value = next
      if (next.deepReportStatus === 'DONE' || (next.deepReport != null && next.deepReport.trim() !== '')) break
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
    }
  } finally {
    deepReportGenerating.value = false
  }
}

async function downloadDeepReport() {
  const row = record.value
  if (!row?.id || !row.deepReport) return
  const url = api.getDeepReportDownloadUrl(row.id)
  const { data } = await api.client.get(url, { responseType: 'blob' })
  const blob = data as Blob
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `深度报告_${row.stockName ?? '公告'}_${row.id}.pdf`
  a.click()
  URL.revokeObjectURL(a.href)
}
</script>

<template>
  <div class="detail-page terminal-page web-page web-page--dense">
    <Breadcrumb :items="breadcrumbItems" />
    <header class="detail-header">
      <div class="detail-header-main">
        <div class="detail-header-copy">
          <div class="detail-header-title">解析详情</div>
          <div class="detail-header-subtitle">公告原文与结构化分析对照，快速验证交易假设</div>
        </div>
        <button type="button" class="detail-back" aria-label="返回列表" @click="goBack">
          <span class="detail-back-icon">←</span>
          <span class="detail-back-text">返回列表</span>
        </button>
      </div>
    </header>

    <div v-if="loading" class="detail-loading">
      <span class="loading-dot">⋯</span> 加载中
    </div>
    <div v-else-if="loadError" class="detail-error">
      <p>{{ loadError }}</p>
      <button type="button" class="btn-back-inline" @click="goBack">返回列表</button>
    </div>
    <template v-else-if="record">
      <article class="detail-article">
        <h1 class="detail-title">{{ record.noticeTitle || '解析详情' }}</h1>

        <section class="detail-summary">
          <div class="detail-summary-inner">
            <div class="detail-stock">
              <div class="detail-stock-main">
                <code class="code">{{ record.stockCode }}</code>
                <span class="detail-stock-name">{{ record.stockName }}</span>
              </div>
              <div class="detail-stock-actions">
                <button
                  type="button"
                  class="detail-stock-quote"
                  @click="goToStockQuote"
                >
                  查看行情
                </button>
                <button
                  type="button"
                  class="detail-stock-original"
                  :disabled="!noticeLink"
                  @click="toggleOriginalView"
                >
                  {{ showOriginal ? '收起原文' : '查看原文' }}
                </button>
              </div>
            </div>
            <div class="detail-meta">
              <span class="detail-meta-item"><span class="detail-meta-key">行业</span><span class="detail-meta-val">{{ record.industry || '—' }}</span></span>
              <span class="detail-meta-item"><span class="detail-meta-key">受益方向</span><span class="detail-meta-val">{{ record.beneficialDirection || '—' }}</span></span>
              <span class="detail-meta-item"><span class="detail-meta-key">发布时间</span><span class="detail-meta-val">{{ record.publishTime }}</span></span>
              <span class="detail-meta-item"><span class="detail-meta-key">T日</span><span class="detail-meta-val">{{ displayTDate(getTDate(record)) }}</span></span>
              <span class="detail-meta-item"><span class="detail-meta-key">T日涨幅</span><span class="detail-meta-val detail-pct" :class="record.pctT != null && record.pctT >= 0 ? 'pct-up' : record.pctT != null ? 'pct-down' : ''">{{ displayPct(record.pctT) }}</span></span>
              <span class="detail-meta-item"><span class="detail-meta-key">T+3涨幅</span><span class="detail-meta-val detail-pct" :class="record.pctT3 != null && record.pctT3 >= 0 ? 'pct-up' : record.pctT3 != null ? 'pct-down' : ''">{{ displayPct(record.pctT3) }}</span></span>
              <span class="detail-meta-item"><span class="detail-meta-key">T+10涨幅</span><span class="detail-meta-val detail-pct" :class="record.pctT10 != null && record.pctT10 >= 0 ? 'pct-up' : record.pctT10 != null ? 'pct-down' : ''">{{ displayPct(record.pctT10) }}</span></span>
            </div>
            <div v-if="record.status === 'DONE'" class="detail-scores">
              <span class="detail-score-item"><span class="detail-score-label">基本面</span><span class="detail-score-num">{{ subScoreDisplay(parseAnalysis(record), record, '评分_基本面', 'scoreFundamental') }}</span></span>
              <span class="detail-score-item"><span class="detail-score-label">逻辑新颖</span><span class="detail-score-num">{{ subScoreDisplay(parseAnalysis(record), record, '评分_逻辑新颖', 'scoreNovelty') }}</span></span>
              <span class="detail-score-item"><span class="detail-score-label">商业</span><span class="detail-score-num">{{ subScoreDisplay(parseAnalysis(record), record, '评分_商业模式竞争力', 'scoreBusiness') }}</span></span>
              <span class="detail-score-item"><span class="detail-score-label">弹性</span><span class="detail-score-num">{{ subScoreDisplay(parseAnalysis(record), record, '评分_弹性确定性', 'scoreElasticity') }}</span></span>
            </div>
            <div v-if="record.status === 'DONE' && record.id != null" class="detail-rating">
              <span class="detail-meta-key">我的评分</span>
              <span class="rating-stars">
                <button
                  v-for="star in 5"
                  :key="star"
                  type="button"
                  class="rating-star"
                  :class="{ active: (record.userRating ?? 0) >= star }"
                  :aria-label="'评 ' + star + ' 分'"
                  @click="submitRating(star)"
                >★</button>
              </span>
            </div>
          </div>
        </section>

        <!-- 主内容：原文查看模式为左右分栏；默认为纵向排版 -->
        <div v-if="showOriginal && noticeLink" class="detail-main-split">
          <section class="detail-original-panel">
            <div class="detail-original-header">
              <h2 class="detail-report-title">公告原文</h2>
              <a
                v-if="noticeLink"
                class="detail-original-open-link"
                :href="noticeLink"
                target="_blank"
                rel="noopener noreferrer"
              >
                在新窗口打开
              </a>
            </div>
            <p class="detail-original-tip">左侧为交易所披露的公告 PDF，右侧为本系统生成的摘要与解析，便于对照阅读。</p>
            <div class="detail-original-frame-wrap">
              <iframe
                class="detail-original-frame"
                :src="noticeLink"
                title="公告原文 PDF"
              />
            </div>
          </section>
          <div class="detail-analysis-panel">
            <section v-if="record.status === 'DONE'" class="detail-report">
              <h2 class="detail-report-title">解析报告</h2>
              <div v-if="parseAnalysis(record)" class="detail-report-grid">
                <div class="detail-block">
                  <h3 class="detail-block-label">公告核心新催化</h3>
                  <p class="detail-block-text">{{ parseAnalysis(record)?.公告核心新催化 || '—' }}</p>
                </div>
                <div class="detail-block">
                  <h3 class="detail-block-label">基本面边际变化</h3>
                  <p class="detail-block-text">{{ parseAnalysis(record)?.基本面边际变化 || '—' }}</p>
                </div>
                <div class="detail-block">
                  <h3 class="detail-block-label">股价正反馈核心矛盾</h3>
                  <p class="detail-block-text">{{ parseAnalysis(record)?.['股价正反馈的核心矛盾'] || '—' }}</p>
                </div>
                <div class="detail-block">
                  <h3 class="detail-block-label">成长逻辑验证</h3>
                  <p class="detail-block-text">{{ parseAnalysis(record)?.成长逻辑验证 || '—' }}</p>
                </div>
                <div class="detail-block">
                  <h3 class="detail-block-label">投资看点</h3>
                  <p class="detail-block-text">{{ parseAnalysis(record)?.投资看点 || '—' }}</p>
                </div>
                <div class="detail-block">
                  <h3 class="detail-block-label">风险提示</h3>
                  <p class="detail-block-text">{{ parseAnalysis(record)?.风险提示 || '—' }}</p>
                </div>
              </div>
              <p v-else class="detail-block-text detail-block-empty">暂无解析结果或格式异常。</p>
            </section>
            <section v-else class="detail-report detail-report-pending">
              <p class="detail-block-text">待执行分析，请稍后刷新查看。</p>
            </section>

            <section v-if="record.status === 'DONE' && record.id != null" class="detail-report detail-deep">
              <h2 class="detail-report-title">深度报告</h2>
              <div class="detail-deep-actions">
                <button
                  type="button"
                  class="btn-deep-generate"
                  :disabled="isDeepReportInProgress()"
                  @click="doGenerateDeepReport"
                >
                  {{ isDeepReportInProgress() ? '生成中…' : (record.deepReport ? '重新生成' : '生成深度报告') }}
                </button>
                <button
                  v-if="record.deepReport"
                  type="button"
                  class="btn-deep-download"
                  @click="downloadDeepReport"
                >
                  下载
                </button>
              </div>
              <div v-if="record.deepReport" class="detail-deep-content">
                <div class="detail-deep-body markdown-body" v-html="deepReportToHtml(record.deepReport)"></div>
              </div>
              <p
                v-else-if="record.deepReportStatus === 'PENDING' || record.deepReportStatus === 'PROCESSING'"
                class="detail-block-text detail-block-empty"
              >
                深度报告生成中，请稍候…
              </p>
              <p v-else class="detail-block-text detail-block-empty">暂无深度报告，点击上方按钮生成。</p>
            </section>
          </div>
        </div>

        <template v-else>
          <section v-if="record.status === 'DONE'" class="detail-report">
            <h2 class="detail-report-title">解析报告</h2>
            <div v-if="parseAnalysis(record)" class="detail-report-grid">
              <div class="detail-block">
                <h3 class="detail-block-label">公告核心新催化</h3>
                <p class="detail-block-text">{{ parseAnalysis(record)?.公告核心新催化 || '—' }}</p>
              </div>
              <div class="detail-block">
                <h3 class="detail-block-label">基本面边际变化</h3>
                <p class="detail-block-text">{{ parseAnalysis(record)?.基本面边际变化 || '—' }}</p>
              </div>
              <div class="detail-block">
                <h3 class="detail-block-label">股价正反馈核心矛盾</h3>
                <p class="detail-block-text">{{ parseAnalysis(record)?.['股价正反馈的核心矛盾'] || '—' }}</p>
              </div>
              <div class="detail-block">
                <h3 class="detail-block-label">成长逻辑验证</h3>
                <p class="detail-block-text">{{ parseAnalysis(record)?.成长逻辑验证 || '—' }}</p>
              </div>
              <div class="detail-block">
                <h3 class="detail-block-label">投资看点</h3>
                <p class="detail-block-text">{{ parseAnalysis(record)?.投资看点 || '—' }}</p>
              </div>
              <div class="detail-block">
                <h3 class="detail-block-label">风险提示</h3>
                <p class="detail-block-text">{{ parseAnalysis(record)?.风险提示 || '—' }}</p>
              </div>
            </div>
            <p v-else class="detail-block-text detail-block-empty">暂无解析结果或格式异常。</p>
          </section>
          <section v-else class="detail-report detail-report-pending">
            <p class="detail-block-text">待执行分析，请稍后刷新查看。</p>
          </section>

          <section v-if="record.status === 'DONE' && record.id" class="detail-report detail-deep">
            <h2 class="detail-report-title">深度报告</h2>
            <div class="detail-deep-actions">
              <button
                type="button"
                class="btn-deep-generate"
                :disabled="isDeepReportInProgress()"
                @click="doGenerateDeepReport"
              >
                {{ isDeepReportInProgress() ? '生成中…' : (record.deepReport ? '重新生成' : '生成深度报告') }}
              </button>
              <button v-if="record.deepReport" type="button" class="btn-deep-download" @click="downloadDeepReport">
                下载
              </button>
            </div>
            <div v-if="record.deepReport" class="detail-deep-content">
              <div class="detail-deep-body markdown-body" v-html="deepReportToHtml(record.deepReport)"></div>
            </div>
            <p
              v-else-if="record.deepReportStatus === 'PENDING' || record.deepReportStatus === 'PROCESSING'"
              class="detail-block-text detail-block-empty"
            >
              深度报告生成中，请稍候…
            </p>
            <p v-else class="detail-block-text detail-block-empty">暂无深度报告，点击上方按钮生成。</p>
          </section>
        </template>
      </article>
    </template>
  </div>
</template>

<style scoped>
.detail-page {
  max-width: var(--layout-content-max, var(--max-content));
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.detail-header {
  margin-bottom: 0;
}

.detail-header-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background:
    linear-gradient(112deg, color-mix(in srgb, var(--accent-subtle) 46%, transparent) 0%, transparent 42%),
    color-mix(in srgb, var(--bg-card) 96%, transparent);
}

.detail-header-copy {
  min-width: 0;
}

.detail-header-title {
  font-size: var(--text-base);
  font-weight: 700;
  color: var(--text-primary);
}

.detail-header-subtitle {
  margin-top: var(--space-2xs);
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.detail-back {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  min-height: var(--control-h-sm);
  padding: 0 var(--space-md);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-secondary);
  background: color-mix(in srgb, var(--bg-elevated) 88%, transparent);
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.detail-back:hover {
  color: var(--text-primary);
  border-color: color-mix(in srgb, var(--accent) 36%, var(--border));
  background: color-mix(in srgb, var(--bg-hover) 70%, transparent);
}

.detail-back-icon {
  font-size: 1.05em;
  line-height: 1;
}

.detail-loading,
.detail-error {
  padding: var(--space-3xl) var(--space-md);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--bg-card) 95%, transparent);
  text-align: center;
  color: var(--text-muted);
  font-size: var(--text-base);
}

.detail-error .btn-back-inline {
  margin-top: var(--space-md);
  min-height: var(--control-h-sm);
  padding: 0 var(--space-lg);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-on-accent);
  background: var(--gradient-accent);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.detail-error .btn-back-inline:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-glow);
}

.loading-dot {
  display: inline-block;
  animation: pulse 1.2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.detail-article {
  font-family: var(--font-sans);
}

.detail-title {
  margin: 0 0 var(--space-sm);
  padding: var(--space-md);
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.35;
  letter-spacing: -0.01em;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background:
    linear-gradient(116deg, color-mix(in srgb, var(--accent-subtle) 40%, transparent) 0%, transparent 45%),
    color-mix(in srgb, var(--bg-card) 96%, transparent);
}

.detail-summary {
  margin-bottom: var(--space-sm);
}

.detail-summary-inner {
  padding: var(--space-md);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--bg-elevated) 95%, transparent) 0%, var(--bg-card) 100%);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-sm);
  box-shadow: var(--shadow-sm);
}

.detail-stock {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  flex-wrap: wrap;
}

.detail-stock-main {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  min-width: 0;
}

.detail-stock .code {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--accent);
  background: color-mix(in srgb, var(--accent-subtle) 64%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 26%, transparent);
  padding: 0.2rem 0.52rem;
  border-radius: var(--radius-full);
  letter-spacing: 0.01em;
}

.detail-stock-name {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--text-primary);
}

.detail-stock-actions {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.detail-stock-quote,
.detail-stock-original {
  min-height: var(--control-h-sm);
  padding: 0 var(--space-md);
  font-size: var(--text-sm);
  font-weight: 600;
  border-radius: var(--radius-sm);
  cursor: pointer;
  border: 1px solid transparent;
  min-width: 7rem;
  text-align: center;
  transition: all var(--transition-fast);
}

.detail-stock-quote {
  background: var(--gradient-accent);
  color: var(--text-on-accent);
}

.detail-stock-quote:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-glow);
}

.detail-stock-original {
  background: color-mix(in srgb, var(--bg-elevated) 90%, transparent);
  color: var(--text-secondary);
  border-color: color-mix(in srgb, var(--accent) 26%, var(--border));
}

.detail-stock-original:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.detail-stock-original:not(:disabled):hover {
  color: var(--accent);
  border-color: color-mix(in srgb, var(--accent) 44%, transparent);
  background: color-mix(in srgb, var(--accent-subtle) 68%, transparent);
}

.detail-meta {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: var(--space-xs);
  font-size: var(--text-sm);
  padding-top: var(--space-sm);
  border-top: 1px solid var(--border);
}

.detail-meta-item {
  display: flex;
  flex-direction: column;
  gap: 0.12rem;
  min-width: 0;
  padding: 0.2rem var(--space-xs);
  border-left: 1px solid var(--border-subtle);
}

.detail-meta-key {
  color: var(--text-muted);
  font-weight: 600;
  font-size: var(--text-2xs);
  letter-spacing: 0.02em;
}

.detail-meta-val {
  color: var(--text-secondary);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.detail-pct.pct-up {
  color: var(--gain);
  font-weight: 700;
}

.detail-pct.pct-down {
  color: var(--loss);
  font-weight: 700;
}

.detail-scores {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
  padding-top: var(--space-sm);
}

.detail-score-item {
  display: flex;
  flex-direction: column;
  gap: 0.08rem;
  min-width: 64px;
  padding: 0 var(--space-xs);
  border-left: 1px solid var(--border-subtle);
}

.detail-score-label {
  color: var(--text-muted);
  font-size: var(--text-2xs);
  letter-spacing: 0.02em;
  font-weight: 600;
}

.detail-score-num {
  font-size: var(--text-base);
  font-weight: 700;
  color: var(--accent);
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.detail-rating {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding-top: var(--space-xs);
  font-size: var(--text-sm);
}

.rating-stars {
  display: inline-flex;
  gap: 2px;
}

.rating-star {
  padding: 0.15rem 0.14rem;
  font-size: 1.3rem;
  color: var(--text-muted);
  background: none;
  border: none;
  cursor: pointer;
  line-height: 1;
  transition: all var(--transition-fast);
}

.rating-star:hover,
.rating-star.active {
  color: var(--warning);
  transform: scale(1.08);
  text-shadow: 0 0 8px color-mix(in srgb, var(--warning) 56%, transparent);
}

.detail-report {
  margin-bottom: var(--space-sm);
  padding: var(--space-md);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 95%, transparent) 0%, var(--bg-card) 100%);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.detail-report:last-child {
  margin-bottom: 0;
}

.detail-report-title {
  margin: 0 0 var(--space-sm);
  font-size: var(--text-base);
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}

.detail-report-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.detail-block {
  margin: 0;
  border: 1px solid color-mix(in srgb, var(--border) 86%, transparent);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--bg-elevated) 84%, transparent);
  overflow: hidden;
}

.detail-block-label {
  margin: 0;
  padding: var(--space-xs) var(--space-sm);
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--secondary);
  letter-spacing: 0.02em;
  border-bottom: 1px solid var(--border-subtle);
  background: color-mix(in srgb, var(--bg-card) 90%, transparent);
}

.detail-block-text {
  margin: 0;
  padding: var(--space-sm);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  line-height: 1.75;
  white-space: pre-wrap;
  word-break: break-word;
  max-width: 100%;
}

.detail-block-empty,
.detail-report-pending .detail-block-text {
  color: var(--text-muted);
}

.detail-deep-actions {
  display: flex;
  gap: var(--space-xs);
  margin-bottom: var(--space-sm);
}

.btn-deep-generate,
.btn-deep-download {
  min-height: var(--control-h-sm);
  padding: 0 var(--space-md);
  font-size: var(--text-sm);
  font-weight: 600;
  border-radius: var(--radius-sm);
  cursor: pointer;
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--bg-elevated) 90%, transparent);
  color: var(--text-secondary);
  transition: all var(--transition-fast);
}

.btn-deep-generate:hover:not(:disabled),
.btn-deep-download:hover {
  border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
  color: var(--text-primary);
  background: color-mix(in srgb, var(--bg-hover) 72%, transparent);
}

.btn-deep-generate:disabled {
  opacity: 0.62;
  cursor: not-allowed;
}

.detail-deep-content {
  max-height: 700px;
  overflow-y: auto;
  padding: var(--space-xs) 0;
}

.detail-deep-body {
  margin: 0;
  font-size: var(--text-sm);
  line-height: 1.85;
  word-break: break-word;
  color: var(--text-secondary);
  max-width: 100%;
}

.detail-deep-body.markdown-body :deep(h1),
.detail-deep-body.markdown-body :deep(h2),
.detail-deep-body.markdown-body :deep(h3),
.detail-deep-body.markdown-body :deep(h4),
.detail-deep-body.markdown-body :deep(h5),
.detail-deep-body.markdown-body :deep(h6) {
  margin: 1.2em 0 0.65em;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.4;
}

.detail-deep-body.markdown-body :deep(h1) { font-size: 1.45em; }
.detail-deep-body.markdown-body :deep(h2) { font-size: 1.28em; }
.detail-deep-body.markdown-body :deep(h3) { font-size: 1.12em; }

.detail-deep-body.markdown-body :deep(p) {
  margin: 0 0 1.2em;
}

.detail-deep-body.markdown-body :deep(ul),
.detail-deep-body.markdown-body :deep(ol) {
  margin: 0.7em 0;
  padding-left: 1.5em;
}

.detail-deep-body.markdown-body :deep(li) {
  margin: 0.45em 0;
}

.detail-deep-body.markdown-body :deep(blockquote) {
  margin: 1em 0;
  padding: 0.65em 1em;
  border-left: 3px solid var(--accent);
  background: color-mix(in srgb, var(--accent-subtle) 56%, transparent);
  color: var(--text-secondary);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}

.detail-deep-body.markdown-body :deep(code) {
  font-family: var(--font-mono);
  font-size: 0.9em;
  padding: 0.2em 0.45em;
  background: color-mix(in srgb, var(--accent-subtle) 58%, transparent);
  border-radius: var(--radius-sm);
  color: var(--accent);
}

.detail-deep-body.markdown-body :deep(pre) {
  margin: 1em 0;
  padding: var(--space-sm) var(--space-md);
  overflow-x: auto;
  background: color-mix(in srgb, var(--bg-elevated) 92%, transparent);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: 0.9em;
  line-height: 1.65;
}

.detail-deep-body.markdown-body :deep(pre code) {
  padding: 0;
  background: none;
  color: inherit;
}

.detail-deep-body.markdown-body :deep(hr) {
  margin: 1.25em 0;
  border: none;
  border-top: 1px solid var(--border);
}

.detail-deep-body.markdown-body :deep(a) {
  color: var(--accent);
  text-decoration: none;
  border-bottom: 1px solid transparent;
  transition: all var(--transition-fast);
}

.detail-deep-body.markdown-body :deep(a:hover) {
  border-bottom-color: var(--accent);
}

.detail-deep-body.markdown-body :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 1em 0;
  font-size: 0.95em;
}

.detail-deep-body.markdown-body :deep(th),
.detail-deep-body.markdown-body :deep(td) {
  padding: 0.6em 0.8em;
  border: 1px solid var(--border);
  text-align: left;
}

.detail-deep-body.markdown-body :deep(th) {
  font-weight: 600;
  background: color-mix(in srgb, var(--bg-elevated) 92%, transparent);
  color: var(--text-primary);
}

.detail-deep-body.markdown-body :deep(strong),
.detail-deep-body.markdown-body :deep(b) {
  font-weight: 600;
  color: var(--text-primary);
}

.detail-main-split {
  display: grid;
  grid-template-columns: minmax(0, 11fr) minmax(0, 9fr);
  gap: var(--space-sm);
  margin-top: var(--space-sm);
}

.detail-original-panel {
  padding: var(--space-sm);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 95%, transparent) 0%, var(--bg-card) 100%);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  min-height: 80vh;
  max-height: 88vh;
  box-shadow: var(--shadow-sm);
}

.detail-original-tip {
  margin: 0 0 var(--space-sm);
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.detail-original-frame-wrap {
  flex: 1;
  min-height: 0;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--bg-elevated) 92%, transparent);
}

.detail-original-frame {
  width: 100%;
  height: 100%;
  border: none;
}

.detail-original-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
  margin-bottom: var(--space-sm);
}

.detail-original-open-link {
  display: inline-flex;
  align-items: center;
  min-height: 1.45rem;
  padding: 0 var(--space-sm);
  border: 1px solid color-mix(in srgb, var(--accent) 24%, transparent);
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--accent-subtle) 56%, transparent);
  font-size: var(--text-xs);
  color: var(--text-secondary);
  text-decoration: none;
  font-weight: 600;
  transition: all var(--transition-fast);
}

.detail-original-open-link:hover {
  color: var(--accent);
  border-color: color-mix(in srgb, var(--accent) 42%, transparent);
}

.detail-analysis-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  overflow-y: auto;
  max-height: 88vh;
  padding-right: var(--space-2xs);
}

@media (max-width: 1024px) {
  .detail-main-split {
    grid-template-columns: minmax(0, 1fr);
  }

  .detail-original-panel {
    min-height: 50vh;
    max-height: none;
  }

  .detail-analysis-panel {
    max-height: none;
    padding-right: 0;
  }
}

@media (max-width: 768px) {
  .detail-header-main {
    flex-direction: column;
    align-items: flex-start;
    padding: var(--space-sm);
  }

  .detail-title {
    padding: var(--space-sm);
    font-size: var(--text-lg);
  }

  .detail-summary-inner {
    padding: var(--space-sm);
  }

  .detail-stock {
    flex-direction: column;
    align-items: flex-start;
  }

  .detail-stock-actions {
    width: 100%;
    justify-content: stretch;
  }

  .detail-stock-quote,
  .detail-stock-original {
    flex: 1;
    min-width: 0;
  }

  .detail-meta {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .detail-report {
    padding: var(--space-sm);
  }

  .detail-original-panel {
    padding: var(--space-sm);
  }
}
</style>
