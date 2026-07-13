<script setup lang="ts">
defineProps<{
  eyebrow: string
  title: string
  description?: string
}>()
</script>

<template>
  <section class="page-heading">
    <div>
      <p class="page-heading__eyebrow">{{ eyebrow }}</p>
      <h1>{{ title }}</h1>
      <p v-if="description" class="page-heading__description">
        {{ description }}
      </p>
    </div>

    <div v-if="$slots.actions" class="page-heading__actions">
      <slot name="actions" />
    </div>
  </section>
</template>

<style scoped>
.page-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-8);
}

.page-heading__eyebrow {
  color: var(--color-brand);
  font-size: 0.6875rem;
  font-weight: var(--weight-bold);
  letter-spacing: 0.09em;
  text-transform: uppercase;
}

.page-heading h1 {
  margin-top: var(--space-2);
  font-size: var(--text-2xl);
  font-weight: var(--weight-semibold);
  letter-spacing: -0.035em;
  line-height: var(--leading-tight);
}

.page-heading__description {
  margin-top: var(--space-2);
  color: var(--color-ink-secondary);
  font-size: var(--text-sm);
}

.page-heading__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-3);
}

@media (max-width: 768px) {
  .page-heading {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-4);
  }

  .page-heading h1 {
    font-size: var(--text-xl);
  }

  .page-heading__actions {
    justify-content: stretch;
  }

  .page-heading__actions > :deep(*) {
    flex: 1 1 auto;
  }
}
</style>
