<script setup lang="ts">
import { Banknote } from '@lucide/vue'
import type { AccountKind, BankKey } from '~/types/account'

withDefaults(
  defineProps<{
    kind?: AccountKind
    name: string
    color: string
    bankKey?: BankKey
    size?: 'md' | 'lg'
  }>(),
  {
    kind: 'bank',
    bankKey: 'custom',
    size: 'md',
  },
)
</script>

<template>
  <span
    v-if="kind === 'cash'"
    class="account-mark account-mark--cash"
    :class="`account-mark--${size}`"
    :style="{ background: color }"
    aria-hidden="true"
  >
    <Banknote />
  </span>
  <AccountsBankMark
    v-else
    :name="name"
    :color="color"
    :bank-key="bankKey"
    :size="size"
  />
</template>

<style scoped>
.account-mark {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  border-radius: var(--radius-sm);
  color: var(--color-white);
}

.account-mark--md {
  width: 2.5rem;
  height: 2.5rem;
}

.account-mark--lg {
  width: 2.75rem;
  height: 2.75rem;
}

.account-mark--cash :deep(svg) {
  width: 1.15rem;
  height: 1.15rem;
  color: var(--color-white);
  stroke: var(--color-white) !important;
}
</style>
