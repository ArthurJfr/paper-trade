import { defineStore } from 'pinia'
import type {
  CategoryStats,
  MarketSnapshot,
  StreamStatus,
  Taxonomy,
  TaxonomyAsset,
  Ticker,
} from '~~/shared/types/market'

// Volume minimum pour pondérer la performance (en USDT).
// Évite que des micro-caps absents de données pourries tirent les moyennes.
const MIN_WEIGHT_VOLUME = 10_000

export const useMarketStore = defineStore('market', () => {
  // ─── State ────────────────────────────────────────────────────────────
  const tickers       = ref<Record<string, Ticker>>({})
  const taxonomy      = ref<Taxonomy>({ categories: [], assets: [] })
  const streamStatus  = ref<StreamStatus>('idle')
  const source        = ref<'binance' | 'mock'>('mock')
  const updatedAt     = ref<number>(0)

  // ─── Lookups ──────────────────────────────────────────────────────────
  const assetByPair = computed<Map<string, TaxonomyAsset>>(() => {
    const m = new Map<string, TaxonomyAsset>()
    for (const a of taxonomy.value.assets) m.set(a.pair, a)
    return m
  })

  const categoryByKey = computed(() => {
    const m = new Map<string, { key: string, label: string, color: string }>()
    for (const c of taxonomy.value.categories) m.set(c.key, c)
    return m
  })

  // ─── Computed : stats par catégorie (perf pondérée par volume) ────────
  const categoryStats = computed<CategoryStats[]>(() => {
    const buckets = new Map<string, { sumWeighted: number, sumWeight: number, count: number, volume: number }>()

    for (const asset of taxonomy.value.assets) {
      const t = tickers.value[asset.pair]
      if (!t) continue
      const weight = Math.max(t.volume24h, MIN_WEIGHT_VOLUME)
      const bucket = buckets.get(asset.category) ?? { sumWeighted: 0, sumWeight: 0, count: 0, volume: 0 }
      bucket.sumWeighted += t.changePct * weight
      bucket.sumWeight   += weight
      bucket.count       += 1
      bucket.volume      += t.volume24h
      buckets.set(asset.category, bucket)
    }

    return taxonomy.value.categories.map((cat) => {
      const b = buckets.get(cat.key)
      const perf = b && b.sumWeight > 0 ? b.sumWeighted / b.sumWeight : 0
      return {
        key:       cat.key as CategoryStats['key'],
        label:     cat.label,
        color:     cat.color,
        perf24h:   perf,
        count:     b?.count ?? 0,
        volume24h: b?.volume ?? 0,
      }
    })
  })

  // ─── Top movers (top 10 par |perf|, filtré sur volume > seuil) ────────
  const topMovers = computed(() => {
    const minVol = 100_000
    const rows = taxonomy.value.assets
      .map((a) => {
        const t = tickers.value[a.pair]
        if (!t || t.volume24h < minVol) return null
        return { asset: a, ticker: t }
      })
      .filter((x): x is { asset: TaxonomyAsset, ticker: Ticker } => x !== null)

    return [...rows]
      .sort((a, b) => Math.abs(b.ticker.changePct) - Math.abs(a.ticker.changePct))
      .slice(0, 10)
  })

  // ─── Stats globales ───────────────────────────────────────────────────
  const btcDominance = computed(() => {
    const btc = tickers.value.BTCUSDT
    return btc ? { price: btc.price, change: btc.changePct } : null
  })

  const totalVolume24h = computed(() =>
    Object.values(tickers.value).reduce((sum, t) => sum + t.volume24h, 0),
  )

  const isLoaded = computed(() => Object.keys(tickers.value).length > 0)
  const pairs    = computed(() => taxonomy.value.assets.map(a => a.pair))

  // ─── Actions ──────────────────────────────────────────────────────────
  function hydrate(snap: MarketSnapshot) {
    taxonomy.value  = snap.taxonomy
    tickers.value   = { ...snap.tickers }
    source.value    = snap.source
    updatedAt.value = snap.updatedAt
  }

  function applyUpdates(updates: Ticker[]) {
    const next = { ...tickers.value }
    for (const u of updates) next[u.symbol] = u
    tickers.value   = next
    updatedAt.value = Date.now()
  }

  function setStreamStatus(s: StreamStatus) {
    streamStatus.value = s
  }

  return {
    // state
    tickers,
    taxonomy,
    streamStatus,
    source,
    updatedAt,
    // getters
    assetByPair,
    categoryByKey,
    categoryStats,
    topMovers,
    btcDominance,
    totalVolume24h,
    isLoaded,
    pairs,
    // actions
    hydrate,
    applyUpdates,
    setStreamStatus,
  }
})
