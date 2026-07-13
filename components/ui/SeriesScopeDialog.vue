<script setup lang="ts">
import { Layers, ListTree, Trash2, X } from '@lucide/vue'
import type { EntrySeriesScope } from '~/types/entry'

const props = withDefaults(
  defineProps<{
    title?: string
    description?: string
    confirmLabel?: string
    /** Quando false, só confirma exclusão (lançamento avulso). */
    showScopeOptions?: boolean
  }>(),
  {
    title: 'Excluir lançamento',
    description: 'Escolha o alcance da exclusão.',
    confirmLabel: 'Excluir',
    showScopeOptions: true,
  },
)

const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{
  confirm: [scope: EntrySeriesScope]
  cancel: []
}>()

const scope = ref<EntrySeriesScope>('occurrence')

const options: {
  value: EntrySeriesScope
  label: string
  hint: string
  icon: typeof Trash2
}[] = [
  {
    value: 'occurrence',
    label: 'Só esta',
    hint: 'Remove apenas este mês.',
    icon: Trash2,
  },
  {
    value: 'future',
    label: 'Esta e próximas',
    hint: 'Remove deste mês em diante.',
    icon: ListTree,
  },
  {
    value: 'series',
    label: 'Série inteira',
    hint: 'Remove todas as parcelas ou recorrências.',
    icon: Layers,
  },
]

watch(open, (value) => {
  if (value) {
    scope.value = props.showScopeOptions ? 'occurrence' : 'series'
  }
})

function close() {
  open.value = false
  emit('cancel')
}

function confirm() {
  open.value = false
  emit('confirm', scope.value)
}

function onKeydown(event: KeyboardEvent) {
  if (!open.value) return
  if (event.key === 'Escape') close()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

void props
</script>

<template>
  <Teleport to="body">
    <Transition name="scope-dialog">
      <div v-if="open" class="scope-dialog" role="presentation">
        <div class="scope-dialog__overlay" @click="close" />
        <div
          class="scope-dialog__panel"
          role="dialog"
          aria-modal="true"
          :aria-label="title"
        >
          <header class="scope-dialog__header">
            <div>
              <h2>{{ title }}</h2>
              <p>{{ description }}</p>
            </div>
            <button type="button" aria-label="Fechar" @click="close">
              <X aria-hidden="true" />
            </button>
          </header>

          <div
            v-if="showScopeOptions"
            class="scope-dialog__options"
            role="radiogroup"
            aria-label="Alcance"
          >
            <button
              v-for="option in options"
              :key="option.value"
              type="button"
              role="radio"
              class="scope-dialog__option"
              :class="{ 'is-active': scope === option.value }"
              :aria-checked="scope === option.value"
              @click="scope = option.value"
            >
              <span class="scope-dialog__icon" aria-hidden="true">
                <component :is="option.icon" />
              </span>
              <span class="scope-dialog__copy">
                <strong>{{ option.label }}</strong>
                <span>{{ option.hint }}</span>
              </span>
            </button>
          </div>

          <footer class="scope-dialog__footer">
            <UiButton variant="ghost" @click="close">Cancelar</UiButton>
            <UiButton @click="confirm">
              {{ confirmLabel }}
            </UiButton>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.scope-dialog {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  padding: var(--space-5);
}

.scope-dialog__overlay {
  position: absolute;
  inset: 0;
  background: rgb(16 22 32 / 44%);
}

.scope-dialog__panel {
  position: relative;
  z-index: 1;
  width: min(100%, 26rem);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-md);
}

.scope-dialog__header {
  display: flex;
  padding: var(--space-5) var(--space-5) var(--space-4);
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}

.scope-dialog__header h2 {
  color: var(--color-ink);
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
}

.scope-dialog__header p {
  margin-top: var(--space-1);
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.scope-dialog__header button {
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  flex-shrink: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-ink-secondary);
  cursor: pointer;
}

.scope-dialog__header button:hover {
  color: var(--color-ink);
}

.scope-dialog__header svg {
  width: 1rem;
  height: 1rem;
}

.scope-dialog__options {
  display: flex;
  padding: 0 var(--space-5);
  flex-direction: column;
  gap: var(--space-2);
}

.scope-dialog__option {
  display: flex;
  width: 100%;
  padding: var(--space-3) var(--space-4);
  align-items: center;
  gap: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    background-color var(--transition-fast);
}

.scope-dialog__option:hover {
  border-color: var(--color-border-strong);
  background: var(--color-surface-subtle);
}

.scope-dialog__option.is-active {
  border-color: var(--color-brand);
  background: var(--color-brand-soft);
}

.scope-dialog__icon {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  place-items: center;
  flex-shrink: 0;
  border-radius: var(--radius-sm);
  background: var(--color-surface-subtle);
  color: var(--color-ink-secondary);
}

.scope-dialog__option.is-active .scope-dialog__icon {
  background: var(--color-surface);
  color: var(--color-brand-ink);
}

.scope-dialog__icon svg {
  width: 1rem;
  height: 1rem;
}

.scope-dialog__copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.15rem;
}

.scope-dialog__copy strong {
  color: var(--color-ink);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
}

.scope-dialog__copy span {
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.scope-dialog__footer {
  display: flex;
  padding: var(--space-5);
  justify-content: flex-end;
  gap: var(--space-2);
}

.scope-dialog-enter-active,
.scope-dialog-leave-active {
  transition: opacity var(--transition-base);
}

.scope-dialog-enter-active .scope-dialog__panel,
.scope-dialog-leave-active .scope-dialog__panel {
  transition: transform var(--transition-base);
}

.scope-dialog-enter-from,
.scope-dialog-leave-to {
  opacity: 0;
}

.scope-dialog-enter-from .scope-dialog__panel,
.scope-dialog-leave-to .scope-dialog__panel {
  transform: translateY(0.5rem) scale(0.98);
}
</style>
