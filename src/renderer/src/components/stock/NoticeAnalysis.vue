<script setup lang="ts">
/**
 * 公告解析详情组件
 * 展示公告的AI解析结果、深度报告
 * 支持 Markdown 格式内容渲染
 */
import { ref, computed, watch } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import type { NoticeRecord, AnalysisResultJson } from '@/api/types'
import { getDeepReport, triggerNoticeAnalysis, generateDeepReport, getNoticeById, rateNotice } from '@/api/client'
import { dataCache, CACHE_KEYS, CACHE_TTL } from '@/utils/cache'
import { normalizeNoticeLink } from '@/utils/noticeLink'

interface Props {
  notice: NoticeRecord | null
  loading?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:notice': [notice: NoticeRecord]
}>()

// 解析详情数据
const analysisDetail = ref<AnalysisResultJson | null>(null)
const deepReport = ref<string>('')
const deepReportLoading = ref(false)
const deepReportError = ref<string | null>(null)

// 触发解析状态
const analysisTriggering = ref(false)
const analysisTriggered = ref(false)

// 深度报告生成状态
const deepReportGenerating = ref(false)

// 用户评分
const userRating = ref(0)
const isRating = ref(false)

// 当前选中的标签页
const activeTab = ref<'analysis' | 'report' | 'original'>('analysis')

// 缓存键
const getCacheKey = (noticeId: number, type: 'detail' | 'report') => 
  `${CACHE_KEYS.NOTICE_DETAIL}:${noticeId}:${type}`

/** 将 Markdown 文本转为安全 HTML */
function markdownToHtml(raw: string | null | undefined): string {
  if (raw == null || String(raw).trim() === '') return ''
  const text = String(raw).trim()
  const html = marked.parse(text, { async: false }) as string
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'b', 'em', 'i', 'u', 'code', 'pre', 'blockquote', 'ul', 'ol', 'li', 'hr', 'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
  })
}

// 获取深度报告
async function fetchDeepReport() {
  if (!props.notice?.id) return

  // 优先使用 notice 里已有的 deepReport
  if (props.notice.deepReport && props.notice.deepReport.trim() !== '') {
    deepReport.value = props.notice.deepReport
    return
  }

  // 如果深度报告状态不是 DONE，不需要请求后端
  if (props.notice.deepReportStatus !== 'DONE') {
    deepReport.value = ''
    return
  }

  const cacheKey = getCacheKey(props.notice.id, 'report')
  const cached = dataCache.get<string>(cacheKey)
  if (cached) {
    deepReport.value = cached
    return
  }

  try {
    deepReportLoading.value = true
    deepReportError.value = null
    const data = await getDeepReport(props.notice.id)
    deepReport.value = data?.deepReport || ''
    if (deepReport.value) {
      dataCache.set(cacheKey, deepReport.value, CACHE_TTL.NOTICE_DETAIL)
    }
  } catch (e) {
    console.error('获取深度报告失败:', e)
    deepReport.value = ''
    deepReportError.value = '获取深度报告失败'
  } finally {
    deepReportLoading.value = false
  }
}

// 格式化日期
function formatDate(dateStr?: string): string {
  if (!dateStr) return '-'
  return dateStr
}

