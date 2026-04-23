import type { Kline, KlineInterval } from '~~/shared/types/market'

export default defineEventHandler(async (event): Promise<Kline[]> => {
  const config = useRuntimeConfig()
  const q = getQuery(event)

  const pair = String(q.pair ?? '').toUpperCase()
  const interval = String(q.interval ?? '1h') as KlineInterval
  const limit = Math.min(500, Math.max(10, Number(q.limit ?? 168)))
  return await $fetch<Kline[]>(`${config.backendApiBasePath}/market/klines`, {
    baseURL: config.backendApiUrl,
    headers: getHeaders(event) as HeadersInit,
    query: { pair, interval, limit },
  })
})
