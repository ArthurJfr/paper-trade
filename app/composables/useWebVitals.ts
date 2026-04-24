// useWebVitals · instrumentation Core Web Vitals (CWV) côté client uniquement.
// - Observe LCP, CLS, INP (approx via event timing), FCP
// - Expose un `ref` des métriques courantes pour un overlay debug optionnel
// - Persiste les derniers scores via sessionStorage pour debug en DevTools
//
// Note: implémentation légère sans dépendance à web-vitals pour garder le bundle
// compact. Les seuils affichés viennent des recommandations Google (2024).

export interface WebVitalsSnapshot {
  lcp: number | null
  cls: number
  inp: number | null
  fcp: number | null
  ttfb: number | null
  updatedAt: number
}

const SESSION_KEY = 'paper-trade:web-vitals'

let singleton: ReturnType<typeof create> | null = null

function create() {
  const snapshot = ref<WebVitalsSnapshot>({
    lcp: null,
    cls: 0,
    inp: null,
    fcp: null,
    ttfb: null,
    updatedAt: Date.now(),
  })

  const observers: PerformanceObserver[] = []

  const persist = () => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(snapshot.value))
    } catch { /* noop */ }
  }

  const safeObserve = (type: string, cb: (entries: PerformanceEntry[]) => void) => {
    if (typeof PerformanceObserver === 'undefined') return
    try {
      const obs = new PerformanceObserver((list) => cb(list.getEntries()))
      obs.observe({ type, buffered: true } as PerformanceObserverInit)
      observers.push(obs)
    } catch { /* noop */ }
  }

  const init = () => {
    if (typeof window === 'undefined') return

    // TTFB depuis navigation timing
    try {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
      if (nav) {
        snapshot.value.ttfb = Math.max(0, nav.responseStart - nav.startTime)
      }
    } catch { /* noop */ }

    // FCP
    safeObserve('paint', (entries) => {
      for (const e of entries) {
        if (e.name === 'first-contentful-paint') {
          snapshot.value.fcp = e.startTime
          snapshot.value.updatedAt = Date.now()
          persist()
        }
      }
    })

    // LCP
    safeObserve('largest-contentful-paint', (entries) => {
      const last = entries[entries.length - 1] as (PerformanceEntry & { startTime: number }) | undefined
      if (!last) return
      snapshot.value.lcp = last.startTime
      snapshot.value.updatedAt = Date.now()
      persist()
    })

    // CLS
    safeObserve('layout-shift', (entries) => {
      let delta = 0
      for (const e of entries as (PerformanceEntry & { value: number, hadRecentInput: boolean })[]) {
        if (!e.hadRecentInput) delta += e.value
      }
      if (delta > 0) {
        snapshot.value.cls = +(snapshot.value.cls + delta).toFixed(4)
        snapshot.value.updatedAt = Date.now()
        persist()
      }
    })

    // INP (approximation: max event duration)
    safeObserve('event', (entries) => {
      let maxDur = snapshot.value.inp ?? 0
      for (const e of entries as (PerformanceEntry & { duration: number, interactionId?: number })[]) {
        if (e.interactionId && e.duration > maxDur) maxDur = e.duration
      }
      if (maxDur !== snapshot.value.inp) {
        snapshot.value.inp = maxDur
        snapshot.value.updatedAt = Date.now()
        persist()
      }
    })
  }

  const stop = () => {
    for (const o of observers) {
      try { o.disconnect() } catch { /* noop */ }
    }
    observers.length = 0
  }

  return { snapshot, init, stop }
}

export function useWebVitals() {
  if (!import.meta.client) {
    return {
      snapshot: ref<WebVitalsSnapshot>({
        lcp: null, cls: 0, inp: null, fcp: null, ttfb: null, updatedAt: 0,
      }),
      init: () => {},
      stop: () => {},
    }
  }
  if (!singleton) {
    singleton = create()
    singleton.init()
  }
  return singleton
}

export function rateVital(kind: 'lcp' | 'fcp' | 'inp' | 'cls' | 'ttfb', value: number | null): 'good' | 'needs' | 'poor' | 'unknown' {
  if (value === null) return 'unknown'
  switch (kind) {
    case 'lcp':  return value <= 2500 ? 'good' : value <= 4000 ? 'needs' : 'poor'
    case 'fcp':  return value <= 1800 ? 'good' : value <= 3000 ? 'needs' : 'poor'
    case 'inp':  return value <= 200  ? 'good' : value <= 500  ? 'needs' : 'poor'
    case 'cls':  return value <= 0.1  ? 'good' : value <= 0.25 ? 'needs' : 'poor'
    case 'ttfb': return value <= 800  ? 'good' : value <= 1800 ? 'needs' : 'poor'
  }
}
