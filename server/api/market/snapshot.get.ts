import type { MarketSnapshot, Ticker } from '~~/shared/types/market'
import { loadTaxonomy } from '~~/server/utils/taxonomy'

// ─── Cache en mémoire (TTL 30 s) ─────────────────────────────────────────
let memo: { at: number; data: MarketSnapshot } | null = null
const TTL_MS = 30_000

// Format brut renvoyé par Binance /api/v3/ticker/24hr
interface BinanceTicker24h {
  symbol: string
  lastPrice: string
  openPrice: string
  highPrice: string
  lowPrice: string
  priceChangePercent: string
  quoteVolume: string
  closeTime: number
}

export default defineEventHandler(async (): Promise<MarketSnapshot> => {
  const now = Date.now()
  if (memo && now - memo.at < TTL_MS) return memo.data

  const taxonomy = loadTaxonomy()
  const tracked = new Set(taxonomy.assets.map(a => a.pair))

  let tickers: Record<string, Ticker> = {}
  let source: 'binance' | 'mock' = 'mock'

  try {
    const raw = await $fetch<BinanceTicker24h[]>(
      'https://api.binance.com/api/v3/ticker/24hr',
      { timeout: 8000, retry: 1 },
    )

    for (const t of raw) {
      if (!tracked.has(t.symbol)) continue
      tickers[t.symbol] = {
        symbol:     t.symbol,
        price:      Number.parseFloat(t.lastPrice),
        open24h:    Number.parseFloat(t.openPrice),
        high24h:    Number.parseFloat(t.highPrice),
        low24h:     Number.parseFloat(t.lowPrice),
        changePct:  Number.parseFloat(t.priceChangePercent),
        volume24h:  Number.parseFloat(t.quoteVolume),
        updatedAt:  t.closeTime,
      }
    }
    source = 'binance'
  } catch (err) {
    // Fallback offline : on renvoie des tickers vides, le dashboard gère l'état.
    console.warn('[market/snapshot] Binance unreachable, falling back to empty snapshot:', (err as Error).message)
    tickers = {}
    source = 'mock'
  }

  const snapshot: MarketSnapshot = {
    updatedAt: Date.now(),
    taxonomy,
    tickers,
    source,
  }

  memo = { at: now, data: snapshot }
  return snapshot
})
