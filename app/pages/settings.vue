<script setup lang="ts">
useHead({ title: 'Réglages · Paper-Trade' })

const cfg = useRuntimeConfig()
const marketStore = useMarketStore()
const ui = useUiPreferencesStore()

const simulationSettings = computed(() => [
  { label: 'Balance initiale', value: `${Number(cfg.public.initialBalanceUsdc).toLocaleString('fr-FR')} USDC` },
  { label: 'Frais simulés', value: `${Number(cfg.public.tradingFeeBps).toFixed(0)} bps` },
  { label: 'Version app', value: `v${cfg.public.appVersion}` },
])

const themeChoices: Array<{ value: 'dark' | 'light' | 'system', label: string }> = [
  { value: 'dark', label: 'Sombre' },
  { value: 'light', label: 'Clair' },
  { value: 'system', label: 'Système' },
]
const densityChoices: Array<{ value: 'comfortable' | 'compact', label: string }> = [
  { value: 'comfortable', label: 'Confortable' },
  { value: 'compact', label: 'Compacte' },
]
</script>

<template>
  <section class="settings">
    <PageHeader
      kicker="Configuration"
      title="Réglages"
      subtitle="Vue simple des paramètres actifs et de la taxonomie chargée."
    />

    <UiCard>
      <h2>Apparence & accessibilité</h2>
      <div class="grid-2">
        <div class="field">
          <label>Thème</label>
          <div class="segmented" role="radiogroup" aria-label="Choix du thème">
            <button
              v-for="c in themeChoices"
              :key="c.value"
              type="button"
              role="radio"
              :aria-checked="ui.state.theme === c.value"
              :class="{ active: ui.state.theme === c.value }"
              @click="ui.setTheme(c.value)"
            >{{ c.label }}</button>
          </div>
        </div>
        <div class="field">
          <label>Densité</label>
          <div class="segmented" role="radiogroup" aria-label="Choix de la densité">
            <button
              v-for="c in densityChoices"
              :key="c.value"
              type="button"
              role="radio"
              :aria-checked="ui.state.density === c.value"
              :class="{ active: ui.state.density === c.value }"
              @click="ui.setDensity(c.value)"
            >{{ c.label }}</button>
          </div>
        </div>
      </div>
      <ul class="rows">
        <li>
          <label for="pref-reduced-motion" class="row-label">Réduire les animations</label>
          <span class="switch">
            <input
              id="pref-reduced-motion"
              type="checkbox"
              :checked="ui.state.reducedMotion"
              @change="ui.setReducedMotion(!ui.state.reducedMotion)"
            />
            <span class="slider" aria-hidden="true" />
          </span>
        </li>
        <li>
          <label for="pref-vitals-overlay" class="row-label">Overlay Core Web Vitals (debug)</label>
          <span class="switch">
            <input
              id="pref-vitals-overlay"
              type="checkbox"
              :checked="ui.state.showVitalsOverlay"
              @change="ui.toggleVitalsOverlay()"
            />
            <span class="slider" aria-hidden="true" />
          </span>
        </li>
      </ul>
    </UiCard>

    <UiCard>
      <h2>Paramètres de simulation</h2>
      <ul class="rows">
        <li v-for="item in simulationSettings" :key="item.label">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
        </li>
      </ul>
    </UiCard>

    <UiCard>
      <h2>Taxonomie active</h2>
      <ul class="cats">
        <li
          v-for="cat in marketStore.taxonomy.categories"
          :key="cat.key"
          class="cat"
        >
          <span class="dot" :style="{ background: cat.color }" aria-hidden="true" />
          <span>{{ cat.label }}</span>
          <small>{{ cat.key }}</small>
        </li>
      </ul>
    </UiCard>
  </section>
</template>

<style lang="scss" scoped>
.settings { @include stack($space-xl); }

h2 { font-size: $fs-lg; margin-bottom: $space-md; }

.rows {
  @include stack($space-xs);
  li {
    @include flex-between;
    gap: $space-md;
    padding: $space-sm 0;
    border-bottom: 1px solid $color-border;
    min-width: 0;
    &:last-child { border-bottom: 0; }
    span { color: var(--text-secondary); }
    strong { @include mono-nums; }
  }

  .row-label {
    color: var(--text-secondary);
    cursor: pointer;
    flex: 1;
    min-width: 0;
  }
}

.cats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: $space-sm;
}

.cat {
  @include row($space-xs);
  background: $color-surface-2;
  border: 1px solid $color-border;
  border-radius: $radius-sm;
  padding: $space-sm;
  min-width: 0;

  > span:not(.dot) { @include truncate; flex: 1; }

  small {
    margin-left: auto;
    color: var(--text-tertiary);
    font-family: $font-mono;
    font-size: $fs-2xs;
    flex-shrink: 0;
  }
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: $radius-full;
}

.grid-2 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: $space-md;
  margin-bottom: $space-md;

  @include media-down($bp-sm) {
    grid-template-columns: 1fr;
  }
}

.field {
  @include stack($space-xs);
  min-width: 0;

  label {
    font-size: $fs-xs;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: $color-text-dim;
  }
}

.segmented {
  display: inline-flex;
  flex-wrap: wrap;
  border: 1px solid $color-border;
  border-radius: $radius-sm;
  overflow: hidden;
  background: $color-surface-2;
  max-width: 100%;

  button {
    padding: $space-xs $space-md;
    font-size: $fs-xs;
    color: $color-text-muted;
    background: transparent;
    border: 0;
    cursor: pointer;
    transition: color $transition-fast, background $transition-fast;

    & + button { border-left: 1px solid $color-border; }
    &:hover { color: $color-text; }
    &:focus-visible { @include ring-inset; }

    &.active {
      background: $color-accent;
      color: $color-surface;
      font-weight: $fw-semibold;
    }
  }
}

.switch {
  position: relative;
  display: inline-block;
  width: 36px;
  height: 20px;
  cursor: pointer;

  input {
    position: absolute;
    opacity: 0;
    width: 100%;
    height: 100%;
    cursor: pointer;
  }

  .slider {
    position: absolute;
    inset: 0;
    background: $color-surface-2;
    border: 1px solid $color-border;
    border-radius: $radius-full;
    transition: background $transition-fast, border-color $transition-fast;

    &::before {
      content: '';
      position: absolute;
      top: 2px;
      left: 2px;
      width: 14px;
      height: 14px;
      background: $color-text-dim;
      border-radius: 50%;
      transition: transform $transition-fast, background $transition-fast;
    }
  }

  input:checked + .slider {
    background: color-mix(in oklab, $color-accent 35%, transparent);
    border-color: $color-accent;
    &::before {
      transform: translateX(16px);
      background: $color-accent;
    }
  }

  input:focus-visible + .slider { @include ring-outset; }
}
</style>
