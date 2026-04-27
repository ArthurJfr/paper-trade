import { ofetch } from 'ofetch'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const id = getRouterParam(event, 'id')
  return await ofetch(`${config.backendApiBasePath}/alerts/${id}`, {
    method:  'DELETE',
    baseURL: config.backendApiUrl,
    headers: getHeaders(event) as HeadersInit,
  })
})
