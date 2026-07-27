<script setup lang="ts">
/**
 * Delega ao AkCard. O padding do Lumen (none/md/lg) mapeia para a escala do
 * Akoma; a superfície plana (sem sombra) passa a vir do design system.
 */
const props = withDefaults(
  defineProps<{
    padding?: 'none' | 'md' | 'lg'
    interactive?: boolean
  }>(),
  {
    padding: 'lg',
    interactive: false,
  },
)

const akPadding = computed(() =>
  props.padding === 'lg' ? 'md' : props.padding === 'md' ? 'sm' : 'none',
)
</script>

<template>
  <AkCard
    class="ui-card"
    :class="{ 'ui-card--flush': padding === 'none' }"
    :padding="akPadding"
    :interactive="interactive"
  >
    <slot />
  </AkCard>
</template>

<style scoped>
/**
 * `padding="none"` no Akoma ainda reserva 18px laterais no corpo do card.
 * No Lumen esse modo existe para listas que sangram até a borda (cada linha
 * controla o próprio padding e o hover precisa ir de ponta a ponta).
 */
.ui-card--flush :deep(.ak-card__body) {
  padding: 0;
}
</style>
