import { ofetch } from 'ofetch'
import type { LimitOrderRecord } from '~~/shared/types/portfolio'

/**
 * GET /api/wallets/:id/limit-orders?status=open|all|filled|cancelled
 */
export default defineEventHandler(async (event): Promise<LimitOrderRecord[]> => {
  const config = useRuntimeConfig()
  const id = getRouterParam(event, 'id')
  const q = getQuery(event)
  const status = typeof q.status === 'string' ? q.status : 'open'
  return await ofetch<LimitOrderRecord[]>(`${config.backendApiBasePath}/wallets/${id}/limit-orders`, {
    baseURL: config.backendApiUrl,
    headers: getHeaders(event) as HeadersInit,
    query:   { status },
  })
})