// 解析 analysisResult JSON
function parseAnalysisResult(notice: NoticeRecord | null): AnalysisResultJson | null {
  if (!notice?.analysisResult) return null
  try {
    const parsed = JSON.parse(notice.analysisResult) as AnalysisResultJson
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

/** 获取分数展示值 */
function getScoreDisplay(
  parsed: AnalysisResultJson | null,
  notice: NoticeRecord | null,
  jsonKey: keyof AnalysisResultJson,
  recordKey: 'scoreFundamental' | 'scoreNovelty' | 'scoreBusiness' | 'scoreElasticity'
): string {
  // 优先使用记录中的分数字段
  const recordVal = notice?.[recordKey]
  if (recordVal != null && recordVal >= 1 && recordVal <= 5) return String(recordVal)
  // 否则从解析结果中取
  if (!parsed) return '-'
  const v = parsed[jsonKey]
  if (v == null || v === '') return '-'
  const n = Number(v)
  return Number.isNaN(n) ? '-' : String(n)
}

/** 获取已解析的分析内容字段 */
function getAnalysisField(key: keyof AnalysisResultJson): string {
  const val = analysisDetail.value?.[key]
  return val != null && String(val).trim() !== '' ? String(val) : ''
}

/** 是否有解析内容 */
const hasAnalysisContent = computed(() => {
  if (!analysisDetail.value) return false
  const keys: (keyof AnalysisResultJson)[] = [
    '公告核心新催化', '基本面边际变化', '股价正反馈的核心矛盾',
    '成长逻辑验证', '投资看点', '风险提示'
  ]
  return keys.some(k => getAnalysisField(k))
})

const secureNoticeLink = computed(() => {
  const notice = props.notice as (NoticeRecord & { notice_link?: string }) | null
  return normalizeNoticeLink(notice?.noticeLink || notice?.notice_link || '')
})

/** 深度报告状态 */
const deepReportStatus = computed(() => props.notice?.deepReportStatus || '')
const isDeepReportGenerating = computed(() => 
  deepReportStatus.value === 'PENDING' || deepReportStatus.value === 'PROCESSING' || deepReportGenerating.value
)
const isAnalysisDone = computed(() => props.notice?.status === 'DONE')

/** 触发公告 AI 解析 */
async function doTriggerAnalysis() {
  if (!props.notice?.id || analysisTriggering.value) return
  analysisTriggering.value = true
  analysisTriggered.value = false
  try {
    const result = await triggerNoticeAnalysis(props.notice.id)
    if (result.triggered) {
      analysisTriggered.value = true
      // 开始轮询解析结果
      pollAnalysisResult()
    }
  } catch (e) {
    console.error('触发解析失败:', e)
  } finally {
    analysisTriggering.value = false
  }
}

// 轮询状态锁
const isPollingAnalysis = ref(false)
const isPollingDeepReport = ref(false)

/** 轮询解析结果 */
async function pollAnalysisResult() {
  if (!props.notice?.id || isPollingAnalysis.value) return
  isPollingAnalysis.value = true
  
  const noticeId = props.notice.id
  const maxAttempts = 60 // 最多轮询 5 分钟
  const interval = 5000 // 5秒轮询一次
  
  try {
    for (let i = 0; i < maxAttempts; i++) {
      // 如果当前 noticeId 变了（用户切走了），停止轮询
      if (props.notice?.id !== noticeId) break
      
      await new Promise(resolve => setTimeout(resolve, interval))
      
      try {
        const updated = await getNoticeById(noticeId)
        // 如果切走了，不再处理
        if (props.notice?.id !== noticeId) break
        
        if (updated.status === 'DONE' && updated.analysisResult) {
          analysisDetail.value = parseAnalysisResult(updated)
          analysisTriggered.value = false
          emit('update:notice', updated)
          return
        } else if (updated.status === 'PROCESSING') {
           // 保持触发状态
           analysisTriggered.value = true
           // 更新一下父组件状态（可选，看是否需要实时同步状态变化）
           // emit('update:notice', updated) 
        }
      } catch (e) {
        console.error('轮询解析结果失败:', e)
      }
    }
  } finally {
    isPollingAnalysis.value = false
    // 只有在没有切换 notice 的情况下才重置
    if (props.notice?.id === noticeId && props.notice?.status !== 'PROCESSING') {
        analysisTriggered.value = false
    }
  }
}

/** 生成深度报告 */
async function doGenerateDeepReport() {
  if (!props.notice?.id || deepReportGenerating.value) return
  deepReportGenerating.value = true
  try {
    await generateDeepReport(props.notice.id)
    // 开始轮询深度报告结果
    pollDeepReportResult()
  } catch (e) {
    console.error('生成深度报告失败:', e)
    deepReportGenerating.value = false
  }
}

/** 轮询深度报告结果 */
async function pollDeepReportResult() {
  if (!props.notice?.id) return
  const noticeId = props.notice.id
  const maxAttempts = 60 // 最多轮询 5 分钟
  const interval = 5000 // 5秒轮询一次
  
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(resolve => setTimeout(resolve, interval))
    try {
      const data = await getDeepReport(noticeId)
      if (data.deepReport && data.deepReport.trim() !== '') {
        deepReport.value = data.deepReport
        deepReportGenerating.value = false
        return
      }
    } catch (e) {
      console.error('轮询深度报告结果失败:', e)
    }
  }
  deepReportGenerating.value = false
}

/** 处理用户评分 */
async function handleRate(value: number) {
  if (!props.notice?.id || isRating.value) return
  isRating.value = true
  try {
    await rateNotice(props.notice.id, value)
    // 更新本地状态，虽然后端没有返回最新的 notice 对象，但可以假定成功
    // 如果父组件通过 emit('update:notice') 更新了整个对象，这里会被 watch 覆盖
    // 为了即时反馈，我们已经通过 v-model 更新了 userRating
    // 也可以通知父组件更新
    if (props.notice) {
       emit('update:notice', { ...props.notice, userRating: value })
    }
  } catch (e) {
    console.error('评分失败:', e)
    // 失败回滚？暂不处理，用户可以重试
  } finally {
    isRating.value = false
  }
}

// 监听公告变化
watch(() => props.notice, (newNotice, oldNotice) => {
  if (newNotice) {
    analysisDetail.value = parseAnalysisResult(newNotice)
    userRating.value = newNotice.userRating || 0
    
    const isSameNotice = oldNotice?.id === newNotice.id
    
    if (!isSameNotice) {
        // 切换公告：完全重置状态
        analysisTriggering.value = false
        deepReportGenerating.value = false
        deepReport.value = '' // 清空旧报告
        
        // 检查新公告状态，如果是处理中则开启轮询
        if (newNotice.status === 'PROCESSING') {
            analysisTriggered.value = true
            pollAnalysisResult()
        } else {
            analysisTriggered.value = false
        }
        
        // 获取深度报告
        fetchDeepReport()
        activeTab.value = 'analysis'
    } else {
        // 同一个公告更新（可能是轮询导致的更新）
        // 如果状态变成完成，重置触发标识
        if (newNotice.status === 'DONE') {
            analysisTriggered.value = false
        } else if (newNotice.status === 'PROCESSING') {
            // 如果变成处理中（可能是其他端触发），确保 polling 开启
            if (!analysisTriggered.value) {
                analysisTriggered.value = true
                pollAnalysisResult()
            }
        }
        // 如果是 PENDING，保持 analysisTriggered 原样（如果是我们手动触发的，它会是 true）
        
        // 检查深度报告状态更新
        if (newNotice.deepReportStatus === 'DONE' && !deepReport.value) {
            fetchDeepReport()
        }
    }
  } else {
    analysisDetail.value = null
    deepReport.value = ''
    analysisTriggered.value = false
  }
}, { immediate: true })
</script>

<template>
  <div class="notice-analysis-container">
    <!-- 空状态 -->
    <div v-if="!notice" class="empty-state">
      <span class="empty-icon" aria-hidden="true"></span>
      <span class="empty-text">请选择一条公告查看解析详情</span>
    </div>

    <!-- 加载状态 -->
    <div v-else-if="loading" class="loading-state">
      <div class="loading-spinner"></div>
      <span>加载解析中...</span>
    </div>

    <!-- 内容区域 -->
    <div v-else class="analysis-content">
      <!-- 公告标题 -->
      <div class="notice-header">
        <h2 class="notice-title">{{ notice.noticeTitle }}</h2>
        <div class="notice-meta">
          <span class="meta-item">
            <span class="meta-label">发布时间</span>
            <span class="meta-value">{{ formatDate(notice.publishTime) }}</span>
          </span>
          <span class="meta-item" v-if="notice.stockName">
            <span class="meta-label">股票</span>
            <span class="meta-value">{{ notice.stockName }} ({{ notice.stockCode }})</span>
          </span>
          <span class="meta-item" v-if="notice.beneficialDirection">
            <span class="meta-label">受益方向</span>
            <span class="meta-value highlight">{{ notice.beneficialDirection }}</span>
          </span>
          <span class="meta-item" v-if="notice.industry">
            <span class="meta-label">行业</span>
            <span class="meta-value">{{ notice.industry }}</span>
          </span>
        </div>
        <!-- 评分展示 -->
        <div v-if="analysisDetail || notice.scoreFundamental" class="notice-scores">
          <div class="score-item">
            <span class="score-label">基本面</span>
            <span class="score-value">{{ getScoreDisplay(analysisDetail, notice, '评分_基本面', 'scoreFundamental') }}</span>
          </div>
          <div class="score-item">
            <span class="score-label">逻辑新颖</span>
            <span class="score-value">{{ getScoreDisplay(analysisDetail, notice, '评分_逻辑新颖', 'scoreNovelty') }}</span>
          </div>
          <div class="score-item">
            <span class="score-label">商业竞争力</span>
            <span class="score-value">{{ getScoreDisplay(analysisDetail, notice, '评分_商业模式竞争力', 'scoreBusiness') }}</span>
          </div>
          <div class="score-item">
            <span class="score-label">弹性确定性</span>
            <span class="score-value">{{ getScoreDisplay(analysisDetail, notice, '评分_弹性确定性', 'scoreElasticity') }}</span>
          </div>
          <!-- 用户评分 -->
          <div class="score-item user-rating-item">
            <span class="score-label">用户评分</span>
            <div class="rating-wrapper">
              <el-rate
                v-model="userRating"
                :max="5"
                allow-half
                :disabled="isRating"
                @change="handleRate"
              />
              <span class="rating-value" v-if="userRating > 0">{{ userRating }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 标签页切换 -->
      <div class="tab-bar">
        <button 
          class="tab-btn" 
          :class="{ active: activeTab === 'analysis' }"
          @click="activeTab = 'analysis'"
        >
          <span class="tab-dot tab-dot--analysis" aria-hidden="true"></span>
          AI解析
        </button>
        <button 
          class="tab-btn" 
          :class="{ active: activeTab === 'report', generating: isDeepReportGenerating }"
          @click="activeTab = 'report'"
        >
          <span class="tab-dot tab-dot--report" aria-hidden="true"></span>
          深度报告
          <span v-if="isDeepReportGenerating" class="tab-badge generating">生成中</span>
          <span v-else-if="deepReport" class="tab-badge ready">已生成</span>
        </button>
        <button 
          class="tab-btn" 
          :class="{ active: activeTab === 'original' }"
          @click="activeTab = 'original'"
        >
          <span class="tab-dot tab-dot--original" aria-hidden="true"></span>
          原文
        </button>
      </div>

      <!-- AI解析内容 -->
      <div v-if="activeTab === 'analysis'" class="tab-content">
        <div v-if="hasAnalysisContent" class="analysis-grid">
          <!-- 公告核心新催化 -->
          <div v-if="getAnalysisField('公告核心新催化')" class="analysis-card highlight-card">
            <h3 class="card-title">
              <span class="card-dot card-dot--highlight" aria-hidden="true"></span>
              公告核心新催化
            </h3>
            <div class="card-content markdown-body" v-html="markdownToHtml(getAnalysisField('公告核心新催化'))"></div>
          </div>
          
          <!-- 基本面边际变化 -->
          <div v-if="getAnalysisField('基本面边际变化')" class="analysis-card">
            <h3 class="card-title">
              <span class="card-dot card-dot--default" aria-hidden="true"></span>
              基本面边际变化
            </h3>
            <div class="card-content markdown-body" v-html="markdownToHtml(getAnalysisField('基本面边际变化'))"></div>
          </div>

          <!-- 股价正反馈核心矛盾 -->
          <div v-if="getAnalysisField('股价正反馈的核心矛盾')" class="analysis-card">
            <h3 class="card-title">
              <span class="card-dot card-dot--default" aria-hidden="true"></span>
              股价正反馈核心矛盾
            </h3>
            <div class="card-content markdown-body" v-html="markdownToHtml(getAnalysisField('股价正反馈的核心矛盾'))"></div>
          </div>

          <!-- 成长逻辑验证 -->
          <div v-if="getAnalysisField('成长逻辑验证')" class="analysis-card">
            <h3 class="card-title">
              <span class="card-dot card-dot--default" aria-hidden="true"></span>
              成长逻辑验证
            </h3>
            <div class="card-content markdown-body" v-html="markdownToHtml(getAnalysisField('成长逻辑验证'))"></div>
          </div>

          <!-- 投资看点 -->
          <div v-if="getAnalysisField('投资看点')" class="analysis-card accent-card">
            <h3 class="card-title">
              <span class="card-dot card-dot--accent" aria-hidden="true"></span>
              投资看点
            </h3>
            <div class="card-content markdown-body" v-html="markdownToHtml(getAnalysisField('投资看点'))"></div>
          </div>

          <!-- 风险提示 -->
          <div v-if="getAnalysisField('风险提示')" class="analysis-card warning-card">
            <h3 class="card-title">
              <span class="card-dot card-dot--warning" aria-hidden="true"></span>
              风险提示
            </h3>
            <div class="card-content markdown-body" v-html="markdownToHtml(getAnalysisField('风险提示'))"></div>
          </div>
        </div>

        <!-- 暂无解析 -->
        <div v-else class="no-data">
          <span class="no-data-icon no-data-icon--analysis" aria-hidden="true"></span>
          <span class="no-data-text">{{ analysisTriggered ? '解析中...' : '暂无AI解析数据' }}</span>
          <span class="no-data-hint">{{ analysisTriggered ? 'AI正在分析公告内容，请稍候...' : '该公告尚未完成AI分析' }}</span>
          <button
            v-if="!analysisTriggered"
            type="button"
            class="action-btn primary"
            :disabled="analysisTriggering"
            @click="doTriggerAnalysis"
          >
            {{ analysisTriggering ? '提交中...' : '请求解析' }}
          </button>
        </div>
      </div>

      <!-- 深度报告内容 -->
      <div v-else-if="activeTab === 'report'" class="tab-content">
        <div v-if="deepReportLoading" class="loading-state compact">
          <div class="loading-spinner"></div>
          <span>加载深度报告中...</span>
        </div>
        <div v-else-if="deepReport" class="report-container">
          <div class="report-actions">
            <button
              type="button"
              class="action-btn secondary"
              :disabled="isDeepReportGenerating || !isAnalysisDone"
              :title="!isAnalysisDone ? '请先完成AI解析' : ''"
              @click="doGenerateDeepReport"
            >
              {{ isDeepReportGenerating ? '生成中...' : '重新生成' }}
            </button>
          </div>
          <div class="report-body markdown-body" v-html="markdownToHtml(deepReport)"></div>
        </div>
        <div v-else-if="isDeepReportGenerating" class="no-data generating">
          <span class="no-data-icon no-data-icon--report generating-icon" aria-hidden="true"></span>
          <span class="no-data-text">深度报告生成中</span>
          <span class="no-data-hint">AI正在分析公告内容，请稍候...</span>
        </div>
        <div v-else class="no-data">
          <span class="no-data-icon no-data-icon--report" aria-hidden="true"></span>
          <span class="no-data-text">暂无深度报告</span>
          <span class="no-data-hint">点击下方按钮生成深度报告</span>
          <button
            type="button"
            class="action-btn primary"
            :disabled="isDeepReportGenerating || !isAnalysisDone"
            :title="!isAnalysisDone ? '请先完成AI解析' : ''"
            @click="doGenerateDeepReport"
          >
            {{ isDeepReportGenerating ? '生成中...' : '生成深度报告' }}
          </button>
        </div>
      </div>

      <!-- 原文内容 -->
      <div v-else-if="activeTab === 'original'" class="tab-content">
        <div v-if="secureNoticeLink" class="original-container">
          <div class="original-actions">
            <a
              :href="secureNoticeLink"
              target="_blank"
              rel="noopener noreferrer"
              class="original-link"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                <polyline points="15 3 21 3 21 9"></polyline>
                <line x1="10" y1="14" x2="21" y2="3"></line>
              </svg>
              <span>在新窗口打开原文</span>
            </a>
          </div>
          <div class="original-frame-wrap">
            <iframe
              class="original-frame"
              :src="secureNoticeLink"
              title="公告原文"
            />
          </div>
        </div>
        <div v-else class="no-data">
          <span class="no-data-icon no-data-icon--original" aria-hidden="true"></span>
          <span class="no-data-text">暂无原文链接</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.notice-analysis-container {
  background:
    linear-gradient(112deg, color-mix(in srgb, var(--accent-subtle) 44%, transparent) 0%, transparent 46%),
    linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 96%, transparent), var(--bg-card));
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 0;
  height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-sm);
}

