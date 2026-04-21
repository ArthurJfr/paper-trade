<script setup lang="ts">
import { useMarketStore } from '~/stores/market'

useHead({ title: 'Dashboard · Paper-Trade' })

const store = useMarketStore()
const now = useNow(1000)
const marketAgeSec = computed(() => store.dataAgeSec(now.value))
const marketFreshness = computed(() => store.freshness(now.value))
const marketLatency = computed(() => store.latencyMs(now.value))
const lastSwitchSec = computed(() =>
  store.lastModeSwitchAt ? Math.max(0, Math.round((now.value - store.lastModeSwitchAt) / 1000)) : null,
)

// ─── Stats en tête ────────────────────────────────────────────────────────
const stats = computed(() => {
  const btc = store.btcDominance
  const avg = store.categoryStats.length
    ? store.categoryStats.reduce((s, c) => s + c.perf24h, 0) / store.categoryStats.length
    : 0

  return [
    {
      label: 'Valeur portefeuille',
      value: '$10 000.00',
      change: 'Paper trading · v0.2',
      trend: 'flat' as Trend,
    },
    {
      label: 'Volume 24 h suivi',
      value: store.isLoaded ? fmtVolume(store.totalVolume24h) : '—',
      change: `${Object.keys(store.tickers).length} actifs trackés`,
      trend: 'flat' as Trend,
    },
    {
      label: 'Bitcoin',
      value: btc ? `$${fmtPrice(btc.price)}` : '—',
      change: btc ? fmtPerf(btc.change) + ' sur 24 h' : 'Chargement…',
      trend: btc ? trendOf(btc.change) : 'flat',
    },
    {
      label: 'Marché global',
      value: store.isLoaded ? fmtPerf(avg) : '—',
      change: 'Moyenne des catégories',
      trend: trendOf(avg),
    },
  ]
})
</script>

<template>
  <section class="dash">
    <header class="head">
      <div>
        <h1>Dashboard</h1>
        <p class="sub">Aperçu du marché · classification par thèses · portefeuille simulé</p>
      </div>
      <span class="chip" :data-status="store.streamStatus">
        <span class="dot" />
        <span>{{
          store.streamStatus === 'live'         ? 'Live · Binance WS'
          : store.streamStatus === 'connecting' ? 'Connexion…'
          : store.streamStatus === 'reconnecting' ? 'Reconnexion…'
          : store.streamStatus === 'offline'    ? 'Déconnecté'
          : store.source === 'binance'          ? 'Snapshot · Binance REST'
          : 'Hors-ligne · données absentes'
        }}</span>
      </span>
      <span class="freshness" :data-freshness="marketFreshness">
        {{ marketAgeSec === null ? 'Données absentes' : `MAJ il y a ${marketAgeSec}s` }}
      </span>
      <span class="meta">
        {{ store.transportMode.toUpperCase() }} ·
        {{ marketLatency === null ? 'latence —' : `${marketLatency}ms` }} ·
        switch {{ store.fallbackSwitchCount }}{{ lastSwitchSec === null ? '' : ` (il y a ${lastSwitchSec}s)` }}
      </span>
    </header>

    <!-- Stats -->
    <div class="stats">
      <article v-for="s in stats" :key="s.label" class="stat">
        <span class="label">{{ s.label }}</span>
        <strong class="value">{{ s.value }}</strong>
        <span class="change" :data-trend="s.trend">{{ s.change }}</span>
      </article>
    </div>

    <!-- Catégories -->
    <section class="block">
      <div class="block-head">
        <div>
          <h2>Catégories</h2>
          <p class="sub">Performance moyenne pondérée par volume — 24 h</p>
        </div>
        <NuxtLink class="link" to="/market">
          Voir tout
          <Icon name="ph:arrow-right-bold" size="14" />
        </NuxtLink>
      </div>

      <div class="cats">
        <article
          v-for="c in store.categoryStats"
          :key="c.key"
          class="cat"
          :style="{ '--cat-color': c.color }"
        >
          <span class="cat-label">{{ c.label }}</span>
          <strong class="cat-perf" :data-trend="trendOf(c.perf24h)">
            {{ c.count > 0 ? fmtPerf(c.perf24h) : '—' }}
          </strong>
          <span class="cat-count">{{ c.count }} actif{{ c.count > 1 ? 's' : '' }}</span>
        </article>
      </div>
    </section>

    <!-- Top movers -->
    <section class="block">
      <div class="block-head">
        <div>
          <h2>Top movers</h2>
          <p class="sub">Plus grosses variations sur 24 h — volume &gt; 100 K $</p>
        </div>
        <span v-if="store.updatedAt" class="dim">MAJ il y a {{ marketAgeSec }}s</span>
      </div>

      <ul v-if="store.topMovers.length" class="movers">
        <li v-for="m in store.topMovers" :key="m.asset.pair">
          <span
            class="cat-dot"
            :style="{ '--cat-color': store.categoryByKey.get(m.asset.category)?.color }"
            aria-hidden="true"
          />
          <span class="sym">{{ m.asset.symbol }}</span>
          <span class="name">{{ m.asset.name }}</span>
          <span class="price">${{ fmtPrice(m.ticker.price) }}</span>
          <strong class="perf" :data-trend="trendOf(m.ticker.changePct)">
            {{ fmtPerf(m.ticker.changePct) }}
          </strong>
        </li>
      </ul>
      <div v-else class="empty">
        <Icon name="ph:cloud-slash-bold" size="20" />
        <p>Pas encore de données — le snapshot arrive.</p>
      </div>
    </section>
  </section>
