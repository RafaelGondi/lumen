<script setup lang="ts">
import {
  CreditCard,
  Landmark,
  LoaderCircle,
  Search,
  Wallet,
} from '@lucide/vue'
import type { GlobalSearchResponse, GlobalSearchResult } from '~/types/search'

const open = ref(false)
const query = ref('')
const loading = ref(false)
const results = ref<GlobalSearchResult[]>([])
const activeIndex = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)
const triggerRef = ref<HTMLButtonElement | null>(null)

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let requestId = 0

const hasQuery = computed(() => query.value.trim().length >= 2)
const showEmptyHint = computed(
  () => open.value && !loading.value && !hasQuery.value,
)
const showNoResults = computed(
  () =>
    open.value &&
    !loading.value &&
    hasQuery.value &&
    results.value.length === 0,
)

function openSearch() {
  open.value = true
  activeIndex.value = 0
  nextTick(() => inputRef.value?.focus())
}

function closeSearch() {
  open.value = false
  query.value = ''
  results.value = []
  activeIndex.value = 0
  loading.value = false
}

async function runSearch(term: string) {
  const trimmed = term.trim()
  if (trimmed.length < 2) {
    results.value = []
    loading.value = false
    return
  }

  const id = ++requestId
  loading.value = true
  try {
    const response = await $fetch<GlobalSearchResponse>('/api/search', {
      query: { q: trimmed },
    })
    if (id !== requestId) return
    results.value = response.results
    activeIndex.value = 0
  } catch {
    if (id !== requestId) return
    results.value = []
  } finally {
    if (id === requestId) loading.value = false
  }
}

function onQueryInput(value: string) {
  query.value = value
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    void runSearch(value)
  }, 180)
}

async function selectResult(result: GlobalSearchResult) {
  closeSearch()
  await navigateTo(result.href)
}

function onKeydown(event: KeyboardEvent) {
  if (!open.value) {
    if (
      event.key === '/' &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey
    ) {
      const target = event.target as HTMLElement | null
      const tag = target?.tagName
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        target?.isContentEditable
      ) {
        return
      }
      event.preventDefault()
      openSearch()
    }
    return
  }

  if (event.key === 'Escape') {
    event.preventDefault()
    closeSearch()
    return
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    if (!results.value.length) return
    activeIndex.value = (activeIndex.value + 1) % results.value.length
    return
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    if (!results.value.length) return
    activeIndex.value =
      (activeIndex.value - 1 + results.value.length) % results.value.length
    return
  }

  if (event.key === 'Enter') {
    const result = results.value[activeIndex.value]
    if (result) {
      event.preventDefault()
      void selectResult(result)
    }
  }
}

function resultIcon(kind: GlobalSearchResult['kind']) {
  return kind === 'card' ? CreditCard : Landmark
}

watch(open, (value) => {
  if (!import.meta.client) return
  document.body.style.overflow = value ? 'hidden' : ''
})

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  if (debounceTimer) clearTimeout(debounceTimer)
  if (import.meta.client) document.body.style.overflow = ''
})

defineExpose({ openSearch, closeSearch })
</script>

