<script setup lang="ts">
import type { CategoryKey, TaxonomyAsset, Ticker } from '~~/shared/types/market'
import { useMarketStore } from '~/stores/market'

useHead({ title: 'Marché · Paper-Trade' })

const store = useMarketStore()
const ui = useUiPreferencesStore()
const now = useNow(1000)
const marketAgeSec = computed(() => store.dataAgeSec(now.value))
const marketFreshness = computed(() => store.freshness(now.value))
const marketLatency = computed(() => store.latencyMs(now.value))
const lastSwitchSec = computed(() =>
  store.lastModeSwitchAt ? Math.max(0, Math.round((now.value - store.lastModeSwitchAt) / 1000)) : null,
)
const route = useRoute()
const router = useRouter()

// ─── État local (synchro URL ?cat=xxx) ─────────────────────────────────────
const filterCategory = ref<'all' | CategoryKey>(
  (route.query.cat as CategoryKey) || 'all',
)
const searchQuery = ref(typeof route.query.q === 'string' ? route.query.q : '')

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
  const q = searchQuery.value.trim()
  if (q) query.q = q
  router.replace({ query })
})

watch(searchQuery, () => {
  const query: Record<string, string> = {}
  if (filterCategory.value !== 'all') query.cat = filterCategory.value
  if (sortBy.value !== 'volume') query.sort = sortBy.value
  if (sortDir.value !== 'desc') query.dir = sortDir.value
  const q = searchQuery.value.trim()
  if (q) query.q = q
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
      categoryColor: cat?.color ?? 'var(--color-text-dim)',
      categoryLabel: cat?.label ?? a.category,
    }
  }),
)

