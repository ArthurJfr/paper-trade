<script setup lang="ts">
import type { Kline, KlineInterval, OrderBookSnapshot, StreamStatus } from '~~/shared/types/market'
import { useMarketStore } from '~/stores/market'

const route = useRoute()
const router = useRouter()
const store = useMarketStore()
const ui = useUiPreferencesStore()
const now = useNow(1000)

// ─── Pair : normalisation + validation ─────────────────────────────────────
const rawPair = String(route.params.pair ?? '')
const pair = rawPair.toUpperCase()

if (!/^[A-Z0-9]{3,20}$/.test(pair)) {
  throw createError({ statusCode: 404, statusMessage: 'Pair invalide' })
}

// ─── Métadonnées depuis la taxonomie (si connue) ───────────────────────────
const asset = computed(() => store.assetByPair.get(pair))
const category = computed(() =>
  asset.value ? store.categoryByKey.get(asset.value.category) : undefined,
)
const ticker = computed(() => store.tickers[pair] ?? null)
const marketAgeSec = computed(() => store.dataAgeSec(now.value))
const marketFreshness = computed(() => store.freshness(now.value))
const marketLatency = computed(() => store.latencyMs(now.value))
const orderBookSourceMode = computed<'ws' | 'rest'>(() =>
  store.streamStatus === 'live' ? 'ws' : 'rest',
)

// ─── Intervalle du chart (synchronisé avec l'URL) ──────────────────────────
const INTERVALS: { key: KlineInterval, label: string }[] = [
  { key: '1m',  label: '1m' },
  { key: '5m',  label: '5m' },
  { key: '15m', label: '15m' },
  { key: '1h',  label: '1H' },
  { key: '4h',  label: '4H' },
  { key: '1d',  label: '1J' },
  { key: '1w',  label: '1S' },
]
const INTERVAL_SHORTCUTS: { id: string, label: string, key: KlineInterval }[] = [
  { id: 'intraday', label: 'Intraday', key: '15m' },
  { id: 'swing', label: 'Swing', key: '4h' },
]
const CHART_MODES = [
  { key: 'candles', label: 'Bougies', icon: 'ph:chart-bar-bold' },
  { key: 'line',    label: 'Ligne',   icon: 'ph:chart-line-bold' },
  { key: 'area',    label: 'Aire',    icon: 'ph:chart-polygon-bold' },
] as const
type ChartMode = typeof CHART_MODES[number]['key']

const chartMode = computed<ChartMode>({
  get: () => ui.state.chart.type as ChartMode,
  set: (v) => ui.setChart({ type: v }),
})

const chartOverlays = computed(() => ui.state.chart.overlays)
const showVolume = computed({
  get: () => ui.state.chart.showVolume,
  set: (v) => ui.setChart({ showVolume: v }),
})

const initialInterval = (route.query.i as KlineInterval) || ui.state.chart.interval || '1h'
const interval = ref<KlineInterval>(
  INTERVALS.some(x => x.key === initialInterval) ? initialInterval : '1h',
)

watch(interval, (i) => {
  const q: Record<string, string> = {}
  for (const [k, v] of Object.entries(route.query)) {
    if (typeof v === 'string') q[k] = v
  }
  if (i === '1h') delete q.i
  else q.i = i
  router.replace({ query: q })
  ui.setChart({ interval: i })
})

const OVERLAY_OPTIONS: { key: keyof typeof chartOverlays.value, label: string, color: string }[] = [
  { key: 'ma20',  label: 'MA20',  color: 'var(--chart-overlay-ma20)' },
  { key: 'ma50',  label: 'MA50',  color: 'var(--chart-overlay-ma50)' },
  { key: 'ema21', label: 'EMA21', color: 'var(--chart-overlay-ema21)' },
  { key: 'vwap',  label: 'VWAP',  color: 'var(--chart-overlay-vwap)' },
]

function toggleOverlay(key: keyof typeof chartOverlays.value) {
  ui.toggleOverlay(key)
}

// ─── Klines (SSR-aware, ré-fetch à chaque changement d'intervalle) ─────────
const { data: klines, pending: klinesPending, error: klinesError } = await useFetch<Kline[]>(
  '/api/market/klines',
  {
    key: `klines-${pair}`,
    query: { pair, interval, limit: 200 },
    server: true,
    watch: [interval],
  },
)

