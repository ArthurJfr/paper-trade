import express from 'express'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import { initDb, pool } from './db.js'

const app = express()
app.use(cors())
app.use(express.json())

const PORT = Number(process.env.API_PORT ?? 4000)
const INITIAL_BALANCE_USDC = Number(process.env.INITIAL_BALANCE_USDC ?? 10000)
const TRADING_FEE_BPS = Number(process.env.TRADING_FEE_BPS ?? 10)
const REQUIRE_AUTH = String(process.env.REQUIRE_AUTH ?? 'false') === 'true'
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production'
const API_USER = process.env.API_USER || 'admin'
const API_PASSWORD = process.env.API_PASSWORD || 'admin'
const SNAPSHOT_TTL_MS = 30_000

// ─── Contraintes wallet ────────────────────────────────────────────────────
const MAX_ACTIVE_WALLETS = 20
const MIN_INITIAL_BALANCE = 100
const MAX_INITIAL_BALANCE = 10_000_000
const MAX_NAME_LEN = 60
const MAX_DESCRIPTION_LEN = 280

const taxonomy = {
  categories: [
    { key: 'layer1', label: 'Layer 1', color: '#f97316' },
    { key: 'layer2', label: 'Layer 2', color: '#06b6d4' },
    { key: 'defi', label: 'DeFi', color: '#22c55e' },
    { key: 'ai', label: 'AI', color: '#a855f7' },
    { key: 'gaming', label: 'Gaming', color: '#eab308' },
    { key: 'memes', label: 'Memes', color: '#ef4444' },
    { key: 'rwa', label: 'RWA', color: '#14b8a6' },
    { key: 'stables', label: 'Stables', color: '#64748b' },
    { key: 'infra', label: 'Infra', color: '#3b82f6' },
  ],
  assets: [
    { id: 'btc', symbol: 'BTC', name: 'Bitcoin', pair: 'BTCUSDT', category: 'layer1' },
    { id: 'eth', symbol: 'ETH', name: 'Ethereum', pair: 'ETHUSDT', category: 'layer1' },
    { id: 'sol', symbol: 'SOL', name: 'Solana', pair: 'SOLUSDT', category: 'layer1' },
    { id: 'bnb', symbol: 'BNB', name: 'BNB', pair: 'BNBUSDT', category: 'layer1' },
    { id: 'xrp', symbol: 'XRP', name: 'XRP', pair: 'XRPUSDT', category: 'layer1' },
    { id: 'ada', symbol: 'ADA', name: 'Cardano', pair: 'ADAUSDT', category: 'layer1' },
    { id: 'doge', symbol: 'DOGE', name: 'Dogecoin', pair: 'DOGEUSDT', category: 'memes' },
    { id: 'link', symbol: 'LINK', name: 'Chainlink', pair: 'LINKUSDT', category: 'infra' },
    { id: 'avax', symbol: 'AVAX', name: 'Avalanche', pair: 'AVAXUSDT', category: 'layer1' },
    { id: 'dot', symbol: 'DOT', name: 'Polkadot', pair: 'DOTUSDT', category: 'infra' },
    { id: 'arb', symbol: 'ARB', name: 'Arbitrum', pair: 'ARBUSDT', category: 'layer2' },
    { id: 'op', symbol: 'OP', name: 'Optimism', pair: 'OPUSDT', category: 'layer2' },
    { id: 'uni', symbol: 'UNI', name: 'Uniswap', pair: 'UNIUSDT', category: 'defi' },
    { id: 'aave', symbol: 'AAVE', name: 'Aave', pair: 'AAVEUSDT', category: 'defi' },
    { id: 'near', symbol: 'NEAR', name: 'NEAR', pair: 'NEARUSDT', category: 'ai' },
    { id: 'fet', symbol: 'FET', name: 'Fetch.ai', pair: 'FETUSDT', category: 'ai' },
    { id: 'render', symbol: 'RNDR', name: 'Render', pair: 'RNDRUSDT', category: 'ai' },
    { id: 'sand', symbol: 'SAND', name: 'The Sandbox', pair: 'SANDUSDT', category: 'gaming' },
    { id: 'mana', symbol: 'MANA', name: 'Decentraland', pair: 'MANAUSDT', category: 'gaming' },
    { id: 'pepe', symbol: 'PEPE', name: 'Pepe', pair: 'PEPEUSDT', category: 'memes' },
    { id: 'shib', symbol: 'SHIB', name: 'Shiba Inu', pair: 'SHIBUSDT', category: 'memes' },
  ],
}

