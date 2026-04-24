import type { PositionSummary } from '~~/shared/types/portfolio'

/**
 * GET /api/wallets/:id/positions
 */
export default defineEventHandler(async (event): Promise<PositionSummary[]> => {
  const config = useRuntimeConfig()
  const id = getRouterParam(event, 'id')
  return await $fetch<PositionSummary[]>(`${config.backendApiBasePath}/wallets/${id}/positions`, {
    baseURL: config.backendApiUrl,
    headers: getHeaders(event) as HeadersInit,
  })
})
