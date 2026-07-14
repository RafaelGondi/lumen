<script setup lang="ts">
import type { Component } from 'vue'
import {
  Landmark,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from '@lucide/vue'
import type { FinancialStat } from '~/types/finance'

const props = defineProps<{
  previousBalance: FinancialStat
  revenues: FinancialStat
  expenses: FinancialStat
  currentBalance: FinancialStat
}>()

type StatSlide = {
  key: string
  stat: FinancialStat
  icon: Component
}

/** Ordem desktop (original). */
const desktopSlides = computed<StatSlide[]>(() => [
  { key: 'previous', stat: props.previousBalance, icon: Landmark },
  { key: 'revenues', stat: props.revenues, icon: TrendingUp },
  { key: 'expenses', stat: props.expenses, icon: TrendingDown },
  { key: 'current', stat: props.currentBalance, icon: WalletCards },
])

/** No mobile: atual → receitas → despesas → saldo anterior. */
const mobileSlides = computed<StatSlide[]>(() => [
  { key: 'current', stat: props.currentBalance, icon: WalletCards },
  { key: 'revenues', stat: props.revenues, icon: TrendingUp },
  { key: 'expenses', stat: props.expenses, icon: TrendingDown },
  { key: 'previous', stat: props.previousBalance, icon: Landmark },
])

const trackRef = ref<HTMLElement | null>(null)
const activeIndex = ref(0)

function syncActiveFromScroll() {
  const track = trackRef.value
  if (!track) return
  const slide = track.querySelector('.stats-carousel__slide') as HTMLElement | null
  if (!slide) return
  const gap = Number.parseFloat(getComputedStyle(track).columnGap || '0') || 0
  const step = slide.offsetWidth + gap
  if (step <= 0) return
  activeIndex.value = Math.min(
    mobileSlides.value.length - 1,
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
  () =>
    [
      props.currentBalance.value,
      props.previousBalance.value,
      props.revenues.value,
      props.expenses.value,
    ].join('|'),
  () => {
    activeIndex.value = 0
    nextTick(() => {
      trackRef.value?.scrollTo({ left: 0 })
    })
  },
)
</script>

<template>
  <div class="stats-cards">
    <div class="stats-grid">
      <UiStatCard
        v-for="slide in desktopSlides"
        :key="`desktop-${slide.key}`"
        :stat="slide.stat"
      >
        <template #icon>
          <component :is="slide.icon" />
        </template>
      </UiStatCard>
    </div>

    <div class="stats-carousel" aria-roledescription="carrossel">
      <div
        ref="trackRef"
        class="stats-carousel__track"
        tabindex="0"
        aria-label="Resumo financeiro"
        @scroll.passive="syncActiveFromScroll"
      >
        <div
          v-for="(slide, index) in mobileSlides"
          :key="`mobile-${slide.key}`"
          class="stats-carousel__slide"
          :aria-hidden="index !== activeIndex"
        >
          <UiStatCard :stat="slide.stat">
            <template #icon>
              <component :is="slide.icon" />
            </template>
          </UiStatCard>
        </div>
      </div>

      <div class="stats-carousel__dots" role="tablist" aria-label="Cards do resumo">
        <button
          v-for="(slide, index) in mobileSlides"
          :key="`dot-${slide.key}`"
          type="button"
          class="stats-carousel__dot"
          :class="{ 'is-active': index === activeIndex }"
          role="tab"
          :aria-selected="index === activeIndex"
          :aria-label="slide.stat.label"
          @click="goToSlide(index)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-4);
}

.stats-carousel {
  display: none;
}

@media (max-width: 900px) {
  .stats-grid {
    display: none;
  }

  .stats-carousel {
    display: block;
  }

  .stats-carousel__track {
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

  .stats-carousel__track::-webkit-scrollbar {
    display: none;
  }

  .stats-carousel__slide {
    flex: 0 0 min(88%, 22rem);
    scroll-snap-align: center;
    min-width: 0;
  }

  .stats-carousel__slide :deep(.stat-card) {
    min-height: 0;
    height: 100%;
  }

  .stats-carousel__dots {
    display: flex;
    margin-top: var(--space-3);
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
  }

  .stats-carousel__dot {
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

  .stats-carousel__dot.is-active {
    width: 1.1rem;
    background: var(--color-brand);
  }
}
</style>
