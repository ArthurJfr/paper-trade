import type { WalletWithStats } from '~~/shared/types/wallet'

/**
 * POST /api/wallets/:id/restore
 * Restaure un wallet précédemment archivé (ne fonctionne que s'il reste
 * de la place dans la limite de 20 wallets actifs).
 */
export default defineEventHandler(async (event): Promise<WalletWithStats> => {
  const config = useRuntimeConfig()
  const id = getRouterParam(event, 'id')
  return await $fetch<WalletWithStats>(`${config.backendApiBasePath}/wallets/${id}/restore`, {
    method: 'POST',
    baseURL: config.backendApiUrl,
    headers: getHeaders(event) as HeadersInit,
  })
})
