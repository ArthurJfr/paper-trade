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

import type { Wallet } from './wallet'

// ─── Requêtes ─────────────────────────────────────────────────────────────

/**
 * Ordre market.
 * - L'un des deux champs `quantity` ou `notional` doit être fourni (xor).
 */
export interface MarketOrderRequest {
  type?:    'market' | undefined
  pair:     string
  side:     OrderSide
  quantity?: number
  notional?: number
}

/** Limite GTC. Escrow sur l’achat. */
export interface LimitOrderRequest {
  type:       'limit'
  pair:       string
  side:       OrderSide
  limitPrice: number
  quantity?:  number
  notional?:  number
}

export type OrderRequest = MarketOrderRequest | LimitOrderRequest

export type LimitOrderStatus = 'open' | 'filled' | 'cancelled'

export interface LimitOrderRecord {
  id:            number
  walletId:      number
  pair:          string
  side:          OrderSide
  limitPrice:    number
  quantity:      number
  notional:      number
  feeBps:        number
  status:        LimitOrderStatus
  escrowCash:    number | null
  filledTradeId:  number | null
  createdAt:     number
  updatedAt:     number
}

export interface MarketOrderResult {
  orderType:  'market'
  trade:      TradeRecord
  account:    AccountState
  position:   PositionSummary | null
  wallet:     Wallet
}

export interface LimitOrderPlaced {
  orderType:   'limit'
  limitOrder:  LimitOrderRecord
}

export type OrderSubmitResult = MarketOrderResult | LimitOrderPlaced

/** Résultat d’exécution market (format store). */
export interface OrderResult {
  trade:    TradeRecord
  account:  AccountState
  position: PositionSummary | null
}

export interface EquityPoint {
  at:     number
  equity: number
}

export interface WalletPerformance {
  initialBalance:   number
  finalEquity:     number
  realizedPnlTotal: number
  maxDrawdownPct:  number
  winRate:         number | null
  sellWinCount:    number
  sellLoseCount:   number
  sellFlatCount:   number
  totalTrades:     number
  equityPoints:    EquityPoint[]
}

export type PriceOp = 'above' | 'below'

export interface PriceAlert {
  id:               number
  walletId:         number | null
  pair:            string
  op:              PriceOp
  targetPrice:     number
  oneShot:         boolean
  webhookUrl:      string | null
  lastTriggeredAt: number | null
  cooldownMs:      number
  active:          boolean
  label:           string | null
  createdAt:       number
  updatedAt:       number
}

export interface CreatePriceAlertRequest {
  pair:        string
  op:         PriceOp
  targetPrice: number
  walletId?:  number
  oneShot?:   boolean
  webhookUrl?: string
  label?:     string
  cooldownMs?: number
}
