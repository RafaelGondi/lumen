<script setup lang="ts">
import {
  Calculator,
  Check,
  Copy,
  Delete as DeleteIcon,
  GripHorizontal,
  X,
} from '@lucide/vue'

const open = ref(false)
const expression = ref('')
const previousExpression = ref('')
const copied = ref(false)
const panelRef = ref<HTMLElement | null>(null)
const dragging = ref(false)
const position = ref<{ left: number; top: number } | null>(null)
const draggedWidth = ref<number | null>(null)

let dragState: {
  pointerId: number
  offsetX: number
  offsetY: number
  width: number
  height: number
} | null = null

let copiedTimer: ReturnType<typeof setTimeout> | null = null

function evaluateExpression(source: string): number | null {
  const input = source.replaceAll(',', '.').replaceAll(' ', '')
  if (!input) return null

  let index = 0

  function parsePrimary(): number {
    if (input[index] === '(') {
      index += 1
      const value = parseExpression()
      if (input[index] !== ')') throw new Error('Parêntese inválido')
      index += 1
      return value
    }

    const match = input.slice(index).match(/^(?:\d+(?:\.\d*)?|\.\d+)/)
    if (!match) throw new Error('Número inválido')
    index += match[0].length
    return Number(match[0])
  }

  function parseUnary(): number {
    if (input[index] === '+') {
      index += 1
      return parseUnary()
    }
    if (input[index] === '-') {
      index += 1
      return -parseUnary()
    }

    let value = parsePrimary()
    while (input[index] === '%') {
      value /= 100
      index += 1
    }
    return value
  }

  function parseTerm(): number {
    let value = parseUnary()
    while (input[index] === '*' || input[index] === '/') {
      const operator = input[index++]
      const next = parseUnary()
      value = operator === '*' ? value * next : value / next
    }
    return value
  }

  function parseExpression(): number {
    let value = parseTerm()
    while (input[index] === '+' || input[index] === '-') {
      const operator = input[index++]
      const next = parseTerm()
      value = operator === '+' ? value + next : value - next
    }
    return value
  }

  try {
    const value = parseExpression()
    return index === input.length && Number.isFinite(value) ? value : null
  } catch {
    return null
  }
}

const result = computed(() => evaluateExpression(expression.value))
const panelStyle = computed(() =>
  position.value
    ? {
        left: `${position.value.left}px`,
        top: `${position.value.top}px`,
        right: 'auto',
        bottom: 'auto',
        width: draggedWidth.value ? `${draggedWidth.value}px` : undefined,
      }
    : undefined,
)

function formatResult(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 10,
    useGrouping: true,
  }).format(value)
}

function plainResult(value: number) {
  return Number(value.toFixed(10)).toString()
}

function displayExpression(value: string) {
  return value
    .replaceAll('*', ' × ')
    .replaceAll('/', ' ÷ ')
    .replaceAll('-', ' − ')
    .replaceAll('+', ' + ')
    .replaceAll('.', ',')
}

function openCalculator() {
  open.value = true
  nextTick(() => panelRef.value?.focus())
}

function closeCalculator() {
  open.value = false
}

function clampPosition(left: number, top: number, width: number, height: number) {
  const margin = 8
  const viewportWidth = document.documentElement.clientWidth
  const viewportHeight = document.documentElement.clientHeight
  return {
    left: Math.min(
      Math.max(left, margin),
      Math.max(margin, viewportWidth - width - margin),
    ),
    top: Math.min(
      Math.max(top, margin),
      Math.max(margin, viewportHeight - height - margin),
    ),
  }
}

function startDrag(event: PointerEvent) {
  if (event.button !== 0 || !panelRef.value) return
  if ((event.target as HTMLElement).closest('button')) return

  const rect = panelRef.value.getBoundingClientRect()
  dragState = {
    pointerId: event.pointerId,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
    width: rect.width,
    height: rect.height,
  }
  draggedWidth.value = rect.width
  dragging.value = true
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  event.preventDefault()
}

function moveDrag(event: PointerEvent) {
  if (!dragState || event.pointerId !== dragState.pointerId) return
  position.value = clampPosition(
    event.clientX - dragState.offsetX,
    event.clientY - dragState.offsetY,
    dragState.width,
    dragState.height,
  )
}

