import { defineStore } from 'pinia'
import type {
  AccountState,
  OrderResult,
  PortfolioSnapshot,
  PositionSummary,
  TradeRecord,
} from '~~/shared/types/portfolio'

/**
 * Store du portefeuille paper-trading.
 * Hydraté initialement via GET /api/portfolio (SSR-friendly),
 * puis mis à jour à chaque ordre via applyOrderResult().
 *
 * La valorisation mark-to-market côté client est recalculée en live
 * via le store market (tickers WebSocket), voir getters `*Live`.
 */
export const usePortfolioStore = defineStore('portfolio', () => {
  const marketStore = useMarketStore()

  // ─── State ────────────────────────────────────────────────────────────
  const account    = ref<AccountState | null>(null)
  const positions  = ref<PositionSummary[]>([])
  const hydratedAt = ref<number>(0)

  // ─── Lookups ──────────────────────────────────────────────────────────
  const positionByPair = computed(() => {
    const m = new Map<string, PositionSummary>()
    for (const p of positions.value) m.set(p.pair, p)
    return m
  })

  const positionCount = computed(() => positions.value.length)

  // ─── Valorisation live (prix depuis le market store) ──────────────────

  /** Somme Σ quantity × lastPrice (fallback: avgCost si prix absent). */
  const marketValue = computed(() => {
    let total = 0
    for (const p of positions.value) {
      const t = marketStore.tickers[p.pair]
      const px = t?.price ?? p.avgCost
      total += p.quantity * px
    }
    return total
  })

  /** Capital investi cumulé (Σ quantity × avgCost). */
  const investedValue = computed(() => {
    let total = 0
    for (const p of positions.value) total += p.quantity * p.avgCost
    return total
  })

  /** Equity totale (cash + valeur marché), temps-réel. */
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

  /** Détail enrichi par position (qty, avg, last, valeur, pnl). */
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

  /** Remplace le state avec un snapshot serveur. */
  function hydrate(snap: PortfolioSnapshot) {
    account.value    = snap.account
    positions.value  = [...snap.positions]
    hydratedAt.value = Date.now()
  }

  /** Applique en local le résultat d'un ordre (évite un round-trip supplémentaire). */
  function applyOrderResult(result: OrderResult) {
    account.value = result.account

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

  function reset() {
    account.value    = null
    positions.value  = []
    hydratedAt.value = 0
  }

  return {
    // state
    account,
    positions,
    hydratedAt,
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
    reset,
  }
})

export type TradeRecordEntry = TradeRecord // re-export utility
