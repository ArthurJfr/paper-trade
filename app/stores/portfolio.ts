import { defineStore } from 'pinia'
import type {
  AccountState,
  OrderResult,
  PortfolioSnapshot,
  PositionSummary,
  TradeRecord,
} from '~~/shared/types/portfolio'
import type { WalletSnapshot } from '~/composables/useWallets' /* type-only import pour typer rehydrate */

/**
 * Store du portefeuille paper-trading, scopé au wallet actif.
 *
 * - Hydraté initialement via GET /api/wallets/:id puis mis à jour à chaque
 *   ordre via applyOrderResult().
 * - La valorisation mark-to-market côté client est recalculée en live via
 *   le store market (tickers WebSocket), voir getters `*Live`.
 * - Le changement de wallet se fait via `useWalletsStore().setActive(id)`,
 *   qui appelle `rehydrate(id)` sur ce store.
 */
export const usePortfolioStore = defineStore('portfolio', () => {
  const marketStore = useMarketStore()

  // ─── State ────────────────────────────────────────────────────────────
  const walletId   = ref<number | null>(null)
  const account    = ref<AccountState | null>(null)
  const positions  = ref<PositionSummary[]>([])
  const hydratedAt = ref<number>(0)
  const loading    = ref<boolean>(false)
  const lastError  = ref<string | null>(null)

  // ─── Lookups ──────────────────────────────────────────────────────────
  const positionByPair = computed(() => {
    const m = new Map<string, PositionSummary>()
    for (const p of positions.value) m.set(p.pair, p)
    return m
  })

  const positionCount = computed(() => positions.value.length)

  // ─── Valorisation live (prix depuis le market store) ──────────────────

  const marketValue = computed(() => {
    let total = 0
    for (const p of positions.value) {
      const t = marketStore.tickers[p.pair]
      const px = t?.price ?? p.avgCost
      total += p.quantity * px
    }
    return total
  })

  const investedValue = computed(() => {
    let total = 0
    for (const p of positions.value) total += p.quantity * p.avgCost
    return total
  })

  const equity = computed(() => {
    if (!account.value) return 0
    return account.value.cashBalance + marketValue.value
  })

  const unrealizedPnl = computed(() => marketValue.value - investedValue.value)

  const performancePct = computed(() => {
    const initial = account.value?.initialBalance ?? 0
    if (initial <= 0) return 0
    return ((equity.value - initial) / initial) * 100
  })

  const positionRows = computed(() => positions.value.map((p) => {
    const t = marketStore.tickers[p.pair]
    const last = t?.price ?? p.avgCost
    const value = p.quantity * last
    const cost = p.quantity * p.avgCost
    const unrealized = value - cost
    const unrealizedPct = cost > 0 ? ((last - p.avgCost) / p.avgCost) * 100 : 0
    return {
      position: p,
      lastPrice: last,
      value,
      cost,
      unrealized,
      unrealizedPct,
      asset: marketStore.assetByPair.get(p.pair) ?? null,
    }
  }))

  const isHydrated = computed(() => account.value !== null)

  // ─── Actions ──────────────────────────────────────────────────────────

  /**
   * Remplace le state avec un snapshot serveur (format /api/wallets/:id,
   * ou éventuellement un `PortfolioSnapshot` legacy pour les tests).
   */
  function hydrate(snap: PortfolioSnapshot | WalletSnapshot) {
    if ('account' in snap && snap.account) {
      account.value   = snap.account
      walletId.value  = snap.account.walletId ?? null
    } else if ('id' in snap) {
      // /api/wallets/:id : le snapshot est un WalletWithStats enrichi
      walletId.value = snap.id
      account.value = {
        walletId:       snap.id,
        cashBalance:    snap.cashBalance,
        initialBalance: snap.initialBalance,
        updatedAt:      snap.updatedAt,
      }
    }
    positions.value  = 'positions' in snap && Array.isArray(snap.positions)
      ? [...snap.positions]
      : []
    hydratedAt.value = Date.now()
    lastError.value  = null
  }

  /** Applique en local le résultat d'un ordre (évite un round-trip supplémentaire). */
  function applyOrderResult(result: OrderResult) {
    account.value = result.account
    if (result.account?.walletId) walletId.value = result.account.walletId

    const idx = positions.value.findIndex(p => p.pair === result.trade.pair)
    if (result.position) {
      if (idx >= 0) positions.value.splice(idx, 1, result.position)
      else positions.value.push(result.position)
    } else if (idx >= 0) {
      // Position clôturée (sell total) → on la retire.
      positions.value.splice(idx, 1)
    }
    hydratedAt.value = Date.now()
  }

  /** Re-charge le snapshot du wallet spécifié (utilisé au switch de wallet). */
  async function rehydrate(id: number): Promise<void> {
    if (!id) return
    loading.value = true
    lastError.value = null
    try {
      const snap = await $fetch<WalletSnapshot>(`/api/wallets/${id}`)
      hydrate(snap)
    } catch (err: unknown) {
      lastError.value = extractErrorMessage(err)
      // On ne wipe pas le state pour éviter un "flash vide" : on garde
      // l'ancien snapshot jusqu'à ce qu'on ait quelque chose de valide.
    } finally {
      loading.value = false
    }
  }

  function reset() {
    walletId.value   = null
    account.value    = null
    positions.value  = []
    hydratedAt.value = 0
    lastError.value  = null
  }

  return {
    // state
    walletId,
    account,
    positions,
    hydratedAt,
    loading,
    lastError,
    // getters
    positionByPair,
    positionCount,
    marketValue,
    investedValue,
    equity,
    unrealizedPnl,
    performancePct,
    positionRows,
    isHydrated,
    // actions
    hydrate,
    applyOrderResult,
    rehydrate,
    reset,
  }
})

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

export type TradeRecordEntry = TradeRecord // re-export utility
