import type { WalletWithStats } from '~~/shared/types/wallet'

/**
 * GET /api/wallets?archived=true|false
 * Renvoie la liste des wallets (par défaut non archivés) enrichis avec
 * leurs stats (equity, invested, perfPct, positionCount, tradeCount).
 */
export default defineEventHandler(async (event): Promise<WalletWithStats[]> => {
  const config = useRuntimeConfig()
  const q = getQuery(event)
  return await $fetch<WalletWithStats[]>(`${config.backendApiBasePath}/wallets`, {
    baseURL: config.backendApiUrl,
    headers: getHeaders(event) as HeadersInit,
    query: {
      archived: q.archived === 'true' ? 'true' : 'false',
    },
  })
})
