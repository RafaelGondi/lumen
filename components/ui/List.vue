<template>
  <ul class="ui-list">
    <slot />
  </ul>
</template>

<style scoped>
.ui-list {
  padding: 0;
  margin: 0;
  list-style: none;
}

.ui-list :deep(.ui-list-item + .ui-list-item) {
  border-top: 1px solid var(--color-border);
}
</style>
