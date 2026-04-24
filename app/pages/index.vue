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
      hint: 'Paper trading · v0.2',
      trend: 'flat' as Trend,
    },
    {
      label: 'Volume 24 h suivi',
      value: store.isLoaded ? fmtVolume(store.totalVolume24h) : '—',
      hint: `${Object.keys(store.tickers).length} actifs trackés`,
      trend: 'flat' as Trend,
    },
    {
      label: 'Bitcoin',
      value: btc ? `$${fmtPrice(btc.price)}` : '—',
      hint: btc ? `${fmtPerf(btc.change)} sur 24 h` : 'Chargement…',
      trend: btc ? trendOf(btc.change) : 'flat' as Trend,
    },
    {
      label: 'Marché global',
      value: store.isLoaded ? fmtPerf(avg) : '—',
      hint: 'Moyenne des catégories',
      trend: trendOf(avg),
    },
  ]
})
</script>

<template>
  <section class="dash">
    <PageHeader
      kicker="Vue d'ensemble"
      title="Dashboard"
      subtitle="Aperçu du marché · classification par thèses · portefeuille simulé"
    >
      <template #meta>
        <MarketStatusBadge :status="store.streamStatus" :source="store.source" />
        <FreshnessBadge :age-sec="marketAgeSec" :freshness="marketFreshness" />
        <MarketMeta
          :transport-mode="store.transportMode"
          :latency-ms="marketLatency"
          :switch-count="store.fallbackSwitchCount"
          :last-switch-sec="lastSwitchSec"
        />
      </template>
    </PageHeader>

    <div class="stats">
      <UiStatCard
        v-for="s in stats"
        :key="s.label"
        :label="s.label"
        :value="s.value"
        :hint="s.hint"
        :trend="s.trend"
        :loading="!store.isLoaded && s.label !== 'Valeur portefeuille'"
      />
    </div>

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
          <NuxtLink :to="`/token/${m.asset.pair}`" class="mover-link">
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
          </NuxtLink>
        </li>
      </ul>
      <UiEmptyState
        v-else
        icon="ph:cloud-slash-bold"
        title="Données en cours d'arrivée"
        description="Le snapshot initial est en train de se charger."
      />
    </section>
  </section>
</template>

<style lang="scss" scoped>
.dash { @include stack($space-xl); }

.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: $space-md;

  @include media-down($bp-sm) {
    grid-template-columns: repeat(2, 1fr);
    gap: $space-sm;
  }

  > * {
    @include anim-slide-up($duration-base, $ease-decelerate);
  }

  @include stagger-children(8, 70ms);
}

.block      { @include stack($space-md); }
.block-head {
  @include flex-between;
  gap: $space-md;
  flex-wrap: wrap;

  h2   { font-size: $fs-xl; font-weight: $fw-semibold; }
  .sub { color: var(--text-secondary); font-size: $fs-xs; margin-top: $space-xs; }
  .link {
    @include row($space-xs);
    color: $color-accent;
    font-size: $fs-sm;
    font-weight: $fw-medium;
    &:hover { text-decoration: underline; }
  }
  .dim { color: var(--text-tertiary); font-size: $fs-xs; font-family: $font-mono; }
}

.cats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: $space-md;
}

.cat {
  @include stack($space-xs);
  @include panel-padded;
  position: relative;
  overflow: hidden;
  min-width: 0;
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

  .cat-label { font-size: $fs-sm; color: var(--text-secondary); @include truncate; }
  .cat-perf {
    font-size: $fs-xl;
    @include mono-nums;
    @include truncate;
    &[data-trend='up']   { color: $color-accent; }
    &[data-trend='down'] { color: $color-danger; }
    &[data-trend='flat'] { color: var(--text-secondary); }
  }
  .cat-count { font-size: $fs-xs; color: var(--text-tertiary); }
}

.movers {
  @include panel;
  padding: 0;
  overflow: hidden;
  @include stagger-children(12, 40ms);

  li {
    border-bottom: 1px solid $color-border;
    @include anim-fade-in($duration-fast, $ease-decelerate);
    &:last-child { border-bottom: 0; }
  }

  .mover-link {
    display: grid;
    grid-template-columns: 12px 72px minmax(0, 1fr) auto auto;
    align-items: center;
    gap: $space-md;
    padding: $space-md $space-lg;
    color: inherit;
    transition:
      background $duration-fast $ease-standard,
      padding-left $duration-fast $ease-standard;
    min-width: 0;

    &:hover {
      background: $color-surface-2;
      padding-left: calc(#{$space-lg} + 4px);
    }
    &:focus-visible { @include ring-inset; background: $color-surface-2; }

    .cat-dot {
      width: 8px;
      height: 8px;
      border-radius: $radius-full;
      background: var(--cat-color, #{$color-text-dim});
    }
    .sym  { font-weight: $fw-semibold; @include mono-nums; }
    .name { color: var(--text-secondary); font-size: $fs-sm; @include truncate; min-width: 0; }
    .price {
      @include mono-nums;
      color: var(--text-secondary);
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

@include media-down($bp-sm) {
  .movers .mover-link {
    grid-template-columns: 10px 56px minmax(0, 1fr) auto;
    gap: $space-sm;
    padding: $space-md;
    .name, .price { display: none; }
  }
}
</style>
