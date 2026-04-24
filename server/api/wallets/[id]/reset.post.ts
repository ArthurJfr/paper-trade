import type { WalletWithStats } from '~~/shared/types/wallet'

/**
 * POST /api/wallets/:id/reset
 * Vide les positions + trades du wallet et remet le cash au capital initial.
 */
export default defineEventHandler(async (event): Promise<WalletWithStats> => {
  const config = useRuntimeConfig()
  const id = getRouterParam(event, 'id')
  return await $fetch<WalletWithStats>(`${config.backendApiBasePath}/wallets/${id}/reset`, {
    method: 'POST',
    baseURL: config.backendApiUrl,
    headers: getHeaders(event) as HeadersInit,
  })
})
