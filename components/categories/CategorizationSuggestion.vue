<script setup lang="ts">
import { Sparkles } from '@lucide/vue'
import type { CategoryType } from '~/types/category'
import type { CategorizationMatch } from '~/types/categorizationRule'

const props = defineProps<{
  enabled: boolean
  type: CategoryType
  description: string
  statementName?: string | null
}>()

const match = ref<CategorizationMatch | null>(null)
let timer: ReturnType<typeof setTimeout> | undefined

watch(
  () => [props.enabled, props.type, props.description, props.statementName] as const,
  () => {
    clearTimeout(timer)
    match.value = null
    if (
      !props.enabled ||
      (!props.description.trim() && !props.statementName?.trim())
    ) {
      return
    }
    timer = setTimeout(async () => {
      try {
        match.value = await $fetch<CategorizationMatch | null>(
          '/api/categorization-rules/match',
          {
            method: 'POST',
            body: {
              type: props.type,
              description: props.description,
              statementName: props.statementName,
            },
          },
        )
      } catch {
        match.value = null
      }
    }, 350)
  },
  { immediate: true },
)

onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <div v-if="match" class="category-suggestion" role="status">
    <Sparkles aria-hidden="true" />
    <span>Regra encontrada: será categorizado como</span>
    <CategoriesCategoryIconChip
      :icon="match.categoryIcon"
      :color="match.categoryColor"
      size="sm"
    />
    <strong>{{ match.categoryName }}</strong>
  </div>
</template>

<style scoped>
.category-suggestion {
  display: flex;
  padding: var(--space-3);
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  border-radius: var(--radius-md);
  background: var(--color-brand-soft);
  color: var(--color-brand-ink);
  font-size: var(--text-xs);
}
.category-suggestion > svg { width: 1rem; height: 1rem; flex: 0 0 auto; }
.category-suggestion strong { font-weight: var(--weight-semibold); }
</style>
