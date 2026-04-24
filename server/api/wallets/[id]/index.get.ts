import type { WalletWithStats } from '~~/shared/types/wallet'
import type { PositionSummary } from '~~/shared/types/portfolio'

export interface WalletSnapshot extends WalletWithStats {
  positions: PositionSummary[]
}

/**
 * GET /api/wallets/:id
 * Renvoie le snapshot complet du wallet (meta + stats + positions).
 */
export default defineEventHandler(async (event): Promise<WalletSnapshot> => {
  const config = useRuntimeConfig()
  const id = getRouterParam(event, 'id')
  return await $fetch<WalletSnapshot>(`${config.backendApiBasePath}/wallets/${id}`, {
    baseURL: config.backendApiUrl,
    headers: getHeaders(event) as HeadersInit,
  })
})