.empty-state,
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-3xl) var(--space-md);
  color: var(--text-muted);
  gap: var(--space-sm);
  flex: 1;
}

.loading-state.compact {
  padding: var(--space-xl) var(--space-md);
}

.empty-icon {
  width: 1.7rem;
  height: 1.7rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--bg-elevated) 90%, transparent);
  opacity: 0.72;
}

.empty-text {
  font-size: var(--text-base);
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 内容区域 */
.analysis-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

/* 公告头部 */
.notice-header {
  padding: var(--space-md);
  border-bottom: 1px solid var(--border);
  background:
    linear-gradient(112deg, color-mix(in srgb, var(--accent-subtle) 46%, transparent) 0%, transparent 42%),
    linear-gradient(180deg, color-mix(in srgb, var(--bg-elevated) 95%, transparent) 0%, var(--bg-card) 100%);
}

.notice-title {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 var(--space-sm) 0;
  line-height: 1.4;
}

.notice-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--text-xs);
  padding: 0.16rem 0.5rem;
  border: 1px solid color-mix(in srgb, var(--border) 85%, transparent);
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--bg-card) 84%, transparent);
}

.meta-label {
  color: var(--text-muted);
  font-size: var(--text-xs);
}

.meta-value {
  color: var(--text-secondary);
  font-weight: 500;
}

