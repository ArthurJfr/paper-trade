// ─────────────────────────────────────────────────────────────────────────────
// Paper-Trade · Types partagés (client + server)
// Nuxt 4 (compat v4) pré-importe ce dossier côté auto-imports.
// ─────────────────────────────────────────────────────────────────────────────

export type CategoryKey =
  | 'layer1'
  | 'layer2'
  | 'defi'
  | 'ai'
  | 'gaming'
  | 'memes'
  | 'rwa'
  | 'stables'
  | 'infra'

export interface Category {
  key: CategoryKey
  label: string
  color: string
}

export interface TaxonomyAsset {
  id: string
  symbol: string
  name: string
  pair: string // Binance pair (ex: BTCUSDT)
  category: CategoryKey
}

export interface Taxonomy {
  categories: Category[]
  assets: TaxonomyAsset[]
}

// ─── Ticker normalisé ──────────────────────────────────────────────────────
export interface Ticker {
  symbol: string       // pair Binance : BTCUSDT
  price: number        // dernier prix
  open24h: number
  high24h: number
  low24h: number
  changePct: number    // variation % sur 24 h
  volume24h: number    // volume en quote asset (USDT)
  updatedAt: number    // timestamp ms
}

// ─── Snapshot initial renvoyé par /api/market/snapshot ─────────────────────
export interface MarketSnapshot {
  updatedAt: number
  taxonomy: Taxonomy
  tickers: Record<string, Ticker> // indexé par pair
  source: 'binance' | 'mock'
}

// ─── Statistiques agrégées par catégorie ───────────────────────────────────
export interface CategoryStats {
  key: CategoryKey
  label: string
  color: string
  perf24h: number   // moyenne pondérée par volume
  count: number     // assets suivis avec données
  volume24h: number // volume total (USDT)
}

// ─── État du stream live ───────────────────────────────────────────────────
export type StreamStatus = 'idle' | 'connecting' | 'live' | 'reconnecting' | 'offline'

// ─── Klines / chandeliers (normalisés depuis Binance) ──────────────────────
export type KlineInterval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w'

export interface Kline {
  openTime: number    // ms
  open: number
  high: number
  low: number
  close: number
  volume: number      // volume en base asset
  quoteVolume: number // volume en quote asset (USDT)
  trades: number
}

// ─── Order book (partial book stream Binance) ──────────────────────────────
export interface OrderBookLevel {
  price: number
  quantity: number
}

export interface OrderBookSnapshot {
  pair: string
  bids: OrderBookLevel[] // triés décroissants (best bid en premier)
  asks: OrderBookLevel[] // triés croissants (best ask en premier)
  updatedAt: number
}
