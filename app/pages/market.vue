<script setup lang="ts">
import type { CategoryKey, TaxonomyAsset, Ticker } from '~~/shared/types/market'
import { useMarketStore } from '~/stores/market'

useHead({ title: 'Marché · Paper-Trade' })

const store = useMarketStore()
const route = useRoute()
const router = useRouter()

// ─── État local (synchro URL ?cat=xxx) ─────────────────────────────────────
const filterCategory = ref<'all' | CategoryKey>(
  (route.query.cat as CategoryKey) || 'all',
)
const searchQuery = ref('')

type SortKey = 'symbol' | 'category' | 'price' | 'perf' | 'volume'
type SortDir = 'asc' | 'desc'

const sortBy = ref<SortKey>((route.query.sort as SortKey) || 'volume')
const sortDir = ref<SortDir>((route.query.dir as SortDir) || 'desc')

// Synchronisation bidirectionnelle avec l'URL (sans reload).
watch([filterCategory, sortBy, sortDir], ([cat, by, dir]) => {
  const query: Record<string, string> = {}
  if (cat !== 'all')   query.cat = cat
  if (by !== 'volume') query.sort = by
  if (dir !== 'desc')  query.dir = dir
  router.replace({ query })
})

// ─── Modèle : merge assets + tickers ───────────────────────────────────────
interface Row {
  asset: TaxonomyAsset
  ticker: Ticker | null
  categoryColor: string
  categoryLabel: string
}

const rows = computed<Row[]>(() =>
  store.taxonomy.assets.map((a) => {
    const cat = store.categoryByKey.get(a.category)
    return {
      asset: a,
      ticker: store.tickers[a.pair] ?? null,
      categoryColor: cat?.color ?? '#5f6368',
      categoryLabel: cat?.label ?? a.category,
    }
  }),
)

// ─── Filtre : catégorie + recherche ────────────────────────────────────────
const filtered = computed<Row[]>(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return rows.value.filter((r) => {
    if (filterCategory.value !== 'all' && r.asset.category !== filterCategory.value) return false
    if (!q) return true
    return (
      r.asset.symbol.toLowerCase().includes(q)
      || r.asset.name.toLowerCase().includes(q)
      || r.asset.pair.toLowerCase().includes(q)
    )
  })
})

// ─── Tri ───────────────────────────────────────────────────────────────────
const sorted = computed<Row[]>(() => {
  const list = [...filtered.value]
  const dir = sortDir.value === 'asc' ? 1 : -1

  list.sort((a, b) => {
    const va = valueFor(a, sortBy.value)
    const vb = valueFor(b, sortBy.value)
    if (va == null && vb == null) return 0
    if (va == null) return 1
    if (vb == null) return -1
    if (typeof va === 'string' && typeof vb === 'string') {
      return va.localeCompare(vb) * dir
    }
    return ((va as number) - (vb as number)) * dir
  })
  return list
})

function valueFor(row: Row, key: SortKey): string | number | null {
  switch (key) {
    case 'symbol':   return row.asset.symbol
    case 'category': return row.categoryLabel
    case 'price':    return row.ticker?.price ?? null
    case 'perf':     return row.ticker?.changePct ?? null
    case 'volume':   return row.ticker?.volume24h ?? null
  }
}

function toggleSort(key: SortKey) {
  if (sortBy.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortBy.value = key
    sortDir.value = key === 'symbol' || key === 'category' ? 'asc' : 'desc'
  }
}

function selectCategory(key: 'all' | CategoryKey) {
  filterCategory.value = key
}

// ─── Colonnes de la table ──────────────────────────────────────────────────
const columns: { key: SortKey, label: string, className: string }[] = [
  { key: 'symbol',   label: 'Actif',       className: 'col-sym' },
  { key: 'category', label: 'Catégorie',   className: 'col-cat' },
  { key: 'price',    label: 'Prix',        className: 'col-num' },
  { key: 'perf',     label: '24 h %',      className: 'col-num' },
  { key: 'volume',   label: 'Volume 24 h', className: 'col-num' },
]

