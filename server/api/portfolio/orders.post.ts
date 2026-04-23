import type { OrderRequest, OrderResult } from '~~/shared/types/portfolio'

/**
 * POST /api/portfolio/orders
 * Body : OrderRequest (pair, side, quantity | notional)
 * Fill market : prix = dernier snapshot Binance (cache 30 s côté market route).
 */
export default defineEventHandler(async (event): Promise<OrderResult> => {
  const config = useRuntimeConfig()
  const body = await readBody<OrderRequest>(event)
  return await $fetch<OrderResult>(`${config.backendApiBasePath}/portfolio/orders`, {
    method: 'POST',
    baseURL: config.backendApiUrl,
    body,
    headers: getHeaders(event) as HeadersInit,
  })
})
