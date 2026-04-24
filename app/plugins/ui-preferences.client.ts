// Plugin client: hydrate les préférences UI avant le rendu du layout pour
// éviter le flash de thème/densité et appliquer les attributs DOM très tôt.
export default defineNuxtPlugin(() => {
  const ui = useUiPreferencesStore()
  ui.hydrate()
  ui.applyTheme(ui.state.theme)
  ui.applyDensity(ui.state.density)
  ui.applyReducedMotion(ui.state.reducedMotion)
})
