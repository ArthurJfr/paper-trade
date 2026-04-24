import type { WalletWithStats } from '~~/shared/types/wallet'

interface DuplicateRequest {
  name?: string
  initialBalance?: number
}

/**
 * POST /api/wallets/:id/duplicate
 * Clone les métadonnées d'un wallet (nom suffixé « (copie) » par défaut).
 * Les positions et trades ne sont pas copiés : le clone démarre au capital initial.
 */
export default defineEventHandler(async (event): Promise<WalletWithStats> => {
  const config = useRuntimeConfig()
  const id = getRouterParam(event, 'id')
  const body = await readBody<DuplicateRequest>(event).catch(() => ({} as DuplicateRequest))
  return await $fetch<WalletWithStats>(`${config.backendApiBasePath}/wallets/${id}/duplicate`, {
    method: 'POST',
    baseURL: config.backendApiUrl,
    headers: getHeaders(event) as HeadersInit,
    body,
  })
})
