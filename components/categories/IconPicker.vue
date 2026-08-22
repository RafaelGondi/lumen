<script setup lang="ts">
defineProps<{
  activeColor: string
}>()

const model = defineModel<string>({ required: true })
</script>

<template>
  <div class="icon-picker" role="radiogroup" aria-label="Ícone">
    <section
      v-for="group in categoryIconGroups"
      :key="group.label"
      class="icon-picker__group"
    >
      <p class="icon-picker__label">{{ group.label }}</p>
      <div class="icon-picker__grid">
        <button
          v-for="name in group.icons"
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
    </section>
  </div>
</template>

<style scoped>
.icon-picker {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.icon-picker__label {
  margin-bottom: var(--space-2);
  color: var(--color-ink-muted);
  font-size: var(--text-2xs);
  font-weight: var(--weight-semibold);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.icon-picker__grid {
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
