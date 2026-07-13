<script setup lang="ts">
withDefaults(
  defineProps<{
    width?: string
    height?: string
    radius?: 'sm' | 'md' | 'lg'
  }>(),
  {
    width: '100%',
    height: '1rem',
    radius: 'sm',
  },
)
</script>

<template>
  <span
    class="ui-skeleton"
    :class="`ui-skeleton--${radius}`"
    :style="{ width, height }"
    aria-hidden="true"
  />
</template>

<style scoped>
.ui-skeleton {
  display: block;
  max-width: 100%;
  background:
    linear-gradient(
      90deg,
      transparent 25%,
      rgb(255 255 255 / 70%) 50%,
      transparent 75%
    ),
    var(--color-border);
  background-size: 200% 100%;
  animation: shimmer 1.3s ease-in-out infinite;
}

.ui-skeleton--sm {
  border-radius: var(--radius-sm);
}

.ui-skeleton--md {
  border-radius: var(--radius-md);
}

.ui-skeleton--lg {
  border-radius: var(--radius-lg);
}

@keyframes shimmer {
  from {
    background-position: 100% 0;
  }
  to {
    background-position: -100% 0;
  }
}
</style>
