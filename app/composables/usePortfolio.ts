import type {
  OrderRequest,
  OrderResult,
  PortfolioSnapshot,
  TradeRecord,
} from '~~/shared/types/portfolio'

/**
 * Orchestrateur portefeuille :
 * - SSR-safe : hydrate le store Pinia dès le premier `useFetch` (synchronous).
 * - Expose `placeOrder` (POST /api/portfolio/orders) qui met à jour le store localement.
 * - Expose `refresh` pour resynchro forcée.
 */
export async function usePortfolio() {
  const store = usePortfolioStore()

  const { data, error, refresh } = await useFetch<PortfolioSnapshot>('/api/portfolio', {
    key: 'portfolio-snapshot',
    server: true,
    default: () => null,
  })

  if (data.value) store.hydrate(data.value)

  watch(data, (snap) => {
    if (snap) store.hydrate(snap)
  })

  const placing = ref(false)
  const lastError = ref<string | null>(null)

  /**
   * Exécute un ordre market.
   * Lance une exception serialisable en cas d'erreur métier (422) ou technique.
   */
  async function placeOrder(req: OrderRequest): Promise<OrderResult> {
    placing.value = true
    lastError.value = null
    try {
      const res = await $fetch<OrderResult>('/api/portfolio/orders', {
        method: 'POST',
        body: req,
      })
      store.applyOrderResult(res)
      return res
    } catch (err: unknown) {
      const msg = extractErrorMessage(err)
      lastError.value = msg
      throw new Error(msg)
    } finally {
      placing.value = false
    }
  }

  return {
    store,
    error,
    placing,
    lastError,
    refresh,
    placeOrder,
  }
}

/** Compose un message lisible depuis une erreur $fetch / H3. */
function extractErrorMessage(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as { statusMessage?: string; data?: { statusMessage?: string; message?: string }; message?: string }
    return (
      e.data?.statusMessage
      ?? e.data?.message
      ?? e.statusMessage
      ?? e.message
      ?? 'Erreur inconnue'
    )
  }
  return String(err)
}

// ─── Helpers exposés pour l'UI (lecture seule) ────────────────────────────

/** Récupère l'historique des trades, lecture seule (pas stockée dans le store). */
export async function fetchTrades(options?: { pair?: string; limit?: number }): Promise<TradeRecord[]> {
  return await $fetch<TradeRecord[]>('/api/portfolio/trades', {
    query: {
      ...(options?.pair  ? { pair:  options.pair  } : {}),
      ...(options?.limit ? { limit: options.limit } : {}),
    },
  })
}
