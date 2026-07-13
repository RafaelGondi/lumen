<script setup lang="ts">
withDefaults(
  defineProps<{
    icon: string
    color: string
    size?: 'sm' | 'md' | 'lg'
  }>(),
  {
    size: 'md',
  },
)
</script>

<template>
  <span
    class="icon-chip"
    :class="`icon-chip--${size}`"
    :style="{ background: color }"
    aria-hidden="true"
  >
    <component :is="categoryIcon(icon)" />
  </span>
</template>

<style scoped>
.icon-chip {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  border-radius: var(--radius-sm);
  color: var(--color-white);
}

.icon-chip--sm {
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 0.3rem;
}

.icon-chip--sm :deep(svg) {
  width: 0.75rem;
  height: 0.75rem;
}

.icon-chip--md {
  width: 2.25rem;
  height: 2.25rem;
}

.icon-chip--md :deep(svg) {
  width: 1.05rem;
  height: 1.05rem;
}

.icon-chip--lg {
  width: 2.75rem;
  height: 2.75rem;
  border-radius: var(--radius-md);
}

.icon-chip--lg :deep(svg) {
  width: 1.3rem;
  height: 1.3rem;
}
</style>
