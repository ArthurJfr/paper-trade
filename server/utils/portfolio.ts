import type { Position, Prisma } from '@prisma/client'
import type {
  AccountState,
  OrderRequest,
  OrderResult,
  PortfolioSnapshot,
  PositionSummary,
  TradeRecord,
} from '~~/shared/types/portfolio'
import { prisma } from './db'

// ─────────────────────────────────────────────────────────────────────────────
// Paper-Trade engine · fill market au prix spot courant (snapshot Binance).
// Atomicité garantie par une transaction Prisma.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retourne le compte, en le créant avec la balance initiale s'il n'existe pas.
 */
export async function getOrCreateAccount(): Promise<AccountState> {
  const config = useRuntimeConfig()
  const initialBalance = config.public.initialBalanceUsdc

  const acc = await prisma.account.upsert({
    where:  { id: 1 },
    update: {},
    create: {
      id: 1,
      cashBalance:    initialBalance,
      initialBalance,
    },
  })

  return toAccountState(acc)
}

/**
 * Charge un snapshot complet : compte, positions, valorisation mark-to-market
 * à partir d'un dictionnaire `pair → lastPrice` fourni par l'appelant
 * (pour éviter de recharger les tickers à chaque requête).
 */
export async function getPortfolioSnapshot(
  marks: Record<string, number>,
): Promise<PortfolioSnapshot> {
  const [account, positions] = await Promise.all([
    getOrCreateAccount(),
    prisma.position.findMany({ orderBy: { pair: 'asc' } }),
  ])

  const positionList: PositionSummary[] = positions.map(toPositionSummary)

  let invested = 0
  let mark = 0
  for (const p of positionList) {
    invested += p.quantity * p.avgCost
    const last = marks[p.pair]
    mark += p.quantity * (Number.isFinite(last) ? last! : p.avgCost)
  }

  const equity = account.cashBalance + mark
  const unrealized = mark - invested
  const perfPct = account.initialBalance > 0
    ? ((equity - account.initialBalance) / account.initialBalance) * 100
    : 0

  return {
    account,
    positions: positionList,
    equity,
    invested,
    unrealized,
    perfPct,
  }
}

/** Liste paginée du journal des trades. */
export async function listTrades(options?: {
  pair?:  string
  limit?: number
  cursor?: number
}): Promise<TradeRecord[]> {
  const limit = Math.min(500, Math.max(1, options?.limit ?? 50))
  const where = options?.pair ? { pair: options.pair.toUpperCase() } : undefined

  const list = await prisma.trade.findMany({
    where,
    take: limit,
    orderBy: { createdAt: 'desc' },
    ...(options?.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
  })

  return list.map(toTradeRecord)
}

// ─────────────────────────────────────────────────────────────────────────────
// Core : exécution d'un ordre market.
// ─────────────────────────────────────────────────────────────────────────────

export interface ExecuteOrderContext {
  order:     OrderRequest
  lastPrice: number    // prix Binance courant (fourni par la route)
}

/**
 * Exécute un ordre market paper-trading.
 * Validation + pricing + écriture transactionnelle.
 *
 * @throws H3Error avec statusCode approprié en cas de rejet métier.
 */
export async function executeMarketOrder(
  ctx: ExecuteOrderContext,
): Promise<OrderResult> {
  const config = useRuntimeConfig()
  const feeBps = config.public.tradingFeeBps

  const pair = ctx.order.pair.toUpperCase()
  const side = ctx.order.side
  const price = ctx.lastPrice

  if (!Number.isFinite(price) || price <= 0) {
    throw createError({
      statusCode: 503,
      statusMessage: `Prix indisponible pour ${pair}`,
    })
  }

  // Résolution de la quantité cible : on accepte quantity XOR notional.
  const quantity = resolveQuantity(ctx.order, price)
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Quantité invalide',
    })
  }

  const notional = quantity * price
  const fee = (notional * feeBps) / 10_000

  // Transaction : cash, position, trade sont mis à jour atomiquement.
  const result = await prisma.$transaction(async (tx) => {
    const account = await tx.account.findUnique({ where: { id: 1 } })
    if (!account) {
      throw createError({ statusCode: 500, statusMessage: 'Account introuvable' })
    }

    const current = await tx.position.findUnique({ where: { pair } })

    if (side === 'buy') {
      return executeBuy(tx, { pair, price, quantity, notional, fee, account, current })
    }
    return executeSell(tx, { pair, price, quantity, notional, fee, account, current })
  })

  return result
}

// ─── Helpers (privés) ─────────────────────────────────────────────────────

