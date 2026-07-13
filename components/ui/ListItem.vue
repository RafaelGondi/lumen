<script setup lang="ts">
withDefaults(
  defineProps<{
    interactive?: boolean
  }>(),
  {
    interactive: false,
  },
)
</script>

<template>
  <li
    class="ui-list-item"
    :class="{ 'ui-list-item--interactive': interactive }"
  >
    <slot />
  </li>
</template>

<style scoped>
.ui-list-item {
  position: relative;
}

.ui-list-item--interactive {
  transition: background-color var(--transition-fast);
}

.ui-list-item--interactive:hover {
  background: var(--color-surface-subtle);
}
</style>