const trackedPairs = new Set(taxonomy.assets.map((a) => a.pair))
const klineCache = new Map()
let snapshotMemo = null

// ─── Helpers market ────────────────────────────────────────────────────────

async function fetchMarketPrice(pair) {
  const symbol = String(pair || '').toUpperCase()
  const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(symbol)}`)
  if (!res.ok) throw new Error(`Prix indisponible pour ${symbol}`)
  const body = await res.json()
  const value = Number(body?.price)
  if (!Number.isFinite(value) || value <= 0) throw new Error(`Prix invalide pour ${symbol}`)
  return value
}

async function fetchTicker24hSnapshot() {
  const now = Date.now()
  if (snapshotMemo && now - snapshotMemo.at < SNAPSHOT_TTL_MS) {
    return snapshotMemo.data
  }

  let tickers = {}
  let source = 'mock'

  try {
    const raw = await fetch('https://api.binance.com/api/v3/ticker/24hr')
    if (!raw.ok) throw new Error(`Binance status ${raw.status}`)
    const payload = await raw.json()

    for (const t of payload) {
      if (!trackedPairs.has(t.symbol)) continue
      tickers[t.symbol] = {
        symbol: t.symbol,
        price: Number.parseFloat(t.lastPrice),
        open24h: Number.parseFloat(t.openPrice),
        high24h: Number.parseFloat(t.highPrice),
        low24h: Number.parseFloat(t.lowPrice),
        changePct: Number.parseFloat(t.priceChangePercent),
        volume24h: Number.parseFloat(t.quoteVolume),
        updatedAt: Number(t.closeTime),
      }
    }
    source = 'binance'
  } catch (_e) {
    tickers = {}
    source = 'mock'
  }

  const snapshot = {
    updatedAt: now,
    taxonomy,
    tickers,
    source,
  }
  snapshotMemo = { at: now, data: snapshot }
  return snapshot
}

// ─── Mappers DB → DTO ──────────────────────────────────────────────────────

function mapWalletRow(r) {
  return {
    id:             Number(r.id),
    name:           r.name,
    description:    r.description ?? null,
    color:          r.color ?? null,
    icon:           r.icon ?? null,
    baseCurrency:   r.base_currency,
    initialBalance: Number(r.initial_balance),
    cashBalance:    Number(r.cash_balance),
    archivedAt:     r.archived_at ? new Date(r.archived_at).getTime() : null,
    createdAt:      new Date(r.created_at).getTime(),
    updatedAt:      new Date(r.updated_at).getTime(),
  }
}

function mapPositionRow(r) {
  return {
    walletId:  Number(r.wallet_id),
    pair:      r.pair,
    quantity:  Number(r.quantity),
    avgCost:   Number(r.avg_cost),
    updatedAt: new Date(r.updated_at).getTime(),
  }
}

function mapTradeRow(r) {
  return {
    id:          Number(r.id),
    walletId:    Number(r.wallet_id),
    pair:        r.pair,
    side:        r.side === 'sell' ? 'sell' : 'buy',
    quantity:    Number(r.quantity),
    price:       Number(r.price),
    notional:    Number(r.notional),
    fee:         Number(r.fee),
    realizedPnl: r.realized_pnl === null ? null : Number(r.realized_pnl),
    createdAt:   new Date(r.created_at).getTime(),
  }
}

function mapAccountFromWallet(wallet) {
  return {
    walletId:       wallet.id,
    cashBalance:    wallet.cashBalance,
    initialBalance: wallet.initialBalance,
    updatedAt:      wallet.updatedAt,
  }
}

// ─── Helpers wallet ────────────────────────────────────────────────────────

async function getWalletById(client, id) {
  const { rows } = await client.query('SELECT * FROM wallet WHERE id = $1', [id])
  return rows[0] ?? null
}

/**
 * Crée un wallet par défaut si la table est vide. Appelée au démarrage pour
 * garantir l'existence d'au moins un wallet utilisable (équivalent runtime
 * de l'ex `getOrCreateAccount`).
 */
async function ensureAtLeastOneWallet() {
  const { rows } = await pool.query('SELECT id FROM wallet ORDER BY id ASC LIMIT 1')
  if (rows.length > 0) return Number(rows[0].id)
  const { rows: inserted } = await pool.query(
    `INSERT INTO wallet (name, initial_balance, cash_balance)
     VALUES ('Portefeuille principal', $1, $1)
     RETURNING id`,
    [INITIAL_BALANCE_USDC],
  )
  return Number(inserted[0].id)
}

function validateWalletPayload(body, { partial = false } = {}) {
  const errors = []
  const { name, initialBalance, description, color, icon, baseCurrency } = body ?? {}

  if (!partial || name !== undefined) {
    if (typeof name !== 'string' || name.trim().length === 0) errors.push('`name` requis')
    else if (name.length > MAX_NAME_LEN) errors.push(`\`name\` ≤ ${MAX_NAME_LEN} caractères`)
  }

  if (!partial || initialBalance !== undefined) {
    if (!Number.isFinite(Number(initialBalance))
      || Number(initialBalance) < MIN_INITIAL_BALANCE
      || Number(initialBalance) > MAX_INITIAL_BALANCE) {
      errors.push(`\`initialBalance\` entre ${MIN_INITIAL_BALANCE} et ${MAX_INITIAL_BALANCE}`)
    }
  }

  if (description !== undefined && description !== null) {
    if (typeof description !== 'string') errors.push('`description` invalide')
    else if (description.length > MAX_DESCRIPTION_LEN) errors.push(`\`description\` ≤ ${MAX_DESCRIPTION_LEN} caractères`)
  }
  if (color !== undefined && color !== null) {
    if (typeof color !== 'string' || color.length > 32) errors.push('`color` invalide')
  }
  if (icon !== undefined && icon !== null) {
    if (typeof icon !== 'string' || icon.length > 64) errors.push('`icon` invalide')
  }
  if (baseCurrency !== undefined && baseCurrency !== null) {
    if (typeof baseCurrency !== 'string' || baseCurrency.length > 10) errors.push('`baseCurrency` invalide')
  }

  return errors
}