// ─── Order book · WebSocket client uniquement ─────────────────────────────
const book = ref<OrderBookSnapshot | null>(null)
const obStatus = ref<StreamStatus>('idle')

useOrderBookStream({
  pair,
  levels: 20,
  throttleMs: 200,
  onUpdate: (ob) => { book.value = ob },
  onStatus: (s)  => { obStatus.value = s },
})

// ─── Prix courant : ticker live prioritaire, fallback sur dernière bougie ─
const lastKlineClose = computed(() => {
  const ks = klines.value
  return ks && ks.length ? ks[ks.length - 1]!.close : null
})
const currentPrice = computed(() => ticker.value?.price ?? lastKlineClose.value)

// ─── Spread calculé depuis l'order book live ──────────────────────────────
const spread = computed(() => {
  const b = book.value
  if (!b || !b.bids.length || !b.asks.length) return null
  const bid = b.bids[0]!.price
  const ask = b.asks[0]!.price
  return { bid, ask, pct: ((ask - bid) / ((ask + bid) / 2)) * 100 }
})

const fmtInt = (n: number) => n.toLocaleString('fr-FR')

// ─── SEO ───────────────────────────────────────────────────────────────────
const pageTitle = computed(() => `${asset.value?.symbol ?? pair} · Paper-Trade`)
useHead({ title: pageTitle })
const pairDataLabel = computed(() => store.pairDataLabel(pair))

function selectInterval(i: KlineInterval) { interval.value = i }
function applyShortcut(i: KlineInterval) { interval.value = i }
async function resetView() {
  interval.value = '1h'
  await router.replace({ query: {} })
  if (process.client) window.scrollTo({ top: 0, behavior: 'smooth' })
}

const isWatched = computed(() => ui.isWatched(pair))
function toggleWatch() {
  ui.toggleWatch(pair)
}
</script>

