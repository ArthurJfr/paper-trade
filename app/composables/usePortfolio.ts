import type {
  OrderRequest,
  OrderResult,
  OrderSubmitResult,
  TradeRecord,
} from '~~/shared/types/portfolio'
import type { WalletSnapshot } from '~/composables/useWallets'

/**
 * Orchestrateur portefeuille (wallet actif).
 * - Le layout appelle `useWallets()` AVANT `usePortfolio()` pour garantir
 *   qu'un `activeWalletId` est défini dans le store wallets.
 * - Expose `placeOrder` qui route vers `POST /api/wallets/:id/orders` et
 *   met à jour le store portefeuille localement.
 * - Expose `refresh` pour une resynchro forcée contre le backend.
 */
export async function usePortfolio() {
  const store = usePortfolioStore()
  const wallets = useWalletsStore()

  // Lien réactif : si l'id actif change pendant le SSR, l'URL du fetch est
  // recalculée via `computed`. En cas d'absence d'id (cas vraiment dégradé),
  // on désactive le fetch pour éviter un 400.
  const url = computed(() =>
    wallets.activeId
      ? `/api/wallets/${wallets.activeId}`
      : null,
  )

  const { data, error, refresh } = await useAsyncData(
    'wallet-snapshot',
    async (): Promise<WalletSnapshot | null> => {
      const u = url.value
      if (!u) return null
      return await $fetch<WalletSnapshot>(u)
    },
    {
      server: true,
      default: () => null as WalletSnapshot | null,
      watch: [url],
    },
  )

  if (data.value) store.hydrate(data.value)

  watch(data, (snap) => {
    if (snap) store.hydrate(snap)
  })

  const placing = ref(false)
  const lastError = ref<string | null>(null)

  async function placeOrder(req: OrderRequest): Promise<OrderSubmitResult> {
    const id = wallets.activeId
    if (!id) throw new Error('Aucun wallet actif')
    placing.value = true
    lastError.value = null
    try {
      const res = await $fetch<OrderSubmitResult>(`/api/wallets/${id}/orders`, {
        method: 'POST',
        body: req,
      })
      if (res.orderType === 'limit') {
        wallets.fetchAll().catch(() => { /* noop */ })
        return res
      }
      const o: OrderResult = { trade: res.trade, account: res.account, position: res.position }
      store.applyOrderResult(o)
      wallets.fetchAll().catch(() => { /* noop */ })
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

/**
 * Récupère l'historique des trades du wallet actif (ou d'un wallet explicite).
 * Lecture seule : pas stockée dans le store.
 */
export async function fetchTrades(options?: {
  pair?: string
  limit?: number
  walletId?: number
}): Promise<TradeRecord[]> {
  const wallets = useWalletsStore()
  const id = options?.walletId ?? wallets.activeId
  if (!id) return []
  return await $fetch<TradeRecord[]>(`/api/wallets/${id}/trades`, {
    query: {
      ...(options?.pair  ? { pair:  options.pair  } : {}),
      ...(options?.limit ? { limit: options.limit } : {}),
    },
  })
}