async function computeStatsForWalletIds(walletIds) {
  const result = new Map()
  for (const id of walletIds) result.set(Number(id), { invested: 0, positionCount: 0, tradeCount: 0 })
  if (walletIds.length === 0) return result

  const posAgg = await pool.query(
    `SELECT wallet_id,
            COUNT(*)::int                   AS pos_count,
            COALESCE(SUM(quantity * avg_cost), 0) AS invested
       FROM position
      WHERE wallet_id = ANY($1::bigint[])
      GROUP BY wallet_id`,
    [walletIds],
  )
  for (const r of posAgg.rows) {
    const cur = result.get(Number(r.wallet_id))
    if (cur) { cur.invested = Number(r.invested); cur.positionCount = Number(r.pos_count) }
  }

  const tradesAgg = await pool.query(
    `SELECT wallet_id, COUNT(*)::int AS trade_count
       FROM trade
      WHERE wallet_id = ANY($1::bigint[])
      GROUP BY wallet_id`,
    [walletIds],
  )
  for (const r of tradesAgg.rows) {
    const cur = result.get(Number(r.wallet_id))
    if (cur) cur.tradeCount = Number(r.trade_count)
  }
  return result
}

function enrichWalletWithStats(wallet, stats) {
  const invested = Number(stats?.invested ?? 0)
  // NOTE : sans prix live ici, on assume mark = invested (break-even).
  // Le front calcule la valorisation temps réel via useMarketStore.
  const mark = invested
  const equity = Number(wallet.cashBalance) + mark
  const unrealized = mark - invested
  const perfPct = wallet.initialBalance > 0
    ? ((equity - wallet.initialBalance) / wallet.initialBalance) * 100
    : 0
  return {
    ...wallet,
    equity,
    invested,
    unrealized,
    perfPct,
    positionCount: stats?.positionCount ?? 0,
    tradeCount:    stats?.tradeCount    ?? 0,
  }
}

async function logWalletEvent(client, walletId, kind, payload = null) {
  try {
    await client.query(
      `INSERT INTO wallet_event (wallet_id, kind, payload) VALUES ($1, $2, $3)`,
      [walletId, kind, payload ? JSON.stringify(payload) : null],
    )
  } catch (_e) { /* table absente = déploiement partiel, on ignore */ }
}

// ─── Auth middleware ───────────────────────────────────────────────────────

function authIfEnabled(req, res, next) {
  if (!REQUIRE_AUTH) return next()
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ statusMessage: 'Unauthorized' })
  }
  try {
    const token = auth.slice('Bearer '.length)
    jwt.verify(token, JWT_SECRET)
    return next()
  } catch (_e) {
    return res.status(401).json({ statusMessage: 'Invalid token' })
  }
}

// ─── Healthcheck ───────────────────────────────────────────────────────────

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1')
    res.status(200).json({ ok: true })
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message })
  }
})

// ─── Router API v1 ─────────────────────────────────────────────────────────

const apiV1 = express.Router()

