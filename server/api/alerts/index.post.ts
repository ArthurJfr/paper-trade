import { ofetch } from 'ofetch'
import type { PriceAlert, CreatePriceAlertRequest } from '~~/shared/types/portfolio'

export default defineEventHandler(async (event): Promise<PriceAlert> => {
  const config = useRuntimeConfig()
  const body = await readBody<CreatePriceAlertRequest>(event)
  return await ofetch<PriceAlert>(`${config.backendApiBasePath}/alerts`, {
    method:  'POST',
    baseURL: config.backendApiUrl,
    body,
    headers: getHeaders(event) as HeadersInit,
  })
})
