<script setup lang="ts">
import { X } from '@lucide/vue'

defineProps<{
  title: string
}>()

const open = defineModel<boolean>('open', { required: true })

function close() {
  open.value = false
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') close()
}

watch(open, (value) => {
  if (import.meta.client) {
    document.body.style.overflow = value ? 'hidden' : ''
  }
})

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer">
      <div v-if="open" class="ui-drawer">
        <div class="ui-drawer__overlay" @click="close" />
        <aside
          class="ui-drawer__panel"
          role="dialog"
          aria-modal="true"
          :aria-label="title"
        >
          <header class="ui-drawer__header">
            <h2>{{ title }}</h2>
            <button type="button" aria-label="Fechar" @click="close">
              <X aria-hidden="true" />
            </button>
          </header>

          <div class="ui-drawer__body">
            <slot />
          </div>

          <footer v-if="$slots.footer" class="ui-drawer__footer">
            <slot name="footer" />
          </footer>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.ui-drawer {
  position: fixed;
  inset: 0;
  z-index: 50;
}

.ui-drawer__overlay {
  position: absolute;
  inset: 0;
  background: rgb(16 22 32 / 44%);
}

.ui-drawer__panel {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  display: flex;
  width: min(27rem, 92vw);
  flex-direction: column;
  background: var(--color-surface);
  box-shadow: var(--shadow-md);
}

.ui-drawer__header {
  display: flex;
  padding: var(--space-5) var(--space-6);
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  border-bottom: 1px solid var(--color-border);
}

.ui-drawer__header h2 {
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
  letter-spacing: -0.01em;
}

.ui-drawer__header button {
  display: grid;
  width: 2rem;
  height: 2rem;
  padding: 0;
  place-items: center;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-ink-muted);
  cursor: pointer;
}

.ui-drawer__header button :deep(svg) {
  pointer-events: none;
}

.ui-drawer__header button:hover {
  background: var(--color-surface-subtle);
  color: var(--color-ink);
}

.ui-drawer__header button svg {
  width: 1.1rem;
  height: 1.1rem;
}

.ui-drawer__body {
  flex: 1;
  padding: var(--space-6);
  overflow-y: auto;
}

.ui-drawer__footer {
  display: flex;
  padding: var(--space-4) var(--space-6);
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-3);
  border-top: 1px solid var(--color-border);
}

.drawer-enter-active,
.drawer-leave-active {
  transition: opacity var(--transition-base);
}

.drawer-enter-active .ui-drawer__panel,
.drawer-leave-active .ui-drawer__panel {
  transition: transform var(--transition-base);
}

.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}

.drawer-enter-from .ui-drawer__panel,
.drawer-leave-to .ui-drawer__panel {
  transform: translateX(100%);
}
</style>
