import type { UpdateWalletRequest, WalletWithStats } from '~~/shared/types/wallet'

/**
 * PATCH /api/wallets/:id
 * Body : UpdateWalletRequest (tous champs optionnels).
 * Le backend renvoie 422 si `initialBalance` est modifié après un trade.
 */
export default defineEventHandler(async (event): Promise<WalletWithStats> => {
  const config = useRuntimeConfig()
  const id = getRouterParam(event, 'id')
  const body = await readBody<UpdateWalletRequest>(event)
  return await $fetch<WalletWithStats>(`${config.backendApiBasePath}/wallets/${id}`, {
    method: 'PATCH',
    baseURL: config.backendApiUrl,
    body,
    headers: getHeaders(event) as HeadersInit,
  })
})
