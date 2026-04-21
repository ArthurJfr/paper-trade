<script setup lang="ts">
const config = useRuntimeConfig()
const router = useRouter()
const route = useRoute()

// Hydrate les stores marché + portefeuille (SSR) et ouvre la WebSocket Binance (client).
const { store: marketStore } = await useMarket()
await usePortfolio()
const portfolio = usePortfolioStore()

const nav = [
  { to: '/',          label: 'Dashboard',    icon: 'ph:chart-line-up-bold' },
  { to: '/market',    label: 'Marché',       icon: 'ph:squares-four-bold' },
  { to: '/portfolio', label: 'Portefeuille', icon: 'ph:wallet-bold', beta: true },
  { to: '/journal',   label: 'Journal',      icon: 'ph:notebook-bold', beta: true },
  { to: '/settings',  label: 'Réglages',     icon: 'ph:gear-six-bold', beta: true },
] as const

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(n)

const equityLabel = computed(() => fmtCurrency(portfolio.equity))
const perfPct = computed(() => portfolio.performancePct)
const perfTrend = computed(() => trendOf(perfPct.value))

const searchQuery = ref('')
const searchInput = ref<HTMLInputElement | null>(null)
const theme = ref<'dark' | 'light'>('dark')

const marketAssets = computed(() => marketStore.taxonomy.assets)

function isCurrentNav(to: string) {
  if (to === '/market') return route.path === '/market' || route.path.startsWith('/token/')
  return route.path === to
}

function focusSearch() {
  searchInput.value?.focus()
  searchInput.value?.select()
}

function resolveSearch(input: string) {
  const q = input.trim().toLowerCase()
  if (!q) return []
  return marketAssets.value.filter((a) =>
    a.symbol.toLowerCase() === q
    || a.pair.toLowerCase() === q
    || a.name.toLowerCase() === q
    || a.symbol.toLowerCase().includes(q)
    || a.pair.toLowerCase().includes(q)
    || a.name.toLowerCase().includes(q),
  )
}

async function submitSearch() {
  const q = searchQuery.value.trim()
  if (!q) return
  const matches = resolveSearch(q)
  if (matches.length === 1) {
    await router.push(`/token/${matches[0]!.pair}`)
    return
  }
  await router.push({ path: '/market', query: { q } })
}

onMounted(() => {
  const savedTheme = localStorage.getItem('paper-trade-theme')
  if (savedTheme === 'light' || savedTheme === 'dark') {
    theme.value = savedTheme
  } else {
    theme.value = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  }
  document.documentElement.setAttribute('data-theme', theme.value)

  const onKeydown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null
    const typingInInput = !!target && (
      target.tagName === 'INPUT'
      || target.tagName === 'TEXTAREA'
      || target.isContentEditable
    )
    if (typingInInput) return
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      focusSearch()
      return
    }
    if (e.key === '/') {
      e.preventDefault()
      focusSearch()
    }
  }
  window.addEventListener('keydown', onKeydown)
  onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
})

function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  document.documentElement.setAttribute('data-theme', theme.value)
  localStorage.setItem('paper-trade-theme', theme.value)
}
</script>

<template>
  <div class="app">
    <aside class="sidebar">
      <div class="brand">
        <Icon name="ph:chart-line-up-bold" size="22" />
        <span>Paper-Trade</span>
        <em class="version">v{{ config.public.appVersion }}</em>
      </div>

      <nav class="nav" aria-label="Navigation principale">
        <NuxtLink
          v-for="item in nav"
          :key="item.to"
          :to="item.to"
          class="nav-item"
          :class="{ current: isCurrentNav(item.to) }"
          :aria-current="isCurrentNav(item.to) ? 'page' : undefined"
        >
          <Icon :name="item.icon" size="18" />
          <span>{{ item.label }}</span>
          <span v-if="item.beta" class="nav-badge">BETA</span>
        </NuxtLink>
      </nav>

      <div class="sidebar-footer">
        <span class="status" :data-status="marketStore.streamStatus">
          <span class="dot" />
          <span>{{
            marketStore.streamStatus === 'live'         ? 'Live · Binance'
            : marketStore.streamStatus === 'connecting' ? 'Connexion…'
            : marketStore.streamStatus === 'reconnecting' ? 'Reconnexion…'
            : marketStore.streamStatus === 'offline'    ? 'Déconnecté'
            : 'En attente'
          }}</span>
        </span>
      </div>
    </aside>

    <main class="main">
      <header class="topbar">
        <form class="search" @submit.prevent="submitSearch">
          <Icon name="ph:magnifying-glass-bold" size="16" />
          <input
            ref="searchInput"
            v-model="searchQuery"
            placeholder="Rechercher un actif (BTC, ETH, SOL...)"
            type="search"
            aria-label="Rechercher un actif"
          />
          <kbd>⌘K</kbd>
        </form>
        <div class="actions">
          <button class="ghost" aria-label="Basculer le thème" @click="toggleTheme">
            <Icon :name="theme === 'dark' ? 'ph:sun-bold' : 'ph:moon-bold'" size="18" />
          </button>
          <button class="ghost" aria-label="Notifications">
            <Icon name="ph:bell-bold" size="18" />
          </button>
          <div class="balance">
            <span class="dim">Portefeuille</span>
            <strong>{{ equityLabel }}</strong>
            <span class="perf" :data-trend="perfTrend">
              {{ fmtPerf(perfPct) }}
            </span>
          </div>
        </div>
      </header>

      <div class="content">
        <slot />
      </div>
    </main>
  </div>