interface LegArgs {
  pair: string
  price: number
  quantity: number
  notional: number
  fee: number
  account: { id: number; cashBalance: number; initialBalance: number }
  current: Position | null
}

async function executeBuy(
  tx: Prisma.TransactionClient,
  a: LegArgs,
): Promise<OrderResult> {
  const totalCost = a.notional + a.fee
  if (a.account.cashBalance < totalCost - 1e-9) {
    throw createError({
      statusCode: 422,
      statusMessage: `Cash insuffisant : besoin ${totalCost.toFixed(2)} $US, disponible ${a.account.cashBalance.toFixed(2)} $US`,
    })
  }

  // Mise à jour position : avg_cost pondéré.
  const prevQty  = a.current?.quantity ?? 0
  const prevAvg  = a.current?.avgCost  ?? 0
  const newQty   = prevQty + a.quantity
  const newAvg   = newQty > 0
    ? (prevQty * prevAvg + a.quantity * a.price) / newQty
    : a.price

  const updatedAccount = await tx.account.update({
    where: { id: 1 },
    data: { cashBalance: a.account.cashBalance - totalCost },
  })

  const updatedPosition = await tx.position.upsert({
    where:  { pair: a.pair },
    create: { pair: a.pair, quantity: newQty, avgCost: newAvg },
    update: { quantity: newQty, avgCost: newAvg },
  })

  const trade = await tx.trade.create({
    data: {
      pair:        a.pair,
      side:        'buy',
      quantity:    a.quantity,
      price:       a.price,
      notional:    a.notional,
      fee:         a.fee,
      realizedPnl: null,
    },
  })

  return {
    trade:    toTradeRecord(trade),
    account:  toAccountState(updatedAccount),
    position: toPositionSummary(updatedPosition),
  }
}

async function executeSell(
  tx: Prisma.TransactionClient,
  a: LegArgs,
): Promise<OrderResult> {
  const available = a.current?.quantity ?? 0
  if (available < a.quantity - 1e-12) {
    throw createError({
      statusCode: 422,
      statusMessage: `Position insuffisante : demandé ${a.quantity}, disponible ${available}`,
    })
  }

  const proceeds = a.notional - a.fee
  const avgCost  = a.current?.avgCost ?? 0
  const realizedPnl = a.quantity * (a.price - avgCost) - a.fee

  const updatedAccount = await tx.account.update({
    where: { id: 1 },
    data:  { cashBalance: a.account.cashBalance + proceeds },
  })

  const remaining = available - a.quantity
  let updatedPosition: Position | null = null

  if (remaining <= 1e-12) {
    // Position totalement clôturée → suppression.
    await tx.position.delete({ where: { pair: a.pair } })
  } else {
    updatedPosition = await tx.position.update({
      where: { pair: a.pair },
      data:  { quantity: remaining }, // avgCost inchangé sur sell partiel
    })
  }

  const trade = await tx.trade.create({
    data: {
      pair:        a.pair,
      side:        'sell',
      quantity:    a.quantity,
      price:       a.price,
      notional:    a.notional,
      fee:         a.fee,
      realizedPnl,
    },
  })

  return {
    trade:    toTradeRecord(trade),
    account:  toAccountState(updatedAccount),
    position: updatedPosition ? toPositionSummary(updatedPosition) : null,
  }
}

function resolveQuantity(order: OrderRequest, price: number): number {
  if (order.quantity && order.quantity > 0) return order.quantity
  if (order.notional && order.notional > 0) return order.notional / price
  return 0
}

// ─── DTO mappers ──────────────────────────────────────────────────────────

function toAccountState(
  a: { cashBalance: number; initialBalance: number; updatedAt: Date },
): AccountState {
  return {
    cashBalance:    a.cashBalance,
    initialBalance: a.initialBalance,
    updatedAt:      a.updatedAt.getTime(),
  }
}

function toPositionSummary(p: Position): PositionSummary {
  return {
    pair:      p.pair,
    quantity:  p.quantity,
    avgCost:   p.avgCost,
    updatedAt: p.updatedAt.getTime(),
  }
}

function toTradeRecord(t: {
  id: number; pair: string; side: string;
  quantity: number; price: number; notional: number; fee: number;
  realizedPnl: number | null; createdAt: Date
}): TradeRecord {
  return {
    id:          t.id,
    pair:        t.pair,
    side:        (t.side === 'sell' ? 'sell' : 'buy'),
    quantity:    t.quantity,
    price:       t.price,
    notional:    t.notional,
    fee:         t.fee,
    realizedPnl: t.realizedPnl,
    createdAt:   t.createdAt.getTime(),
  }
}