<template>
  <section class="token-page">
    <!-- ─── Header ──────────────────────────────────────────────────────── -->
    <header class="head">
      <div class="bread">
        <NuxtLink to="/market" class="back">
          <Icon name="ph:arrow-left-bold" size="13" /> Marché
        </NuxtLink>
      </div>

      <div class="title-row">
        <div class="identity">
          <h1>
            <span class="sym">{{ asset?.symbol ?? pair }}</span>
            <span class="quote">/ USDT</span>
          </h1>
          <div class="meta">
            <span v-if="asset" class="name">{{ asset.name }}</span>
            <span v-if="category" class="cat-tag" :style="{ '--cat-color': category.color }">
              <span class="cat-dot" />{{ category.label }}
            </span>
            <span v-else class="dim">Pair non répertoriée</span>
          </div>
        </div>

        <div class="price-block">
          <div class="price-head">
            <UiIconButton
              :icon="isWatched ? 'ph:star-fill' : 'ph:star-bold'"
              variant="ghost"
              :active="isWatched"
              :ariaLabel="isWatched ? `Retirer ${asset?.symbol ?? pair} de la watchlist` : `Ajouter ${asset?.symbol ?? pair} à la watchlist`"
              @click="toggleWatch"
            />
            <strong class="price" :data-trend="trendOf(ticker?.changePct ?? 0)">
              {{ currentPrice !== null ? '$' + fmtPrice(currentPrice) : '—' }}
            </strong>
          </div>
          <div class="sub-row">
            <span v-if="ticker" class="perf" :data-trend="trendOf(ticker.changePct)">
              {{ fmtPerf(ticker.changePct) }} sur 24 h
            </span>
            <span v-else class="dim">{{ pairDataLabel ?? 'Données en attente' }}</span>
            <FreshnessBadge
              :freshness="marketFreshness"
              :age-sec="marketAgeSec"
            />
            <MarketMeta
              :transport-mode="store.transportMode"
              :latency-ms="marketLatency"
              :switch-count="store.fallbackSwitchCount"
            />
          </div>
        </div>
      </div>
    </header>

    <!-- ─── Corps : chart + order book ──────────────────────────────────── -->
    <div class="body">
      <section class="chart-block">
        <div class="chart-head">
          <h2 class="sr-only">Historique de prix</h2>
          <div class="chart-controls">
            <div class="shortcuts">
              <button
                v-for="s in INTERVAL_SHORTCUTS"
                :key="s.id"
                class="shortcut"
                :class="{ active: interval === s.key }"
                @click="applyShortcut(s.key)"
              >
                {{ s.label }}
              </button>
              <button class="shortcut reset" @click="resetView">Reset vue</button>
            </div>
            <div class="chart-modes" role="tablist" aria-label="Type de graphique">
              <button
                v-for="m in CHART_MODES"
                :key="m.key"
                class="mode"
                :class="{ active: chartMode === m.key }"
                role="tab"
                :aria-selected="chartMode === m.key"
                @click="chartMode = m.key"
              >
                <Icon :name="m.icon" size="12" aria-hidden="true" />
                {{ m.label }}
              </button>
            </div>
            <div class="intervals" role="tablist" aria-label="Intervalle">
              <button
                v-for="i in INTERVALS"
                :key="i.key"
                class="interval"
                :class="{ active: interval === i.key }"
                role="tab"
                :aria-selected="interval === i.key"
                @click="selectInterval(i.key)"
              >{{ i.label }}</button>
            </div>
          </div>
          <div class="chart-aux">
            <div class="overlays-group" role="group" aria-label="Overlays">
              <button
                v-for="ov in OVERLAY_OPTIONS"
                :key="ov.key"
                type="button"
                class="overlay-toggle"
                :class="{ active: chartOverlays[ov.key] }"
                :aria-pressed="chartOverlays[ov.key]"
                @click="toggleOverlay(ov.key)"
              >
                <span class="ov-swatch" :style="{ background: ov.color }" aria-hidden="true" />
                {{ ov.label }}
              </button>
            </div>
            <button
              type="button"
              class="vol-toggle"
              :class="{ active: showVolume }"
              :aria-pressed="showVolume"
              @click="showVolume = !showVolume"
            >
              <Icon name="ph:chart-bar-bold" size="12" />
              Volume
            </button>
          </div>
        </div>

        <div v-if="klinesError" class="state-box error">
          <Icon name="ph:warning-bold" size="22" />
          <p>Impossible de charger les chandeliers.</p>
        </div>
        <div v-else-if="klinesPending && !klines" class="state-box">
          <Icon name="ph:spinner-bold" size="22" class="spin" />
          <p>Chargement…</p>
        </div>
        <div v-else-if="klines && klines.length" class="chart-wrap">
          <TokenChart
            :klines="klines"
            :interval="interval"
            :mode="chartMode"
            :overlays="chartOverlays"
            :show-volume="showVolume"
          />
          <p class="chart-hint">
            <kbd>Drag</kbd> pan · <kbd>Scroll</kbd> zoom · <kbd>0</kbd> reset · <kbd>+/−</kbd> zoom · <kbd>←/→</kbd> pan
          </p>
        </div>
        <div v-else class="state-box">
          <Icon name="ph:cloud-slash-bold" size="22" />
          <p>Aucune donnée pour {{ pair }}.</p>
        </div>
        <!-- ─── Stats ─────────────────────────────────────────────────────── -->
        <section class="stats-block">
          <h2 class="block-title">Statistiques 24 h</h2>
          <div class="stats">
            <article class="stat">
              <span class="label">Ouverture 24 h</span>
              <strong class="value">{{ ticker ? '$' + fmtPrice(ticker.open24h) : (pairDataLabel ?? 'Données en attente') }}</strong>
            </article>
            <article class="stat">
              <span class="label">Plus haut 24 h</span>
              <strong class="value">{{ ticker ? '$' + fmtPrice(ticker.high24h) : (pairDataLabel ?? 'Données en attente') }}</strong>
            </article>
            <article class="stat">
              <span class="label">Plus bas 24 h</span>
              <strong class="value">{{ ticker ? '$' + fmtPrice(ticker.low24h) : (pairDataLabel ?? 'Données en attente') }}</strong>
            </article>
            <article class="stat">
              <span class="label">Volume 24 h</span>
              <strong class="value">{{ ticker ? fmtVolume(ticker.volume24h) : (pairDataLabel ?? 'Données en attente') }}</strong>
              <span class="sub">USDT échangé</span>
            </article>
            <article class="stat">
              <span class="label">Best bid</span>
              <strong class="value up">{{ spread ? '$' + fmtPrice(spread.bid) : '—' }}</strong>
            </article>
            <article class="stat">
              <span class="label">Best ask</span>
              <strong class="value down">{{ spread ? '$' + fmtPrice(spread.ask) : '—' }}</strong>
            </article>
            <article class="stat">
              <span class="label">Spread</span>
              <strong class="value">{{ spread ? spread.pct.toFixed(3) + ' %' : '—' }}</strong>
              <span class="sub">bid-ask relatif</span>
            </article>
            <article class="stat">
              <span class="label">Trades</span>
              <strong class="value">
                {{ klines && klines.length
                  ? fmtInt(klines.reduce((s, k) => s + k.trades, 0))
                  : '—' }}
              </strong>
              <span class="sub">sur la série affichée</span>
            </article>
          </div>
        </section>
      </section>

      <aside class="side-col">
        <OrderTicket
          v-if="currentPrice !== null && currentPrice > 0"
          :pair="pair"
          :price="currentPrice"
          :symbol="asset?.symbol"
        />
        <OrderBook :book="book" :status="obStatus" :depth="14" :source-mode="orderBookSourceMode" />
      </aside>
    </div>
  </section>