.meta-value.highlight {
  color: var(--accent);
  font-weight: 600;
}

.notice-scores {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
  margin-top: var(--space-sm);
  padding-top: var(--space-sm);
  border-top: 1px solid var(--border);
}

.score-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 60px;
  padding: 0 var(--space-2xs);
  border-left: 1px solid var(--border-subtle);
}

.score-label {
  font-size: var(--text-xs);
  color: var(--text-muted);
  letter-spacing: 0.01em;
}

.score-value {
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
  font-family: var(--font-mono);
}

.user-rating-item {
  min-width: 120px;
  padding-left: 16px;
  margin-left: 8px;
}

.rating-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 28px; /* 与其他分数高度对齐 */
}

.rating-value {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--warning);
}

.tab-bar {
  display: flex;
  gap: var(--space-xs);
  padding: var(--space-xs) var(--space-md);
  background: color-mix(in srgb, var(--bg-card) 96%, transparent);
  border-bottom: 1px solid var(--border);
  flex-wrap: wrap;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  min-height: var(--control-h-sm);
  padding: 0 var(--space-md);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-muted);
  background: color-mix(in srgb, var(--bg-elevated) 88%, transparent);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-full);
  cursor: pointer;
  transition: all var(--transition-fast);
  position: relative;
}

.tab-dot {
  width: 0.46rem;
  height: 0.46rem;
  border-radius: var(--radius-full);
  background: var(--text-muted);
}