function stopDrag(event: PointerEvent) {
  if (!dragState || event.pointerId !== dragState.pointerId) return
  const target = event.currentTarget as HTMLElement
  if (target.hasPointerCapture(event.pointerId)) {
    target.releasePointerCapture(event.pointerId)
  }
  dragState = null
  dragging.value = false
}

function keepPanelOnScreen() {
  if (!position.value || !panelRef.value) return
  const rect = panelRef.value.getBoundingClientRect()
  const viewportWidth = document.documentElement.clientWidth
  const width = viewportWidth <= 600
    ? Math.max(0, viewportWidth - 16)
    : Math.min(320, viewportWidth - 24)
  draggedWidth.value = width
  position.value = clampPosition(
    position.value.left,
    position.value.top,
    width,
    rect.height,
  )
}

function clearCalculator() {
  expression.value = ''
  previousExpression.value = ''
  copied.value = false
}

function appendDigit(value: string) {
  if (previousExpression.value) {
    expression.value = ''
    previousExpression.value = ''
  }
  expression.value += value
}

function appendDecimal() {
  if (previousExpression.value) {
    expression.value = ''
    previousExpression.value = ''
  }
  const currentNumber = expression.value.split(/[+\-*/()%]/).at(-1) ?? ''
  if (currentNumber.includes('.')) return
  expression.value += currentNumber ? '.' : '0.'
}

function appendOperator(operator: string) {
  previousExpression.value = ''
  if (!expression.value) {
    if (operator === '-') expression.value = '-'
    return
  }

  const last = expression.value.at(-1)!
  if ('+-*/'.includes(last)) {
    expression.value = `${expression.value.slice(0, -1)}${operator}`
    return
  }
  if (last === '(') {
    if (operator === '-') expression.value += operator
    return
  }
  expression.value += operator
}

function appendParenthesis(parenthesis: '(' | ')') {
  previousExpression.value = ''
  const last = expression.value.at(-1)
  if (parenthesis === '(') {
    if (last && /[\d)%]/.test(last)) expression.value += '*'
    expression.value += '('
    return
  }

  const openCount = [...expression.value].filter((item) => item === '(').length
  const closeCount = [...expression.value].filter((item) => item === ')').length
  if (openCount > closeCount && last && /[\d)%]/.test(last)) {
    expression.value += ')'
  }
}

function appendPercent() {
  previousExpression.value = ''
  const last = expression.value.at(-1)
  if (last && /[\d)]/.test(last)) expression.value += '%'
}

function backspace() {
  previousExpression.value = ''
  expression.value = expression.value.slice(0, -1)
}

function calculate() {
  if (result.value === null) return
  previousExpression.value = displayExpression(expression.value)
  expression.value = plainResult(result.value)
}

async function copyResult() {
  if (result.value === null || !import.meta.client) return
  await navigator.clipboard.writeText(plainResult(result.value).replace('.', ','))
  copied.value = true
  if (copiedTimer) clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => {
    copied.value = false
  }, 1400)
}

function isEditableTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null
  return Boolean(
    element &&
      (element.tagName === 'INPUT' ||
        element.tagName === 'TEXTAREA' ||
        element.tagName === 'SELECT' ||
        element.isContentEditable),
  )
}

function onKeydown(event: KeyboardEvent) {
  if (!open.value) {
    if (event.key === '=' && !isEditableTarget(event.target)) {
      event.preventDefault()
      openCalculator()
    }
    return
  }

  if (event.key === 'Escape') {
    event.preventDefault()
    closeCalculator()
    return
  }
  if (isEditableTarget(event.target)) return

  if (/^\d$/.test(event.key)) appendDigit(event.key)
  else if (event.key === '.' || event.key === ',') appendDecimal()
  else if (['+', '-', '*', '/'].includes(event.key)) appendOperator(event.key)
  else if (event.key === '(' || event.key === ')') {
    appendParenthesis(event.key)
  } else if (event.key === '%') appendPercent()
  else if (event.key === 'Backspace') backspace()
  else if (event.key === 'Delete') clearCalculator()
  else if (event.key === 'Enter' || event.key === '=') calculate()
  else return
  event.preventDefault()
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('resize', keepPanelOnScreen)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('resize', keepPanelOnScreen)
  if (copiedTimer) clearTimeout(copiedTimer)
})
</script>