</template>

<style lang="scss" scoped>
.dash {
  @include stack($space-xl);
}

// ─── Head ────────────────────────────────────────────────────────────────
.head {
  @include flex-between;
  align-items: flex-end;
  gap: $space-md;
  flex-wrap: wrap;

  h1 {
    font-size: $fs-3xl;
    letter-spacing: -0.02em;
  }

  .sub {
    color: $color-text-muted;
    font-size: $fs-sm;
    margin-top: $space-xs;
  }
}

.freshness {
  font-size: $fs-xs;
  font-family: $font-mono;
  color: $color-text-muted;
  &[data-freshness='fresh'] { color: $color-accent; }
  &[data-freshness='delayed'] { color: $color-warning; }
  &[data-freshness='stale'] { color: $color-danger; }
}

.meta {
  font-size: $fs-xs;
  color: $color-text-dim;
  font-family: $font-mono;
}

.chip {
  @include row($space-sm);
  padding: $space-xs $space-md;
  border: 1px solid $color-border;
  border-radius: $radius-full;
  font-size: $fs-xs;
  color: $color-text-muted;
  background: $color-surface;

  .dot {
    width: 6px;
    height: 6px;
    border-radius: $radius-full;
    background: $color-text-dim;
    box-shadow: 0 0 0 4px var(--chip-dot-shadow);
  }

  &[data-status='live'] .dot {
    background: $color-accent;
    box-shadow: 0 0 0 4px $color-accent-soft;
    animation: pulse 2s ease-in-out infinite;
  }
  &[data-status='connecting'] .dot,
  &[data-status='reconnecting'] .dot {
    background: $color-warning;
    box-shadow: 0 0 0 4px $color-warning-soft;
  }
  &[data-status='offline'] .dot {
    background: $color-danger;
    box-shadow: 0 0 0 4px $color-danger-soft;
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.55; }
}

// ─── Stats ───────────────────────────────────────────────────────────────
.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: $space-md;
}

.stat {
  @include card;
  @include stack($space-xs);
  transition: border-color $transition-fast;

  &:hover { border-color: $color-border-hover; }

  .label {
    font-size: $fs-xs;
    color: $color-text-muted;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .value {
    font-size: $fs-2xl;
    @include mono-nums;
  }
  .change {
    font-size: $fs-xs;
    color: $color-text-muted;
    &[data-trend='up']   { color: $color-accent; }
    &[data-trend='down'] { color: $color-danger; }
  }
}

// ─── Blocks ──────────────────────────────────────────────────────────────
.block      { @include stack($space-md); }
.block-head {
  @include flex-between;
  gap: $space-md;
  flex-wrap: wrap;

  h2   { font-size: $fs-xl; font-weight: $fw-semibold; }
  .sub { color: $color-text-muted; font-size: $fs-xs; margin-top: $space-xs; }
  .link {
    @include row($space-xs);
    color: $color-accent;
    font-size: $fs-sm;
    font-weight: $fw-medium;
    &:hover { text-decoration: underline; }
  }
  .dim { color: $color-text-dim; font-size: $fs-xs; font-family: $font-mono; }
}

// ─── Catégories ──────────────────────────────────────────────────────────
.cats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: $space-md;
}

.cat {
  @include stack($space-xs);
  @include card;
  position: relative;
  overflow: hidden;
  transition: border-color $transition-fast, transform $transition-fast;

  &::before {
    content: '';
    position: absolute;
    inset: 0 auto 0 0;
    width: 3px;
    background: var(--cat-color, #{$color-text-dim});
  }
  &:hover {
    border-color: $color-border-hover;
    transform: translateY(-2px);
  }

  .cat-label { font-size: $fs-sm; color: $color-text-muted; }
  .cat-perf {
    font-size: $fs-xl;
    @include mono-nums;
    &[data-trend='up']   { color: $color-accent; }
    &[data-trend='down'] { color: $color-danger; }
    &[data-trend='flat'] { color: $color-text-muted; }
  }
  .cat-count { font-size: $fs-xs; color: $color-text-dim; }
}

// ─── Movers ──────────────────────────────────────────────────────────────
.movers {
  @include card;
  padding: 0;

  li {
    display: grid;
    grid-template-columns: 12px 72px 1fr auto auto;
    align-items: center;
    gap: $space-md;
    padding: $space-md $space-lg;
    border-bottom: 1px solid $color-border;

    &:last-child { border-bottom: 0; }
    &:hover      { background: $color-surface-2; }

    .cat-dot {
      width: 8px;
      height: 8px;
      border-radius: $radius-full;
      background: var(--cat-color, #{$color-text-dim});
    }
    .sym  { font-weight: $fw-semibold; @include mono-nums; }
    .name { color: $color-text-muted; font-size: $fs-sm; @include truncate; }
    .price {
      @include mono-nums;
      color: $color-text-muted;
      font-size: $fs-sm;
    }
    .perf {
      @include mono-nums;
      font-weight: $fw-semibold;
      min-width: 80px;
      text-align: right;
      &[data-trend='up']   { color: $color-accent; }
      &[data-trend='down'] { color: $color-danger; }
    }
  }
}

.empty {
  @include card;
  @include flex-center;
  @include stack($space-sm);
  padding: $space-2xl;
  color: $color-text-muted;
  font-size: $fs-sm;
}
</style>
