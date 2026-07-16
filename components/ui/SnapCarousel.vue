<script setup lang="ts" generic="T">
const props = withDefaults(
  defineProps<{
    items: readonly T[]
    getKey: (item: T, index: number) => string | number
    ariaLabel?: string
    dotsLabel?: string
    columns?: number
  }>(),
  {
    ariaLabel: 'Lista',
    dotsLabel: 'Itens',
    columns: 3,
  },
)

const trackRef = ref<HTMLElement | null>(null)
const activeIndex = ref(0)

function syncActiveFromScroll() {
  const track = trackRef.value
  if (!track) return
  const slide = track.querySelector('.snap-carousel__slide') as HTMLElement | null
  if (!slide) return
  const gap = Number.parseFloat(getComputedStyle(track).columnGap || '0') || 0
  const step = slide.offsetWidth + gap
  if (step <= 0) return
  activeIndex.value = Math.min(
    props.items.length - 1,
    Math.max(0, Math.round(track.scrollLeft / step)),
  )
}

function goToSlide(index: number) {
  const track = trackRef.value
  if (!track) return
  const slide = track.children[index] as HTMLElement | undefined
  if (!slide) return
  track.scrollTo({ left: slide.offsetLeft, behavior: 'smooth' })
  activeIndex.value = index
}

watch(
  () => props.items.map((item, index) => props.getKey(item, index)).join('|'),
  () => {
    activeIndex.value = 0
    nextTick(() => {
      trackRef.value?.scrollTo({ left: 0 })
    })
  },
)
</script>

<template>
  <div
    class="snap-carousel"
    :style="{ '--snap-cols': String(columns) }"
    aria-roledescription="carrossel"
  >
    <div
      ref="trackRef"
      class="snap-carousel__track"
      tabindex="0"
      :aria-label="ariaLabel"
      @scroll.passive="syncActiveFromScroll"
    >
      <div
        v-for="(item, index) in items"
        :key="getKey(item, index)"
        class="snap-carousel__slide"
      >
        <slot :item="item" :index="index" />
      </div>
    </div>

    <div
      v-if="items.length > 1"
      class="snap-carousel__dots"
      role="tablist"
      :aria-label="dotsLabel"
    >
      <button
        v-for="(item, index) in items"
        :key="`dot-${getKey(item, index)}`"
        type="button"
        class="snap-carousel__dot"
        :class="{ 'is-active': index === activeIndex }"
        role="tab"
        :aria-selected="index === activeIndex"
        :aria-label="`Item ${index + 1}`"
        @click="goToSlide(index)"
      />
    </div>
  </div>
</template>

<style scoped>
.snap-carousel__track {
  display: grid;
  grid-template-columns: repeat(var(--snap-cols, 3), minmax(0, 1fr));
  gap: var(--space-4);
}

.snap-carousel__slide {
  min-width: 0;
}

.snap-carousel__slide > :deep(*) {
  height: 100%;
}

.snap-carousel__dots {
  display: none;
}

@media (max-width: 900px) {
  .snap-carousel__track {
    display: flex;
    gap: var(--space-3);
    overflow-x: auto;
    padding: 0.15rem var(--space-1) var(--space-2);
    margin: 0 calc(-1 * var(--space-1));
    scroll-snap-type: x mandatory;
    scroll-padding-inline: var(--space-1);
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }

  .snap-carousel__track::-webkit-scrollbar {
    display: none;
  }

  .snap-carousel__slide {
    flex: 0 0 min(88%, 22rem);
    scroll-snap-align: center;
  }

  .snap-carousel__dots {
    display: flex;
    margin-top: var(--space-3);
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
  }

  .snap-carousel__dot {
    width: 0.45rem;
    height: 0.45rem;
    padding: 0;
    border: 0;
    border-radius: 999px;
    background: var(--color-border-strong);
    cursor: pointer;
    transition:
      width var(--transition-fast),
      background-color var(--transition-fast);
  }

  .snap-carousel__dot.is-active {
    width: 1.1rem;
    background: var(--color-brand);
  }
}
</style>
