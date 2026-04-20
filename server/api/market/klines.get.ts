import type { Kline, KlineInterval } from '~~/shared/types/market'

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/market/klines?pair=BTCUSDT&interval=1h&limit=168
// Proxy vers Binance /api/v3/klines avec cache TTL (évite rate limits).
// ─────────────────────────────────────────────────────────────────────────────

const VALID_INTERVALS: ReadonlySet<KlineInterval> = new Set<KlineInterval>([
  '1m', '5m', '15m', '1h', '4h', '1d', '1w',
])

// TTL par interval : on rafraîchit plus souvent pour les bougies courtes.
const TTL_MS: Record<KlineInterval, number> = {
  '1m': 3_000, '5m': 10_000, '15m': 20_000,
  '1h': 30_000, '4h': 60_000, '1d': 300_000, '1w': 900_000,
}

interface CacheEntry { at: number; data: Kline[] }
const cache = new Map<string, CacheEntry>()

// Tuple brut renvoyé par Binance :
// [openTime, open, high, low, close, volume, closeTime, quoteVolume, trades, ...]
type RawKline = [number, string, string, string, string, string, number, string, number, string, string, string]

export default defineEventHandler(async (event): Promise<Kline[]> => {
  const q = getQuery(event)

  const pair = String(q.pair ?? '').toUpperCase()
  const interval = String(q.interval ?? '1h') as KlineInterval
  const limit = Math.min(500, Math.max(10, Number(q.limit ?? 168)))

  if (!/^[A-Z0-9]{3,20}$/.test(pair)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid pair' })
  }
  if (!VALID_INTERVALS.has(interval)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid interval' })
  }

  const key = `${pair}:${interval}:${limit}`
  const now = Date.now()
  const ttl = TTL_MS[interval]

  const cached = cache.get(key)
  if (cached && now - cached.at < ttl) {
    return cached.data
  }

  try {
    const raw = await $fetch<RawKline[]>(
      `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=${interval}&limit=${limit}`,
      { timeout: 5000, retry: 1 },
    )

    const normalized: Kline[] = raw.map(k => ({
      openTime:    k[0],
      open:        Number.parseFloat(k[1]),
      high:        Number.parseFloat(k[2]),
      low:         Number.parseFloat(k[3]),
      close:       Number.parseFloat(k[4]),
      volume:      Number.parseFloat(k[5]),
      quoteVolume: Number.parseFloat(k[7]),
      trades:      Number(k[8]),
    }))

    cache.set(key, { at: now, data: normalized })
    return normalized
  } catch (err) {
    // Si on a une ancienne entrée, on sert du stale plutôt que de fail.
    if (cached) return cached.data
    console.warn('[market/klines] Binance unreachable:', (err as Error).message)
    throw createError({ statusCode: 502, statusMessage: 'Binance unreachable' })
  }
})
