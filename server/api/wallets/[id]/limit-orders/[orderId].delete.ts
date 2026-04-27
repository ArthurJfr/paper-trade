import { ofetch } from 'ofetch'

/**
 * DELETE /api/wallets/:id/limit-orders/:orderId
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const id = getRouterParam(event, 'id')
  const orderId = getRouterParam(event, 'orderId')
  return await ofetch(`${config.backendApiBasePath}/wallets/${id}/limit-orders/${orderId}`, {
    baseURL: config.backendApiUrl,
    method:  'DELETE',
    headers: getHeaders(event) as HeadersInit,
  })
})
