import type { CreateWalletRequest, WalletWithStats } from '~~/shared/types/wallet'

/**
 * POST /api/wallets
 * Body : CreateWalletRequest (name, initialBalance requis)
 * Renvoie le WalletWithStats fraîchement créé (HTTP 201).
 */
export default defineEventHandler(async (event): Promise<WalletWithStats> => {
  const config = useRuntimeConfig()
  const body = await readBody<CreateWalletRequest>(event)
  return await $fetch<WalletWithStats>(`${config.backendApiBasePath}/wallets`, {
    method: 'POST',
    baseURL: config.backendApiUrl,
    body,
    headers: getHeaders(event) as HeadersInit,
  })
})
