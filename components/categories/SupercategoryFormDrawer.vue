<script setup lang="ts">
import type { Supercategory, SupercategoryPayload } from '~/types/category'

const props = defineProps<{
  supercategory: Supercategory | null
}>()

const emit = defineEmits<{
  saved: []
}>()

const open = defineModel<boolean>('open', { required: true })

const name = ref('')
const color = ref(categoryColorPalette[0]!)
const icon = ref(categoryIconNames[0]!)
const errorMessage = ref('')
const saving = ref(false)

const isEditing = computed(() => props.supercategory !== null)

watch(open, (value) => {
  if (!value) return

  errorMessage.value = ''
  name.value = props.supercategory?.name ?? ''
  color.value = props.supercategory?.color ?? categoryColorPalette[0]!
  icon.value = props.supercategory?.icon ?? categoryIconNames[0]!
})

async function save() {
  if (!name.value.trim()) {
    errorMessage.value = 'Informe um nome para a supercategoria.'
    return
  }

  const payload: SupercategoryPayload = {
    name: name.value.trim(),
    color: color.value,
    icon: icon.value,
  }

  saving.value = true
  errorMessage.value = ''

  try {
    if (isEditing.value) {
      await $fetch(`/api/supercategories/${props.supercategory!.id}`, {
        method: 'PUT',
        body: payload,
      })
    } else {
      await $fetch('/api/supercategories', { method: 'POST', body: payload })
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
    :title="isEditing ? 'Editar supercategoria' : 'Nova supercategoria'"
  >
    <form class="super-form" @submit.prevent="save">
      <UiTextField
        v-model="name"
        label="Nome"
        placeholder="Ex: Moradia, Alimentação, Renda..."
        required
      />

      <div class="super-form__section">
        <p class="super-form__label">Cor</p>
        <CategoriesColorPicker v-model="color" />
      </div>

      <div class="super-form__section">
        <p class="super-form__label">Ícone</p>
        <CategoriesIconPicker v-model="icon" :active-color="color" />
      </div>

      <div class="super-form__preview">
        <CategoriesCategoryIconChip :icon="icon" :color="color" />
        <p>{{ name.trim() || 'Nome da supercategoria' }}</p>
      </div>

      <p v-if="errorMessage" class="super-form__error" role="alert">
        {{ errorMessage }}
      </p>
    </form>

    <template #footer>
      <UiButton variant="ghost" @click="open = false">Cancelar</UiButton>
      <UiButton :disabled="saving" @click="save">
        {{ isEditing ? 'Salvar alterações' : 'Criar supercategoria' }}
      </UiButton>
    </template>
  </UiDrawer>
</template>

<style scoped>
.super-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.super-form__section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.super-form__label {
  color: var(--color-ink-secondary);
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
}

.super-form__preview {
  display: flex;
  padding: var(--space-4);
  align-items: center;
  gap: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-subtle);
}

.super-form__preview p {
  color: var(--color-ink);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
}

.super-form__error {
  color: var(--color-negative);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
}
</style>