// ─── Stats globales (sur le filtre courant) ────────────────────────────────
const summary = computed(() => {
  const tickers = filtered.value.map(r => r.ticker).filter((t): t is Ticker => t !== null)
  if (tickers.length === 0) {
    return { gainers: 0, losers: 0, volume: 0, avg: 0, count: 0 }
  }
  const gainers = tickers.filter(t => t.changePct > 0).length
  const losers  = tickers.filter(t => t.changePct < 0).length
  const volume  = tickers.reduce((s, t) => s + t.volume24h, 0)
  const avg     = tickers.reduce((s, t) => s + t.changePct, 0) / tickers.length
  return { gainers, losers, volume, avg, count: tickers.length }
})

// ─── Heatmap : trier par volume décroissant pour afficher les gros d'abord ─
const heatmapRows = computed<Row[]>(() =>
  [...filtered.value]
    .filter(r => r.ticker !== null)
    .sort((a, b) => (b.ticker!.volume24h - a.ticker!.volume24h)),
)

// ─── Catégories pour les pills (avec compteur) ─────────────────────────────
const categoryPills = computed(() => {
  return [
    { key: 'all' as const, label: 'Tout', color: '#9aa0a6', count: rows.value.length },
    ...store.taxonomy.categories.map(c => ({
      key: c.key,
      label: c.label,
      color: c.color,
      count: rows.value.filter(r => r.asset.category === c.key).length,
    })),
  ]
})
</script>

<template>
  <section class="market">
    <header class="head">
      <div>
        <h1>Marché</h1>
        <p class="sub">
          {{ summary.count }} actif<span v-if="summary.count > 1">s</span>
          · {{ summary.gainers }} en hausse · {{ summary.losers }} en baisse
        </p>
      </div>
      <span class="chip" :data-status="store.streamStatus">
        <span class="dot" />
        {{ store.streamStatus === 'live' ? 'Live · Binance WS' : store.streamStatus }}
      </span>
    </header>

    <!-- Stats -->
    <div class="stats">
      <article class="stat">
        <span class="label">Performance moyenne</span>
        <strong class="value" :data-trend="trendOf(summary.avg)">{{ fmtPerf(summary.avg) }}</strong>
        <span class="sub">sur la sélection</span>
      </article>
      <article class="stat">
        <span class="label">Volume 24 h</span>
        <strong class="value">{{ fmtVolume(summary.volume) }}</strong>
        <span class="sub">cumulé USDT</span>
      </article>
      <article class="stat">
        <span class="label">Gainers</span>
        <strong class="value" style="color: var(--color-accent, #16c784)">{{ summary.gainers }}</strong>
        <span class="sub">sur {{ summary.count }}</span>
      </article>
      <article class="stat">
        <span class="label">Losers</span>
        <strong class="value" style="color: var(--color-danger, #ea3943)">{{ summary.losers }}</strong>
        <span class="sub">sur {{ summary.count }}</span>
      </article>
    </div>

    <!-- Filtres catégorie + recherche -->
    <div class="filters">
      <div class="pills">
        <button
          v-for="p in categoryPills"
          :key="p.key"
          class="pill"
          :class="{ active: filterCategory === p.key }"
          :style="{ '--pill-color': p.color }"
          @click="selectCategory(p.key)"
        >
          <span class="pill-dot" />
          {{ p.label }}
          <span class="pill-count">{{ p.count }}</span>
        </button>
      </div>
      <div class="search">
        <Icon name="ph:magnifying-glass-bold" size="14" />
        <input
          v-model="searchQuery"
          placeholder="Filtrer par symbole ou nom…"
          type="search"
        />
      </div>
    </div>

    <!-- Heatmap -->
    <section class="block">
      <div class="block-head">
        <h2>Heatmap</h2>
        <p class="sub">Couleur = variation 24 h · taille uniforme · triée par volume</p>
      </div>
      <div v-if="heatmapRows.length" class="heatmap">
        <NuxtLink
          v-for="r in heatmapRows"
          :key="r.asset.pair"
          :to="`/token/${r.asset.pair}`"
          class="tile"
          :style="{
            backgroundColor: perfHeatColor(r.ticker!.changePct),
            '--cat-color': r.categoryColor,
          }"
          :title="`${r.asset.name} · ${fmtVolume(r.ticker!.volume24h)}`"
        >
          <span class="tile-cat" aria-hidden="true" />
          <span class="tile-sym">{{ r.asset.symbol }}</span>
          <strong class="tile-perf" :data-trend="trendOf(r.ticker!.changePct)">
            {{ fmtPerf(r.ticker!.changePct) }}
          </strong>
          <span class="tile-price">${{ fmtPrice(r.ticker!.price) }}</span>
        </NuxtLink>
      </div>
      <div v-else class="empty">
        <Icon name="ph:cloud-slash-bold" size="20" />
        <p>Aucun actif dans cette sélection.</p>
      </div>
    </section>

    <!-- Table -->
    <section class="block">
      <div class="block-head">
        <h2>Actifs</h2>
        <p class="sub">Clique sur une colonne pour trier · {{ sorted.length }} résultat{{ sorted.length > 1 ? 's' : '' }}</p>
      </div>
      <div class="table-wrap">
        <table class="assets-table">
          <thead>
            <tr>
              <th
                v-for="col in columns"
                :key="col.key"
                :class="[col.className, { sorted: sortBy === col.key }]"
                :data-dir="sortBy === col.key ? sortDir : null"
                @click="toggleSort(col.key)"
              >
                {{ col.label }}
                <Icon
                  :name="sortBy === col.key
                    ? (sortDir === 'asc' ? 'ph:caret-up-bold' : 'ph:caret-down-bold')
                    : 'ph:caret-up-down-bold'"
                  size="11"
                />
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="r in sorted"
              :key="r.asset.pair"
              class="row-link"
              tabindex="0"
              @click="router.push(`/token/${r.asset.pair}`)"
              @keydown.enter="router.push(`/token/${r.asset.pair}`)"
            >
              <td class="cell-sym">
                <NuxtLink :to="`/token/${r.asset.pair}`" class="sym-link" @click.stop>
                  <span class="sym">{{ r.asset.symbol }}</span>
                  <span class="name">{{ r.asset.name }}</span>
                </NuxtLink>
              </td>
              <td>
                <span class="cat-tag" :style="{ '--cat-color': r.categoryColor }">
                  <span class="cat-dot" />
                  {{ r.categoryLabel }}
                </span>
              </td>
              <td class="col-num">{{ r.ticker ? '$' + fmtPrice(r.ticker.price) : '—' }}</td>
              <td class="col-num">
                <span v-if="r.ticker" class="perf" :data-trend="trendOf(r.ticker.changePct)">
                  {{ fmtPerf(r.ticker.changePct) }}
                </span>
                <span v-else class="dim">—</span>
              </td>
              <td class="col-num">{{ r.ticker ? fmtVolume(r.ticker.volume24h) : '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </section>
</template>

<style lang="scss" scoped>
.market { @include stack($space-xl); }

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
  }

  &[data-status='live'] .dot {
    background: $color-accent;
    box-shadow: 0 0 0 4px $color-accent-soft;
  }
  &[data-status='offline'] .dot,
  &[data-status='reconnecting'] .dot {
    background: $color-danger;
  }
}

