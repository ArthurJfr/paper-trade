// ─────────────────────────────────────────────────────────────────────────────
// Formatters partagés — auto-importés par Nuxt (app/utils/*.ts)
// ─────────────────────────────────────────────────────────────────────────────

export type Trend = 'up' | 'down' | 'flat'

export const trendOf = (n: number): Trend =>
  n > 0.01 ? 'up' : n < -0.01 ? 'down' : 'flat'

/** +3.21%  /  -1.45%  /  0.00% */
export const fmtPerf = (n: number): string =>
  (n > 0 ? '+' : '') + n.toFixed(2) + '%'

/** Prix crypto-friendly : adapte la précision au range. */
export const fmtPrice = (p: number): string => {
  if (!Number.isFinite(p)) return '—'
  if (p >= 1000)    return p.toLocaleString('en-US', { maximumFractionDigits: 0 })
  if (p >= 1)       return p.toFixed(2)
  if (p >= 0.01)    return p.toFixed(4)
  if (p >= 0.0001)  return p.toFixed(6)
  return p.toPrecision(4)
}

/** Volume compact : $1.2B / $45.6M / $890K. */
export const fmtVolume = (v: number): string => {
  if (!Number.isFinite(v) || v <= 0) return '—'
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`
  return `$${v.toFixed(0)}`
}

/**
 * Couleur de heatmap basée sur la performance.
 * Retourne une rgba() interpolée entre rouge et vert,
 * avec une opacité proportionnelle à l'intensité.
 */
export const perfHeatColor = (perf: number): string => {
  if (!Number.isFinite(perf)) return 'rgba(255, 255, 255, 0.03)'
  const clamped = Math.max(-10, Math.min(10, perf))
  if (clamped > 0) {
    const intensity = Math.min(1, clamped / 8)
    return `rgba(22, 199, 132, ${0.08 + intensity * 0.55})`
  }
  if (clamped < 0) {
    const intensity = Math.min(1, Math.abs(clamped) / 8)
    return `rgba(234, 57, 67, ${0.08 + intensity * 0.55})`
  }
  return 'rgba(255, 255, 255, 0.03)'
}

/** Temps écoulé : "3 s", "12 min", "2 h". */
export const fmtRelativeTime = (timestamp: number): string => {
  const diff = Math.max(0, Math.floor((Date.now() - timestamp) / 1000))
  if (diff < 60)   return `${diff} s`
  if (diff < 3600) return `${Math.floor(diff / 60)} min`
  return `${Math.floor(diff / 3600)} h`
}
