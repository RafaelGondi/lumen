<script setup lang="ts">
import { Pause, Pencil, Play, Trash2 } from '@lucide/vue'
import type { CategorizationRule } from '~/types/categorizationRule'

const props = defineProps<{ rule: CategorizationRule }>()
defineEmits<{ edit: []; remove: []; toggle: [] }>()

const fieldLabels = {
  description: 'Descrição',
  statement_name: 'Nome no extrato',
  either: 'Descrição ou extrato',
}
const operatorLabels = {
  contains: 'contém',
  starts_with: 'começa com',
  equals: 'é exatamente',
}
</script>

<template>
  <article class="rule-card" :class="{ 'rule-card--paused': !rule.active }">
    <div class="rule-card__category">
      <CategoriesCategoryIconChip
        :icon="rule.categoryIcon"
        :color="rule.categoryColor"
      />
      <div>
        <strong>{{ rule.categoryName }}</strong>
        <span>{{ categoryTypeLabels[rule.categoryType] }}</span>
      </div>
    </div>

    <div class="rule-card__condition">
      <span>Se {{ fieldLabels[rule.field].toLocaleLowerCase('pt-BR') }}</span>
      <p>
        {{ operatorLabels[rule.operator] }}
        <strong>“{{ rule.pattern }}”</strong>
      </p>
    </div>

    <div class="rule-card__usage">
      <span :class="{ 'is-active': rule.active }">
        {{ rule.active ? 'Ativa' : 'Pausada' }}
      </span>
      <small>
        {{ rule.matchCount }}
        {{ rule.matchCount === 1 ? 'aplicação' : 'aplicações' }}
      </small>
    </div>

    <div class="rule-card__actions">
      <button
        type="button"
        :aria-label="rule.active ? 'Pausar regra' : 'Ativar regra'"
        @click="$emit('toggle')"
      >
        <Pause v-if="rule.active" aria-hidden="true" />
        <Play v-else aria-hidden="true" />
      </button>
      <button type="button" aria-label="Editar regra" @click="$emit('edit')">
        <Pencil aria-hidden="true" />
      </button>
      <button type="button" aria-label="Excluir regra" @click="$emit('remove')">
        <Trash2 aria-hidden="true" />
      </button>
    </div>
  </article>
</template>

<style scoped>
.rule-card { display: grid; min-width: 0; padding: var(--space-4); grid-template-columns: minmax(10rem, .8fr) minmax(14rem, 1.5fr) auto auto; align-items: center; gap: var(--space-5); border-bottom: 1px solid var(--color-border); background: var(--color-surface); }
.rule-card:last-child { border-bottom: 0; }
.rule-card--paused { background: var(--color-surface-subtle); }
.rule-card__category { display: flex; min-width: 0; align-items: center; gap: var(--space-3); }
.rule-card__category > div { display: flex; min-width: 0; flex-direction: column; gap: .1rem; }
.rule-card__category strong { overflow: hidden; font-size: var(--text-sm); text-overflow: ellipsis; white-space: nowrap; }
.rule-card__category span, .rule-card__condition span, .rule-card__usage small { color: var(--color-ink-muted); font-size: var(--text-xs); }
.rule-card__condition { min-width: 0; }
.rule-card__condition p { margin-top: .15rem; overflow: hidden; color: var(--color-ink-secondary); font-size: var(--text-sm); text-overflow: ellipsis; white-space: nowrap; }
.rule-card__condition strong { color: var(--color-ink); font-weight: var(--weight-semibold); }
.rule-card__usage { display: flex; min-width: 5rem; flex-direction: column; align-items: flex-end; gap: .2rem; }
.rule-card__usage > span { color: var(--color-ink-muted); font-size: var(--text-xs); font-weight: var(--weight-semibold); }
.rule-card__usage > span.is-active { color: var(--color-positive); }
.rule-card__actions { display: flex; gap: var(--space-1); }
.rule-card__actions button { display: grid; width: 2rem; height: 2rem; padding: 0; place-items: center; border: 0; border-radius: var(--radius-sm); background: transparent; color: var(--color-ink-muted); cursor: pointer; }
.rule-card__actions button:hover { background: var(--color-surface-subtle); color: var(--color-ink); }
.rule-card__actions svg { width: .95rem; height: .95rem; }
@media (max-width: 760px) {
  .rule-card { grid-template-columns: minmax(0, 1fr) auto; gap: var(--space-3); }
  .rule-card__condition { grid-column: 1 / -1; grid-row: 2; }
  .rule-card__usage { align-items: flex-end; }
  .rule-card__actions { grid-column: 1 / -1; justify-content: flex-end; border-top: 1px solid var(--color-border); padding-top: var(--space-2); }
}
</style>
