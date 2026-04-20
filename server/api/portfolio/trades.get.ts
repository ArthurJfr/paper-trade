import type { TradeRecord } from '~~/shared/types/portfolio'
import { listTrades } from '~~/server/utils/portfolio'

/**
 * GET /api/portfolio/trades
 * Query : ?pair=BTCUSDT&limit=50&cursor=123
 */
export default defineEventHandler(async (event): Promise<TradeRecord[]> => {
  const q = getQuery(event)
  const pair   = typeof q.pair === 'string' ? q.pair : undefined
  const limit  = typeof q.limit === 'string' ? Number.parseInt(q.limit, 10) : 50
  const cursor = typeof q.cursor === 'string' ? Number.parseInt(q.cursor, 10) : undefined

  return listTrades({
    pair,
    limit: Number.isFinite(limit) ? limit : 50,
    cursor: Number.isFinite(cursor!) ? cursor : undefined,
  })
})
