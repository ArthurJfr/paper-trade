import { ofetch } from 'ofetch'
import type { OrderRequest, OrderSubmitResult } from '~~/shared/types/portfolio'

/**
 * POST /api/wallets/:id/orders
 * Market (`type` omis ou "market") ou limite GTC (`type: "limit"` + `limitPrice`).
 */
export default defineEventHandler(async (event): Promise<OrderSubmitResult> => {
  const config = useRuntimeConfig()
  const id = getRouterParam(event, 'id')
  const body = await readBody<OrderRequest>(event)
  return await ofetch<OrderSubmitResult>(`${config.backendApiBasePath}/wallets/${id}/orders`, {
    method: 'POST',
    baseURL: config.backendApiUrl,
    body,
    headers: getHeaders(event) as HeadersInit,
  })
})
