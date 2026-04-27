<script setup lang="ts">
const config = useRuntimeConfig()
const router = useRouter()
const route = useRoute()

// Hydrate les stores marché + wallets + portefeuille (SSR)
// ordre critique : wallets avant portfolio (activeId doit être connu).
const { store: marketStore } = await useMarket()
await useWallets()
await usePortfolio()
const portfolio = usePortfolioStore()
const wallets = useWalletsStore()
const ui = useUiPreferencesStore()

interface NavItem {
  to: string
  label: string
  icon: string
  beta?: boolean
}

interface NavGroup {
  id: 'scan' | 'analyze' | 'execute' | 'review'
  label: string
  items: readonly NavItem[]
}

const navGroups: readonly NavGroup[] = [
  {
    id: 'scan',
    label: 'Scanner',
    items: [
      { to: '/',       label: 'Dashboard', icon: 'ph:chart-line-up-bold' },
      { to: '/market', label: 'Marché',    icon: 'ph:squares-four-bold' },
    ],
  },
  {
    id: 'execute',
    label: 'Simuler',
    items: [
      { to: '/wallets', label: 'Wallets', icon: 'ph:wallet-bold' },
    ],
  },
  {
    id: 'review',
    label: 'Revue',
    items: [
      { to: '/alerts',   label: 'Alertes',  icon: 'ph:bell-bold' },
      { to: '/journal',  label: 'Journal',   icon: 'ph:notebook-bold', beta: true },
      { to: '/settings', label: 'Réglages',  icon: 'ph:gear-six-bold', beta: true },
    ],
  },
]

const searchQuery = ref('')
const searchInput = ref<HTMLInputElement | null>(null)

// Theme + density pilotés par uiPreferences (persisté)
const themeIcon = computed(() =>
  ui.resolvedTheme === 'dark' ? 'ph:sun-bold' : 'ph:moon-bold',
)
const themeLabel = computed(() =>
  ui.resolvedTheme === 'dark' ? 'Passer en thème clair' : 'Passer en thème sombre',
)

const marketAssets = computed(() => marketStore.taxonomy.assets)