apiV1.post('/auth/token', (req, res) => {
  const username = String(req.body?.username ?? '')
  const password = String(req.body?.password ?? '')
  if (username !== API_USER || password !== API_PASSWORD) {
    return res.status(401).json({ statusMessage: 'Invalid credentials' })
  }
  const token = jwt.sign({ sub: username }, JWT_SECRET, { expiresIn: '12h' })
  return res.json({ token, tokenType: 'Bearer', expiresIn: 43200 })
})

// ─── Market ────────────────────────────────────────────────────────────────

apiV1.get('/market/snapshot', async (_req, res) => {
  try {
    const snapshot = await fetchTicker24hSnapshot()
    res.json(snapshot)
  } catch (e) {
    res.status(500).json({ statusMessage: e.message || 'Erreur serveur' })
  }
})

apiV1.get('/market/klines', async (req, res) => {
  const pair = String(req.query.pair ?? '').toUpperCase()
  const interval = String(req.query.interval ?? '1h')
  const limit = Math.min(500, Math.max(10, Number(req.query.limit ?? 168)))
  const validIntervals = new Set(['1m', '5m', '15m', '1h', '4h', '1d', '1w'])
  const ttlByInterval = {
    '1m': 3000,
    '5m': 10000,
    '15m': 20000,
    '1h': 30000,
    '4h': 60000,
    '1d': 300000,
    '1w': 900000,
  }

  if (!/^[A-Z0-9]{3,20}$/.test(pair)) {
    return res.status(400).json({ statusMessage: 'Invalid pair' })
  }
  if (!validIntervals.has(interval)) {
    return res.status(400).json({ statusMessage: 'Invalid interval' })
  }

  const cacheKey = `${pair}:${interval}:${limit}`
  const now = Date.now()
  const cached = klineCache.get(cacheKey)
  const ttl = ttlByInterval[interval]

  if (cached && now - cached.at < ttl) {
    return res.json(cached.data)
  }

  try {
    const upstream = await fetch(`https://api.binance.com/api/v3/klines?symbol=${pair}&interval=${interval}&limit=${limit}`)
    if (!upstream.ok) throw new Error(`Binance status ${upstream.status}`)
    const raw = await upstream.json()
    const normalized = raw.map((k) => ({
      openTime: k[0],
      open: Number.parseFloat(k[1]),
      high: Number.parseFloat(k[2]),
      low: Number.parseFloat(k[3]),
      close: Number.parseFloat(k[4]),
      volume: Number.parseFloat(k[5]),
      quoteVolume: Number.parseFloat(k[7]),
      trades: Number(k[8]),
    }))
    klineCache.set(cacheKey, { at: now, data: normalized })
    return res.json(normalized)
  } catch (_e) {
    if (cached) return res.json(cached.data)
    return res.status(502).json({ statusMessage: 'Binance unreachable' })
  }
})

// ─── Wallets CRUD ──────────────────────────────────────────────────────────

apiV1.get('/wallets', authIfEnabled, async (req, res) => {
  try {
    const includeArchived = String(req.query.archived ?? 'false') === 'true'
    const clause = includeArchived ? '' : 'WHERE archived_at IS NULL'
    const { rows } = await pool.query(`SELECT * FROM wallet ${clause} ORDER BY id ASC`)
    const wallets = rows.map(mapWalletRow)
    const stats = await computeStatsForWalletIds(wallets.map((w) => w.id))
    res.json(wallets.map((w) => enrichWalletWithStats(w, stats.get(w.id))))
  } catch (e) {
    res.status(500).json({ statusMessage: e.message || 'Erreur serveur' })
  }
})

apiV1.post('/wallets', authIfEnabled, async (req, res) => {
  const errors = validateWalletPayload(req.body, { partial: false })
  if (errors.length) return res.status(400).json({ statusMessage: errors.join(' ; ') })

  const client = await pool.connect()
  try {
    const { rows: countRows } = await client.query(
      `SELECT COUNT(*)::int AS n FROM wallet WHERE archived_at IS NULL`,
    )
    if (Number(countRows[0].n) >= MAX_ACTIVE_WALLETS) {
      return res.status(422).json({
        statusMessage: `Maximum ${MAX_ACTIVE_WALLETS} wallets actifs atteint. Archivez-en un avant d'en créer un nouveau.`,
      })
    }

    const { name, description, color, icon, baseCurrency } = req.body
    const initialBalance = Number(req.body.initialBalance)

    const inserted = await client.query(
      `INSERT INTO wallet (name, description, color, icon, base_currency, initial_balance, cash_balance)
       VALUES ($1, $2, $3, $4, COALESCE($5, 'USDC'), $6, $6)
       RETURNING *`,
      [
        name.trim(),
        description ?? null,
        color ?? null,
        icon ?? null,
        baseCurrency ?? null,
        initialBalance,
      ],
    )
    const wallet = mapWalletRow(inserted.rows[0])
    await logWalletEvent(client, wallet.id, 'created', { initialBalance })
    const stats = await computeStatsForWalletIds([wallet.id])
    res.status(201).json(enrichWalletWithStats(wallet, stats.get(wallet.id)))
  } catch (e) {
    res.status(500).json({ statusMessage: e.message || 'Erreur serveur' })
  } finally {
    client.release()
  }
})