</template>

<style lang="scss" scoped>
.token-page { @include stack($space-xl); }

// ─── Header ───────────────────────────────────────────────────────────────
.head { @include stack($space-md); }

.bread .back {
  @include row($space-xs);
  color: $color-text-muted;
  font-size: $fs-sm;
  &:hover { color: $color-text; }
}

.title-row {
  @include flex-between;
  align-items: flex-start;
  gap: $space-md;
  flex-wrap: wrap;
}

.identity {
  @include stack($space-sm);

  h1 {
    font-size: $fs-3xl;
    letter-spacing: -0.02em;
    @include mono-nums;

    .sym { color: $color-text; font-weight: $fw-bold; }
    .quote { color: $color-text-dim; font-weight: $fw-regular; margin-left: 4px; }
  }

  .meta {
    @include row($space-sm);
    flex-wrap: wrap;
    font-size: $fs-sm;

    .name { color: $color-text-muted; }
  }
}

.cat-tag {
  @include row($space-xs);
  padding: 2px $space-sm;
  background: $color-surface-2;
  border-radius: $radius-sm;
  font-size: $fs-xs;
  color: $color-text-muted;

  .cat-dot {
    width: 6px;
    height: 6px;
    border-radius: $radius-full;
    background: var(--cat-color, #{$color-text-dim});
  }
}

.price-block {
  text-align: right;
  @include stack($space-xs);

  .price-head {
    @include row($space-sm);
    justify-content: flex-end;
  }

  .price {
    font-size: $fs-3xl;
    @include mono-nums;
    letter-spacing: -0.02em;
    &[data-trend='up']   { color: $color-accent; }
    &[data-trend='down'] { color: $color-danger; }
  }

  .sub-row {
    font-size: $fs-sm;
    @include mono-nums;
    @include row($space-sm);
    justify-content: flex-end;
    flex-wrap: wrap;

    .perf {
      &[data-trend='up']   { color: $color-accent; }
      &[data-trend='down'] { color: $color-danger; }
    }
  }
}

// ─── Body ─────────────────────────────────────────────────────────────────
.body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: $space-lg;
  align-items: start;

  @include media-down($bp-lg) {
    grid-template-columns: minmax(0, 1fr);
  }
}

.side-col {
  @include stack($space-md);
}

.chart-block { @include stack($space-md); }

.chart-head {
  @include flex-between;
  gap: $space-md;
  flex-wrap: wrap;
  min-width: 0;
}

.chart-controls {
  @include stack($space-sm);
  width: 100%;
  min-width: 0;
}

.shortcuts {
  @include row($space-sm);
  flex-wrap: wrap;
  min-width: 0;
}

.shortcut {
  padding: $space-2xs $space-sm;
  border: 1px solid $color-border;
  border-radius: $radius-full;
  background: $color-surface;
  color: $color-text-muted;
  font-size: $fs-xs;
  cursor: pointer;

  &:hover { color: $color-text; border-color: $color-border-hover; }
  &:focus-visible { @include ring-outset; }
  &.active { color: $color-accent; border-color: $color-accent; }
  &.reset { margin-left: auto; }
}

.intervals {
  @include row($space-2xs);
  padding: $space-xs;
  background: $color-surface-2;
  border-radius: $radius-md;
  max-width: 100%;
  overflow-x: auto;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }

  .interval {
    padding: $space-xs $space-md;
    background: transparent;
    border: 0;
    border-radius: $radius-sm;
    color: $color-text-muted;
    font-size: $fs-xs;
    font-weight: $fw-medium;
    font-family: $font-mono;
    cursor: pointer;
    transition: background $transition-fast, color $transition-fast;
    flex-shrink: 0;

    &:hover { color: $color-text; }
    &:focus-visible { @include ring-inset; }
    &.active {
      background: $color-surface;
      color: $color-text;
      box-shadow: $shadow-sm;
    }
  }
}

