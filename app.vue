<script setup lang="ts">
import { Bell, CircleHelp } from '@lucide/vue'

const route = useRoute()

const navigation = [
  { label: 'Visão geral', to: '/' },
  { label: 'Lançamentos', to: '/lancamentos' },
  { label: 'Categorias', to: '/categorias' },
  { label: 'Contas', to: '/contas' },
  { label: 'Cartões', to: '/cartoes' },
  { label: 'Relatórios', to: '/relatorios' },
]

function isActive(to: string) {
  if (to === '/') return route.path === '/'
  return route.path === to || route.path.startsWith(`${to}/`)
}
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <div class="topbar__inner">
        <NuxtLink class="brand" to="/" aria-label="Lumen, início">
          <span class="brand__mark" aria-hidden="true">L</span>
          <span class="brand__name">LUMEN</span>
        </NuxtLink>

        <nav class="main-nav" aria-label="Navegação principal">
          <template v-for="item in navigation" :key="item.label">
            <NuxtLink
              v-if="item.to"
              :to="item.to"
              :class="{ 'main-nav__item--active': isActive(item.to) }"
            >
              {{ item.label }}
            </NuxtLink>
            <a v-else href="#" class="main-nav__item--disabled" @click.prevent>
              {{ item.label }}
            </a>
          </template>
        </nav>

        <div class="topbar__actions">
          <button type="button" aria-label="Ajuda">
            <CircleHelp aria-hidden="true" />
          </button>
          <button class="notification-button" type="button" aria-label="Notificações">
            <Bell aria-hidden="true" />
            <span aria-hidden="true" />
          </button>
          <div class="account">
            <span class="account__avatar">RM</span>
            <div>
              <strong>Rafael Martins</strong>
              <span>Soliê Tecnologia</span>
            </div>
          </div>
        </div>
      </div>
    </header>

    <main class="page">
      <NuxtPage />
    </main>
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
}

.topbar {
  height: 4.25rem;
  background: var(--color-nav);
  color: var(--color-white);
}

.topbar__inner {
  display: flex;
  width: min(calc(100% - var(--space-12)), var(--content-max));
  height: 100%;
  margin: 0 auto;
  align-items: stretch;
}

.brand {
  display: flex;
  width: 11.5rem;
  align-items: center;
  gap: var(--space-3);
}

.brand__mark {
  display: grid;
  width: 1.875rem;
  height: 1.875rem;
  place-items: center;
  border: 1px solid rgb(255 255 255 / 22%);
  border-radius: var(--radius-sm);
  background: #1f5da3;
  font-size: var(--text-sm);
  font-weight: var(--weight-bold);
}

.brand__name {
  font-size: var(--text-sm);
  font-weight: var(--weight-bold);
  letter-spacing: 0.16em;
}

.main-nav {
  display: flex;
  align-items: stretch;
  gap: var(--space-6);
}

.main-nav a {
  position: relative;
  display: flex;
  align-items: center;
  color: var(--color-nav-muted);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  transition: color var(--transition-fast);
}

.main-nav a:hover {
  color: var(--color-white);
}

.main-nav__item--active {
  color: var(--color-white) !important;
}

.main-nav__item--active::after {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 2px;
  background: #5f96d6;
  content: "";
}

.main-nav__item--disabled {
  opacity: 0.6;
  cursor: default;
}

.topbar__actions {
  display: flex;
  margin-left: auto;
  align-items: center;
  gap: var(--space-2);
}

.topbar__actions > button {
  position: relative;
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  padding: 0;
  place-items: center;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-nav-muted);
  cursor: pointer;
}

.topbar__actions > button:hover {
  background: rgb(255 255 255 / 7%);
  color: var(--color-white);
}

.topbar__actions > button svg {
  width: 1.1rem;
  height: 1.1rem;
}

.notification-button span {
  position: absolute;
  top: 0.45rem;
  right: 0.45rem;
  width: 0.4rem;
  height: 0.4rem;
  border: 2px solid var(--color-nav);
  border-radius: 50%;
  background: #e6a548;
}

.account {
  display: flex;
  min-width: 12rem;
  padding-left: var(--space-4);
  margin-left: var(--space-2);
  align-items: center;
  gap: var(--space-3);
  border-left: 1px solid rgb(255 255 255 / 12%);
}

.account__avatar {
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border-radius: var(--radius-sm);
  background: #e8eef6;
  color: var(--color-brand-ink);
  font-size: 0.6875rem;
  font-weight: var(--weight-bold);
}

.account div {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.account strong {
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
}

.account div span {
  color: var(--color-nav-muted);
  font-size: 0.625rem;
}

.page {
  width: min(calc(100% - var(--space-12)), var(--content-max));
  padding: var(--space-8) 0 var(--space-12);
  margin: 0 auto;
}
</style>