.tab-dot--analysis {
  background: var(--accent);
}

.tab-dot--report {
  background: var(--secondary);
}

.tab-dot--original {
  background: var(--success);
}

.tab-btn:hover {
  color: var(--text-primary);
  border-color: color-mix(in srgb, var(--accent) 34%, var(--border));
  background: color-mix(in srgb, var(--bg-hover) 72%, transparent);
}

.tab-btn.active {
  color: var(--accent);
  border-color: color-mix(in srgb, var(--accent) 44%, var(--border));
  background: color-mix(in srgb, var(--accent-subtle) 66%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 18%, transparent);
}

.tab-btn.generating {
  color: var(--warning);
}

.tab-badge {
  font-size: var(--text-2xs);
  padding: 2px 6px;
  border-radius: var(--radius-full);
  font-weight: 600;
}

.tab-badge.generating {
  background: var(--warning-subtle);
  color: var(--warning);
  animation: pulse-badge 1.5s ease-in-out infinite;
}

.tab-badge.ready {
  background: var(--success-subtle);
  color: var(--success);
}

@keyframes pulse-badge {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

/* 内容区域 */
.tab-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-md);
}

/* AI解析网格布局 */
.analysis-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.analysis-card {
  background: color-mix(in srgb, var(--bg-elevated) 90%, transparent);
  border: 1px solid color-mix(in srgb, var(--border) 88%, transparent);
  border-radius: var(--radius-md);
  overflow: hidden;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.analysis-card:hover {
  border-color: color-mix(in srgb, var(--accent) 30%, var(--border));
  box-shadow: var(--shadow-xs);
}

.analysis-card.highlight-card {
  border-left: 3px solid var(--accent);
}

.analysis-card.accent-card {
  border-left: 3px solid var(--success);
}

.analysis-card.warning-card {
  border-left: 3px solid var(--warning);
}

.card-title {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-sm) var(--space-md);
  margin: 0;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-primary);
  background: color-mix(in srgb, var(--bg-card) 92%, transparent);
  border-bottom: 1px solid var(--border);
}

