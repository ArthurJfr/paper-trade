import { ofetch } from 'ofetch'
import type { MarketSnapshot } from '~~/shared/types/market'

export default defineEventHandler(async (event): Promise<MarketSnapshot> => {
  const config = useRuntimeConfig()
  return await ofetch<MarketSnapshot>(`${config.backendApiBasePath}/market/snapshot`, {
    baseURL: config.backendApiUrl,
    headers: getHeaders(event) as HeadersInit,
  })
})
