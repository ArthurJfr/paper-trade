import { ofetch } from 'ofetch'

/**
 * DELETE /api/wallets/:id
 * Query : ?hard=true pour une suppression définitive (cascade positions+trades).
 * Par défaut, soft-archive (archived_at = NOW()).
 */
export default defineEventHandler(async (event): Promise<{ ok: boolean; id: number; hardDeleted: boolean }> => {
  const config = useRuntimeConfig()
  const id = getRouterParam(event, 'id')
  const q = getQuery(event)
  return await ofetch(`${config.backendApiBasePath}/wallets/${id}`, {
    method: 'DELETE',
    baseURL: config.backendApiUrl,
    headers: getHeaders(event) as HeadersInit,
    query: {
      hard: q.hard === 'true' ? 'true' : 'false',
    },
  })
})