apiV1.get('/wallets/:id', authIfEnabled, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ statusMessage: 'id invalide' })
  const client = await pool.connect()
  try {
    const raw = await getWalletById(client, id)
    if (!raw) return res.status(404).json({ statusMessage: 'Wallet introuvable' })
    const wallet = mapWalletRow(raw)
    const statsMap = await computeStatsForWalletIds([id])
    const enriched = enrichWalletWithStats(wallet, statsMap.get(id))
    const { rows: positionsRaw } = await client.query(
      'SELECT * FROM position WHERE wallet_id = $1 ORDER BY pair ASC',
      [id],
    )
    res.json({
      ...enriched,
      positions: positionsRaw.map(mapPositionRow),
    })
  } catch (e) {
    res.status(500).json({ statusMessage: e.message || 'Erreur serveur' })
  } finally {
    client.release()
  }
})

apiV1.patch('/wallets/:id', authIfEnabled, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ statusMessage: 'id invalide' })

  const errors = validateWalletPayload(req.body, { partial: true })
  if (errors.length) return res.status(400).json({ statusMessage: errors.join(' ; ') })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const current = await getWalletById(client, id)
    if (!current) { await client.query('ROLLBACK'); return res.status(404).json({ statusMessage: 'Wallet introuvable' }) }

    const body = req.body ?? {}
    const patch = {}
    if (body.name !== undefined) patch.name = String(body.name).trim()
    if (body.description !== undefined) patch.description = body.description ?? null
    if (body.color !== undefined) patch.color = body.color ?? null
    if (body.icon !== undefined) patch.icon = body.icon ?? null

    if (body.initialBalance !== undefined) {
      const ib = Number(body.initialBalance)
      const { rows: countRows } = await client.query(
        'SELECT COUNT(*)::int AS n FROM trade WHERE wallet_id = $1',
        [id],
      )
      if (Number(countRows[0].n) > 0 && ib !== Number(current.initial_balance)) {
        await client.query('ROLLBACK')
        return res.status(422).json({
          statusMessage: 'Capital initial verrouillé après le premier trade. Utilisez "Reset" pour repartir à zéro.',
        })
      }
      patch.initial_balance = ib
      // Si pas encore de trade ET pas encore de position, on peut aussi recaler le cash.
      const { rows: posRows } = await client.query(
        'SELECT COUNT(*)::int AS n FROM position WHERE wallet_id = $1',
        [id],
      )
      if (Number(posRows[0].n) === 0) patch.cash_balance = ib
    }

    const setParts = []
    const values = []
    for (const [col, val] of Object.entries(patch)) {
      values.push(val)
      setParts.push(`${col} = $${values.length}`)
    }
    if (setParts.length === 0) {
      await client.query('ROLLBACK')
      const wallet = mapWalletRow(current)
      const statsMap = await computeStatsForWalletIds([id])
      return res.json(enrichWalletWithStats(wallet, statsMap.get(id)))
    }
    setParts.push(`updated_at = NOW()`)
    values.push(id)
    const updated = await client.query(
      `UPDATE wallet SET ${setParts.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values,
    )
    await logWalletEvent(client, id, 'updated', patch)
    await client.query('COMMIT')

    const wallet = mapWalletRow(updated.rows[0])
    const statsMap = await computeStatsForWalletIds([id])
    res.json(enrichWalletWithStats(wallet, statsMap.get(id)))
  } catch (e) {
    await client.query('ROLLBACK')
    res.status(500).json({ statusMessage: e.message || 'Erreur serveur' })
  } finally {
    client.release()
  }
})

apiV1.delete('/wallets/:id', authIfEnabled, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ statusMessage: 'id invalide' })
  const hard = String(req.query.hard ?? 'false') === 'true'

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const current = await getWalletById(client, id)
    if (!current) { await client.query('ROLLBACK'); return res.status(404).json({ statusMessage: 'Wallet introuvable' }) }

    if (hard) {
      // CASCADE sur position + trade via FK ON DELETE CASCADE.
      await logWalletEvent(client, id, 'hard_deleted', { name: current.name })
      await client.query('DELETE FROM wallet WHERE id = $1', [id])
    } else {
      if (current.archived_at) {
        await client.query('ROLLBACK')
        return res.status(422).json({ statusMessage: 'Wallet déjà archivé' })
      }
      await client.query(
        'UPDATE wallet SET archived_at = NOW(), updated_at = NOW() WHERE id = $1',
        [id],
      )
      await logWalletEvent(client, id, 'archived', null)
    }

    await client.query('COMMIT')
    res.json({ ok: true, id, hardDeleted: hard })
  } catch (e) {
    await client.query('ROLLBACK')
    res.status(500).json({ statusMessage: e.message || 'Erreur serveur' })
  } finally {
    client.release()
  }
})

apiV1.post('/wallets/:id/restore', authIfEnabled, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ statusMessage: 'id invalide' })
  const client = await pool.connect()
  try {
    const current = await getWalletById(client, id)
    if (!current) return res.status(404).json({ statusMessage: 'Wallet introuvable' })
    if (!current.archived_at) return res.status(422).json({ statusMessage: 'Wallet non archivé' })

    const { rows: countRows } = await client.query(
      'SELECT COUNT(*)::int AS n FROM wallet WHERE archived_at IS NULL',
    )
    if (Number(countRows[0].n) >= MAX_ACTIVE_WALLETS) {
      return res.status(422).json({
        statusMessage: `Maximum ${MAX_ACTIVE_WALLETS} wallets actifs atteint.`,
      })
    }

    const updated = await client.query(
      `UPDATE wallet SET archived_at = NULL, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id],
    )
    await logWalletEvent(client, id, 'restored', null)
    const wallet = mapWalletRow(updated.rows[0])
    const statsMap = await computeStatsForWalletIds([id])
    res.json(enrichWalletWithStats(wallet, statsMap.get(id)))
  } catch (e) {
    res.status(500).json({ statusMessage: e.message || 'Erreur serveur' })
  } finally {
    client.release()
  }
})

