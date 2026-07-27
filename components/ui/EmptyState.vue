<script setup lang="ts">
/**
 * Delega ao AkEmptyState — a API já era idêntica (title/description +
 * slots icon/action), então as chamadas existentes seguem valendo.
 */
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <AkEmptyState :title="title" :description="description">
    <template v-if="$slots.icon" #icon><slot name="icon" /></template>
    <template v-if="$slots.action" #action><slot name="action" /></template>
  </AkEmptyState>
</template>
