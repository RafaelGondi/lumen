<script setup lang="ts">
/**
 * `eyebrow` permanece no contrato para compatibilidade com as páginas, mas o
 * caminho redundante não é exibido no cabeçalho.
 */
defineProps<{
  eyebrow: string
  title: string
  description?: string
}>()
</script>

<template>
  <AkPageHeader
    class="page-heading"
    :title="title"
    :meta="description"
    variant="flush"
    size="md"
  >
    <template v-if="$slots.actions" #actions>
      <div class="page-heading__actions">
        <slot name="actions" />
      </div>
    </template>
  </AkPageHeader>
</template>

<style scoped>
.page-heading__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-3);
}

/* O header do Akoma alinha ações ao topo; aqui elas convivem com o título. */
.page-heading :deep(.ak-page-header__top) {
  align-items: center;
}

/**
 * O slot de ações do Akoma vem com fundo de grupo de controles (pensado para
 * AkIconButtons). Aqui ele recebe o MonthSwitcher, que já traz superfície
 * própria — sem isso ficariam duas caixas empilhadas.
 */
.page-heading :deep(.ak-page-header__actions) {
  padding: 0;
  background: none;
  border-radius: 0;
  margin-top: 0;
}

@media (max-width: 768px) {
  .page-heading :deep(.ak-page-header__top) {
    flex-direction: column;
    align-items: stretch;
  }

  .page-heading__actions {
    width: 100%;
    justify-content: stretch;
  }

  .page-heading__actions > :deep(*) {
    flex: 1 1 auto;
    min-width: 0;
  }
}
</style>
