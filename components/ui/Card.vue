<script setup lang="ts">
withDefaults(
  defineProps<{
    padding?: 'none' | 'md' | 'lg'
    interactive?: boolean
  }>(),
  {
    padding: 'lg',
    interactive: false,
  },
)
</script>

<template>
  <section
    class="ui-card"
    :class="[
      `ui-card--padding-${padding}`,
      { 'ui-card--interactive': interactive },
    ]"
  >
    <slot />
  </section>
</template>

<style scoped>
.ui-card {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-xs);
}

.ui-card--padding-none {
  padding: 0;
}

.ui-card--padding-md {
  padding: var(--space-5);
}

.ui-card--padding-lg {
  padding: var(--space-6);
}

.ui-card--interactive {
  transition:
    border-color var(--transition-base),
    box-shadow var(--transition-base),
    transform var(--transition-base);
}

.ui-card--interactive:hover {
  border-color: var(--color-border-strong);
  box-shadow: var(--shadow-sm);
  transform: translateY(-1px);
}
</style>
