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
    sign: raw.find((part) => part.type === 'minusSign')?.value ?? '',
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
    <span v-if="parts.sign" class="ui-money__sign">{{ parts.sign }}</span>
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
  /*
   * 0.62em sozinho fica ilegível sobre texto pequeno (ex.: 6.8px sobre
   * --text-2xs). max() mantém a proporção em textos grandes mas nunca cai
   * abaixo do menor tamanho da escala do Akoma.
   */
  font-size: max(var(--text-2xs), 0.62em);
  font-weight: var(--weight-medium);
  opacity: 0.62;
}

.ui-money__sign {
  margin-right: 0.18em;
}

.ui-money__decimals {
  font-size: max(var(--text-2xs), 0.72em);
  font-weight: var(--weight-medium);
  opacity: 0.62;
}
</style>
