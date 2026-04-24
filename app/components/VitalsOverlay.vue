<script setup lang="ts">
import { rateVital, useWebVitals } from '~/composables/useWebVitals'

const ui = useUiPreferencesStore()
const { snapshot } = useWebVitals()

const metrics = computed(() => [
  { key: 'lcp' as const,  label: 'LCP',  value: snapshot.value.lcp,  unit: 'ms', fmt: fmtMs },
  { key: 'fcp' as const,  label: 'FCP',  value: snapshot.value.fcp,  unit: 'ms', fmt: fmtMs },
  { key: 'inp' as const,  label: 'INP',  value: snapshot.value.inp,  unit: 'ms', fmt: fmtMs },
  { key: 'cls' as const,  label: 'CLS',  value: snapshot.value.cls,  unit: '',   fmt: fmtCls },
  { key: 'ttfb' as const, label: 'TTFB', value: snapshot.value.ttfb, unit: 'ms', fmt: fmtMs },
])

function fmtMs(v: number | null): string {
  return v === null ? '—' : Math.round(v).toString()
}
function fmtCls(v: number | null): string {
  return v === null ? '—' : v.toFixed(3)
}
</script>

<template>
  <Transition name="pt-popover">
  <aside
    v-if="ui.state.showVitalsOverlay"
    class="vitals"
    role="status"
    aria-label="Core Web Vitals"
  >
    <header>
      <span>CWV</span>
      <button type="button" class="close" aria-label="Fermer l'overlay" @click="ui.toggleVitalsOverlay()">×</button>
    </header>
    <dl>
      <template v-for="m in metrics" :key="m.key">
        <dt>{{ m.label }}</dt>
        <dd :data-rating="rateVital(m.key, m.value)">
          {{ m.fmt(m.value) }}<span v-if="m.unit" class="unit">{{ m.unit }}</span>
        </dd>
      </template>
    </dl>
  </aside>
  </Transition>
</template>

<style lang="scss" scoped>
.vitals {
  position: fixed;
  bottom: $space-md;
  right: $space-md;
  z-index: $z-toast - 1;
  background: $color-surface-2;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  padding: $space-sm;
  box-shadow: $shadow-lg;
  min-width: 160px;
  max-width: calc(100vw - #{$space-md * 2});
  font-size: $fs-2xs;

  header {
    @include flex-between;
    margin-bottom: $space-xs;

    > span {
      font-weight: $fw-semibold;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: $color-text-dim;
    }

    .close {
      background: transparent;
      border: 0;
      color: $color-text-dim;
      cursor: pointer;
      font-size: $fs-md;
      line-height: 1;
      padding: 0 $space-xs;
      border-radius: $radius-sm;
      &:hover { color: $color-text; }
      &:focus-visible { @include ring-inset; }
    }
  }

  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: $space-2xs $space-sm;
  }

  dt {
    color: $color-text-dim;
    font-family: $font-mono;
  }

  dd {
    @include mono-nums;
    text-align: right;
    color: $color-text;

    &[data-rating='good']  { color: $color-accent; }
    &[data-rating='needs'] { color: $color-warning; }
    &[data-rating='poor']  { color: $color-danger; }

    .unit {
      color: $color-text-dim;
      margin-left: $space-2xs;
      font-size: $fs-3xs;
    }
  }
}
</style>
