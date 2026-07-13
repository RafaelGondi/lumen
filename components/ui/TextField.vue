<script setup lang="ts">
withDefaults(
  defineProps<{
    label?: string
    placeholder?: string
    required?: boolean
    type?: string
  }>(),
  {
    label: undefined,
    placeholder: undefined,
    required: false,
    type: 'text',
  },
)

const model = defineModel<string>({ required: true })
const id = useId()
</script>

<template>
  <div class="ui-field">
    <label v-if="label" :for="id" class="ui-field__label">
      {{ label }}
      <span v-if="required" class="ui-field__required" aria-hidden="true">*</span>
    </label>
    <input
      :id="id"
      v-model="model"
      class="ui-field__input"
      :type="type"
      :placeholder="placeholder"
      :required="required"
    />
  </div>
</template>

<style scoped>
.ui-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.ui-field__label {
  color: var(--color-ink-secondary);
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
}

.ui-field__required {
  color: var(--color-negative);
}

.ui-field__input {
  min-height: 2.5rem;
  padding: 0 var(--space-3);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-ink);
  font-size: var(--text-sm);
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.ui-field__input::placeholder {
  color: var(--color-ink-muted);
}

.ui-field__input:focus {
  outline: none;
  border-color: var(--color-brand);
  box-shadow: 0 0 0 3px var(--color-brand-soft);
}
</style>
