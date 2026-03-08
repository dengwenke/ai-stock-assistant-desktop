<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { getNoticeOriginalList } from '@/api/client'
import type { NoticeOriginalRecord } from '@/api/types'
import PaginationBar from '@/components/PaginationBar.vue'
import TradeCalendarDatePicker from '@/components/TradeCalendarDatePicker.vue'
import { useWorkspaceStore } from '@/stores/workspace'
import { normalizeNoticeLink } from '@/utils/noticeLink'

const list = ref<NoticeOriginalRecord[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const loading = ref(false)

const queryStockCode = ref('')
const queryStockName = ref('')
const queryNoticeTitle = ref('')
const queryStartDate = ref('')
const queryEndDate = ref('')
const workspaceStore = useWorkspaceStore()
const { currentMarket } = storeToRefs(workspaceStore)

async function fetchList(p = page.value) {
  loading.value = true
  try {
    const result = await getNoticeOriginalList({
      page: p,
      size: pageSize.value,
      stockCode: queryStockCode.value.trim() || undefined,
      stockName: queryStockName.value.trim() || undefined,
      noticeTitle: queryNoticeTitle.value.trim() || undefined,
      startDate: queryStartDate.value || undefined,
      endDate: queryEndDate.value || undefined,
      market: currentMarket.value,
    })
    list.value = result.list
    total.value = result.total
    page.value = p
  } catch (e) {
    console.error('查询公告原文失败', e)
  } finally {
    loading.value = false
  }
}

function doQuery() {
  fetchList(1)
}

function resetQuery() {
  queryStockCode.value = ''
  queryStockName.value = ''
  queryNoticeTitle.value = ''
  queryStartDate.value = ''
  queryEndDate.value = ''
  fetchList(1)
}

function goPage(p: number) {
  fetchList(p)
}

function changePageSize(s: number) {
  pageSize.value = s
  fetchList(1)
}

function openNoticeLink(url: string) {
  const secureUrl = normalizeNoticeLink(url)
  if (secureUrl) {
    window.open(secureUrl, '_blank')
  }
}

function formatDate(dateStr: string) {
  if (!dateStr) return '-'
  return dateStr
}

function getEmptyText() {
  if (currentMarket.value === 'HK') {
    return '暂无港股公告数据，可先开启港股公告同步后再查询'
  }
  if (currentMarket.value === 'US') {
    return '暂无美股公告数据，可先开启美股公告同步后再查询'
  }
  return '暂无数据'
}

onMounted(() => {
  fetchList()
})

watch(currentMarket, () => {
  fetchList(1)
})
</script>

<template>
  <div class="notice-original terminal-page web-page web-page--dense">
    <section class="result-section">
      <div class="result-card">
        <div class="table-panel-header notice-header">
          <div class="notice-head-main">
            <div class="table-panel-title">公告原文</div>
            <div class="table-panel-subtitle">直接回溯交易所原文，校验信号来源并减少二次解读偏差</div>
          </div>
          <div class="table-panel-kpis">
            <span class="table-panel-kpi">本页 {{ list.length }}</span>
          </div>
        </div>
        <div class="query-bar">
          <div class="query-row">
            <div class="query-field">
              <label class="query-field-label">证券代码</label>
              <input
                v-model="queryStockCode"
                type="text"
                class="query-input"
                placeholder="如 000001"
                @keydown.enter="doQuery"
              />
            </div>
            <div class="query-field">
              <label class="query-field-label">证券简称</label>
              <input
                v-model="queryStockName"
                type="text"
                class="query-input"
                placeholder="如 平安银行"
                @keydown.enter="doQuery"
              />
            </div>
            <div class="query-field">
              <label class="query-field-label">公告标题</label>
              <input
                v-model="queryNoticeTitle"
                type="text"
                class="query-input"
                placeholder="公告标题关键词"
                @keydown.enter="doQuery"
              />
            </div>
            <div class="query-field">
              <label class="query-field-label">发布日期区间</label>
              <TradeCalendarDatePicker
                :start="queryStartDate"
                :end="queryEndDate"
                placeholder="选择日期范围"
                @update:start="queryStartDate = $event"
                @update:end="queryEndDate = $event"
              />
            </div>
            <div class="query-actions">
              <button type="button" class="btn-query" @click="doQuery">查询</button>
              <button type="button" class="btn-reset" @click="resetQuery">重置</button>
            </div>
          </div>
        </div>

        <div class="result-table-wrap">
          <div class="table-wrap" v-adaptive-height>
            <table class="data-table">
              <thead>
                <tr>
                  <th>证券代码</th>
                  <th>证券简称</th>
                  <th>公告标题</th>
                  <th>发布日期</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="loading">
                  <td colspan="5" class="text-center">加载中...</td>
                </tr>
                <tr v-else-if="list.length === 0">
                  <td colspan="5" class="text-center">{{ getEmptyText() }}</td>
                </tr>
                <tr v-for="item in list" :key="item.id">
                  <td>{{ item.stockCode || '-' }}</td>
                  <td>{{ item.secname || '-' }}</td>
                  <td class="cell-title" :title="item.noticeTitle">
                    {{ item.noticeTitle || '-' }}
                  </td>
                  <td>{{ formatDate(item.publishTime) }}</td>
                  <td>
                    <a
                      v-if="item.noticeLink"
                      href="#"
                      class="link-action"
                      @click.prevent="openNoticeLink(item.noticeLink)"
                    >
                      查看原文
                    </a>
                    <span v-else>-</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <PaginationBar
            v-if="total > 0"
            :total="total"
            :page="page"
            :page-size="pageSize"
            :total-pages="Math.ceil(total / pageSize)"
            :loading="loading"
            @update:page="goPage"
            @update:pageSize="changePageSize"
          />
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.notice-original {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding: var(--space-md);
  max-width: var(--layout-content-max);
  margin: 0 auto;
}

.result-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  min-height: 0;
}

