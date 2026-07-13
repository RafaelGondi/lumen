<script setup lang="ts">
import { Calendar } from '@lucide/vue'
import { formatDateBr, maskDateBr, parseDateBr } from '~/utils/dateMoney'

const props = withDefaults(
  defineProps<{
    label?: string
    required?: boolean
    placeholder?: string
    disabled?: boolean
  }>(),
  {
    label: undefined,
    required: false,
    placeholder: 'dd/mm/aaaa',
    disabled: false,
  },
)

/** Valor exibido em dd/mm/aaaa (pode estar incompleto durante a digitação). */
const model = defineModel<string>({ required: true })
const id = useId()
const nativeRef = ref<HTMLInputElement | null>(null)
const touched = ref(false)

const isoValue = computed(() => parseDateBr(model.value) ?? '')
const showError = computed(() => {
  if (!touched.value) return false
  const digits = model.value.replace(/\D/g, '')
  if (digits.length === 0) return false
  if (digits.length < 8) return false
  return parseDateBr(model.value) === null
})

function onTextInput(event: Event) {
  const input = event.target as HTMLInputElement
  const masked = maskDateBr(input.value)
  model.value = masked
  input.value = masked
}

function onBlur() {
  touched.value = true
  const digits = model.value.replace(/\D/g, '')
  if (digits.length === 8 && !parseDateBr(model.value)) {
    // Mantém o valor para o usuário corrigir; o estado de erro aparece.
    return
  }
}

function onNativeInput(event: Event) {
  const value = (event.target as HTMLInputElement).value
  model.value = value ? formatDateBr(value) : ''
  touched.value = true
}

function openPicker() {
  if (props.disabled) return
  const input = nativeRef.value
  if (!input) return
  if (typeof input.showPicker === 'function') {
    try {
      input.showPicker()
      return
    } catch {
      // fallback abaixo
    }
  }
  input.click()
}
</script>

<template>
  <div class="ui-date-field" :class="{ 'is-invalid': showError }">
    <label v-if="label" :for="id" class="ui-date-field__label">
      {{ label }}
      <span v-if="required" class="ui-date-field__required" aria-hidden="true"
        >*</span
      >
    </label>

    <div class="ui-date-field__control">
      <input
        :id="id"
        class="ui-date-field__text"
        type="text"
        inputmode="numeric"
        autocomplete="off"
        maxlength="10"
        :value="model"
        :placeholder="placeholder"
        :required="required"
        :disabled="disabled"
        :aria-invalid="showError"
        @input="onTextInput"
        @blur="onBlur"
      />
      <button
        type="button"
        class="ui-date-field__calendar"
        :disabled="disabled"
        aria-label="Abrir calendário"
        @click="openPicker"
      >
        <Calendar aria-hidden="true" />
      </button>
      <input
        ref="nativeRef"
        class="ui-date-field__native"
        type="date"
        :value="isoValue"
        :disabled="disabled"
        tabindex="-1"
        aria-hidden="true"
        @input="onNativeInput"
      />
    </div>

    <p v-if="showError" class="ui-date-field__error" role="alert">
      Informe uma data válida (dd/mm/aaaa).
    </p>
  </div>
</template>

<style scoped>
.ui-date-field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--space-2);
}

.ui-date-field__label {
  color: var(--color-ink-secondary);
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
}

.ui-date-field__required {
  color: var(--color-negative);
}

.ui-date-field__control {
  position: relative;
  display: flex;
  min-height: 2.5rem;
  align-items: center;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.ui-date-field__control:focus-within {
  border-color: var(--color-brand);
  box-shadow: 0 0 0 3px var(--color-brand-soft);
}

.ui-date-field.is-invalid .ui-date-field__control {
  border-color: var(--color-negative);
}

.ui-date-field.is-invalid .ui-date-field__control:focus-within {
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-negative) 20%, transparent);
}

.ui-date-field__text {
  width: 100%;
  min-width: 0;
  padding: 0 2.5rem 0 var(--space-3);
  border: 0;
  background: transparent;
  color: var(--color-ink);
  font-size: var(--text-sm);
  font-variant-numeric: tabular-nums;
}

.ui-date-field__text:focus {
  outline: none;
}

.ui-date-field__text:disabled {
  color: var(--color-ink-muted);
  cursor: not-allowed;
}

.ui-date-field__text::placeholder {
  color: var(--color-ink-muted);
}

.ui-date-field__calendar {
  position: absolute;
  top: 50%;
  right: 0.35rem;
  display: grid;
  width: 1.85rem;
  height: 1.85rem;
  padding: 0;
  place-items: center;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-ink-muted);
  cursor: pointer;
  transform: translateY(-50%);
}

.ui-date-field__calendar:hover:not(:disabled) {
  background: var(--color-surface-subtle);
  color: var(--color-ink);
}

.ui-date-field__calendar:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.ui-date-field__calendar svg {
  width: 1rem;
  height: 1rem;
}

.ui-date-field__native {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  border: 0;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}

.ui-date-field__error {
  color: var(--color-negative);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
}
</style>
