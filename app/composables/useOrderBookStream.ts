import type { OrderBookSnapshot, StreamStatus } from '~~/shared/types/market'

// ─────────────────────────────────────────────────────────────────────────────
// useOrderBookStream · WebSocket Binance "partial book depth stream"
// Endpoint : wss://stream.binance.com:9443/ws/<pair>@depth20@100ms
// Payload : { lastUpdateId, bids: [[price, qty], ...], asks: [[price, qty], ...] }
// Pas de maintenance de diff : chaque message est un snapshot des N meilleurs.
// ─────────────────────────────────────────────────────────────────────────────

interface Options {
  pair: string
  levels?: 5 | 10 | 20
  onUpdate: (ob: OrderBookSnapshot) => void
  onStatus: (s: StreamStatus) => void
  throttleMs?: number
}

interface RawDepthMessage {
  lastUpdateId: number
  bids: [string, string][]
  asks: [string, string][]
}

export function useOrderBookStream({
  pair,
  levels = 20,
  onUpdate,
  onStatus,
  throttleMs = 200,
}: Options) {
  let ws: WebSocket | null = null
  let closed = false
  let reconnectDelay = 1000
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null

  // ─── Throttle : on émet au max une fois par `throttleMs` ────────────────
  let pending: OrderBookSnapshot | null = null
  let lastEmit = 0
  let flushTimer: ReturnType<typeof setTimeout> | null = null

  const flush = () => {
    flushTimer = null
    if (!pending) return
    lastEmit = Date.now()
    onUpdate(pending)
    pending = null
  }

  const scheduleEmit = (snap: OrderBookSnapshot) => {
    pending = snap
    const since = Date.now() - lastEmit
    if (since >= throttleMs) {
      flush()
    } else if (!flushTimer) {
      flushTimer = setTimeout(flush, throttleMs - since)
    }
  }

  const connect = () => {
    if (closed) return

    onStatus('connecting')
    const url = `wss://stream.binance.com:9443/ws/${pair.toLowerCase()}@depth${levels}@100ms`

    try {
      ws = new WebSocket(url)
    } catch {
      scheduleReconnect()
      return
    }

    ws.onopen = () => {
      reconnectDelay = 1000
      onStatus('live')
    }

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string) as RawDepthMessage
        scheduleEmit({
          pair,
          bids: msg.bids.map(([p, q]) => ({ price: Number(p), quantity: Number(q) })),
          asks: msg.asks.map(([p, q]) => ({ price: Number(p), quantity: Number(q) })),
          updatedAt: Date.now(),
        })
      } catch {
        // Ignore les messages malformés
      }
    }

    ws.onerror = () => {
      onStatus('reconnecting')
    }

    ws.onclose = () => {
      if (closed) return
      scheduleReconnect()
    }
  }

  const scheduleReconnect = () => {
    if (closed) return
    onStatus('reconnecting')
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      reconnectDelay = Math.min(15_000, Math.round(reconnectDelay * 1.6))
      connect()
    }, reconnectDelay)
  }

  // ─── Pause quand l'onglet est caché ─────────────────────────────────────
  const onVisibility = () => {
    if (document.hidden) {
      ws?.close()
    } else if (!ws || ws.readyState === WebSocket.CLOSED) {
      connect()
    }
  }

  onMounted(() => {
    connect()
    document.addEventListener('visibilitychange', onVisibility)
  })

  onBeforeUnmount(() => {
    closed = true
    if (reconnectTimer) clearTimeout(reconnectTimer)
    if (flushTimer)     clearTimeout(flushTimer)
    document.removeEventListener('visibilitychange', onVisibility)
    ws?.close()
    ws = null
  })
}
