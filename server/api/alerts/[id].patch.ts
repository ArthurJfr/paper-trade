import { ofetch } from 'ofetch'
import type { PriceAlert } from '~~/shared/types/portfolio'

export default defineEventHandler(async (event): Promise<PriceAlert> => {
  const config = useRuntimeConfig()
  const id = getRouterParam(event, 'id')
  const body = await readBody<Partial<{ active: boolean, webhookUrl: string | null }>>(event)
  return await ofetch<PriceAlert>(`${config.backendApiBasePath}/alerts/${id}`, {
    method:  'PATCH',
    baseURL: config.backendApiUrl,
    body,
    headers: getHeaders(event) as HeadersInit,
  })
})