const watchedAssets = computed(() => {
  const byPair = marketStore.assetByPair
  return ui.state.watchlist
    .map(pair => byPair.get(pair))
    .filter((a): a is NonNullable<typeof a> => !!a)
    .slice(0, 6)
})

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
  ui.hydrate()

  // Migration de l'ancien localStorage 'paper-trade-theme' si présent
  const legacy = localStorage.getItem('paper-trade-theme')
  if (legacy === 'light' || legacy === 'dark') {
    ui.setTheme(legacy)
    localStorage.removeItem('paper-trade-theme')
  } else if (ui.state.theme === 'dark' && !localStorage.getItem('paper-trade:ui-preferences')) {
    // première visite : respecter préférence système
    ui.setTheme(window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
  }

  ui.applyTheme(ui.state.theme)
  ui.applyDensity(ui.state.density)

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
</script>

<template>
  <div class="app">
    <a href="#main-content" class="skip-link">Aller au contenu principal</a>

    <aside class="sidebar" aria-label="Navigation">
      <div class="brand">
        <Icon name="ph:chart-line-up-bold" size="22" />
        <span>Paper-Trade</span>
        <em class="version">v{{ config.public.appVersion }}</em>
      </div>

      <nav class="nav" aria-label="Navigation principale">
        <div
          v-for="group in navGroups"
          :key="group.id"
          class="nav-group"
        >
          <p class="nav-group-label">{{ group.label }}</p>
          <NuxtLink
            v-for="item in group.items"
            :key="item.to"
            :to="item.to"
            class="nav-item"
            :class="{ current: isCurrentNav(item.to) }"
            :aria-current="isCurrentNav(item.to) ? 'page' : undefined"
          >
            <Icon :name="item.icon" size="18" aria-hidden="true" />
            <span>{{ item.label }}</span>
            <UiBadge v-if="item.beta" variant="neutral">BETA</UiBadge>
          </NuxtLink>
        </div>

        <div v-if="watchedAssets.length" class="nav-group watchlist">
          <p class="nav-group-label">
            <span>Watchlist</span>
            <NuxtLink to="/market" class="nav-group-link">Voir</NuxtLink>
          </p>
          <NuxtLink
            v-for="a in watchedAssets"
            :key="a.pair"
            :to="`/token/${a.pair}`"
            class="nav-item compact"
            :class="{ current: route.path === `/token/${a.pair}` }"
          >
            <span class="watch-dot" aria-hidden="true" />
            <span class="watch-sym">{{ a.symbol }}</span>
            <span class="watch-perf" :data-trend="trendOf(marketStore.tickers[a.pair]?.changePct ?? 0)">
              {{ marketStore.tickers[a.pair] ? fmtPerf(marketStore.tickers[a.pair]!.changePct) : '—' }}
            </span>
          </NuxtLink>
        </div>
      </nav>

      <div class="sidebar-footer">
        <MarketStatusBadge :status="marketStore.streamStatus" :source="marketStore.source" />
      </div>
    </aside>

    <main class="main" id="main-content">
      <header class="topbar">
        <form class="search" @submit.prevent="submitSearch" role="search">
          <Icon name="ph:magnifying-glass-bold" size="16" aria-hidden="true" />
          <input
            ref="searchInput"
            v-model="searchQuery"
            placeholder="Rechercher un actif (BTC, ETH, SOL...)"
            type="search"
            aria-label="Rechercher un actif"
          />
          <kbd aria-hidden="true">⌘K</kbd>
        </form>
        <div class="actions">
          <WalletSelector v-if="wallets.list.length > 0" class="wallet-selector-slot" />
          <UiIconButton
            :icon="ui.state.density === 'compact' ? 'ph:rows-bold' : 'ph:list-bullets-bold'"
            variant="ghost"
            :ariaLabel="ui.state.density === 'compact' ? 'Passer en densité confort' : 'Passer en densité compacte'"
            @click="ui.toggleDensity"
          />
          <UiIconButton
            :icon="themeIcon"
            variant="ghost"
            :ariaLabel="themeLabel"
            @click="ui.toggleTheme"
          />
          <UiIconButton
            icon="ph:bell-bold"
            variant="ghost"
            ariaLabel="Alertes prix"
            @click="navigateTo('/alerts')"
          />
        </div>
      </header>

      <div class="content">
        <slot />
      </div>
    </main>

    <ClientOnly>
      <UiToastHost />
      <VitalsOverlay />
    </ClientOnly>
  </div>
</template>

<style lang="scss" scoped>
.app {
  display: grid;
  grid-template-columns: $sidebar-width 1fr;
  min-height: 100vh;

  @include media-down($bp-lg) {
    grid-template-columns: 72px 1fr;
  }
  @include media-down($bp-md) {
    grid-template-columns: 1fr;
  }
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
  overflow: hidden;

  @include media-down($bp-lg) {
    padding: $space-md $space-sm;
    .brand span,
    .brand .version,
    .nav-group-label,
    .nav-group-link,
    .nav-item span:not(.watch-sym):not(.watch-perf),
    .nav-item.compact .watch-perf,
    .nav-item :deep(.ui-badge) { display: none; }
    .nav-item { justify-content: center; padding: $space-sm; }
    .watchlist { display: none; }
    .sidebar-footer { display: none; }
  }

  @include media-down($bp-md) {
    position: sticky;
    top: 0;
    z-index: $z-sticky + 1;
    height: auto;
    border-right: 0;
    border-bottom: 1px solid $color-border;
    padding: $space-sm $space-md;

    .brand { padding-bottom: $space-sm; }
    .brand span { display: inline; font-size: $fs-md; }
    .brand .version { display: none; }

    .nav {
      flex-direction: row;
      overflow-x: auto;
      overflow-y: hidden;
      gap: $space-xs;
      @include scrollbar;

      .nav-group {
        display: flex;
        flex-direction: row;
        gap: $space-xs;
        border-top: 0;
        padding-top: 0;
        margin-top: 0;

        &.watchlist { display: none; }
      }
      .nav-group-label { display: none; }
      .nav-item {
        padding: $space-xs $space-sm;
        white-space: nowrap;
      }
      .nav-item span:not(.watch-sym):not(.watch-perf) { display: inline; font-size: $fs-xs; }
    }
  }
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
  @include stack($space-md);
  flex: 1;
  overflow-y: auto;
  @include scrollbar;
}

.nav-group {
  @include stack(2px);

  & + .nav-group {
    padding-top: $space-sm;
    border-top: 1px dashed $color-border;
  }
}

.nav-group-label {
  @include flex-between;
  padding: 0 $space-sm;
  margin: 0 0 $space-xs;
  font-size: $fs-3xs;
  font-weight: $fw-semibold;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: $color-text-dim;
}

.nav-group-link {
  font-size: $fs-3xs;
  font-weight: $fw-medium;
  letter-spacing: 0.04em;
  color: $color-text-muted;

  &:hover { color: $color-text; }
  &:focus-visible { @include ring-outset; }
}

.nav-item {
  @include row($space-sm);
  padding: $space-sm $space-md;
  border-radius: $radius-md;
  color: $color-text-muted;
  font-size: $fs-sm;
  font-weight: $fw-medium;
  position: relative;
  transition:
    background $duration-fast $ease-standard,
    color $duration-fast $ease-standard,
    transform $duration-instant $ease-standard;

  &:hover {
    background: $color-surface-2;
    color: $color-text;
    transform: translate3d(2px, 0, 0);
  }

  &.router-link-active,
  &.current {
    background: $color-accent-soft;
    color: $color-accent;

    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 20%;
      bottom: 20%;
      width: 2px;
      border-radius: $radius-full;
      background: $color-accent;
      transform-origin: center;
      animation: pt-scale-in $duration-base $ease-spring both;
    }
  }

  &:focus-visible {
    outline: 2px solid $color-accent;
    outline-offset: -1px;
  }

  &.compact {
    padding: 6px $space-md;
    font-size: $fs-xs;

    .watch-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: $color-text-dim;
      flex-shrink: 0;
    }

    .watch-sym {
      flex: 1;
      font-weight: $fw-semibold;
      letter-spacing: 0.02em;
    }

    .watch-perf {
      @include mono-nums;
      font-size: $fs-2xs;
      color: $color-text-muted;

      &[data-trend='up']   { color: $color-accent; }
      &[data-trend='down'] { color: $color-danger; }
    }

    &.current .watch-dot { background: $color-accent; }
  }
}