</template>

<style lang="scss" scoped>
.app {
  display: grid;
  grid-template-columns: $sidebar-width 1fr;
  min-height: 100vh;
}

.sidebar {
  display: flex;
  flex-direction: column;
  background: $color-surface;
  border-right: 1px solid $color-border;
  padding: $space-lg $space-md;
  position: sticky;
  top: 0;
  height: 100vh;
}

.brand {
  @include row($space-sm);
  color: $color-accent;
  font-weight: $fw-semibold;
  font-size: $fs-lg;
  padding: 0 $space-sm $space-lg;

  .version {
    margin-left: auto;
    font-size: $fs-xs;
    font-style: normal;
    color: $color-text-dim;
    font-weight: $fw-regular;
  }
}

.nav {
  @include stack($space-xs);
  flex: 1;
}

.nav-item {
  @include row($space-sm);
  padding: $space-sm $space-md;
  border-radius: $radius-md;
  color: $color-text-muted;
  font-size: $fs-sm;
  font-weight: $fw-medium;

  &:hover {
    background: $color-surface-2;
    color: $color-text;
  }

  &.router-link-active,
  &.current {
    background: $color-accent-soft;
    color: $color-accent;
  }

  &:focus-visible {
    outline: 2px solid $color-accent;
    outline-offset: -1px;
  }
}

.nav-badge {
  margin-left: auto;
  font-size: 10px;
  font-family: $font-mono;
  padding: 2px 6px;
  border-radius: $radius-full;
  border: 1px solid $color-border;
  color: $color-text-dim;
  background: $color-surface-3;
}

.sidebar-footer {
  padding: $space-md $space-sm 0;
  border-top: 1px solid $color-border;
  margin-top: $space-md;
}

.status {
  @include row($space-sm);
  font-size: $fs-xs;
  color: $color-text-muted;
  font-family: $font-mono;

  .dot {
    width: 6px;
    height: 6px;
    border-radius: $radius-full;
    background: $color-text-dim;
    flex-shrink: 0;
  }

  &[data-status='live'] {
    color: $color-accent;
    .dot {
      background: $color-accent;
      box-shadow: 0 0 0 3px $color-accent-soft;
      animation: sidebar-pulse 2s ease-in-out infinite;
    }
  }
  &[data-status='connecting'] .dot,
  &[data-status='reconnecting'] .dot {
    background: $color-warning;
  }
  &[data-status='offline'] .dot {
    background: $color-danger;
  }
}

@keyframes sidebar-pulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.5; }
}

.main {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.topbar {
  @include flex-between;
  position: sticky;
  top: 0;
  z-index: $z-sticky;
  height: $header-height;
  padding: 0 $space-xl;
  @include glass;
}

.search {
  &:focus-within {
    border-color: $color-border-hover;
  }

  @include row($space-sm);
  flex: 1;
  max-width: 420px;
  padding: $space-sm $space-md;
  background: $color-surface-2;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  color: $color-text-muted;

  input {
    flex: 1;
    background: transparent;
    border: 0;
    outline: 0;
    color: $color-text;
    font-size: $fs-sm;

    &::placeholder {
      color: $color-text-dim;
    }
  }

  kbd {
    font-family: $font-mono;
    font-size: $fs-xs;
    padding: 2px 6px;
    background: $color-surface-3;
    border: 1px solid $color-border;
    border-radius: $radius-sm;
    color: $color-text-dim;
  }
}

.actions {
  @include row($space-md);
}

.ghost {
  @include flex-center;
  width: 36px;
  height: 36px;
  border-radius: $radius-md;
  color: $color-text-muted;

  &:hover {
    background: $color-surface-2;
    color: $color-text;
  }
}

.balance {
  @include row($space-sm);
  padding: $space-sm $space-md;
  background: $color-surface-2;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  font-size: $fs-sm;

  .dim {
    color: $color-text-muted;
  }

  strong {
    @include mono-nums;
    font-weight: $fw-semibold;
    color: $color-text;
  }

  .perf {
    @include mono-nums;
    font-size: $fs-xs;
    padding: 2px 6px;
    border-radius: $radius-sm;
    background: $color-surface-3;
    color: $color-text-muted;

    &[data-trend='up']   { color: $color-accent; background: $color-accent-soft; }
    &[data-trend='down'] { color: $color-danger; background: $color-danger-soft; }
  }
}

.content {
  flex: 1;
  width: 100%;
  max-width: $container-max;
  padding: $space-xl;
  margin: 0 auto;
}
</style>