<template>
  <div class="global-search">
    <button
      ref="triggerRef"
      type="button"
      class="global-search__trigger"
      aria-label="Busca global"
      @click="openSearch"
    >
      <Search aria-hidden="true" />
      <span class="global-search__trigger-label">Buscar</span>
      <kbd class="global-search__kbd">/</kbd>
    </button>

    <button
      type="button"
      class="global-search__trigger-icon"
      aria-label="Busca global"
      @click="openSearch"
    >
      <Search aria-hidden="true" />
    </button>

    <Teleport to="body">
      <div
        v-if="open"
        class="global-search__overlay"
        role="dialog"
        aria-modal="true"
        aria-label="Busca global"
        @click.self="closeSearch"
      >
        <div class="global-search__panel">
          <div class="global-search__input-row">
            <Search class="global-search__input-icon" aria-hidden="true" />
            <input
              ref="inputRef"
              class="global-search__input"
              type="search"
              :value="query"
              placeholder="Buscar por descrição ou nome na fatura..."
              autocomplete="off"
              autocorrect="off"
              spellcheck="false"
              @input="onQueryInput(($event.target as HTMLInputElement).value)"
            />
            <kbd class="global-search__kbd global-search__kbd--esc">Esc</kbd>
          </div>

          <div class="global-search__body">
            <p v-if="showEmptyHint" class="global-search__hint">
              Digite para buscar em todas as transações
            </p>

            <div v-else-if="loading" class="global-search__hint">
              <LoaderCircle class="global-search__spinner" aria-hidden="true" />
              Buscando…
            </div>

            <p v-else-if="showNoResults" class="global-search__hint">
              Nenhum resultado para “{{ query.trim() }}”
            </p>

            <ul v-else class="global-search__results" role="listbox">
              <li v-for="(result, index) in results" :key="result.id">
                <button
                  type="button"
                  class="global-search__result"
                  :class="{ 'is-active': index === activeIndex }"
                  role="option"
                  :aria-selected="index === activeIndex"
                  @mouseenter="activeIndex = index"
                  @click="selectResult(result)"
                >
                  <span
                    class="global-search__result-icon"
                    :class="`global-search__result-icon--${result.kind}`"
                    aria-hidden="true"
                  >
                    <component :is="resultIcon(result.kind)" />
                  </span>
                  <span class="global-search__result-main">
                    <strong>{{ result.title }}</strong>
                    <small>{{ result.subtitle }}</small>
                  </span>
                  <span class="global-search__result-meta">
                    <span class="global-search__result-context">
                      <Wallet
                        v-if="result.kind === 'account'"
                        aria-hidden="true"
                      />
                      <CreditCard v-else aria-hidden="true" />
                      {{ result.contextLabel }}
                    </span>
                    <strong
                      class="numeric"
                      :class="{
                        'is-expense': result.entryType === 'expense',
                        'is-income': result.entryType === 'income',
                      }"
                    >
                      <UiMoney :value="result.amount" />
                    </strong>
                  </span>
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.global-search {
  display: contents;
}

.global-search__trigger {
  display: none;
  min-width: 14rem;
  min-height: 2.25rem;
  padding: 0 0.55rem 0 0.75rem;
  align-items: center;
  gap: 0.55rem;
  border: 1px solid rgb(255 255 255 / 12%);
  border-radius: 999px;
  background: rgb(255 255 255 / 8%);
  color: var(--color-nav-muted);
  cursor: pointer;
  transition:
    background-color var(--transition-fast),
    border-color var(--transition-fast),
    color var(--transition-fast);
}

.global-search__trigger:hover {
  background: rgb(255 255 255 / 12%);
  border-color: rgb(255 255 255 / 18%);
  color: var(--color-white);
}

.global-search__trigger svg {
  width: 0.95rem;
  height: 0.95rem;
  flex-shrink: 0;
}

.global-search__trigger-label {
  flex: 1;
  text-align: left;
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
}

.global-search__trigger-icon {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  padding: 0;
  place-items: center;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-nav-muted);
  cursor: pointer;
}

.global-search__trigger-icon:hover {
  background: rgb(255 255 255 / 7%);
  color: var(--color-white);
}

.global-search__trigger-icon svg {
  width: 1.1rem;
  height: 1.1rem;
}

.global-search__kbd {
  display: inline-grid;
  min-width: 1.35rem;
  height: 1.35rem;
  padding: 0 0.35rem;
  place-items: center;
  border: 1px solid rgb(255 255 255 / 14%);
  border-radius: 0.35rem;
  background: rgb(255 255 255 / 10%);
  color: var(--color-nav-muted);
  font-family: var(--font-sans);
  font-size: 0.6875rem;
  font-weight: var(--weight-semibold);
  line-height: 1;
}

