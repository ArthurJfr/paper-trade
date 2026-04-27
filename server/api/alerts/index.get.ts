import { ofetch } from 'ofetch'
import type { PriceAlert } from '~~/shared/types/portfolio'

export default defineEventHandler(async (event): Promise<PriceAlert[]> => {
  const config = useRuntimeConfig()
  return await ofetch<PriceAlert[]>(`${config.backendApiBasePath}/alerts`, {
    baseURL: config.backendApiUrl,
    headers: getHeaders(event) as HeadersInit,
  })
})
