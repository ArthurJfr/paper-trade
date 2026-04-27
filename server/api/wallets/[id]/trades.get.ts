import { ofetch } from 'ofetch'
import type { TradeRecord } from '~~/shared/types/portfolio'

/**
 * GET /api/wallets/:id/trades
 * Query : ?pair=BTCUSDT&limit=50&cursor=123
 */
export default defineEventHandler(async (event): Promise<TradeRecord[]> => {
  const config = useRuntimeConfig()
  const id = getRouterParam(event, 'id')
  const q = getQuery(event)
  const pair   = typeof q.pair === 'string' ? q.pair : undefined
  const limit  = typeof q.limit === 'string' ? Number.parseInt(q.limit, 10) : 50
  const cursor = typeof q.cursor === 'string' ? Number.parseInt(q.cursor, 10) : undefined

  return await ofetch<TradeRecord[]>(`${config.backendApiBasePath}/wallets/${id}/trades`, {
    baseURL: config.backendApiUrl,
    headers: getHeaders(event) as HeadersInit,
    query: {
      pair,
      limit: Number.isFinite(limit) ? limit : 50,
      cursor: Number.isFinite(cursor!) ? cursor : undefined,
    },
  })
})