// ─── Filtre : catégorie + recherche ────────────────────────────────────────
const filtered = computed<Row[]>(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return rows.value.filter((r) => {
    if (viewMode.value === 'watchlist' && !ui.isWatched(r.asset.pair)) return false
    if (filterCategory.value !== 'all' && r.asset.category !== filterCategory.value) return false
    if (filters.perfMin !== null && (r.ticker?.changePct ?? -Infinity) < filters.perfMin) return false
    if (filters.perfMax !== null && (r.ticker?.changePct ?? Infinity) > filters.perfMax) return false
    if (filters.volumeMin !== null && (r.ticker?.volume24h ?? 0) < filters.volumeMin) return false
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
type ColumnKey = SortKey | 'highLow'

interface Column {
  key: ColumnKey
  label: string
  className: string
  sortable: boolean
  optional?: boolean
}

const allColumns: Column[] = [
  { key: 'symbol',   label: 'Actif',       className: 'col-sym', sortable: true },
  { key: 'category', label: 'Catégorie',   className: 'col-cat', sortable: true },
  { key: 'price',    label: 'Prix',        className: 'col-num', sortable: true },
  { key: 'perf',     label: '24 h %',      className: 'col-num', sortable: true },
  { key: 'highLow',  label: 'H / L 24 h',  className: 'col-num', sortable: false, optional: true },
  { key: 'volume',   label: 'Volume 24 h', className: 'col-num', sortable: true },
]

const visibleCols = computed<ColumnKey[]>(() => {
  const s = new Set(ui.state.marketColumns as ColumnKey[])
  // garantir que 'symbol' est toujours visible
  s.add('symbol')
  return allColumns.filter(c => s.has(c.key)).map(c => c.key)
})

const columns = computed<Column[]>(() =>
  allColumns.filter(c => visibleCols.value.includes(c.key)),
)

function toggleColumn(key: ColumnKey) {
  const s = new Set(ui.state.marketColumns as ColumnKey[])
  if (s.has(key)) s.delete(key)
  else s.add(key)
  s.add('symbol')
  ui.setMarketColumns(Array.from(s) as ColumnKey[])
}

const sortPresets: { id: string, label: string, sort: SortKey, dir: SortDir }[] = [
  { id: 'gainers', label: 'Top gainers', sort: 'perf', dir: 'desc' },
  { id: 'losers', label: 'Top losers', sort: 'perf', dir: 'asc' },
  { id: 'volume', label: 'Plus gros volumes', sort: 'volume', dir: 'desc' },
]

const activePreset = computed(() =>
  sortPresets.find(p => p.sort === sortBy.value && p.dir === sortDir.value)?.id ?? null,
)

function applyPreset(preset: { sort: SortKey, dir: SortDir }) {
  sortBy.value = preset.sort
  sortDir.value = preset.dir
}

function toggleWatch(pair: string) {
  ui.toggleWatch(pair)
}

type ScreenerView = 'all' | 'watchlist'
const viewMode = ref<ScreenerView>((route.query.view as ScreenerView) === 'watchlist' ? 'watchlist' : 'all')
watch(viewMode, (v) => {
  const query = { ...route.query }
  if (v === 'watchlist') query.view = 'watchlist'
  else delete query.view
  router.replace({ query })
})

// ─── Filtres numériques avancés ────────────────────────────────────────────
const filters = reactive({
  perfMin: route.query.pmin ? Number(route.query.pmin) : null as number | null,
  perfMax: route.query.pmax ? Number(route.query.pmax) : null as number | null,
  volumeMin: route.query.vmin ? Number(route.query.vmin) : null as number | null,
})
const advancedOpen = ref(false)

watch(filters, () => {
  const query = { ...route.query }
  filters.perfMin === null ? delete query.pmin : query.pmin = String(filters.perfMin)
  filters.perfMax === null ? delete query.pmax : query.pmax = String(filters.perfMax)
  filters.volumeMin === null ? delete query.vmin : query.vmin = String(filters.volumeMin)
  router.replace({ query })
}, { deep: true })

const activeFilterCount = computed(() => {
  let n = 0
  if (filters.perfMin !== null) n++
  if (filters.perfMax !== null) n++
  if (filters.volumeMin !== null) n++
  return n
})

function resetAdvancedFilters() {
  filters.perfMin = null
  filters.perfMax = null
  filters.volumeMin = null
}

// ─── Menu colonnes & vues sauvegardées ─────────────────────────────────────
const columnsMenuOpen = ref(false)
const viewsMenuOpen = ref(false)
const newViewName = ref('')

function saveCurrentView() {
  const name = newViewName.value.trim() || `Vue ${ui.state.marketViews.length + 1}`
  ui.saveMarketView({
    label: name,
    category: filterCategory.value,
    query: searchQuery.value,
    sort: sortBy.value,
    dir: sortDir.value,
    columns: ui.state.marketColumns,
  })
  newViewName.value = ''
  viewsMenuOpen.value = false
}

function applyView(view: (typeof ui.state.marketViews)[number]) {
  filterCategory.value = view.category as typeof filterCategory.value
  searchQuery.value = view.query
  sortBy.value = view.sort as SortKey
  sortDir.value = view.dir
  ui.setMarketColumns(view.columns)
  viewsMenuOpen.value = false
}

function deleteView(id: string) {
  ui.deleteMarketView(id)
}

function closeAllMenus() {
  columnsMenuOpen.value = false
  viewsMenuOpen.value = false
}

// Références aux triggers pour restaurer le focus lors de la fermeture via Esc.
// `UiButton` est un composant wrappant un <button> : on accède à $el.
const columnsTrigger = ref<{ $el: HTMLElement } | null>(null)
const viewsTrigger = ref<{ $el: HTMLElement } | null>(null)

function restoreFocus(target: { $el: HTMLElement } | null) {
  const el = target?.$el
  if (el && typeof el.focus === 'function') el.focus()
}

onMounted(() => {
  const onDocClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement | null
    if (!target?.closest('.menu-wrap')) closeAllMenus()
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return
    if (!columnsMenuOpen.value && !viewsMenuOpen.value) return
    const wasCols = columnsMenuOpen.value
    const wasViews = viewsMenuOpen.value
    closeAllMenus()
    nextTick(() => {
      if (wasCols) restoreFocus(columnsTrigger.value)
      else if (wasViews) restoreFocus(viewsTrigger.value)
    })
  }
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onKey)
  onBeforeUnmount(() => {
    document.removeEventListener('click', onDocClick)
    document.removeEventListener('keydown', onKey)
  })
})

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
    { key: 'all' as const, label: 'Tout', color: 'var(--color-text-muted)', count: rows.value.length },
    ...store.taxonomy.categories.map(c => ({
      key: c.key,
      label: c.label,
      color: c.color,
      count: rows.value.filter(r => r.asset.category === c.key).length,
    })),
  ]
})

