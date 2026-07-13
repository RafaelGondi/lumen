<script setup lang="ts">
export interface TabItem {
  id: string
  label: string
  count?: number
}

defineProps<{
  tabs: TabItem[]
}>()

const model = defineModel<string>({ required: true })
</script>

<template>
  <div class="ui-tabs" role="tablist">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      type="button"
      role="tab"
      class="ui-tabs__tab"
      :class="{ 'ui-tabs__tab--active': model === tab.id }"
      :aria-selected="model === tab.id"
      @click="model = tab.id"
    >
      {{ tab.label }}
      <span v-if="tab.count !== undefined" class="ui-tabs__count">
        {{ tab.count }}
      </span>
    </button>
  </div>
</template>

<style scoped>
.ui-tabs {
  display: flex;
  gap: var(--space-6);
  border-bottom: 1px solid var(--color-border);
}

.ui-tabs__tab {
  position: relative;
  display: inline-flex;
  padding: var(--space-3) 0;
  align-items: center;
  gap: var(--space-2);
  border: 0;
  background: transparent;
  color: var(--color-ink-muted);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  cursor: pointer;
  transition: color var(--transition-fast);
}

.ui-tabs__tab:hover {
  color: var(--color-ink);
}

.ui-tabs__tab--active {
  color: var(--color-ink);
  font-weight: var(--weight-semibold);
}

.ui-tabs__tab--active::after {
  position: absolute;
  right: 0;
  bottom: -1px;
  left: 0;
  height: 2px;
  background: var(--color-brand);
  content: "";
}

.ui-tabs__count {
  display: grid;
  min-width: 1.4rem;
  height: 1.4rem;
  padding: 0 0.3rem;
  place-items: center;
  border-radius: var(--radius-sm);
  background: var(--color-surface-subtle);
  border: 1px solid var(--color-border);
  color: var(--color-ink-secondary);
  font-size: 0.6875rem;
  font-weight: var(--weight-semibold);
}
</style>
