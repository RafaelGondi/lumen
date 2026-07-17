<script setup lang="ts" generic="T">
const props = withDefaults(
  defineProps<{
    items: readonly T[]
    getKey: (item: T, index: number) => string | number
    ariaLabel?: string
    dotsLabel?: string
    columns?: number
    circular?: boolean
  }>(),
  {
    ariaLabel: 'Lista',
    dotsLabel: 'Itens',
    columns: 3,
    circular: false,
  },
)

type DisplaySlide = {
  item: T
  realIndex: number
  slideKey: string | number
  isClone: boolean
}

const MOBILE_QUERY = '(max-width: 900px)'

const trackRef = ref<HTMLElement | null>(null)
const activeIndex = ref(0)
const isMobileCarousel = ref(false)
let scrollEndTimer: ReturnType<typeof setTimeout> | null = null
let suppressScrollSync = false

const circularActive = computed(
  () => props.circular && props.items.length > 1 && isMobileCarousel.value,
)

const displaySlides = computed<DisplaySlide[]>(() => {
  const slides: DisplaySlide[] = props.items.map((item, index) => ({
    item,
    realIndex: index,
    slideKey: props.getKey(item, index),
    isClone: false,
  }))

  if (!circularActive.value) return slides

  const lastIndex = props.items.length - 1
  const last = props.items[lastIndex]!
  const first = props.items[0]!

  return [
    {
      item: last,
      realIndex: lastIndex,
      slideKey: `clone-before-${props.getKey(last, lastIndex)}`,
      isClone: true,
    },
    ...slides,
    {
      item: first,
      realIndex: 0,
      slideKey: `clone-after-${props.getKey(first, 0)}`,
      isClone: true,
    },
  ]
})

function getStep(track: HTMLElement) {
  const slide = track.querySelector('.snap-carousel__slide') as HTMLElement | null
  if (!slide) return 0
  const gap = Number.parseFloat(getComputedStyle(track).columnGap || '0') || 0
  return slide.offsetWidth + gap
}

function syncActiveFromScroll() {
  if (suppressScrollSync) return

  const track = trackRef.value
  if (!track) return

  const step = getStep(track)
  if (step <= 0) return

  const displayIndex = Math.min(
    displaySlides.value.length - 1,
    Math.max(0, Math.round(track.scrollLeft / step)),
  )
  const slide = displaySlides.value[displayIndex]
  if (slide) activeIndex.value = slide.realIndex

  scheduleScrollEnd()
}

function scheduleScrollEnd() {
  if (!circularActive.value) return
  if (scrollEndTimer) clearTimeout(scrollEndTimer)
  scrollEndTimer = setTimeout(handleScrollEnd, 120)
}

function handleScrollEnd() {
  if (!circularActive.value) return

  const track = trackRef.value
  if (!track) return

  const step = getStep(track)
  if (step <= 0) return

  const displayIndex = Math.round(track.scrollLeft / step)
  const lastDisplayIndex = displaySlides.value.length - 1

  if (displayIndex <= 0) {
    scrollToDisplayIndex(props.items.length, false)
    return
  }

  if (displayIndex >= lastDisplayIndex) {
    scrollToDisplayIndex(1, false)
  }
}

function scrollToDisplayIndex(displayIndex: number, smooth = true) {
  const track = trackRef.value
  if (!track) return

  const slide = track.children[displayIndex] as HTMLElement | undefined
  if (!slide) return

  suppressScrollSync = true
  track.scrollTo({
    left: slide.offsetLeft,
    behavior: smooth ? 'smooth' : 'auto',
  })

  const slideMeta = displaySlides.value[displayIndex]
  if (slideMeta) activeIndex.value = slideMeta.realIndex

  if (!smooth) {
    requestAnimationFrame(() => {
      suppressScrollSync = false
    })
    return
  }

  window.setTimeout(() => {
    suppressScrollSync = false
  }, 350)
}

function goToSlide(index: number) {
  if (circularActive.value) {
    scrollToDisplayIndex(index + 1, true)
    return
  }

  const track = trackRef.value
  if (!track) return

  const slide = track.children[index] as HTMLElement | undefined
  if (!slide) return

  track.scrollTo({ left: slide.offsetLeft, behavior: 'smooth' })
  activeIndex.value = index
}

function initializeScroll() {
  nextTick(() => {
    const track = trackRef.value
    if (!track) return

    if (circularActive.value) {
      scrollToDisplayIndex(1, false)
      return
    }

    track.scrollTo({ left: 0 })
    activeIndex.value = 0
  })
}

function setupMobileQuery() {
  if (!import.meta.client) return

  const mediaQuery = window.matchMedia(MOBILE_QUERY)
  const update = () => {
    isMobileCarousel.value = mediaQuery.matches
    initializeScroll()
  }

  update()
  mediaQuery.addEventListener('change', update)

  onUnmounted(() => {
    mediaQuery.removeEventListener('change', update)
    if (scrollEndTimer) clearTimeout(scrollEndTimer)
  })
}

onMounted(setupMobileQuery)

watch(
  () => props.items.map((item, index) => props.getKey(item, index)).join('|'),
  () => {
    activeIndex.value = 0
    initializeScroll()
  },
)

watch(circularActive, () => initializeScroll())
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
      @scrollend="handleScrollEnd"
    >
      <div
        v-for="slide in displaySlides"
        :key="slide.slideKey"
        class="snap-carousel__slide"
        :class="{ 'snap-carousel__slide--clone': slide.isClone }"
        :aria-hidden="slide.isClone || slide.realIndex !== activeIndex"
      >
        <slot :item="slide.item" :index="slide.realIndex" />
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
