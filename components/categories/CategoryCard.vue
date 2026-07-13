<script setup lang="ts">
import { Pencil, Trash2 } from '@lucide/vue'
import type { Category } from '~/types/category'

defineProps<{
  category: Category
}>()

defineEmits<{
  edit: []
  remove: []
}>()
</script>

<template>
  <article class="category-card">
    <CategoriesCategoryIconChip :icon="category.icon" :color="category.color" />

    <div class="category-card__info">
      <p class="category-card__name">{{ category.name }}</p>
      <p class="category-card__meta">
        {{ categoryTypeLabels[category.type] }}
        <template v-if="category.supercategoryName">
          · {{ category.supercategoryName }}
        </template>
      </p>
    </div>

    <div class="category-card__actions">
      <button type="button" aria-label="Editar categoria" @click="$emit('edit')">
        <Pencil aria-hidden="true" />
      </button>
      <button
        type="button"
        class="category-card__delete"
        aria-label="Excluir categoria"
        @click="$emit('remove')"
      >
        <Trash2 aria-hidden="true" />
      </button>
    </div>
  </article>
</template>

<style scoped>
.category-card {
  position: relative;
  display: flex;
  min-height: 4.5rem;
  padding: var(--space-4);
  align-items: center;
  gap: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-xs);
  transition: border-color var(--transition-fast);
}

.category-card:hover {
  border-color: var(--color-border-strong);
}

.category-card__info {
  min-width: 0;
}

.category-card__name {
  overflow: hidden;
  color: var(--color-ink);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.category-card__meta {
  overflow: hidden;
  margin-top: var(--space-1);
  color: var(--color-ink-muted);
  font-size: 0.6875rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.category-card__actions {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  display: flex;
  gap: 0.125rem;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.category-card:hover .category-card__actions,
.category-card:focus-within .category-card__actions {
  opacity: 1;
}

.category-card__actions button {
  display: grid;
  width: 1.75rem;
  height: 1.75rem;
  padding: 0;
  place-items: center;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-ink-secondary);
  cursor: pointer;
}

.category-card__actions button:hover {
  color: var(--color-ink);
  border-color: var(--color-border-strong);
}

.category-card__actions .category-card__delete:hover {
  color: var(--color-negative);
  border-color: var(--color-negative);
}

.category-card__actions svg {
  width: 0.85rem;
  height: 0.85rem;
}
</style>
