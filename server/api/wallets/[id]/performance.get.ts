import { ofetch } from 'ofetch'
import type { WalletPerformance } from '~~/shared/types/portfolio'

/**
 * GET /api/wallets/:id/performance?from=&to=
 */
export default defineEventHandler(async (event): Promise<WalletPerformance> => {
  const config = useRuntimeConfig()
  const id = getRouterParam(event, 'id')
  const q = getQuery(event)
  return await ofetch<WalletPerformance>(`${config.backendApiBasePath}/wallets/${id}/performance`, {
    baseURL: config.backendApiUrl,
    headers: getHeaders(event) as HeadersInit,
    query:   {
      ...(q.from != null && typeof q.from === 'string' ? { from: q.from } : {}),
      ...(q.to != null && typeof q.to === 'string' ? { to: q.to } : {}),
    },
  })
})
