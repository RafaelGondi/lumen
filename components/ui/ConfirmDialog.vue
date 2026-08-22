<script setup lang="ts">
import { AlertTriangle, X } from '@lucide/vue'

withDefaults(
  defineProps<{
    title: string
    description: string
    confirmLabel?: string
    busy?: boolean
  }>(),
  {
    confirmLabel: 'Confirmar',
    busy: false,
  },
)

const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ confirm: []; cancel: [] }>()

function close() {
  if (!open.value) return
  open.value = false
  emit('cancel')
}

function onKeydown(event: KeyboardEvent) {
  if (open.value && event.key === 'Escape') close()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <Transition name="confirm-dialog">
      <div v-if="open" class="confirm-dialog" role="presentation">
        <div class="confirm-dialog__overlay" @click="!busy && close()" />
        <section
          class="confirm-dialog__panel"
          role="dialog"
          aria-modal="true"
          :aria-label="title"
        >
          <header class="confirm-dialog__header">
            <span class="confirm-dialog__icon" aria-hidden="true">
              <AlertTriangle />
            </span>
            <div>
              <h2>{{ title }}</h2>
              <p>{{ description }}</p>
            </div>
            <button
              type="button"
              aria-label="Fechar"
              :disabled="busy"
              @click="close"
            >
              <X aria-hidden="true" />
            </button>
          </header>

          <footer class="confirm-dialog__footer">
            <UiButton variant="ghost" :disabled="busy" @click="close">
              Cancelar
            </UiButton>
            <UiButton variant="danger" :disabled="busy" @click="emit('confirm')">
              {{ busy ? 'Excluindo…' : confirmLabel }}
            </UiButton>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.confirm-dialog { position: fixed; inset: 0; z-index: 70; display: grid; padding: var(--space-5); place-items: center; }
.confirm-dialog__overlay { position: absolute; inset: 0; background: rgb(16 22 32 / 44%); }
.confirm-dialog__panel { position: relative; z-index: 1; width: min(100%, 27rem); border: 1px solid var(--color-border); border-radius: var(--radius-lg); background: var(--color-surface); box-shadow: var(--shadow-md); }
.confirm-dialog__header { display: grid; padding: var(--space-5); grid-template-columns: auto minmax(0, 1fr) auto; align-items: flex-start; gap: var(--space-3); }
.confirm-dialog__icon { display: grid; width: 2.5rem; height: 2.5rem; place-items: center; border-radius: var(--radius-sm); background: var(--color-negative-soft); color: var(--color-negative-ink); }
.confirm-dialog__icon svg, .confirm-dialog__header button svg { width: 1rem; height: 1rem; }
.confirm-dialog__header h2 { color: var(--color-ink); font-size: var(--text-md); font-weight: var(--weight-semibold); }
.confirm-dialog__header p { margin-top: var(--space-1); color: var(--color-ink-muted); font-size: var(--text-xs); line-height: 1.5; }
.confirm-dialog__header button { display: grid; width: 2rem; height: 2rem; place-items: center; border: 0; background: transparent; color: var(--color-ink-muted); cursor: pointer; }
.confirm-dialog__footer { display: flex; padding: var(--space-4) var(--space-5); justify-content: flex-end; gap: var(--space-2); border-top: 1px solid var(--color-border); }
.confirm-dialog-enter-active, .confirm-dialog-leave-active { transition: opacity var(--transition-base); }
.confirm-dialog-enter-active .confirm-dialog__panel, .confirm-dialog-leave-active .confirm-dialog__panel { transition: transform var(--transition-base); }
.confirm-dialog-enter-from, .confirm-dialog-leave-to { opacity: 0; }
.confirm-dialog-enter-from .confirm-dialog__panel, .confirm-dialog-leave-to .confirm-dialog__panel { transform: translateY(.5rem) scale(.98); }
@media (max-width: 480px) {
  .confirm-dialog { padding: var(--space-3); align-items: end; }
  .confirm-dialog__panel { border-radius: var(--radius-lg) var(--radius-lg) 0 0; }
}
</style>
