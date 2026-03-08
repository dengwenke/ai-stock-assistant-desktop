<script setup lang="ts">
import { PAGE_SIZE_OPTIONS } from '@/stores/analysis'

defineProps<{
  total: number
  page: number
  pageSize: number
  totalPages: number
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:page', value: number): void
  (e: 'update:pageSize', value: number): void
}>()

function goPage(p: number) {
  emit('update:page', p)
}

function onPageSizeChange(e: Event) {
  const v = (e.target as HTMLSelectElement).value
  emit('update:pageSize', parseInt(v, 10))
}
</script>

<template>
  <div class="pagination-bar">
    <span class="pagination-total">共 {{ total }} 条</span>
    <span class="pagination-size">
      每页
      <select
        :value="pageSize"
        :disabled="loading"
        class="pagination-select"
        @change="onPageSizeChange"
      >
        <option
          v-for="n in PAGE_SIZE_OPTIONS"
          :key="n"
          :value="n"
        >{{ n }}</option>
      </select>
      条
    </span>
    <div class="pagination-nav">
      <button
        type="button"
        class="pagination-btn"
        :disabled="loading || page <= 1"
        @click="goPage(page - 1)"
      >
        上一页
      </button>
      <span class="pagination-info">第 {{ page }} / {{ totalPages }} 页</span>
      <button
        type="button"
        class="pagination-btn"
        :disabled="loading || page >= totalPages"
        @click="goPage(page + 1)"
      >
        下一页
      </button>
    </div>
  </div>
</template>

<style scoped>
.pagination-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-md);
  padding: var(--space-xs) var(--space-md);
  font-size: var(--text-xs);
  color: var(--text-muted);
  background: var(--bg-card);
  border-top: 1px solid var(--border-subtle);
}

.pagination-total {
  font-weight: 500;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.pagination-size {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.pagination-select {
  height: var(--control-h-sm);
  padding: 0 var(--space-sm);
  padding-right: 1.25rem;
  font-size: var(--text-xs);
  color: var(--text-primary);
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'%3E%3Cpath fill='%2364748b' d='M5 7L1.5 3h7z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.375rem center;
}

.pagination-select:hover {
  border-color: var(--border-strong);
}

.pagination-select:focus {
  outline: none;
  border-color: var(--accent);
}

.pagination-nav {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-left: auto;
}

.pagination-btn {
  height: var(--control-h-sm);
  padding: 0 var(--space-sm);
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--accent);
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.pagination-btn:hover:not(:disabled) {
  border-color: var(--accent);
  background: var(--accent-subtle);
}

.pagination-btn:active:not(:disabled) {
  transform: scale(0.97);
}

.pagination-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.pagination-info {
  color: var(--text-muted);
  font-size: var(--text-xs);
  font-variant-numeric: tabular-nums;
}

/* ---------- 移动端页脚：紧凑布局、触控友好、安全区 ---------- */
@media (max-width: 768px) {
  .pagination-bar {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
    padding: 0.6rem max(1rem, env(safe-area-inset-left));
    padding-right: max(1rem, env(safe-area-inset-right));
    padding-bottom: max(2.5rem, calc(env(safe-area-inset-bottom, 0px) + 1.5rem));
    font-size: 0.8125rem;
  }

  .pagination-bar > .pagination-total,
  .pagination-bar > .pagination-size {
    display: flex;
    align-items: center;
  }

  .pagination-nav {
    margin-left: 0;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .pagination-btn {
    min-height: 2.5rem;
    padding: 0.5rem 1rem;
    font-size: 0.8125rem;
    flex: 1;
    max-width: 45%;
    border-radius: 8px;
  }

  .pagination-info {
    flex-shrink: 0;
    align-self: center;
    font-size: 0.75rem;
  }

  .pagination-select {
    min-height: 2.25rem;
    padding: 0.35rem 0.5rem;
    border-radius: 8px;
  }
}

@media (max-width: 480px) {
  .pagination-bar {
    padding: 0.5rem max(0.75rem, env(safe-area-inset-left));
    padding-right: max(0.75rem, env(safe-area-inset-right));
    /* 留出右下角上传 FAB 的空间，避免遮挡 */
    padding-bottom: max(3.25rem, calc(env(safe-area-inset-bottom, 0px) + 2.5rem));
    gap: 0.5rem;
  }

  .pagination-total {
    font-size: 0.8125rem;
  }

  .pagination-btn {
    min-height: 2.75rem;
    padding: 0.5rem 0.75rem;
  }

  .pagination-info {
    font-size: 0.6875rem;
  }
}
</style>
