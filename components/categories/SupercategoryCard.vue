<script setup lang="ts">
import { Pencil, Trash2 } from '@lucide/vue'
import type { Supercategory } from '~/types/category'

defineProps<{
  supercategory: Supercategory
}>()

defineEmits<{
  edit: []
  remove: []
}>()

const VISIBLE_MEMBERS = 5
</script>

<template>
  <article class="super-card">
    <div class="super-card__main">
      <CategoriesCategoryIconChip
        :icon="supercategory.icon"
        :color="supercategory.color"
        size="lg"
      />

      <div class="super-card__info">
        <p class="super-card__name">{{ supercategory.name }}</p>
        <p class="super-card__meta">
          {{ supercategory.categories.length }}
          {{ supercategory.categories.length === 1 ? 'categoria' : 'categorias' }}
        </p>
      </div>

      <div class="super-card__actions">
        <button
          type="button"
          aria-label="Editar supercategoria"
          @click="$emit('edit')"
        >
          <Pencil aria-hidden="true" />
        </button>
        <button
          type="button"
          class="super-card__delete"
          aria-label="Excluir supercategoria"
          @click="$emit('remove')"
        >
          <Trash2 aria-hidden="true" />
        </button>
      </div>
    </div>

    <ul v-if="supercategory.categories.length" class="super-card__members">
      <li
        v-for="member in supercategory.categories.slice(0, VISIBLE_MEMBERS)"
        :key="member.id"
      >
        <span
          class="super-card__member-dot"
          :style="{ background: member.color }"
          aria-hidden="true"
        />
        {{ member.name }}
      </li>
      <li
        v-if="supercategory.categories.length > VISIBLE_MEMBERS"
        class="super-card__member-more"
      >
        +{{ supercategory.categories.length - VISIBLE_MEMBERS }}
      </li>
    </ul>
    <p v-else class="super-card__empty">Nenhuma categoria associada.</p>
  </article>
</template>

<style scoped>
.super-card {
  padding: var(--space-5);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-xs);
  transition: border-color var(--transition-fast);
}

.super-card:hover {
  border-color: var(--color-border-strong);
}

.super-card__main {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.super-card__info {
  min-width: 0;
  flex: 1;
}

.super-card__name {
  color: var(--color-ink);
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
}

.super-card__meta {
  margin-top: var(--space-1);
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.super-card__actions {
  display: flex;
  gap: 0.125rem;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.super-card:hover .super-card__actions,
.super-card:focus-within .super-card__actions {
  opacity: 1;
}

.super-card__actions button {
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

.super-card__actions button:hover {
  color: var(--color-ink);
  border-color: var(--color-border-strong);
}

.super-card__actions .super-card__delete:hover {
  color: var(--color-negative);
  border-color: var(--color-negative);
}

.super-card__actions svg {
  width: 0.85rem;
  height: 0.85rem;
}

.super-card__members {
  display: flex;
  padding: var(--space-4) 0 0;
  margin: var(--space-4) 0 0;
  flex-wrap: wrap;
  gap: var(--space-2);
  border-top: 1px solid var(--color-border);
  list-style: none;
}

.super-card__members li {
  display: inline-flex;
  min-height: 1.5rem;
  padding: 0 var(--space-2);
  align-items: center;
  gap: 0.375rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-round);
  background: var(--color-surface-subtle);
  color: var(--color-ink-secondary);
  font-size: 0.6875rem;
  font-weight: var(--weight-medium);
}

.super-card__member-dot {
  width: 0.375rem;
  height: 0.375rem;
  border-radius: 50%;
}

.super-card__member-more {
  color: var(--color-ink-muted);
}

.super-card__empty {
  padding: var(--space-4) 0 0;
  margin-top: var(--space-4);
  border-top: 1px solid var(--color-border);
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}
</style>
