<script setup lang="ts">
import type {
  Category,
  CategoryPayload,
  CategoryType,
  Supercategory,
} from '~/types/category'

const props = defineProps<{
  category: Category | null
  supercategories: Supercategory[]
}>()

const emit = defineEmits<{
  saved: []
}>()

const open = defineModel<boolean>('open', { required: true })

const name = ref('')
const type = ref<CategoryType>('expense')
const color = ref(categoryColorPalette[0]!)
const icon = ref(categoryIconNames[0]!)
const supercategoryId = ref<number | null>(null)
const errorMessage = ref('')
const saving = ref(false)

const isEditing = computed(() => props.category !== null)

watch(open, (value) => {
  if (!value) return

  errorMessage.value = ''
  name.value = props.category?.name ?? ''
  type.value = props.category?.type ?? 'expense'
  color.value = props.category?.color ?? categoryColorPalette[0]!
  icon.value = props.category?.icon ?? categoryIconNames[0]!
  supercategoryId.value = props.category?.supercategoryId ?? null
})

async function save() {
  if (!name.value.trim()) {
    errorMessage.value = 'Informe um nome para a categoria.'
    return
  }

  const payload: CategoryPayload = {
    name: name.value.trim(),
    type: type.value,
    color: color.value,
    icon: icon.value,
    supercategoryId: supercategoryId.value,
  }

  saving.value = true
  errorMessage.value = ''

  try {
    if (isEditing.value) {
      await $fetch(`/api/categories/${props.category!.id}`, {
        method: 'PUT',
        body: payload,
      })
    } else {
      await $fetch('/api/categories', { method: 'POST', body: payload })
    }

    open.value = false
    emit('saved')
  } catch (error) {
    errorMessage.value =
      (error as { statusMessage?: string }).statusMessage ??
      'Não foi possível salvar. Tente novamente.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UiDrawer
    v-model:open="open"
    :title="isEditing ? 'Editar categoria' : 'Nova categoria'"
  >
    <form class="category-form" @submit.prevent="save">
      <div class="category-form__section">
        <p class="category-form__label">
          Tipo <span aria-hidden="true">*</span>
        </p>
        <UiSegmentedControl v-model="type" :options="categoryTypeOptions" />
      </div>

      <UiTextField
        v-model="name"
        label="Nome"
        placeholder="Ex: Alimentação, Salário, Aluguel..."
        required
      />

      <div class="category-form__section">
        <p class="category-form__label">Cor</p>
        <CategoriesColorPicker v-model="color" />
      </div>

      <div class="category-form__section">
        <p class="category-form__label">Ícone</p>
        <CategoriesIconPicker v-model="icon" :active-color="color" />
      </div>

      <div class="category-form__section">
        <p class="category-form__label">Supercategoria</p>
        <div class="category-form__supercategories">
          <button
            type="button"
            class="category-form__chip"
            :class="{
              'category-form__chip--active': supercategoryId === null,
            }"
            @click="supercategoryId = null"
          >
            Nenhuma
          </button>
          <button
            v-for="supercategory in supercategories"
            :key="supercategory.id"
            type="button"
            class="category-form__chip"
            :class="{
              'category-form__chip--active':
                supercategoryId === supercategory.id,
            }"
            @click="supercategoryId = supercategory.id"
          >
            <component
              :is="categoryIcon(supercategory.icon)"
              aria-hidden="true"
            />
            {{ supercategory.name }}
          </button>
        </div>
      </div>

      <div class="category-form__preview">
        <CategoriesCategoryIconChip :icon="icon" :color="color" />
        <div>
          <p>{{ name.trim() || 'Nome da categoria' }}</p>
          <span>{{ categoryTypeLabels[type] }}</span>
        </div>
      </div>

      <p v-if="errorMessage" class="category-form__error" role="alert">
        {{ errorMessage }}
      </p>
    </form>

    <template #footer>
      <UiButton variant="ghost" @click="open = false">Cancelar</UiButton>
      <UiButton :disabled="saving" @click="save">
        {{ isEditing ? 'Salvar alterações' : 'Criar categoria' }}
      </UiButton>
    </template>
  </UiDrawer>
</template>

<style scoped>
.category-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.category-form__section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.category-form__label {
  color: var(--color-ink-secondary);
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
}

.category-form__label span {
  color: var(--color-negative);
}

.category-form__supercategories {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.category-form__chip {
  display: inline-flex;
  min-height: 2rem;
  padding: 0 var(--space-3);
  align-items: center;
  gap: 0.375rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-round);
  background: var(--color-surface);
  color: var(--color-ink-secondary);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    background-color var(--transition-fast),
    color var(--transition-fast);
}

.category-form__chip:hover {
  border-color: var(--color-brand);
  color: var(--color-brand);
}

.category-form__chip--active {
  border-color: var(--color-brand);
  background: var(--color-brand-soft);
  color: var(--color-brand-ink);
  font-weight: var(--weight-semibold);
}

.category-form__chip svg {
  width: 0.85rem;
  height: 0.85rem;
}

.category-form__preview {
  display: flex;
  padding: var(--space-4);
  align-items: center;
  gap: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-subtle);
}

.category-form__preview p {
  color: var(--color-ink);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
}

.category-form__preview span {
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.category-form__error {
  color: var(--color-negative);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
}
</style>
