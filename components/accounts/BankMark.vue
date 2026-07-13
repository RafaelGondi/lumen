<script setup lang="ts">
import { svgBanco } from '@edusites/bancos-brasil'
import type { BankKey } from '~/types/account'
import { BANK_LOGO_SVG } from '~/utils/bankLogos'

const props = withDefaults(
  defineProps<{
    name: string
    color: string
    bankKey?: BankKey
    size?: 'md' | 'lg'
    /**
     * Usa `color` como fundo e remove o fundo embutido do logo do banco,
     * para exibir o ícone sobre a cor do cartão (ou outra cor customizada).
     */
    tint?: boolean
  }>(),
  {
    bankKey: 'custom',
    size: 'md',
    tint: false,
  },
)

const LOGO_NAMES: Partial<Record<BankKey, string>> = {
  itau: 'itau',
  bradesco: 'bradesco',
  bb: 'bancodobrasil',
  caixa: 'caixa',
  inter: 'inter',
  btg: 'btg',
  picpay: 'picpay',
}

const svg = ref('')
const failed = ref(false)

const pixelSize = computed(() => (props.size === 'lg' ? 44 : 40))
const localLogo = computed(() => BANK_LOGO_SVG[props.bankKey] ?? null)
const hasLogo = computed(
  () => Boolean(localLogo.value) || (!failed.value && Boolean(svg.value)),
)

function isLight(hex: string) {
  const value = hex.replace('#', '')
  const r = Number.parseInt(value.slice(0, 2), 16)
  const g = Number.parseInt(value.slice(2, 4), 16)
  const b = Number.parseInt(value.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255

  return luminance > 0.65
}

watch(
  () => [props.bankKey, pixelSize.value, localLogo.value] as const,
  async ([key, size, local], _, onCleanup) => {
    let cancelled = false
    onCleanup(() => {
      cancelled = true
    })

    svg.value = ''
    failed.value = false

    if (local) {
      // Asset local preenchido — não usa o traço fino da biblioteca.
      return
    }

    const logoName = LOGO_NAMES[key]
    failed.value = !logoName

    if (!logoName) return

    try {
      const markup = await svgBanco({
        nome: logoName,
        formato: 'quadrado',
        tamanho: size,
      })

      if (cancelled) return

      svg.value = markup
      failed.value = !markup
    } catch {
      if (cancelled) return
      failed.value = true
      svg.value = ''
    }
  },
  { immediate: true },
)
</script>

<template>
  <span
    class="bank-mark"
    :class="[
      `bank-mark--${size}`,
      {
        'bank-mark--light': !hasLogo && isLight(color),
        'bank-mark--logo': hasLogo && !tint,
        'bank-mark--tint': tint,
        'bank-mark--tint-light': tint && isLight(color),
      },
    ]"
    :style="!hasLogo || tint ? { background: color } : undefined"
    aria-hidden="true"
  >
    <span
      v-if="localLogo"
      class="bank-mark__logo"
      v-html="localLogo"
    />
    <span
      v-else-if="!failed && svg"
      class="bank-mark__logo"
      v-html="svg"
    />
    <template v-else>{{ bankInitials(name) }}</template>
  </span>
</template>

<style scoped>
.bank-mark {
  display: grid;
  flex-shrink: 0;
  overflow: hidden;
  place-items: center;
  border-radius: var(--radius-sm);
  color: var(--color-white);
  font-weight: var(--weight-semibold);
  letter-spacing: 0.02em;
}

.bank-mark--md {
  width: 2.5rem;
  height: 2.5rem;
  font-size: 0.6875rem;
}

.bank-mark--lg {
  width: 2.75rem;
  height: 2.75rem;
  font-size: 0.75rem;
}

.bank-mark--light {
  color: var(--color-ink);
}

.bank-mark--logo {
  background: transparent;
}

.bank-mark--tint .bank-mark__logo :deep(svg > rect:first-child) {
  fill: none !important;
}

/* Logos claros sobre fundo claro → escurece o símbolo. */
.bank-mark--tint-light .bank-mark__logo {
  filter: brightness(0);
}

.bank-mark__logo {
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
}

.bank-mark__logo :deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
