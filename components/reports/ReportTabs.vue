<script setup lang="ts">
const tabs = [
  { label: 'Fluxo de caixa', to: '/relatorios' },
  { label: 'Por categoria', to: '/relatorios/categorias' },
]
</script>

<template>
  <nav class="report-tabs" aria-label="Relatórios">
    <NuxtLink
      v-for="tab in tabs"
      :key="tab.to"
      :to="tab.to"
      class="report-tabs__item"
      active-class="is-active"
    >
      {{ tab.label }}
    </NuxtLink>
  </nav>
</template>

<style scoped>
.report-tabs {
  display: inline-flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.report-tabs__item {
  display: inline-flex;
  padding: 0.45rem 0.8rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-ink-muted);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  text-decoration: none;
}

.report-tabs__item:hover {
  border-color: var(--color-border-strong);
  color: var(--color-ink);
}

.report-tabs__item.is-active {
  border-color: var(--color-border-strong);
  background: var(--color-surface);
  color: var(--color-ink);
  box-shadow: var(--shadow-xs);
  font-weight: var(--weight-semibold);
}
</style>
