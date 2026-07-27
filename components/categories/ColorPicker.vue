<script setup lang="ts">
import { Check } from '@lucide/vue'

const model = defineModel<string>({ required: true })
</script>

<template>
  <div class="color-picker" role="radiogroup" aria-label="Cor">
    <button
      v-for="color in categoryColorSwatches"
      :key="color.hex"
      type="button"
      role="radio"
      class="color-picker__swatch"
      :style="{ background: color.hex }"
      :aria-checked="model === color.hex"
      :aria-label="color.label"
      @click="model = color.hex"
    >
      <Check v-if="model === color.hex" aria-hidden="true" />
    </button>
  </div>
</template>

<style scoped>
/**
 * 10 colunas com famílias de 5 shades: cada linha cobre duas famílias
 * inteiras, então as faixas de matiz continuam legíveis mesmo sem rótulo.
 */
.color-picker {
  display: grid;
  grid-template-columns: repeat(10, minmax(0, 1fr));
  gap: var(--space-2);
}

.color-picker__swatch {
  display: grid;
  aspect-ratio: 1;
  padding: 0;
  place-items: center;
  border: 0;
  border-radius: var(--radius-sm);
  color: var(--color-white);
  cursor: pointer;
  transition: transform var(--transition-fast);
}

.color-picker__swatch:hover {
  transform: scale(1.08);
}

.color-picker__swatch svg {
  width: 0.85rem;
  height: 0.85rem;
}
</style>
