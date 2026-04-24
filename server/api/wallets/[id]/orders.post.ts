import type { OrderRequest, OrderResult } from '~~/shared/types/portfolio'

/**
 * POST /api/wallets/:id/orders
 * Body : OrderRequest (pair, side, quantity | notional)
 * Exécute un ordre market scopé au wallet :id.
 */
export default defineEventHandler(async (event): Promise<OrderResult> => {
  const config = useRuntimeConfig()
  const id = getRouterParam(event, 'id')
  const body = await readBody<OrderRequest>(event)
  return await $fetch<OrderResult>(`${config.backendApiBasePath}/wallets/${id}/orders`, {
    method: 'POST',
    baseURL: config.backendApiUrl,
    body,
    headers: getHeaders(event) as HeadersInit,
  })
})