.result-card {
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 96%, transparent) 0%, var(--bg-card) 100%);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.notice-header {
  align-items: flex-start;
}

.notice-head-main {
  min-width: 0;
}

.query-bar {
  padding: var(--space-md);
  border-bottom: 1px solid var(--border);
  background:
    linear-gradient(112deg, color-mix(in srgb, var(--accent-subtle) 48%, transparent) 0%, transparent 40%),
    color-mix(in srgb, var(--bg-elevated) 95%, transparent);
}

.query-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--space-sm) var(--space-md);
}

.query-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  min-width: 0;
}

.query-field-label {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text-muted);
  letter-spacing: 0.01em;
}

.query-input {
  height: var(--control-h-sm);
  padding: 0 0.75rem;
  font-size: var(--text-sm);
  color: var(--text-primary);
  background: color-mix(in srgb, var(--bg-card) 92%, var(--bg-elevated));
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
  font-variant-numeric: tabular-nums;
}

.query-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-subtle) 64%, transparent);
}

.query-actions {
  display: flex;
  align-items: flex-end;
  gap: var(--space-sm);
}

.btn-query {
  height: var(--control-h-sm);
  padding: 0 1.2rem;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-on-accent);
  background: var(--gradient-accent);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: transform var(--transition-fast), box-shadow var(--transition-fast), filter var(--transition-fast);
}

.btn-query:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-glow);
  filter: saturate(1.05);
}

.btn-reset {
  height: var(--control-h-sm);
  padding: 0 var(--space-lg);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-secondary);
  background: color-mix(in srgb, var(--bg-card) 90%, var(--bg-elevated));
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-reset:hover {
  color: var(--text-primary);
  border-color: color-mix(in srgb, var(--accent) 38%, var(--border));
  background: var(--bg-card);
}

.result-table-wrap {
  min-height: 0;
  border-top: 1px solid var(--border);
}

.table-wrap {
  --adaptive-height-min: var(--layout-table-min-height);
  --adaptive-height-bottom: var(--layout-table-bottom-reserve);

  overflow: auto;
  background: color-mix(in srgb, var(--bg-surface) 92%, transparent);
}

.data-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: var(--text-sm);
}

.data-table th,
.data-table td {
  padding: var(--space-sm) var(--space-md);
  text-align: left;
  border-bottom: 1px solid var(--border);
}

.data-table th {
  position: sticky;
  top: 0;
  z-index: 2;
  font-weight: 600;
  color: var(--text-secondary);
  letter-spacing: 0.01em;
  background: color-mix(in srgb, var(--bg-elevated) 92%, transparent);
  white-space: nowrap;
}

.data-table td {
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.data-table tbody tr:hover {
  background: color-mix(in srgb, var(--accent-subtle) 52%, transparent);
}

.cell-title {
  max-width: 360px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color var(--transition-fast);
  padding: 0.25rem 0.5rem;
  margin: -0.25rem -0.5rem;
  border-radius: var(--radius-sm);
}

.cell-title:hover {
  background-color: var(--bg-hover);
}

.text-center {
  text-align: center;
  color: var(--text-muted);
  padding: var(--space-xl) 0;
}

.link-action {
  color: var(--text-secondary);
  text-decoration: none;
  font-size: var(--text-xs);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
  padding: 0.14rem 0.42rem;
  border: 1px solid color-mix(in srgb, var(--accent) 24%, transparent);
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--accent-subtle) 56%, transparent);
  display: inline-block;
}

.link-action:hover {
  text-decoration: none;
  border-color: color-mix(in srgb, var(--accent) 42%, transparent);
  color: var(--accent);
  background: color-mix(in srgb, var(--accent-subtle) 66%, transparent);
}

@media (max-width: 768px) {
  .notice-original {
    padding: var(--space-sm);
  }

  .query-row {
    flex-direction: column;
    align-items: stretch;
  }

  .query-field {
    width: 100%;
  }

  .query-input {
    width: 100%;
  }

  .query-actions {
    width: 100%;
    justify-content: stretch;
  }

  .btn-query,
  .btn-reset {
    flex: 1;
  }

  .table-panel-kpis {
    display: none;
  }

  .table-panel-subtitle {
    display: none;
  }
}
</style>