<template>
  <div class="floating-calculator">
    <button
      type="button"
      class="floating-calculator__trigger"
      :aria-expanded="open"
      aria-controls="floating-calculator-panel"
      aria-label="Abrir calculadora"
      title="Calculadora (=)"
      @click="open ? closeCalculator() : openCalculator()"
    >
      <Calculator aria-hidden="true" />
    </button>

    <Teleport to="body">
      <section
        v-if="open"
        id="floating-calculator-panel"
        ref="panelRef"
        class="calculator-panel"
        :class="{ 'is-dragging': dragging }"
        :style="panelStyle"
        role="dialog"
        aria-label="Calculadora"
        tabindex="-1"
      >
        <header
          class="calculator-panel__header"
          @pointerdown="startDrag"
          @pointermove="moveDrag"
          @pointerup="stopDrag"
          @pointercancel="stopDrag"
        >
          <span class="calculator-panel__title">
            <Calculator aria-hidden="true" />
            Calculadora
          </span>
          <GripHorizontal class="calculator-panel__grip" aria-hidden="true" />
          <button
            type="button"
            aria-label="Fechar calculadora"
            @click="closeCalculator"
          >
            <X aria-hidden="true" />
          </button>
        </header>

        <div class="calculator-panel__display" aria-live="polite">
          <p class="calculator-panel__history">
            {{ previousExpression || 'Digite uma conta' }}
          </p>
          <p class="calculator-panel__expression numeric">
            {{ expression ? displayExpression(expression) : '0' }}
          </p>
          <p class="calculator-panel__result numeric">
            {{ result === null ? '—' : `= ${formatResult(result)}` }}
          </p>
        </div>

        <div class="calculator-panel__keys">
          <button type="button" class="is-utility" @click="clearCalculator">C</button>
          <button type="button" class="is-utility" @click="appendParenthesis('(')">(</button>
          <button type="button" class="is-utility" @click="appendParenthesis(')')">)</button>
          <button
            type="button"
            class="is-utility"
            aria-label="Apagar último caractere"
            @click="backspace"
          >
            <DeleteIcon aria-hidden="true" />
          </button>

          <button type="button" @click="appendDigit('7')">7</button>
          <button type="button" @click="appendDigit('8')">8</button>
          <button type="button" @click="appendDigit('9')">9</button>
          <button type="button" class="is-operator" @click="appendOperator('/')">÷</button>

          <button type="button" @click="appendDigit('4')">4</button>
          <button type="button" @click="appendDigit('5')">5</button>
          <button type="button" @click="appendDigit('6')">6</button>
          <button type="button" class="is-operator" @click="appendOperator('*')">×</button>

          <button type="button" @click="appendDigit('1')">1</button>
          <button type="button" @click="appendDigit('2')">2</button>
          <button type="button" @click="appendDigit('3')">3</button>
          <button type="button" class="is-operator" @click="appendOperator('-')">−</button>

          <button type="button" @click="appendDigit('0')">0</button>
          <button type="button" @click="appendDecimal">,</button>
          <button type="button" @click="appendPercent">%</button>
          <button type="button" class="is-operator" @click="appendOperator('+')">+</button>

          <button type="button" class="is-equals" @click="calculate">=</button>
        </div>

        <footer class="calculator-panel__footer">
          <span>Atalho: <kbd>=</kbd></span>
          <button
            type="button"
            :disabled="result === null"
            @click="copyResult"
          >
            <Check v-if="copied" aria-hidden="true" />
            <Copy v-else aria-hidden="true" />
            {{ copied ? 'Copiado' : 'Copiar resultado' }}
          </button>
        </footer>
      </section>
    </Teleport>
  </div>
</template>

<style scoped>
.floating-calculator {
  display: contents;
}

.floating-calculator__trigger {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  padding: 0;
  place-items: center;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-ink-muted);
  cursor: pointer;
  transition:
    background-color var(--transition-fast),
    color var(--transition-fast);
}

.floating-calculator__trigger:hover,
.floating-calculator__trigger[aria-expanded='true'] {
  background: var(--color-surface-subtle);
  color: var(--color-ink);
}

.floating-calculator__trigger svg {
  width: 1.1rem;
  height: 1.1rem;
}