.nav-item :deep(.ui-badge) {
  margin-left: auto;
}

.sidebar-footer {
  padding: $space-md $space-sm 0;
  border-top: 1px solid $color-border;
  margin-top: $space-md;
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
  gap: $space-md;
  @include glass;
  min-width: 0;

  @include media-down($bp-md) {
    padding: 0 $space-md;
    gap: $space-sm;
    // La sidebar se transforme en topbar en mobile : éviter la superposition
    // en désactivant le sticky ici (le contenu défile, la nav reste accessible
    // via la sidebar horizontale sticky au-dessus).
    position: static;

    .search kbd { display: none; }
  }
}

.search {
  @include row($space-sm);
  flex: 1;
  min-width: 0;
  max-width: 420px;
  padding: $space-sm $space-md;
  background: $color-surface-2;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  color: $color-text-muted;
  transition:
    border-color $duration-fast $ease-standard,
    box-shadow $duration-fast $ease-standard,
    background $duration-fast $ease-standard;

  &:focus-within {
    border-color: $color-accent;
    box-shadow: 0 0 0 3px $color-accent-soft;
    background: var(--surface-raised);
  }

  input {
    flex: 1;
    min-width: 0;
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
    flex-shrink: 0;
    font-family: $font-mono;
    font-size: $fs-2xs;
    padding: $space-2xs $space-xs;
    background: $color-surface-3;
    border: 1px solid $color-border;
    border-radius: $radius-sm;
    color: $color-text-dim;
  }
}

.actions {
  @include row($space-md);
}

.content {
  flex: 1;
  width: 100%;
  max-width: $container-max;
  padding: $space-xl;
  margin: 0 auto;

  @include media-down($bp-md) {
    padding: $space-lg $space-md;
  }
}
</style>
