<script setup lang="ts">
export interface BreadcrumbItem {
  text: string
  to?: string
}

defineProps<{
  items: BreadcrumbItem[]
}>()
</script>

<template>
  <nav class="breadcrumb" aria-label="面包屑">
    <ol class="breadcrumb-list">
      <li v-for="(item, i) in items" :key="i" class="breadcrumb-item">
        <router-link v-if="item.to" :to="item.to" class="breadcrumb-link">{{ item.text }}</router-link>
        <span v-else class="breadcrumb-current">{{ item.text }}</span>
        <span v-if="i < items.length - 1" class="breadcrumb-sep" aria-hidden="true">/</span>
      </li>
    </ol>
  </nav>
</template>

<style scoped>
.breadcrumb {
  margin-bottom: var(--space-md);
}

.breadcrumb-list {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.25rem;
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: var(--text-sm);
  color: var(--text-muted);
}

.breadcrumb-item {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.breadcrumb-link {
  color: var(--text-secondary);
  text-decoration: none;
  transition: color var(--transition-fast);
}

.breadcrumb-link:hover {
  color: var(--accent);
  text-decoration: none;
}

.breadcrumb-current {
  color: var(--text-primary);
  font-weight: 500;
}

.breadcrumb-sep {
  color: var(--text-muted);
  user-select: none;
}
</style>
