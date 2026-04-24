import type { StreamStatus, Ticker } from '~~/shared/types/market'

// ─────────────────────────────────────────────────────────────────────────────
// useBinanceStream · WebSocket client Binance
// ─────────────────────────────────────────────────────────────────────────────
// - Streams individuels `@ticker` combinés via `/stream?streams=...`
// - Reconnexion exponentielle (1s → 30s max)
// - Pause quand le document est caché (Page Visibility API)
// - Batch : `onBatch` appelé au max toutes les `throttleMs` ms
// - Reconnecte automatiquement si les paires changent (ex: après hydratation
//   asynchrone du snapshot serveur).
//
// À appeler dans le setup() d'un composant (layout) — utilise onMounted/
// onBeforeUnmount pour gérer son cycle de vie.
// ─────────────────────────────────────────────────────────────────────────────

interface BinanceStreamTicker {
  e: string              // event type
  E: number              // event time
  s: string              // symbol
  c: string              // last price
  o: string              // open
  h: string              // high
  l: string              // low
  P: string              // price change percent
  q: string              // quote volume
}

interface StreamMessage {
  stream: string
  data: BinanceStreamTicker
}

export interface UseBinanceStreamOptions {
  /** Fonction qui retourne la liste courante des paires à suivre. */
  getPairs: () => string[]
  onBatch: (updates: Ticker[]) => void
  onStatus?: (s: StreamStatus) => void
  throttleMs?: number
}

export function useBinanceStream(opts: UseBinanceStreamOptions) {
  const { getPairs, onBatch, onStatus, throttleMs = 500 } = opts

  const status = ref<StreamStatus>('idle')

  let ws: WebSocket | null = null
  let buffer = new Map<string, Ticker>()
  let flushTimer: ReturnType<typeof setTimeout> | null = null
  let reconnectAttempt = 0
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let destroyed = false
  let currentPairsKey = ''
  let lastMessageAt = 0
  let watchdogTimer: ReturnType<typeof setInterval> | null = null
  const SILENCE_LIMIT_MS = 45_000

  const setStatus = (s: StreamStatus) => {
    status.value = s
    onStatus?.(s)
  }

  const scheduleFlush = () => {
    if (flushTimer) return
    flushTimer = setTimeout(() => {
      flushTimer = null
      if (buffer.size === 0) return
      const updates = Array.from(buffer.values())
      buffer = new Map()
      onBatch(updates)
    }, throttleMs)
  }

  const handleMessage = (ev: MessageEvent) => {
    lastMessageAt = Date.now()
    try {
      const msg = JSON.parse(ev.data) as StreamMessage
      const d = msg.data
      if (!d || !d.s) return
      buffer.set(d.s, {
        symbol:    d.s,
        price:     Number.parseFloat(d.c),
        open24h:   Number.parseFloat(d.o),
        high24h:   Number.parseFloat(d.h),
        low24h:    Number.parseFloat(d.l),
        changePct: Number.parseFloat(d.P),
        volume24h: Number.parseFloat(d.q),
        updatedAt: d.E,
      })
      scheduleFlush()
    } catch { /* noop */ }
  }

  const closeSocket = () => {
    if (ws) {
      ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null
      try { ws.close() } catch { /* noop */ }
      ws = null
    }
  }

  const scheduleReconnect = () => {
    if (destroyed) return
    const delay = Math.min(30_000, 1000 * 2 ** reconnectAttempt)
    reconnectAttempt++
    setStatus('reconnecting')
    reconnectTimer = setTimeout(connect, delay)
  }

  const connect = () => {
    if (destroyed) return
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }

    const pairs = getPairs()
    currentPairsKey = pairs.slice().sort().join(',')

    if (pairs.length === 0) {
      setStatus('idle')
      return
    }

    closeSocket()
    setStatus('connecting')

    const streams = pairs.map(p => `${p.toLowerCase()}@ticker`).join('/')
    const url = `wss://stream.binance.com:9443/stream?streams=${streams}`

    try {
      ws = new WebSocket(url)
    } catch {
      scheduleReconnect()
      return
    }

    ws.onopen = () => {
      reconnectAttempt = 0
      lastMessageAt = Date.now()
      setStatus('live')
    }
    ws.onmessage = handleMessage
    ws.onerror = () => { /* géré via onclose */ }
    ws.onclose = () => {
      if (destroyed) return
      setStatus('offline')
      scheduleReconnect()
    }
  }

  const startWatchdog = () => {
    if (watchdogTimer) return
    watchdogTimer = setInterval(() => {
      if (destroyed || !ws || ws.readyState !== WebSocket.OPEN) return
      if (document.hidden) return
      const silenceFor = Date.now() - lastMessageAt
      if (silenceFor > SILENCE_LIMIT_MS) {
        setStatus('reconnecting')
        closeSocket()
        scheduleReconnect()
      }
    }, 10_000)
  }

  const stopWatchdog = () => {
    if (watchdogTimer) { clearInterval(watchdogTimer); watchdogTimer = null }
  }

  const maybeReconnectOnPairsChange = () => {
    const pairs = getPairs()
    const key = pairs.slice().sort().join(',')
    if (key !== currentPairsKey) connect()
  }

  const onVisibilityChange = () => {
    if (document.hidden) {
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
      closeSocket()
      setStatus('idle')
    } else {
      reconnectAttempt = 0
      connect()
    }
  }

  let pollTimer: ReturnType<typeof setInterval> | null = null

  onMounted(() => {
    document.addEventListener('visibilitychange', onVisibilityChange)
    connect()
    startWatchdog()
    // Si les paires arrivent après le mount (hydratation asynchrone du snapshot),
    // on réévalue périodiquement jusqu'à ce qu'on soit connecté au bon set.
    pollTimer = setInterval(() => {
      if (destroyed) {
        if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
        return
      }
      if (status.value === 'live' || status.value === 'connecting') return
      maybeReconnectOnPairsChange()
    }, 1000)
  })

  onBeforeUnmount(() => {
    destroyed = true
    document.removeEventListener('visibilitychange', onVisibilityChange)
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
    if (flushTimer)     { clearTimeout(flushTimer); flushTimer = null }
    if (pollTimer)      { clearInterval(pollTimer); pollTimer = null }
    stopWatchdog()
    closeSocket()
  })

  return {
    status: readonly(status),
    reconnect: () => {
      reconnectAttempt = 0
      connect()
    },
  }
}