const unavailableCount = computed(() =>
  rows.value.filter(r => store.pairDataState(r.asset.pair) === 'unavailable').length,
)
</script>

<template>
  <section class="market">
    <PageHeader
      kicker="Exploration"
      title="Marché"
    >
      <template #subtitle>
        {{ summary.count }} actif<span v-if="summary.count > 1">s</span>
        · {{ summary.gainers }} en hausse · {{ summary.losers }} en baisse
      </template>
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

    <!-- Stats -->
    <div class="stats">
      <UiStatCard
        label="Performance moyenne"
        :value="fmtPerf(summary.avg)"
        :trend="trendOf(summary.avg)"
        hint="sur la sélection"
      />
      <UiStatCard
        label="Volume 24 h"
        :value="fmtVolume(summary.volume)"
        hint="cumulé USDT"
      />
      <UiStatCard
        label="Gainers"
        :value="String(summary.gainers)"
        trend="up"
        :hint="`sur ${summary.count}`"
      />
      <UiStatCard
        label="Losers"
        :value="String(summary.losers)"
        trend="down"
        :hint="`sur ${summary.count}`"
      />
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

    <div class="presets-row">
      <UiTabs
        v-model="viewMode"
        :items="[
          { key: 'all', label: 'Tout', icon: 'ph:grid-four-bold' },
          { key: 'watchlist', label: `Watchlist (${ui.state.watchlist.length})`, icon: 'ph:star-bold' },
        ]"
        aria-label="Vue du screener"
        size="sm"
      />
      <div class="presets">
        <button
          v-for="preset in sortPresets"
          :key="preset.id"
          class="preset"
          :class="{ active: activePreset === preset.id }"
          :aria-label="`Activer le preset ${preset.label}`"
          @click="applyPreset(preset)"
        >
          {{ preset.label }}
        </button>
      </div>
      <div class="screener-tools">
        <UiButton
          variant="ghost"
          size="sm"
          :aria-expanded="advancedOpen"
          :aria-label="advancedOpen ? 'Fermer les filtres avancés' : 'Ouvrir les filtres avancés'"
          @click="advancedOpen = !advancedOpen"
        >
          <Icon name="ph:funnel-bold" size="12" />
          Filtres
          <UiBadge v-if="activeFilterCount" variant="accent">{{ activeFilterCount }}</UiBadge>
        </UiButton>

        <div class="menu-wrap">
          <UiButton
            ref="columnsTrigger"
            variant="ghost"
            size="sm"
            :aria-expanded="columnsMenuOpen"
            aria-haspopup="true"
            aria-controls="columns-menu"
            aria-label="Configurer les colonnes"
            @click.stop="columnsMenuOpen = !columnsMenuOpen; viewsMenuOpen = false"
          >
            <Icon name="ph:columns-bold" size="12" />
            Colonnes
          </UiButton>
          <div
            v-if="columnsMenuOpen"
            id="columns-menu"
            class="menu"
            role="group"
            aria-label="Colonnes affichées"
          >
            <p class="menu-title">Colonnes affichées</p>
            <label
              v-for="c in allColumns"
              :key="c.key"
              class="menu-option"
              :class="{ locked: c.key === 'symbol' }"
            >
              <input
                type="checkbox"
                :checked="visibleCols.includes(c.key)"
                :disabled="c.key === 'symbol'"
                @change="toggleColumn(c.key)"
              />
              <span>{{ c.label }}</span>
            </label>
          </div>
        </div>

        <div class="menu-wrap">
          <UiButton
            ref="viewsTrigger"
            variant="ghost"
            size="sm"
            :aria-expanded="viewsMenuOpen"
            aria-haspopup="true"
            aria-controls="views-menu"
            aria-label="Gérer les vues sauvegardées"
            @click.stop="viewsMenuOpen = !viewsMenuOpen; columnsMenuOpen = false"
          >
            <Icon name="ph:bookmark-bold" size="12" />
            Vues
            <UiBadge v-if="ui.state.marketViews.length" variant="neutral">
              {{ ui.state.marketViews.length }}
            </UiBadge>
          </UiButton>
          <div
            v-if="viewsMenuOpen"
            id="views-menu"
            class="menu views-menu"
            role="group"
            aria-label="Vues sauvegardées"
          >
            <p class="menu-title">Vues sauvegardées</p>
            <ul v-if="ui.state.marketViews.length" class="views-list">
              <li v-for="v in ui.state.marketViews" :key="v.id" class="view-item">
                <button class="view-apply" @click="applyView(v)" :aria-label="`Appliquer la vue ${v.label}`">
                  {{ v.label }}
                </button>
                <button class="view-del" :aria-label="`Supprimer la vue ${v.label}`" @click="deleteView(v.id)">
                  <Icon name="ph:trash-bold" size="11" />
                </button>
              </li>
            </ul>
            <p v-else class="view-empty">Aucune vue enregistrée.</p>
            <form class="view-save" @submit.prevent="saveCurrentView">
              <input
                v-model="newViewName"
                type="text"
                placeholder="Nom de la vue"
                :aria-label="'Nom de la vue à sauvegarder'"
              />
              <UiButton type="submit" variant="primary" size="sm">Sauvegarder</UiButton>
            </form>
          </div>
        </div>
      </div>
    </div>

    <div v-if="advancedOpen" class="advanced">
      <div class="adv-group">
        <label class="adv-label">Perf min (%)</label>
        <input
          v-model.number="filters.perfMin"
          type="number"
          step="0.5"
          placeholder="ex. 5"
        />
      </div>
      <div class="adv-group">
        <label class="adv-label">Perf max (%)</label>
        <input
          v-model.number="filters.perfMax"
          type="number"
          step="0.5"
          placeholder="ex. 20"
        />
      </div>
      <div class="adv-group">
        <label class="adv-label">Volume min (USDT)</label>
        <input
          v-model.number="filters.volumeMin"
          type="number"
          step="1000"
          placeholder="ex. 1000000"
        />
      </div>
      <UiButton
        variant="ghost"
        size="sm"
        :disabled="activeFilterCount === 0"
        @click="resetAdvancedFilters"
      >
        Réinitialiser
      </UiButton>
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
        <p class="sub">
          Clique sur une colonne pour trier · {{ sorted.length }} résultat{{ sorted.length > 1 ? 's' : '' }}
          <span v-if="unavailableCount"> · {{ unavailableCount }} pair{{ unavailableCount > 1 ? 's' : '' }} indisponible{{ unavailableCount > 1 ? 's' : '' }}</span>
        </p>
      </div>
      <div class="table-wrap">
        <table v-if="sorted.length" class="assets-table">
          <thead>
            <tr>
              <th scope="col" class="col-watch" aria-label="Watchlist" />
              <th
                v-for="col in columns"
                :key="col.key"
                :class="[col.className, { sorted: col.sortable && sortBy === col.key }]"
                :aria-sort="col.sortable && sortBy === col.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined"
                scope="col"
              >
                <button
                  v-if="col.sortable"
                  type="button"
                  class="sort-btn"
                  :aria-label="`Trier par ${col.label}`"
                  @click="toggleSort(col.key as SortKey)"
                >
                  <span>{{ col.label }}</span>
                  <Icon
                    :name="sortBy === col.key
                      ? (sortDir === 'asc' ? 'ph:caret-up-bold' : 'ph:caret-down-bold')
                      : 'ph:caret-up-down-bold'"
                    size="11"
                    aria-hidden="true"
                  />
                </button>
                <span v-else class="col-static">{{ col.label }}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in sorted" :key="r.asset.pair" class="row">
              <td class="col-watch">
                <button
                  type="button"
                  class="watch-btn"
                  :class="{ active: ui.isWatched(r.asset.pair) }"
                  :aria-pressed="ui.isWatched(r.asset.pair)"
                  :aria-label="ui.isWatched(r.asset.pair) ? `Retirer ${r.asset.symbol} de la watchlist` : `Ajouter ${r.asset.symbol} à la watchlist`"
                  @click.stop="toggleWatch(r.asset.pair)"
                >
                  <Icon :name="ui.isWatched(r.asset.pair) ? 'ph:star-fill' : 'ph:star-bold'" size="14" />
                </button>
              </td>
              <td v-if="visibleCols.includes('symbol')" class="cell-sym">
                <NuxtLink :to="`/token/${r.asset.pair}`" class="sym-link">
                  <span class="sym">{{ r.asset.symbol }}</span>
                  <span class="name">{{ r.asset.name }}</span>
                </NuxtLink>
              </td>
              <td v-if="visibleCols.includes('category')">
                <span class="cat-tag" :style="{ '--cat-color': r.categoryColor }">
                  <span class="cat-dot" />
                  {{ r.categoryLabel }}
                </span>
              </td>
              <td v-if="visibleCols.includes('price')" class="col-num">
                {{ r.ticker ? '$' + fmtPrice(r.ticker.price) : store.pairDataLabel(r.asset.pair) }}
              </td>
              <td v-if="visibleCols.includes('perf')" class="col-num">
                <span v-if="r.ticker" class="perf" :data-trend="trendOf(r.ticker.changePct)">
                  {{ fmtPerf(r.ticker.changePct) }}
                </span>
                <span v-else class="dim">{{ store.pairDataLabel(r.asset.pair) }}</span>
              </td>
              <td v-if="visibleCols.includes('highLow')" class="col-num high-low">
                <template v-if="r.ticker">
                  <span class="hl-up">${{ fmtPrice(r.ticker.high24h) }}</span>
                  <span class="hl-sep">·</span>
                  <span class="hl-down">${{ fmtPrice(r.ticker.low24h) }}</span>
                </template>
                <span v-else class="dim">—</span>
              </td>
              <td v-if="visibleCols.includes('volume')" class="col-num">
                {{ r.ticker ? fmtVolume(r.ticker.volume24h) : store.pairDataLabel(r.asset.pair) }}
              </td>
            </tr>
          </tbody>
        </table>
        <UiEmptyState
          v-else
          icon="ph:magnifying-glass-bold"
          title="Aucun actif correspondant"
          description="Ajuste tes filtres ou ta recherche pour voir plus d'actifs."
        />
      </div>
    </section>
  </section>
