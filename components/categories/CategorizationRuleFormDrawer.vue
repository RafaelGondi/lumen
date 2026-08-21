<script setup lang="ts">
import type { Category, CategoryType } from '~/types/category'
import type {
  CategorizationRule,
  CategorizationRuleField,
  CategorizationRuleOperator,
  CategorizationRulePayload,
} from '~/types/categorizationRule'

const props = defineProps<{
  rule: CategorizationRule | null
  categories: Category[]
}>()
const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>('open', { required: true })

const categoryType = ref<CategoryType>('expense')
const field = ref<CategorizationRuleField>('either')
const operator = ref<CategorizationRuleOperator>('contains')
const pattern = ref('')
const categoryId = ref<number | null>(null)
const active = ref(true)
const saving = ref(false)
const errorMessage = ref('')

const isEditing = computed(() => props.rule !== null)
const matchingCategories = computed(() =>
  props.categories.filter((category) => category.type === categoryType.value),
)

const fieldOptions = [
  { value: 'either' as const, label: 'Ambos' },
  { value: 'description' as const, label: 'Descrição' },
  { value: 'statement_name' as const, label: 'Extrato' },
]
const operatorOptions = [
  { value: 'contains' as const, label: 'contém' },
  { value: 'starts_with' as const, label: 'começa com' },
  { value: 'equals' as const, label: 'é exatamente' },
]

const conditionText = computed(() => {
  const fieldLabel =
    field.value === 'either'
      ? 'Descrição ou extrato'
      : field.value === 'statement_name'
        ? 'Nome no extrato'
        : 'Descrição'
  const operatorLabel = operatorOptions.find((item) => item.value === operator.value)?.label
  return `${fieldLabel} ${operatorLabel} “${pattern.value.trim() || 'texto'}”`
})

watch(open, (value) => {
  if (!value) return
  const rule = props.rule
  categoryType.value = rule?.categoryType ?? 'expense'
  field.value = rule?.field ?? 'either'
  operator.value = rule?.operator ?? 'contains'
  pattern.value = rule?.pattern ?? ''
  categoryId.value = rule?.categoryId ?? null
  active.value = rule?.active ?? true
  errorMessage.value = ''
})

watch(categoryType, () => {
  if (!matchingCategories.value.some((category) => category.id === categoryId.value)) {
    categoryId.value = null
  }
})

