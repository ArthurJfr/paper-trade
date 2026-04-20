import type { MarketSnapshot } from '~~/shared/types/market'
import type { OrderRequest, OrderResult } from '~~/shared/types/portfolio'
import { executeMarketOrder } from '~~/server/utils/portfolio'
import { loadTaxonomy } from '~~/server/utils/taxonomy'

/**
 * POST /api/portfolio/orders
 * Body : OrderRequest (pair, side, quantity | notional)
 * Fill market : prix = dernier snapshot Binance (cache 30 s côté market route).
 */
export default defineEventHandler(async (event): Promise<OrderResult> => {
  const body = await readBody<OrderRequest>(event)
  validateBody(body)

  const pair = body.pair.toUpperCase()
  const tracked = new Set(loadTaxonomy().assets.map(a => a.pair))
  if (!tracked.has(pair)) {
    throw createError({ statusCode: 400, statusMessage: `Pair inconnue : ${pair}` })
  }

  // Récupération du prix de fill via le snapshot market (cache 30 s).
  const snap = await $fetch<MarketSnapshot>('/api/market/snapshot', {
    headers: getHeaders(event) as HeadersInit,
  })
  const ticker = snap.tickers[pair]
  if (!ticker || !Number.isFinite(ticker.price) || ticker.price <= 0) {
    throw createError({
      statusCode: 503,
      statusMessage: `Aucun prix Binance pour ${pair} actuellement`,
    })
  }

  return executeMarketOrder({ order: { ...body, pair }, lastPrice: ticker.price })
})

function validateBody(b: Partial<OrderRequest> | null | undefined): asserts b is OrderRequest {
  if (!b || typeof b !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Body manquant' })
  }
  if (typeof b.pair !== 'string' || !b.pair.trim()) {
    throw createError({ statusCode: 400, statusMessage: '`pair` requise' })
  }
  if (b.side !== 'buy' && b.side !== 'sell') {
    throw createError({ statusCode: 400, statusMessage: '`side` doit être "buy" ou "sell"' })
  }
  const hasQty  = typeof b.quantity === 'number' && b.quantity > 0
  const hasNot  = typeof b.notional === 'number' && b.notional > 0
  if (hasQty === hasNot) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Fournir exactement `quantity` OU `notional`',
    })
  }
}
