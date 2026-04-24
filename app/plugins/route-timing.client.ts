// Mesure du temps de navigation entre routes côté client.
// Ajoute des marks/measures natifs exploitables via DevTools Performance,
// et log un résumé en console.debug pour le QA UX.
export default defineNuxtPlugin((nuxt) => {
  if (typeof window === 'undefined') return

  const router = useRouter()
  let pending: { from: string, to: string, startedAt: number, mark: string } | null = null

  router.beforeEach((to, from) => {
    const mark = `route:${from.fullPath}→${to.fullPath}`
    try { performance.mark(`${mark}:start`) } catch { /* noop */ }
    pending = { from: from.fullPath, to: to.fullPath, startedAt: performance.now(), mark }
    return true
  })

  nuxt.hook('page:finish', () => {
    if (!pending) return
    const p = pending
    pending = null
    const dur = performance.now() - p.startedAt
    try {
      performance.mark(`${p.mark}:end`)
      performance.measure(p.mark, `${p.mark}:start`, `${p.mark}:end`)
    } catch { /* noop */ }
    if (import.meta.dev) {
      console.debug(`[route-timing] ${p.to} ← ${p.from} · ${dur.toFixed(0)}ms`)
    }
  })
})