// ─── Positions / Trades scopés ─────────────────────────────────────────────

apiV1.get('/wallets/:id/positions', authIfEnabled, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ statusMessage: 'id invalide' })
  try {
    const { rows } = await pool.query(
      'SELECT * FROM position WHERE wallet_id = $1 ORDER BY pair ASC',
      [id],
    )
    res.json(rows.map(mapPositionRow))
  } catch (e) {
    res.status(500).json({ statusMessage: e.message || 'Erreur serveur' })
  }
})

apiV1.get('/wallets/:id/trades', authIfEnabled, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ statusMessage: 'id invalide' })

  const pair = typeof req.query.pair === 'string' ? req.query.pair.toUpperCase() : null
  const limit = Math.min(500, Math.max(1, Number(req.query.limit ?? 50)))
  const cursor = Number(req.query.cursor || 0)

  const params = [id]
  const clauses = ['wallet_id = $1']
  if (pair) { params.push(pair); clauses.push(`pair = $${params.length}`) }
  if (cursor > 0) { params.push(cursor); clauses.push(`id < $${params.length}`) }
  params.push(limit)

  const query = `
    SELECT id, wallet_id, pair, side, quantity, price, notional, fee, realized_pnl, created_at
    FROM trade
    WHERE ${clauses.join(' AND ')}
    ORDER BY created_at DESC, id DESC
    LIMIT $${params.length}
  `

  try {
    const { rows } = await pool.query(query, params)
    res.json(rows.map(mapTradeRow))
  } catch (e) {
    res.status(500).json({ statusMessage: e.message || 'Erreur serveur' })
  }
})

// ─── Orders (place un trade market) ────────────────────────────────────────