async function save() {
  if (!pattern.value.trim()) {
    errorMessage.value = 'Informe o texto que identifica o lançamento.'
    return
  }
  if (categoryId.value === null) {
    errorMessage.value = 'Escolha a categoria que será aplicada.'
    return
  }

  const payload: CategorizationRulePayload = {
    field: field.value,
    operator: operator.value,
    pattern: pattern.value.trim(),
    categoryId: categoryId.value,
    active: active.value,
  }
  saving.value = true
  errorMessage.value = ''
  try {
    if (props.rule) {
      await $fetch(`/api/categorization-rules/${props.rule.id}`, {
        method: 'PUT',
        body: payload,
      })
    } else {
      await $fetch('/api/categorization-rules', { method: 'POST', body: payload })
    }
    open.value = false
    emit('saved')
  } catch (error) {
    errorMessage.value =
      (error as { statusMessage?: string }).statusMessage ??
      'Não foi possível salvar a regra.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UiDrawer
    v-model:open="open"
    :title="isEditing ? 'Editar regra inteligente' : 'Nova regra inteligente'"
  >
    <form class="rule-form" @submit.prevent="save">
      <div class="rule-form__intro">
        <strong>Quando um lançamento corresponder à condição</strong>
        <span>A categoria será preenchida automaticamente se estiver vazia.</span>
      </div>

      <div class="rule-form__section">
        <p class="rule-form__label">Tipo de lançamento</p>
        <UiSegmentedControl
          v-model="categoryType"
          :options="categoryTypeOptions"
        />
      </div>

      <div class="rule-form__section">
        <p class="rule-form__label">Onde procurar</p>
        <UiSegmentedControl v-model="field" :options="fieldOptions" />
      </div>

      <div class="rule-form__condition">
        <label>
          <span>Condição</span>
          <select v-model="operator">
            <option
              v-for="option in operatorOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
        </label>
        <UiTextField
          v-model="pattern"
          label="Texto identificador"
          placeholder="Ex: IFOOD, NETFLIX, POSTO..."
          required
        />
      </div>

      <div class="rule-form__section">
        <p class="rule-form__label">Categorizar como</p>
        <CategoriesCategoryPicker
          v-model="categoryId"
          :categories="matchingCategories"
          label="Categoria"
        />
      </div>

      <div class="rule-form__preview">
        <span>Se</span>
        <strong>{{ conditionText }}</strong>
        <span>então categorizar como</span>
        <strong>
          {{
            matchingCategories.find((category) => category.id === categoryId)?.name ??
            'categoria'
          }}
        </strong>
      </div>

      <label class="rule-form__toggle">
        <input v-model="active" type="checkbox" />
        <span>
          <strong>Regra ativa</strong>
          <small>Pode ser pausada sem perder a configuração.</small>
        </span>
      </label>

      <p v-if="errorMessage" class="rule-form__error" role="alert">
        {{ errorMessage }}
      </p>
    </form>

    <template #footer>
      <UiButton variant="ghost" @click="open = false">Cancelar</UiButton>
      <UiButton :disabled="saving" @click="save">
        {{ isEditing ? 'Salvar alterações' : 'Criar regra' }}
      </UiButton>
    </template>
  </UiDrawer>
</template>

<style scoped>
.rule-form { display: flex; flex-direction: column; gap: var(--space-6); }
.rule-form__intro { display: flex; padding: var(--space-4); flex-direction: column; gap: var(--space-1); border-radius: var(--radius-md); background: var(--color-brand-soft); color: var(--color-brand-ink); }
.rule-form__intro strong { font-size: var(--text-sm); }
.rule-form__intro span { font-size: var(--text-xs); line-height: 1.45; }
.rule-form__section { display: flex; min-width: 0; flex-direction: column; gap: var(--space-2); }
.rule-form__label, .rule-form__condition label > span { color: var(--color-ink-secondary); font-size: var(--text-xs); font-weight: var(--weight-semibold); }
.rule-form__section :deep(.ui-segmented) { display: flex; width: 100%; overflow-x: auto; }
.rule-form__section :deep(.ui-segmented__option) { flex: 1 0 auto; }
.rule-form__condition { display: grid; grid-template-columns: minmax(8rem, .8fr) minmax(0, 1.2fr); gap: var(--space-3); }
.rule-form__condition label { display: flex; flex-direction: column; gap: var(--space-2); }
.rule-form__condition select { min-height: 2.5rem; padding: 0 var(--space-3); border: 1px solid var(--color-border-strong); border-radius: var(--radius-sm); background: var(--color-surface); color: var(--color-ink); font: inherit; font-size: var(--text-sm); }
.rule-form__preview { display: flex; padding: var(--space-4); flex-wrap: wrap; align-items: baseline; gap: .3rem; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface-subtle); font-size: var(--text-xs); line-height: 1.5; }
.rule-form__preview span { color: var(--color-ink-muted); }
.rule-form__preview strong { color: var(--color-ink); }
.rule-form__toggle { display: flex; align-items: flex-start; gap: var(--space-3); color: var(--color-ink); cursor: pointer; }
.rule-form__toggle input { margin-top: .2rem; }
.rule-form__toggle span { display: flex; flex-direction: column; gap: var(--space-1); }
.rule-form__toggle strong { font-size: var(--text-sm); }
.rule-form__toggle small { color: var(--color-ink-muted); font-size: var(--text-xs); }
.rule-form__error { color: var(--color-negative); font-size: var(--text-xs); font-weight: var(--weight-medium); }
@media (max-width: 480px) { .rule-form__condition { grid-template-columns: 1fr; } }
</style>