.card-dot {
  width: 0.46rem;
  height: 0.46rem;
  border-radius: var(--radius-full);
  background: var(--text-muted);
  flex-shrink: 0;
}

.card-dot--default {
  background: color-mix(in srgb, var(--accent) 72%, var(--text-muted));
}

.card-dot--highlight {
  background: var(--accent);
}

.card-dot--accent {
  background: var(--success);
}

.card-dot--warning {
  background: var(--warning);
}

.card-content {
  padding: var(--space-md);
}

/* Markdown 内容样式 */
.markdown-body {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  line-height: 1.75;
}

.markdown-body :deep(p) {
  margin: 0 0 1em;
}

.markdown-body :deep(p:last-child) {
  margin-bottom: 0;
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4) {
  margin: 1.2em 0 0.6em;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.4;
}

.markdown-body :deep(h1) { font-size: 1.4em; }
.markdown-body :deep(h2) { font-size: 1.25em; }
.markdown-body :deep(h3) { font-size: 1.1em; }
.markdown-body :deep(h4) { font-size: 1em; }

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  margin: 0.75em 0;
  padding-left: 1.5em;
}

.markdown-body :deep(li) {
  margin: 0.4em 0;
}

.markdown-body :deep(strong),
.markdown-body :deep(b) {
  color: var(--text-primary);
  font-weight: 600;
}

