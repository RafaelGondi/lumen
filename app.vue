<script setup lang="ts">
import { Bell, CircleHelp, Menu, X } from '@lucide/vue'

const route = useRoute()
const menuOpen = ref(false)

const navigation = [
  { label: 'Visão geral', to: '/' },
  { label: 'Lançamentos', to: '/lancamentos' },
  { label: 'Categorias', to: '/categorias' },
  { label: 'Limites', to: '/limites' },
  { label: 'Contas', to: '/contas' },
  { label: 'Cartões', to: '/cartoes' },
  { label: 'Relatórios', to: '/relatorios' },
]

function isActive(to: string) {
  if (to === '/') return route.path === '/'
  return route.path === to || route.path.startsWith(`${to}/`)
}

function closeMenu() {
  menuOpen.value = false
}

watch(
  () => route.fullPath,
  () => {
    menuOpen.value = false
  },
)

watch(menuOpen, (open) => {
  if (!import.meta.client) return
  document.body.style.overflow = open ? 'hidden' : ''
})

onBeforeUnmount(() => {
  if (!import.meta.client) return
  document.body.style.overflow = ''
})
</script>

<template>
  <div class="app-shell" :class="{ 'app-shell--menu-open': menuOpen }">
    <header class="topbar">
      <div class="topbar__inner">
        <button
          type="button"
          class="topbar__menu-btn"
          :aria-expanded="menuOpen"
          aria-controls="mobile-nav"
          :aria-label="menuOpen ? 'Fechar menu' : 'Abrir menu'"
          @click="menuOpen = !menuOpen"
        >
          <X v-if="menuOpen" aria-hidden="true" />
          <Menu v-else aria-hidden="true" />
        </button>

        <NuxtLink class="brand" to="/" aria-label="Lumen, início" @click="closeMenu">
          <span class="brand__mark" aria-hidden="true">L</span>
          <span class="brand__name">LUMEN</span>
        </NuxtLink>

        <nav class="main-nav" aria-label="Navegação principal">
          <NuxtLink
            v-for="item in navigation"
            :key="item.label"
            :to="item.to"
            :class="{ 'main-nav__item--active': isActive(item.to) }"
          >
            {{ item.label }}
          </NuxtLink>
        </nav>

        <div class="topbar__actions">
          <SearchGlobalSearch />
          <button type="button" class="topbar__icon-btn topbar__icon-btn--desktop" aria-label="Ajuda">
            <CircleHelp aria-hidden="true" />
          </button>
          <button
            class="notification-button topbar__icon-btn topbar__icon-btn--desktop"
            type="button"
            aria-label="Notificações"
          >
            <Bell aria-hidden="true" />
            <span aria-hidden="true" />
          </button>
          <div class="account">
            <span class="account__avatar">RM</span>
            <div class="account__meta">
              <strong>Rafael Martins</strong>
              <span>Soliê Tecnologia</span>
            </div>
          </div>
        </div>
      </div>
    </header>

    <Teleport to="body">
      <div
        v-if="menuOpen"
        class="mobile-nav-backdrop"
        aria-hidden="true"
        @click="closeMenu"
      />
      <nav
        v-if="menuOpen"
        id="mobile-nav"
        class="mobile-nav"
        aria-label="Menu"
      >
        <NuxtLink
          v-for="item in navigation"
          :key="item.label"
          :to="item.to"
          class="mobile-nav__link"
          :class="{ 'mobile-nav__link--active': isActive(item.to) }"
          @click="closeMenu"
        >
          {{ item.label }}
        </NuxtLink>
      </nav>
    </Teleport>

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
  position: sticky;
  top: 0;
  z-index: 40;
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
  gap: var(--space-3);
}

.topbar__menu-btn {
  display: none;
  width: 2.5rem;
  height: 2.5rem;
  margin: auto 0;
  padding: 0;
  flex-shrink: 0;
  place-items: center;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-white);
}

.topbar__menu-btn svg {
  width: 1.25rem;
  height: 1.25rem;
}

.brand {
  display: flex;
  width: 11.5rem;
  flex-shrink: 0;
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

.topbar__actions {
  display: flex;
  margin-left: auto;
  align-items: center;
  gap: var(--space-2);
}

.topbar__icon-btn {
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

.topbar__icon-btn:hover {
  background: rgb(255 255 255 / 7%);
  color: var(--color-white);
}

.topbar__icon-btn svg {
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
  flex-shrink: 0;
  place-items: center;
  border-radius: var(--radius-sm);
  background: #e8eef6;
  color: var(--color-brand-ink);
  font-size: 0.6875rem;
  font-weight: var(--weight-bold);
}

.account__meta {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.account__meta strong {
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
}

.account__meta span {
  color: var(--color-nav-muted);
  font-size: 0.625rem;
}

.page {
  width: min(calc(100% - var(--space-12)), var(--content-max));
  padding: var(--space-8) 0 var(--space-12);
  margin: 0 auto;
}

.mobile-nav-backdrop {
  display: none;
}

.mobile-nav {
  display: none;
}

@media (max-width: 900px) {
  .topbar__inner {
    width: min(calc(100% - var(--space-6)), var(--content-max));
    align-items: center;
  }

  .topbar__menu-btn {
    display: grid;
  }

  .brand {
    width: auto;
  }

  .main-nav,
  .topbar__icon-btn--desktop,
  .account__meta {
    display: none;
  }

  .account {
    min-width: 0;
    padding-left: 0;
    margin-left: 0;
    border-left: 0;
  }

  .page {
    width: min(calc(100% - var(--space-6)), var(--content-max));
    padding: var(--space-5) 0 var(--space-10);
  }

  .mobile-nav-backdrop {
    display: block;
    position: fixed;
    inset: 4.25rem 0 0;
    z-index: 45;
    background: rgb(15 23 42 / 45%);
  }

  .mobile-nav {
    display: flex;
    position: fixed;
    top: 4.25rem;
    left: 0;
    z-index: 50;
    width: min(20rem, 88vw);
    max-height: calc(100vh - 4.25rem);
    padding: var(--space-3);
    flex-direction: column;
    gap: 0.25rem;
    overflow: auto;
    border-right: 1px solid var(--color-border);
    background: var(--color-surface);
    box-shadow: var(--shadow-md);
  }

  .mobile-nav__link {
    display: flex;
    min-height: 2.75rem;
    padding: 0 var(--space-4);
    align-items: center;
    border-radius: var(--radius-sm);
    color: var(--color-ink-secondary);
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
  }

  .mobile-nav__link--active {
    background: var(--color-brand-soft);
    color: var(--color-brand-ink);
    font-weight: var(--weight-semibold);
  }
}

@media (max-width: 480px) {
  .topbar__inner,
  .page {
    width: min(calc(100% - var(--space-4)), var(--content-max));
  }

  .brand__name {
    letter-spacing: 0.12em;
  }
}
</style>