async function placeOrderForWallet(walletId, body) {
  const pair = String(body?.pair ?? '').toUpperCase()
  const side = body?.side
  const quantityInput = Number(body?.quantity ?? 0)
  const notionalInput = Number(body?.notional ?? 0)
  const hasQty = Number.isFinite(quantityInput) && quantityInput > 0
  const hasNotional = Number.isFinite(notionalInput) && notionalInput > 0

  if (!pair) throw httpError(400, '`pair` requise')
  if (side !== 'buy' && side !== 'sell') throw httpError(400, '`side` doit être "buy" ou "sell"')
  if (hasQty === hasNotional) throw httpError(400, 'Fournir exactement `quantity` OU `notional`')

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const walletRaw = await getWalletById(client, walletId)
    if (!walletRaw) { await client.query('ROLLBACK'); throw httpError(404, 'Wallet introuvable') }
    if (walletRaw.archived_at) { await client.query('ROLLBACK'); throw httpError(422, 'Wallet archivé — trades bloqués') }

    const currentPositionResult = await client.query(
      'SELECT * FROM position WHERE wallet_id = $1 AND pair = $2',
      [walletId, pair],
    )
    const current = currentPositionResult.rows[0] ?? null

    const price = await fetchMarketPrice(pair)
    const quantity = hasQty ? quantityInput : (notionalInput / price)
    const notional = quantity * price
    const fee = (notional * TRADING_FEE_BPS) / 10_000

    if (side === 'buy') {
      const totalCost = notional + fee
      if (Number(walletRaw.cash_balance) < totalCost - 1e-9) {
        await client.query('ROLLBACK')
        throw httpError(422, 'Cash insuffisant')
      }
      const prevQty = Number(current?.quantity ?? 0)
      const prevAvg = Number(current?.avg_cost ?? 0)
      const newQty = prevQty + quantity
      const newAvg = newQty > 0 ? ((prevQty * prevAvg + quantity * price) / newQty) : price

      await client.query(
        'UPDATE wallet SET cash_balance = $1, updated_at = NOW() WHERE id = $2',
        [Number(walletRaw.cash_balance) - totalCost, walletId],
      )
      await client.query(
        `INSERT INTO position (wallet_id, pair, quantity, avg_cost, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (wallet_id, pair)
         DO UPDATE SET quantity = EXCLUDED.quantity, avg_cost = EXCLUDED.avg_cost, updated_at = NOW()`,
        [walletId, pair, newQty, newAvg],
      )

      const tradeInsert = await client.query(
        `INSERT INTO trade (wallet_id, pair, side, quantity, price, notional, fee, realized_pnl)
         VALUES ($1, $2, 'buy', $3, $4, $5, $6, NULL)
         RETURNING *`,
        [walletId, pair, quantity, price, notional, fee],
      )

      await client.query('COMMIT')
      const trade = mapTradeRow(tradeInsert.rows[0])
      const updatedWallet = mapWalletRow((await pool.query('SELECT * FROM wallet WHERE id = $1', [walletId])).rows[0])
      const updatedPosition = (await pool.query(
        'SELECT * FROM position WHERE wallet_id = $1 AND pair = $2',
        [walletId, pair],
      )).rows[0]
      return {
        trade,
        account:  mapAccountFromWallet(updatedWallet),
        position: updatedPosition ? mapPositionRow(updatedPosition) : null,
        wallet:   updatedWallet,
      }
    }

    // SELL
    const available = Number(current?.quantity ?? 0)
    if (available < quantity - 1e-12) {
      await client.query('ROLLBACK')
      throw httpError(422, 'Position insuffisante')
    }

    const proceeds = notional - fee
    const avgCost = Number(current?.avg_cost ?? 0)
    const realizedPnl = quantity * (price - avgCost) - fee
    const remaining = available - quantity

    await client.query(
      'UPDATE wallet SET cash_balance = $1, updated_at = NOW() WHERE id = $2',
      [Number(walletRaw.cash_balance) + proceeds, walletId],
    )

    if (remaining <= 1e-12) {
      await client.query('DELETE FROM position WHERE wallet_id = $1 AND pair = $2', [walletId, pair])
    } else {
      await client.query(
        'UPDATE position SET quantity = $1, updated_at = NOW() WHERE wallet_id = $2 AND pair = $3',
        [remaining, walletId, pair],
      )
    }

    const tradeInsert = await client.query(
      `INSERT INTO trade (wallet_id, pair, side, quantity, price, notional, fee, realized_pnl)
       VALUES ($1, $2, 'sell', $3, $4, $5, $6, $7)
       RETURNING *`,
      [walletId, pair, quantity, price, notional, fee, realizedPnl],
    )

    await client.query('COMMIT')
    const trade = mapTradeRow(tradeInsert.rows[0])
    const updatedWallet = mapWalletRow((await pool.query('SELECT * FROM wallet WHERE id = $1', [walletId])).rows[0])
    const updatedPositionRow = remaining <= 1e-12
      ? null
      : (await pool.query(
        'SELECT * FROM position WHERE wallet_id = $1 AND pair = $2',
        [walletId, pair],
      )).rows[0]
    return {
      trade,
      account:  mapAccountFromWallet(updatedWallet),
      position: updatedPositionRow ? mapPositionRow(updatedPositionRow) : null,
      wallet:   updatedWallet,
    }
  } catch (e) {
    try { await client.query('ROLLBACK') } catch (_r) { /* noop */ }
    throw e
  } finally {
    client.release()
  }
}

