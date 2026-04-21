import type { MarketSnapshot } from '~~/shared/types/market'
import { useMarketStore } from '~/stores/market'

// ─────────────────────────────────────────────────────────────────────────────
// useMarket · À APPELER UNE SEULE FOIS, depuis le layout.
// Charge le snapshot (SSR) puis ouvre la WebSocket Binance en client-only.
// ─────────────────────────────────────────────────────────────────────────────

export async function useMarket() {
  const store = useMarketStore()

  // `await` pour bloquer le SSR jusqu'à résolution : le store
  // doit être peuplé avant la phase de rendu des pages.
  const { data, error, refresh } = await useFetch<MarketSnapshot>('/api/market/snapshot', {
    key: 'market-snapshot',
    server: true,
    lazy: false,
  })

  if (data.value) store.hydrate(data.value)

  watch(data, (snap) => {
    if (snap) store.hydrate(snap)
  })

  // Stream live, uniquement côté client.
  // Les paires sont disponibles dès que le snapshot est hydraté.
  if (import.meta.client) {
    useBinanceStream({
      // Fonction lazy : le composable lira les pairs au moment de se connecter.
      getPairs: () => store.pairs,
      onBatch: updates => store.applyUpdates(updates),
      onStatus: s => store.setStreamStatus(s),
      throttleMs: 500,
    })

    let restPollTimer: ReturnType<typeof setInterval> | null = null

    const stopRestPolling = () => {
      if (restPollTimer) {
        clearInterval(restPollTimer)
        restPollTimer = null
      }
    }

    const startRestPolling = () => {
      if (restPollTimer) return
      restPollTimer = setInterval(() => {
        refresh()
      }, 3000)
    }

    watch(
      () => store.streamStatus,
      (status) => {
        if (status === 'live' || status === 'connecting') {
          stopRestPolling()
          return
        }
        startRestPolling()
      },
      { immediate: true },
    )

    onBeforeUnmount(() => {
      stopRestPolling()
    })
  }

  return { error, refresh, store }
}