.markdown-body :deep(blockquote) {
  margin: 1em 0;
  padding: 0.75em 1em;
  border-left: 3px solid var(--accent);
  background: var(--bg-card);
  color: var(--text-secondary);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}

.markdown-body :deep(code) {
  font-family: var(--font-mono);
  font-size: 0.9em;
  padding: 0.2em 0.4em;
  background: var(--bg-card);
  border-radius: var(--radius-sm);
  color: var(--accent);
}

.markdown-body :deep(pre) {
  margin: 1em 0;
  padding: 1em;
  background: var(--bg-card);
  border-radius: var(--radius-md);
  overflow-x: auto;
}

.markdown-body :deep(pre code) {
  padding: 0;
  background: none;
}

.markdown-body :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 1em 0;
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  padding: 8px 12px;
  border: 1px solid var(--border);
  text-align: left;
}

.markdown-body :deep(th) {
  background: var(--bg-card);
  font-weight: 600;
}

/* 深度报告容器 */
.report-container {
  background: color-mix(in srgb, var(--bg-elevated) 90%, transparent);
  border: 1px solid color-mix(in srgb, var(--border) 88%, transparent);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.report-body {
  padding: var(--space-lg);
  max-height: calc(100vh - 450px);
  overflow-y: auto;
}

/* 无数据 */
.no-data {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-3xl) var(--space-md);
  color: var(--text-muted);
  gap: var(--space-xs);
  text-align: center;
}

