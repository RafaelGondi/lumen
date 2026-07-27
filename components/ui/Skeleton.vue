<script setup lang="ts">
/** Delega ao AkShimmer — mesma API (width/height/radius). */
withDefaults(
  defineProps<{
    width?: string
    height?: string
    radius?: 'sm' | 'md' | 'lg'
  }>(),
  {
    width: '100%',
    height: '1rem',
    radius: 'sm',
  },
)
</script>

<template>
  <AkShimmer :width="width" :height="height" :radius="radius" />
</template>