.global-search__overlay {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  padding: max(12vh, 2rem) var(--space-4) var(--space-4);
  align-content: start;
  justify-items: center;
  background: rgb(16 22 32 / 52%);
  backdrop-filter: blur(2px);
}

.global-search__panel {
  width: min(40rem, 100%);
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: 1rem;
  background: var(--color-surface);
  box-shadow: var(--shadow-md);
}

.global-search__input-row {
  display: flex;
  min-height: 3.5rem;
  padding: 0 var(--space-4);
  align-items: center;
  gap: var(--space-3);
  border-bottom: 1px solid var(--color-border);
}

.global-search__input-icon {
  width: 1.15rem;
  height: 1.15rem;
  flex-shrink: 0;
  color: var(--color-ink-muted);
}

.global-search__input {
  width: 100%;
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--color-ink);
  font-size: var(--text-md);
}

.global-search__input::placeholder {
  color: var(--color-ink-muted);
}

.global-search__input:focus {
  outline: none;
}

.global-search__kbd--esc {
  border-color: var(--color-border);
  background: var(--color-surface-subtle);
  color: var(--color-ink-muted);
}

.global-search__body {
  min-height: 8.5rem;
  max-height: min(24rem, 55vh);
  overflow: auto;
}

.global-search__hint {
  display: flex;
  min-height: 8.5rem;
  padding: var(--space-6);
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  color: var(--color-ink-muted);
  font-size: var(--text-sm);
  text-align: center;
}

.global-search__spinner {
  width: 1rem;
  height: 1rem;
  animation: spin 0.8s linear infinite;
}

.global-search__results {
  margin: 0;
  padding: var(--space-2);
  list-style: none;
}

.global-search__result {
  display: grid;
  width: 100%;
  padding: 0.7rem 0.75rem;
  grid-template-columns: 2.25rem minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
  border: 0;
  border-radius: 0.75rem;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.global-search__result.is-active,
.global-search__result:hover {
  background: var(--color-surface-subtle);
}

.global-search__result-icon {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  place-items: center;
  border-radius: var(--radius-sm);
  background: var(--color-brand-soft);
  color: var(--color-brand-ink);
}

.global-search__result-icon--card {
  background: var(--color-info-soft);
  color: var(--color-info);
}

.global-search__result-icon svg {
  width: 1rem;
  height: 1rem;
}

.global-search__result-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.global-search__result-main strong {
  overflow: hidden;
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.global-search__result-main small {
  overflow: hidden;
  color: var(--color-ink-muted);
  font-size: 0.6875rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.global-search__result-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.2rem;
}

.global-search__result-context {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  color: var(--color-ink-muted);
  font-size: 0.625rem;
  font-weight: var(--weight-medium);
}

.global-search__result-context svg {
  width: 0.7rem;
  height: 0.7rem;
}

.global-search__result-meta > strong {
  color: var(--color-ink);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
}

.global-search__result-meta > strong.is-expense {
  color: var(--color-negative-ink);
}

.global-search__result-meta > strong.is-income {
  color: var(--color-positive-ink);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (min-width: 901px) {
  .global-search__trigger {
    display: inline-flex;
  }

  .global-search__trigger-icon {
    display: none;
  }
}

@media (max-width: 480px) {
  .global-search__overlay {
    padding: var(--space-3);
    align-content: start;
  }

  .global-search__panel {
    border-radius: 0.85rem;
  }

  .global-search__result {
    grid-template-columns: 2rem minmax(0, 1fr);
    grid-template-areas:
      "icon main"
      "icon meta";
  }

  .global-search__result-icon {
    grid-area: icon;
  }

  .global-search__result-main {
    grid-area: main;
  }

  .global-search__result-meta {
    grid-area: meta;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    width: 100%;
  }
}
</style>