.no-data-icon {
  width: 1.6rem;
  height: 1.6rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--bg-elevated) 88%, transparent);
  opacity: 0.72;
}

.no-data-icon--analysis {
  border-color: color-mix(in srgb, var(--accent) 30%, transparent);
  background: color-mix(in srgb, var(--accent-subtle) 62%, transparent);
}

.no-data-icon--report {
  border-color: color-mix(in srgb, var(--warning) 30%, transparent);
  background: color-mix(in srgb, var(--warning-subtle) 62%, transparent);
}

.no-data-icon--original {
  border-color: color-mix(in srgb, var(--success) 30%, transparent);
  background: color-mix(in srgb, var(--success-subtle) 62%, transparent);
}

.no-data.generating .generating-icon {
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.05); opacity: 0.7; }
}

.no-data-text {
  font-size: var(--text-base);
  color: var(--text-secondary);
  font-weight: 500;
}

.no-data-hint {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

/* 操作按钮 */
.action-btn {
  margin-top: var(--space-sm);
  min-height: var(--control-h-sm);
  padding: 0 var(--space-lg);
  font-size: var(--text-sm);
  font-weight: 600;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.action-btn.primary {
  background: var(--gradient-accent);
  color: var(--text-on-accent);
}

.action-btn.primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: var(--shadow-glow);
}

.action-btn.secondary {
  background: var(--bg-elevated);
  color: var(--text-secondary);
  border: 1px solid var(--border);
}

.action-btn.secondary:hover:not(:disabled) {
  background: color-mix(in srgb, var(--bg-hover) 70%, transparent);
  border-color: color-mix(in srgb, var(--accent) 36%, var(--border));
  color: var(--text-primary);
}

.action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 报告操作栏 */
.report-actions {
  display: flex;
  justify-content: flex-end;
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--border);
  background: color-mix(in srgb, var(--bg-elevated) 92%, transparent);
}

.report-actions .action-btn {
  margin-top: 0;
  padding: 6px 16px;
  font-size: var(--text-xs);
}

/* 原文容器 */
.original-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: var(--space-sm);
}

.original-actions {
  display: flex;
  justify-content: flex-end;
}

.original-link {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  min-height: var(--control-h-sm);
  padding: 0 var(--space-md);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-secondary);
  background: color-mix(in srgb, var(--bg-elevated) 92%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 24%, var(--border));
  border-radius: var(--radius-full);
  text-decoration: none;
  transition: all var(--transition-fast);
}

.original-link:hover {
  background: color-mix(in srgb, var(--accent-subtle) 68%, transparent);
  color: var(--accent);
  border-color: color-mix(in srgb, var(--accent) 40%, transparent);
}

.original-frame-wrap {
  flex: 1;
  min-height: 500px;
  background: color-mix(in srgb, var(--bg-elevated) 90%, transparent);
  border: 1px solid color-mix(in srgb, var(--border) 88%, transparent);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.original-frame {
  width: 100%;
  height: 100%;
  border: none;
  background: white;
}

/* 响应式 */
@media (max-width: 768px) {
  .notice-header {
    padding: var(--space-sm);
  }

  .notice-title {
    font-size: var(--text-base);
  }

  .notice-meta {
    flex-direction: column;
    gap: 8px;
  }

  .notice-scores {
    gap: 12px;
  }

  .tab-bar {
    padding: var(--space-xs) var(--space-sm);
  }

  .tab-btn {
    padding: 0 var(--space-sm);
    font-size: var(--text-xs);
  }

  .tab-content {
    padding: var(--space-sm);
  }

  .card-title {
    padding: var(--space-sm);
  }

  .card-content {
    padding: var(--space-sm);
  }

  .report-body {
    padding: var(--space-sm);
  }
}
</style>
