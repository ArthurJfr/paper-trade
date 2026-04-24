// ─────────────────────────────────────────────────────────────────────────────
// Paper-Trade · types partagés pour le moteur de portefeuille
// ─────────────────────────────────────────────────────────────────────────────

export type OrderSide = 'buy' | 'sell'

export interface AccountState {
  walletId:       number
  cashBalance:    number
  initialBalance: number
  updatedAt:      number // ms epoch
}

export interface PositionSummary {
  walletId:  number
  pair:      string
  quantity:  number
  avgCost:   number   // USDC
  updatedAt: number
}

export interface TradeRecord {
  id:          number
  walletId:    number
  pair:        string
  side:        OrderSide
  quantity:    number
  price:       number
  notional:    number
  fee:         number
  realizedPnl: number | null
  createdAt:   number
}

/**
 * Snapshot complet (legacy / tests). La nouvelle API est GET /api/wallets/:id
 * qui renvoie un `WalletWithStats` enrichi (voir shared/types/wallet.ts).
 * Valorisation calculée côté serveur à partir du snapshot market.
 */
export interface PortfolioSnapshot {
  account:    AccountState
  positions:  PositionSummary[]
  // Totaux en USDC, calculés avec les derniers prix disponibles :
  equity:     number  // cash + Σ(quantity × lastPrice)
  invested:   number  // Σ(quantity × avgCost)
  unrealized: number  // Σ(quantity × (lastPrice − avgCost))
  perfPct:    number  // (equity − initial) / initial × 100
}

// ─── Requêtes ─────────────────────────────────────────────────────────────

/**
 * Ordre market.
 * - L'un des deux champs `quantity` ou `notional` doit être fourni (xor).
 * - `side: 'buy'`  → sucre du cash, crée/augmente la position
 * - `side: 'sell'` → réduit la position, crédite le cash (net de frais)
 */
export interface OrderRequest {
  pair:      string
  side:      OrderSide
  quantity?: number   // base asset (ex: 0.1 BTC)
  notional?: number   // USDC visé (ex: 500 $)
}

/** Résultat d'une exécution d'ordre. */
export interface OrderResult {
  trade:    TradeRecord
  account:  AccountState
  position: PositionSummary | null // null si la position a été fermée
}
