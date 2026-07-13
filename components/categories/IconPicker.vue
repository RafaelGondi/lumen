<script setup lang="ts">
defineProps<{
  activeColor: string
}>()

const model = defineModel<string>({ required: true })
</script>

<template>
  <div class="icon-picker" role="radiogroup" aria-label="Ícone">
    <button
      v-for="name in categoryIconNames"
      :key="name"
      type="button"
      role="radio"
      class="icon-picker__option"
      :class="{ 'icon-picker__option--active': model === name }"
      :style="model === name ? { background: activeColor } : undefined"
      :aria-checked="model === name"
      :aria-label="`Ícone ${name}`"
      @click="model = name"
    >
      <component :is="categoryIcon(name)" aria-hidden="true" />
    </button>
  </div>
</template>

<style scoped>
.icon-picker {
  display: grid;
  grid-template-columns: repeat(9, minmax(0, 1fr));
  gap: var(--space-2);
}

.icon-picker__option {
  display: grid;
  aspect-ratio: 1;
  padding: 0;
  place-items: center;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-ink-secondary);
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    background-color var(--transition-fast),
    color var(--transition-fast);
}

.icon-picker__option:hover {
  border-color: var(--color-border-strong);
  color: var(--color-ink);
}

.icon-picker__option--active {
  border-color: transparent;
  color: var(--color-white);
}

.icon-picker__option svg {
  width: 1rem;
  height: 1rem;
}
</style>