</template>

<style lang="scss" scoped>
.market { @include stack($space-xl); }

.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: $space-md;

  @include media-down($bp-sm) {
    grid-template-columns: repeat(2, 1fr);
    gap: $space-sm;
  }
}

// ─── Filtres ─────────────────────────────────────────────────────────────
.filters {
  @include flex-between;
  gap: $space-md;
  flex-wrap: wrap;
  min-width: 0;

  @include media-down($bp-sm) {
    .search { width: 100%; min-width: 0; }
  }
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
  &:focus-visible { @include ring-outset; }

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
  flex: 1 1 240px;
  min-width: 0;
  max-width: 420px;

  input {
    flex: 1;
    min-width: 0;
    background: transparent;
    border: 0;
    outline: 0;
    color: $color-text;
    font-size: $fs-sm;
    &::placeholder { color: $color-text-dim; }
    &::-webkit-search-cancel-button { filter: invert(0.6); }
  }
}

.presets-row {
  @include flex-between;
  gap: $space-md;
  flex-wrap: wrap;
}

.presets {
  @include row($space-sm);
  flex-wrap: wrap;
}

.preset {
  padding: $space-xs $space-md;
  font-size: $fs-xs;
  font-weight: $fw-medium;
  border-radius: $radius-full;
  border: 1px solid $color-border;
  background: $color-surface;
  color: $color-text-muted;
  cursor: pointer;

  &:hover {
    border-color: $color-border-hover;
    color: $color-text;
  }
  &:focus-visible { @include ring-outset; }

  &.active {
    border-color: $color-accent;
    color: $color-accent;
    background: $color-accent-soft;
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
  border: 1px solid var(--heatmap-tile-border);
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
    border-color: var(--heatmap-tile-border-hover);
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
    &[data-trend='up']   { color: var(--heatmap-tile-up); }
    &[data-trend='down'] { color: var(--heatmap-tile-down); }
    &[data-trend='flat'] { color: $color-text-muted; }
  }

  .tile-price {
    font-size: $fs-xs;
    color: var(--heatmap-tile-price);
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
  @include panel;
  padding: 0;
  overflow-x: auto;
  @include scrollbar;
}

.assets-table {
  @include table-reset;

  thead th {
    padding: 0;
    text-align: left;
    font-weight: $fw-medium;
    color: var(--text-secondary);
    font-size: $fs-xs;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    border-bottom: 1px solid $color-border;
    white-space: nowrap;

    &.sorted { color: $color-accent; }
    &.col-num { text-align: right; }
  }

  .sort-btn {
    @include row($space-xs);
    width: 100%;
    padding: $space-md $space-lg;
    color: inherit;
    font-size: inherit;
    font-weight: inherit;
    text-transform: inherit;
    letter-spacing: inherit;
    text-align: left;
    border-radius: 0;
    background: transparent;

    &:hover { color: $color-text; }
    &:focus-visible { @include ring-inset; }
  }

  th.col-num .sort-btn {
    justify-content: flex-end;
    text-align: right;
  }

  tbody tr {
    border-bottom: 1px solid $color-border;
    transition: background $duration-fast $ease-standard;
    @include anim-fade-in($duration-fast, $ease-decelerate);
    &:last-child { border-bottom: 0; }
    &:hover { background: $color-surface-2; }
    &:focus-within { background: $color-surface-2; }
  }

  td {
    padding: $space-md $space-lg;
    vertical-align: middle;
  }

  .col-num { text-align: right; @include mono-nums; }
}

.cell-sym {
  .sym-link {
    color: inherit;
    display: block;
    &:focus-visible { outline: 2px solid $color-accent; outline-offset: 4px; border-radius: $radius-sm; }
  }
  .sym  { display: block; font-weight: $fw-semibold; @include mono-nums; }
  .name { display: block; color: var(--text-secondary); font-size: $fs-xs; margin-top: 2px; }
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

.screener-tools {
  @include row($space-xs);
  flex-wrap: wrap;
  margin-left: auto;

  @include media-down($bp-md) {
    margin-left: 0;
    width: 100%;
    justify-content: flex-start;
  }
}

.menu-wrap {
  position: relative;
}

.menu {
  position: absolute;
  right: 0;
  top: calc(100% + #{$space-xs});
  min-width: 240px;
  max-width: calc(100vw - #{$space-md * 2});
  padding: $space-sm;
  background: $color-surface;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  box-shadow: $shadow-md;
  z-index: $z-dropdown;
  @include stack($space-xs);
}

.menu-title {
  font-size: $fs-3xs;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: $color-text-dim;
  margin-bottom: $space-xs;
}

.menu-option {
  @include row($space-sm);
  padding: $space-xs;
  border-radius: $radius-sm;
  font-size: $fs-sm;
  color: $color-text;
  cursor: pointer;
  user-select: none;
  min-width: 0;

  &:hover { background: $color-surface-2; }
  &:focus-within { @include ring-inset; }
  &.locked { opacity: 0.6; cursor: not-allowed; }

  input[type='checkbox'] { accent-color: $color-accent; flex-shrink: 0; }

  > span { @include truncate; flex: 1; }
}

.views-menu {
  min-width: 280px;
  max-width: calc(100vw - #{$space-md * 2});
}

.views-list {
  list-style: none;
  padding: 0;
  margin: 0;
  @include stack($space-2xs);
}

.view-item {
  @include row($space-xs);
  border-radius: $radius-sm;
  min-width: 0;

  &:hover { background: $color-surface-2; }

  .view-apply {
    flex: 1;
    min-width: 0;
    padding: $space-xs $space-sm;
    background: transparent;
    border: 0;
    color: $color-text;
    text-align: left;
    font-size: $fs-sm;
    cursor: pointer;
    border-radius: $radius-sm;
    @include truncate;

    &:focus-visible { @include ring-inset; }
  }

  .view-del {
    padding: $space-xs;
    background: transparent;
    border: 0;
    color: $color-text-dim;
    cursor: pointer;
    border-radius: $radius-sm;
    flex-shrink: 0;

    &:hover { color: $color-danger; background: $color-danger-soft; }
    &:focus-visible { @include ring-inset; }
  }
}

.view-empty {
  font-size: $fs-xs;
  color: $color-text-dim;
  padding: $space-xs 0;
}

.view-save {
  @include row($space-xs);
  padding-top: $space-xs;
  border-top: 1px dashed $color-border;

  input {
    flex: 1;
    min-width: 0;
    width: 100%;
    padding: $space-xs $space-sm;
    background: $color-surface-2;
    border: 1px solid $color-border;
    border-radius: $radius-sm;
    color: $color-text;
    font-size: $fs-xs;

    &::placeholder { color: $color-text-dim; }
  }
}

.advanced {
  @include row($space-md);
  flex-wrap: wrap;
  padding: $space-md;
  background: $color-surface;
  border: 1px solid $color-border;
  border-radius: $radius-md;

  .adv-group {
    @include stack($space-xs);
    flex: 1 1 120px;
    min-width: 0;

    .adv-label {
      font-size: $fs-3xs;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: $color-text-dim;
    }

    input {
      width: 100%;
      min-width: 0;
      padding: $space-xs $space-sm;
      background: $color-surface-2;
      border: 1px solid $color-border;
      border-radius: $radius-sm;
      color: $color-text;
      font-size: $fs-sm;
      font-family: $font-mono;
      width: 100%;

      &:focus-visible { border-color: $color-accent; @include ring-inset; }
    }
  }
}

.high-low {
  @include mono-nums;
  font-size: $fs-xs;

  .hl-up   { color: $color-accent; }
  .hl-down { color: $color-danger; }
  .hl-sep  { color: $color-text-dim; margin: 0 4px; }
}

.col-static {
  display: block;
  padding: $space-md $space-lg;
  text-align: left;
  white-space: nowrap;
}

.assets-table th.col-num .col-static { text-align: right; }

.col-watch {
  width: 42px;
  padding-left: $space-md;
  padding-right: 0;
}

.watch-btn {
  @include flex-center;
  width: 28px;
  height: 28px;
  border: 0;
  background: transparent;
  color: $color-text-dim;
  border-radius: $radius-sm;
  cursor: pointer;
  transition: color $transition-fast, background $transition-fast;

  &:hover { color: $color-text; background: $color-surface-2; }
  &.active { color: $color-warning; }
  &:focus-visible { @include ring-inset; }
}

.dim { color: $color-text-dim; }
</style>