// ─── Stats ───────────────────────────────────────────────────────────────
.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: $space-md;
}

.stat {
  @include card;
  @include stack($space-xs);

  .label {
    font-size: $fs-xs;
    color: $color-text-muted;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .value {
    font-size: $fs-2xl;
    @include mono-nums;
    &[data-trend='up']   { color: $color-accent; }
    &[data-trend='down'] { color: $color-danger; }
  }
  .sub {
    font-size: $fs-xs;
    color: $color-text-dim;
  }
}

// ─── Filtres ─────────────────────────────────────────────────────────────
.filters {
  @include flex-between;
  gap: $space-md;
  flex-wrap: wrap;
}

.pills {
  @include row($space-sm);
  flex-wrap: wrap;
}

.pill {
  @include row($space-xs);
  padding: $space-xs $space-md;
  background: $color-surface;
  border: 1px solid $color-border;
  border-radius: $radius-full;
  color: $color-text-muted;
  font-size: $fs-sm;
  font-weight: $fw-medium;
  cursor: pointer;
  transition: border-color $transition-fast, background $transition-fast, color $transition-fast;

  .pill-dot {
    width: 6px;
    height: 6px;
    border-radius: $radius-full;
    background: var(--pill-color, #{$color-text-dim});
  }

  .pill-count {
    font-family: $font-mono;
    font-size: $fs-xs;
    color: $color-text-dim;
    background: $color-surface-2;
    padding: 1px 6px;
    border-radius: $radius-full;
  }

  &:hover {
    border-color: $color-border-hover;
    color: $color-text;
  }

  &.active {
    background: $color-surface-2;
    color: $color-text;
    border-color: var(--pill-color, #{$color-accent});

    .pill-count {
      background: $color-bg;
      color: $color-text-muted;
    }
  }
}

.search {
  @include row($space-sm);
  padding: $space-xs $space-md;
  background: $color-surface-2;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  color: $color-text-muted;
  min-width: 240px;

  input {
    flex: 1;
    background: transparent;
    border: 0;
    outline: 0;
    color: $color-text;
    font-size: $fs-sm;
    &::placeholder { color: $color-text-dim; }
    &::-webkit-search-cancel-button { filter: invert(0.6); }
  }
}

// ─── Blocks ──────────────────────────────────────────────────────────────
.block { @include stack($space-md); }

.block-head {
  h2   { font-size: $fs-xl; font-weight: $fw-semibold; }
  .sub { color: $color-text-muted; font-size: $fs-xs; margin-top: $space-xs; }
}

// ─── Heatmap ─────────────────────────────────────────────────────────────
.heatmap {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 6px;
}

.tile {
  @include stack($space-xs);
  position: relative;
  padding: $space-md;
  border-radius: $radius-md;
  border: 1px solid rgba(255, 255, 255, 0.04);
  cursor: pointer;
  text-decoration: none;
  color: inherit;
  transition: transform $transition-fast, border-color $transition-fast;
  min-height: 96px;

  &::after {
    content: '';
    position: absolute;
    inset: 0 auto 0 0;
    width: 2px;
    background: var(--cat-color);
    opacity: 0.6;
    border-radius: $radius-md 0 0 $radius-md;
  }

  &:hover {
    transform: translateY(-1px);
    border-color: rgba(255, 255, 255, 0.12);
    z-index: 1;
  }

  .tile-sym {
    font-weight: $fw-semibold;
    font-size: $fs-sm;
    @include mono-nums;
    letter-spacing: -0.01em;
  }

  .tile-perf {
    font-size: $fs-lg;
    @include mono-nums;
    &[data-trend='up']   { color: #a6f4c5; }
    &[data-trend='down'] { color: #fca5a5; }
    &[data-trend='flat'] { color: $color-text-muted; }
  }

  .tile-price {
    font-size: $fs-xs;
    color: rgba(255, 255, 255, 0.65);
    @include mono-nums;
    @include truncate;
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

// ─── Table ───────────────────────────────────────────────────────────────
.table-wrap {
  @include card;
  padding: 0;
  overflow-x: auto;
}

.assets-table {
  width: 100%;
  border-collapse: collapse;
  font-size: $fs-sm;

  thead th {
    @include row($space-xs);
    display: table-cell;
    padding: $space-md $space-lg;
    text-align: left;
    font-weight: $fw-medium;
    color: $color-text-muted;
    font-size: $fs-xs;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    border-bottom: 1px solid $color-border;
    cursor: pointer;
    user-select: none;
    white-space: nowrap;

    &:hover { color: $color-text; }
    &.sorted { color: $color-accent; }

    &.col-num { text-align: right; }
  }

  tbody tr {
    border-bottom: 1px solid $color-border;
    transition: background $transition-fast;
    &:last-child { border-bottom: 0; }
    &:hover { background: $color-surface-2; }

    &.row-link {
      cursor: pointer;
      &:focus-visible {
        outline: 2px solid $color-accent;
        outline-offset: -2px;
      }
    }
  }

  td {
    padding: $space-md $space-lg;
    vertical-align: middle;
  }

  .col-num { text-align: right; @include mono-nums; }
}

.cell-sym {
  .sym-link { color: inherit; display: block; }
  .sym  { display: block; font-weight: $fw-semibold; @include mono-nums; }
  .name { display: block; color: $color-text-muted; font-size: $fs-xs; margin-top: 2px; }
}

.cat-tag {
  @include row($space-xs);
  padding: 2px $space-sm;
  background: $color-surface-2;
  border-radius: $radius-sm;
  font-size: $fs-xs;
  color: $color-text-muted;
  white-space: nowrap;

  .cat-dot {
    width: 6px;
    height: 6px;
    border-radius: $radius-full;
    background: var(--cat-color, #{$color-text-dim});
  }
}

.perf {
  @include mono-nums;
  font-weight: $fw-semibold;
  &[data-trend='up']   { color: $color-accent; }
  &[data-trend='down'] { color: $color-danger; }
}

.dim { color: $color-text-dim; }
</style>
