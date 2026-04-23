import type { PortfolioSnapshot } from '~~/shared/types/portfolio'

export default defineEventHandler(async (event): Promise<PortfolioSnapshot> => {
  const config = useRuntimeConfig()
  return await $fetch<PortfolioSnapshot>(`${config.backendApiBasePath}/portfolio`, {
    baseURL: config.backendApiUrl,
    headers: getHeaders(event) as HeadersInit,
  })
})
