// ─────────────────────────────────────────────────────────────────────────────
// Paper-Trade · types partagés pour le multi-wallet
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Représentation d'un wallet (portefeuille simulé).
 * Contient les métadonnées + le solde cash courant.
 */
export interface Wallet {
  id:             number
  name:           string
  description:    string | null
  color:          string | null     // hex, utilisé comme point d'identification UI
  icon:           string | null     // nom d'icône Phosphor (ex. "ph:rocket-bold") OU emoji
  baseCurrency:   string            // "USDC" par défaut
  initialBalance: number
  cashBalance:    number
  archivedAt:     number | null     // ms epoch ; null = actif
  createdAt:      number            // ms epoch
  updatedAt:      number            // ms epoch
}

/**
 * Wallet enrichi avec la valorisation mark-to-market calculée côté serveur
 * à partir du dernier snapshot market (équivalent de l'ex-PortfolioSnapshot
 * mais scopé par wallet).
 */
export interface WalletWithStats extends Wallet {
  equity:        number   // cash + Σ(quantity × lastPrice)
  invested:      number   // Σ(quantity × avgCost)
  unrealized:    number   // Σ(quantity × (lastPrice − avgCost))
  perfPct:       number   // (equity − initial) / initial × 100
  positionCount: number
  tradeCount:    number
}

// ─── Requêtes ──────────────────────────────────────────────────────────────

export interface CreateWalletRequest {
  name:            string
  initialBalance:  number
  description?:    string
  color?:          string
  icon?:           string
  baseCurrency?:   string
}

/**
 * `initialBalance` ne peut être modifié que si le wallet n'a encore aucun
 * trade (sinon la métrique `perfPct` devient incohérente historiquement).
 * Le backend répond 422 dans ce cas.
 */
export type UpdateWalletRequest = Partial<Pick<
  Wallet, 'name' | 'description' | 'color' | 'icon'
>> & {
  initialBalance?: number
}
