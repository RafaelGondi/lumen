<script setup lang="ts">
const props = defineProps<{
  value: number
}>()

const formatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
})

const parts = computed(() => {
  const raw = formatter.formatToParts(props.value)

  return {
    symbol: raw.find((part) => part.type === 'currency')?.value ?? 'R$',
    integer: raw
      .filter((part) => part.type === 'integer' || part.type === 'group')
      .map((part) => part.value)
      .join(''),
    decimals: raw
      .filter((part) => part.type === 'decimal' || part.type === 'fraction')
      .map((part) => part.value)
      .join(''),
  }
})
</script>

<template>
  <span class="ui-money numeric">
    <span class="ui-money__symbol">{{ parts.symbol }}</span>
    <span class="ui-money__integer">{{ parts.integer }}</span>
    <span class="ui-money__decimals">{{ parts.decimals }}</span>
  </span>
</template>

<style scoped>
.ui-money {
  display: inline-flex;
  align-items: baseline;
  white-space: nowrap;
}

.ui-money__symbol {
  margin-right: 0.3em;
  font-size: 0.62em;
  font-weight: var(--weight-medium);
  opacity: 0.62;
}

.ui-money__decimals {
  font-size: 0.72em;
  font-weight: var(--weight-medium);
  opacity: 0.62;
}
</style>
