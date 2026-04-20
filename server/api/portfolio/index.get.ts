import type { MarketSnapshot } from '~~/shared/types/market'
import type { PortfolioSnapshot } from '~~/shared/types/portfolio'
import { getPortfolioSnapshot } from '~~/server/utils/portfolio'

export default defineEventHandler(async (event): Promise<PortfolioSnapshot> => {
  // Fetch interne Nitro (pas de round-trip HTTP), réutilise le cache du snapshot market.
  let marks: Record<string, number> = {}
  try {
    const snap = await $fetch<MarketSnapshot>('/api/market/snapshot', {
      headers: getHeaders(event) as HeadersInit,
    })
    for (const [pair, t] of Object.entries(snap.tickers)) {
      if (t && Number.isFinite(t.price)) marks[pair] = t.price
    }
  } catch (err) {
    console.warn('[portfolio] snapshot marks unavailable:', (err as Error).message)
    marks = {}
  }

  return getPortfolioSnapshot(marks)
})