.chart-modes {
  @include row($space-2xs);
  width: fit-content;
  max-width: 100%;
  padding: $space-xs;
  background: $color-surface-2;
  border-radius: $radius-md;
  overflow-x: auto;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }

  .mode {
    @include row($space-xs);
    padding: $space-xs $space-md;
    background: transparent;
    border: 0;
    border-radius: $radius-sm;
    color: $color-text-muted;
    font-size: $fs-xs;
    font-weight: $fw-medium;
    font-family: $font-mono;
    cursor: pointer;
    transition: background $transition-fast, color $transition-fast;
    flex-shrink: 0;

    &:hover { color: $color-text; }
    &:focus-visible { @include ring-inset; }
    &.active {
      background: $color-surface;
      color: $color-text;
      box-shadow: $shadow-sm;
    }
  }
}

.chart-wrap {
  position: relative;
  @include stack($space-xs);
}

.chart-hint {
  font-size: $fs-2xs;
  color: $color-text-dim;
  font-family: $font-mono;
  letter-spacing: 0.02em;
  display: flex;
  gap: $space-sm;
  flex-wrap: wrap;

  kbd {
    font-family: $font-mono;
    padding: $space-2xs $space-xs;
    border: 1px solid $color-border;
    border-radius: $radius-sm;
    background: $color-surface-2;
    color: $color-text-muted;
    font-size: $fs-3xs;
  }
}

.chart-aux {
  @include flex-between;
  flex-wrap: wrap;
  gap: $space-sm;
  padding-top: $space-xs;
  border-top: 1px dashed $color-border;
}

.overlays-group {
  @include row($space-xs);
  flex-wrap: wrap;
}

.overlay-toggle {
  @include row($space-xs);
  padding: $space-xs $space-sm;
  font-size: $fs-2xs;
  font-weight: $fw-medium;
  font-family: $font-mono;
  background: $color-surface;
  border: 1px solid $color-border;
  border-radius: $radius-sm;
  color: $color-text-muted;
  cursor: pointer;

  .ov-swatch {
    width: 10px;
    height: 2px;
    border-radius: $radius-xs;
  }

  &:hover { color: $color-text; border-color: $color-border-hover; }
  &.active { color: $color-text; background: $color-surface-2; border-color: $color-border-hover; }
  &:focus-visible { @include ring-inset; }
}

.vol-toggle {
  @include row($space-xs);
  padding: $space-xs $space-sm;
  font-size: $fs-2xs;
  font-family: $font-mono;
  background: $color-surface;
  border: 1px solid $color-border;
  border-radius: $radius-sm;
  color: $color-text-muted;
  cursor: pointer;

  &:hover { color: $color-text; }
  &:focus-visible { @include ring-inset; }
  &.active { color: $color-accent; border-color: $color-accent; background: $color-accent-soft; }
}

.state-box {
  @include card;
  @include flex-center;
  @include stack($space-sm);
  padding: $space-2xl;
  color: $color-text-muted;
  text-align: center;
  min-height: 240px;

  &.error { color: $color-danger; }
  p { font-size: $fs-sm; }
}

.spin {
  animation: spin 1s linear infinite;
  @keyframes spin { to { transform: rotate(360deg); } }
}

.sr-only {
  position: absolute;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0,0,0,0);
  white-space: nowrap; border: 0;
}

// ─── Stats ────────────────────────────────────────────────────────────────
.stats-block { @include stack($space-md); }

.block-title { font-size: $fs-xl; font-weight: $fw-semibold; }

.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: $space-md;
}

.stat {
  @include card;
  @include stack($space-xs);
  min-width: 0;

  .label {
    font-size: $fs-xs;
    color: $color-text-muted;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .value {
    font-size: $fs-xl;
    @include mono-nums;
    @include truncate;

    &.up   { color: $color-accent; }
    &.down { color: $color-danger; }
  }
  .sub {
    font-size: $fs-xs;
    color: $color-text-dim;
    @include truncate;
  }
}

.dim { color: $color-text-dim; }
</style>
