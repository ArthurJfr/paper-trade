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

async function getOrCreateAccount(client) {
  const { rows } = await client.query('SELECT * FROM account WHERE id = 1')
  if (rows.length > 0) return rows[0]
  const inserted = await client.query(
    `INSERT INTO account (id, cash_balance, initial_balance, updated_at)
     VALUES (1, $1, $1, NOW())
     RETURNING *`,
    [INITIAL_BALANCE_USDC],
  )
  return inserted.rows[0]
}

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

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1')
    res.status(200).json({ ok: true })
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message })
  }
})

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

apiV1.get('/portfolio', authIfEnabled, async (_req, res) => {
  const client = await pool.connect()
  try {
    const accountRaw = await getOrCreateAccount(client)
    const positionsRaw = await client.query('SELECT * FROM position ORDER BY pair ASC')

    const positions = positionsRaw.rows.map((p) => ({
      pair: p.pair,
      quantity: Number(p.quantity),
      avgCost: Number(p.avg_cost),
      updatedAt: new Date(p.updated_at).getTime(),
    }))

    const account = {
      cashBalance: Number(accountRaw.cash_balance),
      initialBalance: Number(accountRaw.initial_balance),
      updatedAt: new Date(accountRaw.updated_at).getTime(),
    }

    let invested = 0
    let mark = 0
    for (const p of positions) {
      invested += p.quantity * p.avgCost
      mark += p.quantity * p.avgCost
    }

    const equity = account.cashBalance + mark
    const unrealized = mark - invested
    const perfPct = account.initialBalance > 0
      ? ((equity - account.initialBalance) / account.initialBalance) * 100
      : 0

    res.json({
      account,
      positions,
      equity,
      invested,
      unrealized,
      perfPct,
    })
  } catch (e) {
    res.status(500).json({ statusMessage: e.message || 'Erreur serveur' })
  } finally {
    client.release()
  }
})

apiV1.get('/portfolio/trades', authIfEnabled, async (req, res) => {
  const pair = typeof req.query.pair === 'string' ? req.query.pair.toUpperCase() : null
  const limit = Math.min(500, Math.max(1, Number(req.query.limit ?? 50)))
  const cursor = Number(req.query.cursor || 0)

  const params = []
  const clauses = []
  if (pair) {
    params.push(pair)
    clauses.push(`pair = $${params.length}`)
  }
  if (cursor > 0) {
    params.push(cursor)
    clauses.push(`id < $${params.length}`)
  }
  params.push(limit)

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const query = `
    SELECT id, pair, side, quantity, price, notional, fee, realized_pnl, created_at
    FROM trade
    ${where}
    ORDER BY created_at DESC, id DESC
    LIMIT $${params.length}
  `

  try {
    const { rows } = await pool.query(query, params)
    res.json(rows.map((t) => ({
      id: Number(t.id),
      pair: t.pair,
      side: t.side === 'sell' ? 'sell' : 'buy',
      quantity: Number(t.quantity),
      price: Number(t.price),
      notional: Number(t.notional),
      fee: Number(t.fee),
      realizedPnl: t.realized_pnl === null ? null : Number(t.realized_pnl),
      createdAt: new Date(t.created_at).getTime(),
    })))
  } catch (e) {
    res.status(500).json({ statusMessage: e.message || 'Erreur serveur' })
  }
})