function httpError(status, message) {
  const err = new Error(message)
  err.status = status
  return err
}

apiV1.post('/wallets/:id/orders', authIfEnabled, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ statusMessage: 'id invalide' })
  try {
    const result = await placeOrderForWallet(id, req.body)
    res.json(result)
  } catch (e) {
    const status = e?.status ?? 500
    res.status(status).json({ statusMessage: e.message || 'Erreur serveur' })
  }
})

// ─── Reset & duplicate ─────────────────────────────────────────────────────

apiV1.post('/wallets/:id/reset', authIfEnabled, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ statusMessage: 'id invalide' })
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const current = await getWalletById(client, id)
    if (!current) { await client.query('ROLLBACK'); return res.status(404).json({ statusMessage: 'Wallet introuvable' }) }
    if (current.archived_at) { await client.query('ROLLBACK'); return res.status(422).json({ statusMessage: 'Wallet archivé — restaurez-le avant de le reset' }) }

    await client.query('DELETE FROM position WHERE wallet_id = $1', [id])
    await client.query('DELETE FROM trade WHERE wallet_id = $1', [id])
    const updated = await client.query(
      `UPDATE wallet SET cash_balance = initial_balance, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id],
    )
    await logWalletEvent(client, id, 'reset', { cashBalance: Number(current.initial_balance) })
    await client.query('COMMIT')

    const wallet = mapWalletRow(updated.rows[0])
    const statsMap = await computeStatsForWalletIds([id])
    res.json(enrichWalletWithStats(wallet, statsMap.get(id)))
  } catch (e) {
    try { await client.query('ROLLBACK') } catch (_r) { /* noop */ }
    res.status(500).json({ statusMessage: e.message || 'Erreur serveur' })
  } finally {
    client.release()
  }
})

apiV1.post('/wallets/:id/duplicate', authIfEnabled, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ statusMessage: 'id invalide' })
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const current = await getWalletById(client, id)
    if (!current) { await client.query('ROLLBACK'); return res.status(404).json({ statusMessage: 'Wallet introuvable' }) }

    const { rows: countRows } = await client.query(
      `SELECT COUNT(*)::int AS n FROM wallet WHERE archived_at IS NULL`,
    )
    if (Number(countRows[0].n) >= MAX_ACTIVE_WALLETS) {
      await client.query('ROLLBACK')
      return res.status(422).json({ statusMessage: `Maximum ${MAX_ACTIVE_WALLETS} wallets actifs atteint.` })
    }

    const overrideName = typeof req.body?.name === 'string' ? req.body.name.trim() : null
    const baseName = overrideName && overrideName.length > 0
      ? overrideName
      : `${current.name} (copie)`
    const finalName = baseName.slice(0, MAX_NAME_LEN)

    const initialBalance = Number.isFinite(Number(req.body?.initialBalance))
      ? Number(req.body.initialBalance)
      : Number(current.initial_balance)
    if (initialBalance < MIN_INITIAL_BALANCE || initialBalance > MAX_INITIAL_BALANCE) {
      await client.query('ROLLBACK')
      return res.status(400).json({ statusMessage: `\`initialBalance\` entre ${MIN_INITIAL_BALANCE} et ${MAX_INITIAL_BALANCE}` })
    }

    const inserted = await client.query(
      `INSERT INTO wallet (name, description, color, icon, base_currency, initial_balance, cash_balance)
       VALUES ($1, $2, $3, $4, $5, $6, $6)
       RETURNING *`,
      [finalName, current.description, current.color, current.icon, current.base_currency, initialBalance],
    )
    const wallet = mapWalletRow(inserted.rows[0])
    await logWalletEvent(client, wallet.id, 'duplicated_from', { sourceId: id, initialBalance })
    await client.query('COMMIT')

    const statsMap = await computeStatsForWalletIds([wallet.id])
    res.status(201).json(enrichWalletWithStats(wallet, statsMap.get(wallet.id)))
  } catch (e) {
    try { await client.query('ROLLBACK') } catch (_r) { /* noop */ }
    res.status(500).json({ statusMessage: e.message || 'Erreur serveur' })
  } finally {
    client.release()
  }
})

app.use('/api/v1', apiV1)
app.use('/api', apiV1)

await initDb()
await ensureAtLeastOneWallet()

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[paper-trade-api] listening on 0.0.0.0:${PORT}`)
})
