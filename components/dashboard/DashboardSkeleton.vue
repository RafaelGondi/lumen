<template>
  <div class="dashboard-skeleton" role="status" aria-label="Carregando dados">
    <span class="sr-only">Carregando dados financeiros</span>

    <div class="dashboard-skeleton__stats">
      <UiCard v-for="index in 4" :key="index" padding="md">
        <div class="dashboard-skeleton__line">
          <UiSkeleton width="44%" />
          <UiSkeleton width="2rem" height="2rem" radius="sm" />
        </div>
        <UiSkeleton
          width="72%"
          height="2rem"
          radius="sm"
          class="dashboard-skeleton__value"
        />
        <UiSkeleton width="40%" height="0.75rem" />
        <div class="dashboard-skeleton__details">
          <UiSkeleton width="38%" height="2.25rem" />
          <UiSkeleton width="42%" height="2.25rem" />
        </div>
      </UiCard>
    </div>

    <div class="dashboard-skeleton__carousel" aria-hidden="true">
      <UiCard padding="md">
        <div class="dashboard-skeleton__line">
          <UiSkeleton width="44%" />
          <UiSkeleton width="2rem" height="2rem" radius="sm" />
        </div>
        <UiSkeleton
          width="72%"
          height="2rem"
          radius="sm"
          class="dashboard-skeleton__value"
        />
        <UiSkeleton width="40%" height="0.75rem" />
        <div class="dashboard-skeleton__details">
          <UiSkeleton width="38%" height="2.25rem" />
          <UiSkeleton width="42%" height="2.25rem" />
        </div>
      </UiCard>
      <div class="dashboard-skeleton__dots">
        <span /><span /><span /><span />
      </div>
    </div>

    <div class="dashboard-skeleton__lists">
      <UiCard v-for="index in 2" :key="index" padding="none">
        <div class="dashboard-skeleton__list-header">
          <UiSkeleton width="9rem" height="1.25rem" />
          <UiSkeleton width="4rem" height="2rem" />
        </div>
        <div
          v-for="row in 3"
          :key="row"
          class="dashboard-skeleton__list-row"
        >
          <UiSkeleton width="2.25rem" height="2.25rem" radius="sm" />
          <div>
            <UiSkeleton width="9rem" />
            <UiSkeleton width="12rem" height="0.65rem" />
          </div>
          <UiSkeleton width="5rem" />
        </div>
      </UiCard>
    </div>
  </div>
</template>

<style scoped>
.dashboard-skeleton__stats,
.dashboard-skeleton__lists {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-4);
}

.dashboard-skeleton__carousel {
  display: none;
}

.dashboard-skeleton__stats :deep(.ui-card) {
  min-height: 15.5rem;
}

.dashboard-skeleton__line {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.dashboard-skeleton__value {
  margin: var(--space-5) 0 var(--space-3);
}

.dashboard-skeleton__details {
  display: flex;
  padding-top: var(--space-5);
  margin-top: var(--space-5);
  justify-content: space-between;
  border-top: 1px solid var(--color-border);
}

.dashboard-skeleton__lists {
  margin-top: var(--space-5);
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.dashboard-skeleton__list-header {
  display: flex;
  min-height: 5.25rem;
  padding: var(--space-5) var(--space-6);
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--color-border);
}

.dashboard-skeleton__list-row {
  display: grid;
  min-height: 4.75rem;
  padding: var(--space-3) var(--space-5);
  grid-template-columns: 2.25rem 1fr 5rem;
  align-items: center;
  gap: var(--space-3);
  border-bottom: 1px solid var(--color-border);
}

.dashboard-skeleton__list-row div {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

@media (max-width: 900px) {
  .dashboard-skeleton__stats {
    display: none;
  }

  .dashboard-skeleton__carousel {
    display: block;
  }

  .dashboard-skeleton__carousel :deep(.ui-card) {
    min-height: 0;
  }

  .dashboard-skeleton__dots {
    display: flex;
    margin-top: var(--space-3);
    justify-content: center;
    gap: 0.4rem;
  }

  .dashboard-skeleton__dots span {
    width: 0.45rem;
    height: 0.45rem;
    border-radius: 999px;
    background: var(--color-border-strong);
  }

  .dashboard-skeleton__dots span:first-child {
    width: 1.1rem;
    background: var(--color-brand);
  }

  .dashboard-skeleton__lists {
    grid-template-columns: 1fr;
  }
}
</style>