.calculator-panel {
  position: fixed;
  top: calc(4.25rem + var(--space-3));
  right: max(var(--space-4), calc((100vw - var(--content-max)) / 2));
  z-index: 70;
  width: min(20rem, calc(100vw - var(--space-6)));
  overflow: hidden;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-lg);
  outline: none;
  background: var(--color-surface);
  color: var(--color-ink);
}

.calculator-panel__header {
  display: grid;
  min-height: 3rem;
  padding: 0 var(--space-3) 0 var(--space-4);
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  border-bottom: 1px solid var(--color-border);
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.calculator-panel.is-dragging .calculator-panel__header {
  cursor: grabbing;
}

.calculator-panel__title {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
}

.calculator-panel__grip {
  width: 1.1rem;
  height: 1.1rem;
  color: var(--color-ink-muted);
  opacity: 0.7;
}

.calculator-panel__title svg,
.calculator-panel__header button svg,
.calculator-panel__footer button svg {
  width: 1rem;
  height: 1rem;
}

.calculator-panel__header button {
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
  justify-self: end;
}

.calculator-panel__header button:hover {
  background: var(--color-surface-subtle);
  color: var(--color-ink);
}

.calculator-panel__display {
  min-height: 7.5rem;
  padding: var(--space-4);
  overflow: hidden;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface-subtle);
  text-align: right;
}

.calculator-panel__history {
  min-height: 1rem;
  overflow: hidden;
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.calculator-panel__expression {
  min-height: 2rem;
  margin-top: var(--space-2);
  overflow: hidden;
  font-size: var(--text-lg);
  font-weight: var(--weight-medium);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.calculator-panel__result {
  min-height: 1.75rem;
  margin-top: var(--space-1);
  overflow: hidden;
  color: var(--color-brand-ink);
  font-size: var(--text-xl);
  font-weight: var(--weight-bold);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.calculator-panel__keys {
  display: grid;
  padding: var(--space-3);
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-2);
}

.calculator-panel__keys button {
  display: grid;
  min-width: 0;
  height: 2.6rem;
  padding: 0;
  place-items: center;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-ink);
  font: inherit;
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  cursor: pointer;
  transition:
    background-color var(--transition-fast),
    border-color var(--transition-fast);
}

.calculator-panel__keys button:hover {
  border-color: var(--color-border-strong);
  background: var(--color-surface-subtle);
}

.calculator-panel__keys button.is-utility {
  background: var(--color-surface-subtle);
  color: var(--color-ink-secondary);
}

.calculator-panel__keys button.is-operator {
  border-color: color-mix(in srgb, var(--color-brand), transparent 70%);
  background: var(--color-brand-soft);
  color: var(--color-brand-ink);
}

.calculator-panel__keys button.is-equals {
  grid-column: 1 / -1;
  border-color: var(--color-brand);
  background: var(--color-brand);
  color: var(--color-white);
}

.calculator-panel__keys button svg {
  width: 1rem;
  height: 1rem;
}

.calculator-panel__footer {
  display: flex;
  min-height: 3rem;
  padding: 0 var(--space-3) 0 var(--space-4);
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  border-top: 1px solid var(--color-border);
}

.calculator-panel__footer > span {
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.calculator-panel__footer kbd {
  display: inline-grid;
  min-width: 1.25rem;
  height: 1.25rem;
  place-items: center;
  border: 1px solid var(--color-border);
  border-radius: 0.3rem;
  background: var(--color-surface-subtle);
  font-family: inherit;
  font-size: 0.6875rem;
}

.calculator-panel__footer button {
  display: inline-flex;
  min-height: 2rem;
  padding: 0 var(--space-2);
  align-items: center;
  gap: var(--space-2);
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-brand-ink);
  font: inherit;
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  cursor: pointer;
}

.calculator-panel__footer button:hover:not(:disabled) {
  background: var(--color-brand-soft);
}

.calculator-panel__footer button:disabled {
  color: var(--color-ink-muted);
  opacity: 0.55;
}

@media (max-width: 600px) {
  .calculator-panel {
    top: auto;
    right: var(--space-2);
    bottom: var(--space-2);
    left: var(--space-2);
    width: auto;
  }

  .calculator-panel__keys button {
    height: 2.75rem;
  }
}
</style>