apiV1.post('/portfolio/orders', authIfEnabled, async (req, res) => {
  const body = req.body ?? {}
  const pair = String(body.pair ?? '').toUpperCase()
  const side = body.side
  const quantityInput = Number(body.quantity ?? 0)
  const notionalInput = Number(body.notional ?? 0)
  const hasQty = Number.isFinite(quantityInput) && quantityInput > 0
  const hasNotional = Number.isFinite(notionalInput) && notionalInput > 0

  if (!pair) return res.status(400).json({ statusMessage: '`pair` requise' })
  if (side !== 'buy' && side !== 'sell') return res.status(400).json({ statusMessage: '`side` doit être "buy" ou "sell"' })
  if (hasQty === hasNotional) return res.status(400).json({ statusMessage: 'Fournir exactement `quantity` OU `notional`' })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const account = await getOrCreateAccount(client)
    const currentPositionResult = await client.query('SELECT * FROM position WHERE pair = $1', [pair])
    const current = currentPositionResult.rows[0] ?? null

    const price = await fetchMarketPrice(pair)
    const quantity = hasQty ? quantityInput : (notionalInput / price)
    const notional = quantity * price
    const fee = (notional * TRADING_FEE_BPS) / 10_000

    if (side === 'buy') {
      const totalCost = notional + fee
      if (Number(account.cash_balance) < totalCost - 1e-9) {
        await client.query('ROLLBACK')
        return res.status(422).json({ statusMessage: 'Cash insuffisant' })
      }

      const prevQty = Number(current?.quantity ?? 0)
      const prevAvg = Number(current?.avg_cost ?? 0)
      const newQty = prevQty + quantity
      const newAvg = newQty > 0 ? ((prevQty * prevAvg + quantity * price) / newQty) : price

      await client.query(
        'UPDATE account SET cash_balance = $1, updated_at = NOW() WHERE id = 1',
        [Number(account.cash_balance) - totalCost],
      )
      await client.query(
        `INSERT INTO position (pair, quantity, avg_cost, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (pair)
         DO UPDATE SET quantity = EXCLUDED.quantity, avg_cost = EXCLUDED.avg_cost, updated_at = NOW()`,
        [pair, newQty, newAvg],
      )

      const tradeInsert = await client.query(
        `INSERT INTO trade (pair, side, quantity, price, notional, fee, realized_pnl)
         VALUES ($1, 'buy', $2, $3, $4, $5, NULL)
         RETURNING *`,
        [pair, quantity, price, notional, fee],
      )

      await client.query('COMMIT')
      const trade = tradeInsert.rows[0]
      const updatedAccount = await pool.query('SELECT * FROM account WHERE id = 1')
      const updatedPosition = await pool.query('SELECT * FROM position WHERE pair = $1', [pair])

      return res.json({
        trade: {
          id: Number(trade.id),
          pair: trade.pair,
          side: 'buy',
          quantity: Number(trade.quantity),
          price: Number(trade.price),
          notional: Number(trade.notional),
          fee: Number(trade.fee),
          realizedPnl: null,
          createdAt: new Date(trade.created_at).getTime(),
        },
        account: {
          cashBalance: Number(updatedAccount.rows[0].cash_balance),
          initialBalance: Number(updatedAccount.rows[0].initial_balance),
          updatedAt: new Date(updatedAccount.rows[0].updated_at).getTime(),
        },
        position: {
          pair: updatedPosition.rows[0].pair,
          quantity: Number(updatedPosition.rows[0].quantity),
          avgCost: Number(updatedPosition.rows[0].avg_cost),
          updatedAt: new Date(updatedPosition.rows[0].updated_at).getTime(),
        },
      })
    }

    const available = Number(current?.quantity ?? 0)
    if (available < quantity - 1e-12) {
      await client.query('ROLLBACK')
      return res.status(422).json({ statusMessage: 'Position insuffisante' })
    }

    const proceeds = notional - fee
    const avgCost = Number(current?.avg_cost ?? 0)
    const realizedPnl = quantity * (price - avgCost) - fee
    const remaining = available - quantity

    await client.query(
      'UPDATE account SET cash_balance = $1, updated_at = NOW() WHERE id = 1',
      [Number(account.cash_balance) + proceeds],
    )

    if (remaining <= 1e-12) {
      await client.query('DELETE FROM position WHERE pair = $1', [pair])
    } else {
      await client.query(
        'UPDATE position SET quantity = $1, updated_at = NOW() WHERE pair = $2',
        [remaining, pair],
      )
    }

    const tradeInsert = await client.query(
      `INSERT INTO trade (pair, side, quantity, price, notional, fee, realized_pnl)
       VALUES ($1, 'sell', $2, $3, $4, $5, $6)
       RETURNING *`,
      [pair, quantity, price, notional, fee, realizedPnl],
    )

    await client.query('COMMIT')
    const trade = tradeInsert.rows[0]
    const updatedAccount = await pool.query('SELECT * FROM account WHERE id = 1')
    const updatedPosition = remaining <= 1e-12
      ? null
      : (await pool.query('SELECT * FROM position WHERE pair = $1', [pair])).rows[0]

    return res.json({
      trade: {
        id: Number(trade.id),
        pair: trade.pair,
        side: 'sell',
        quantity: Number(trade.quantity),
        price: Number(trade.price),
        notional: Number(trade.notional),
        fee: Number(trade.fee),
        realizedPnl: trade.realized_pnl === null ? null : Number(trade.realized_pnl),
        createdAt: new Date(trade.created_at).getTime(),
      },
      account: {
        cashBalance: Number(updatedAccount.rows[0].cash_balance),
        initialBalance: Number(updatedAccount.rows[0].initial_balance),
        updatedAt: new Date(updatedAccount.rows[0].updated_at).getTime(),
      },
      position: updatedPosition ? {
        pair: updatedPosition.pair,
        quantity: Number(updatedPosition.quantity),
        avgCost: Number(updatedPosition.avg_cost),
        updatedAt: new Date(updatedPosition.updated_at).getTime(),
      } : null,
    })
  } catch (e) {
    await client.query('ROLLBACK')
    res.status(500).json({ statusMessage: e.message || 'Erreur serveur' })
  } finally {
    client.release()
  }
})

app.use('/api/v1', apiV1)
app.use('/api', apiV1)

await initDb()

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[paper-trade-api] listening on 0.0.0.0:${PORT}`)
})
