<script setup lang="ts">
import { ChevronDown, Pause, Pencil, Play, Trash2 } from '@lucide/vue'
import type { CategorizationRule } from '~/types/categorizationRule'

const props = defineProps<{ rules: CategorizationRule[] }>()
const emit = defineEmits<{
  edit: [rule: CategorizationRule]
  remove: [rule: CategorizationRule]
  toggle: [rule: CategorizationRule]
}>()

const expanded = ref(false)
const category = computed(() => props.rules[0])
const activeCount = computed(() => props.rules.filter((rule) => rule.active).length)
const matchCount = computed(() =>
  props.rules.reduce((total, rule) => total + rule.matchCount, 0),
)

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
  <article v-if="category" class="rule-group">
    <button
      type="button"
      class="rule-group__summary"
      :aria-expanded="expanded"
      @click="expanded = !expanded"
    >
      <span class="rule-group__identity">
        <CategoriesCategoryIconChip
          :icon="category.categoryIcon"
          :color="category.categoryColor"
        />
        <span class="rule-group__title">
          <strong>{{ category.categoryName }}</strong>
          <small>
            {{ rules.length }} {{ rules.length === 1 ? 'condição' : 'condições' }}
            <template v-if="activeCount !== rules.length">
              · {{ activeCount }} {{ activeCount === 1 ? 'ativa' : 'ativas' }}
            </template>
          </small>
        </span>
      </span>

      <span class="rule-group__patterns" aria-hidden="true">
        <span
          v-for="rule in rules"
          :key="rule.id"
          :class="{ 'is-paused': !rule.active }"
        >
          {{ rule.pattern }}
        </span>
      </span>

      <span class="rule-group__usage">
        {{ matchCount }} {{ matchCount === 1 ? 'aplicação' : 'aplicações' }}
      </span>
      <ChevronDown
        class="rule-group__chevron"
        :class="{ 'is-open': expanded }"
        aria-hidden="true"
      />
    </button>

    <div v-if="expanded" class="rule-group__details">
      <div
        v-for="rule in rules"
        :key="rule.id"
        class="rule-group__condition"
        :class="{ 'is-paused': !rule.active }"
      >
        <span class="rule-group__condition-text">
          <small>{{ fieldLabels[rule.field] }} {{ operatorLabels[rule.operator] }}</small>
          <strong>“{{ rule.pattern }}”</strong>
        </span>

        <span class="rule-group__condition-usage">
          {{ rule.active ? 'Ativa' : 'Pausada' }}
          <small>{{ rule.matchCount }} {{ rule.matchCount === 1 ? 'uso' : 'usos' }}</small>
        </span>

        <span class="rule-group__actions">
          <button
            type="button"
            :aria-label="rule.active ? `Pausar ${rule.pattern}` : `Ativar ${rule.pattern}`"
            @click="emit('toggle', rule)"
          >
            <Pause v-if="rule.active" aria-hidden="true" />
            <Play v-else aria-hidden="true" />
          </button>
          <button
            type="button"
            :aria-label="`Editar ${rule.pattern}`"
            @click="emit('edit', rule)"
          >
            <Pencil aria-hidden="true" />
          </button>
          <button
            type="button"
            :aria-label="`Excluir ${rule.pattern}`"
            @click="emit('remove', rule)"
          >
            <Trash2 aria-hidden="true" />
          </button>
        </span>
      </div>
    </div>
  </article>
</template>

<style scoped>
.rule-group { border-bottom: 1px solid var(--color-border); background: var(--color-surface); }
.rule-group:last-child { border-bottom: 0; }
.rule-group__summary { display: grid; width: 100%; min-width: 0; min-height: 4.25rem; padding: var(--space-3) var(--space-4); grid-template-columns: minmax(12rem, .8fr) minmax(12rem, 1.5fr) auto auto; align-items: center; gap: var(--space-4); border: 0; background: transparent; color: var(--color-ink); text-align: left; cursor: pointer; }
.rule-group__summary:hover { background: var(--color-surface-subtle); }
.rule-group__identity { display: flex; min-width: 0; align-items: center; gap: var(--space-3); }
.rule-group__title { display: flex; min-width: 0; flex-direction: column; gap: .1rem; }
.rule-group__title strong { overflow: hidden; font-size: var(--text-sm); text-overflow: ellipsis; white-space: nowrap; }
.rule-group__title small, .rule-group__usage { color: var(--color-ink-muted); font-size: var(--text-xs); }
.rule-group__patterns { display: flex; min-width: 0; overflow: hidden; gap: var(--space-1); }
.rule-group__patterns > span { display: inline-flex; max-width: 10rem; padding: .2rem .5rem; flex: 0 1 auto; overflow: hidden; border-radius: var(--radius-sm); background: var(--color-surface-subtle); color: var(--color-ink-secondary); font-size: var(--text-xs); text-overflow: ellipsis; white-space: nowrap; }
.rule-group__patterns > span.is-paused { opacity: .5; text-decoration: line-through; }
.rule-group__usage { white-space: nowrap; }
.rule-group__chevron { width: 1rem; height: 1rem; color: var(--color-ink-muted); transition: transform var(--transition-fast); }
.rule-group__chevron.is-open { transform: rotate(180deg); }
.rule-group__details { border-top: 1px solid var(--color-border); background: var(--color-surface-subtle); }
.rule-group__condition { display: grid; min-height: 3.5rem; padding: var(--space-2) var(--space-4) var(--space-2) 4.85rem; grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; gap: var(--space-4); border-bottom: 1px solid var(--color-border); }
.rule-group__condition:last-child { border-bottom: 0; }
.rule-group__condition.is-paused { opacity: .65; }
.rule-group__condition-text { display: flex; min-width: 0; align-items: baseline; gap: .35rem; }
.rule-group__condition-text small { color: var(--color-ink-muted); font-size: var(--text-xs); }
.rule-group__condition-text strong { overflow: hidden; font-size: var(--text-sm); text-overflow: ellipsis; white-space: nowrap; }
.rule-group__condition-usage { display: flex; min-width: 4.5rem; flex-direction: column; align-items: flex-end; color: var(--color-positive); font-size: var(--text-xs); font-weight: var(--weight-semibold); }
.rule-group__condition.is-paused .rule-group__condition-usage { color: var(--color-ink-muted); }
.rule-group__condition-usage small { color: var(--color-ink-muted); font-weight: var(--weight-regular); }
.rule-group__actions { display: flex; gap: var(--space-1); }
.rule-group__actions button { display: grid; width: 2rem; height: 2rem; padding: 0; place-items: center; border: 0; border-radius: var(--radius-sm); background: transparent; color: var(--color-ink-muted); cursor: pointer; }
.rule-group__actions button:hover { background: var(--color-surface); color: var(--color-ink); }
.rule-group__actions svg { width: .95rem; height: .95rem; }

@media (max-width: 760px) {
  .rule-group__summary { min-height: 4rem; grid-template-columns: minmax(0, 1fr) auto; gap: var(--space-2); }
  .rule-group__patterns { grid-column: 1 / -1; grid-row: 2; }
  .rule-group__usage { display: none; }
  .rule-group__condition { padding-left: var(--space-4); grid-template-columns: minmax(0, 1fr) auto; }
  .rule-group__condition-usage { display: none; }
  .rule-group__actions { grid-column: 2; }
}
</style>
