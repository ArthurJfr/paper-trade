// Composable qui détecte les variations d'un nombre et expose une classe
// CSS transitoire (`flash-up` / `flash-down`) pendant une courte fenêtre.
// Utile pour animer equity / prix / perf quand ils changent, sans recréer
// un composant dédié à chaque endroit.
//
// Respect de l'accessibilité : retourne null si `prefers-reduced-motion:
// reduce` est actif ou si l'utilisateur a opt-in `reducedMotion` dans les
// préférences UI.

export function useFlashOnChange(
  source: MaybeRefOrGetter<number | null | undefined>,
  options?: { duration?: number; threshold?: number },
) {
  const duration = options?.duration ?? 600
  const threshold = options?.threshold ?? 0

  const flashClass = ref<'flash-up' | 'flash-down' | null>(null)
  let timeout: ReturnType<typeof setTimeout> | null = null

  const ui = import.meta.client ? useUiPreferencesStore() : null

  watch(
    () => toValue(source),
    (next, prev) => {
      if (!import.meta.client) return
      if (ui?.state.reducedMotion) return
      if (typeof next !== 'number' || typeof prev !== 'number') return

      const delta = next - prev
      if (Math.abs(delta) <= threshold) return

      flashClass.value = delta > 0 ? 'flash-up' : 'flash-down'
      if (timeout) clearTimeout(timeout)
      timeout = setTimeout(() => {
        flashClass.value = null
      }, duration)
    },
  )

  onBeforeUnmount(() => {
    if (timeout) clearTimeout(timeout)
  })

  return flashClass
}
