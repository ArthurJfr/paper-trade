<script setup lang="ts">
import type { Kline, KlineInterval } from '~~/shared/types/market'

const props = defineProps<{
  klines: Kline[]
  interval: KlineInterval
}>()

// ─── Canevas interne SVG (viewBox fixe, preserveAspectRatio: none) ────────
const W = 800
const H = 400
const PAD_L = 56
const PAD_R = 12
const PAD_T = 16
const PAD_B = 36
const VOL_H = 72
const CHART_H = H - PAD_T - PAD_B - VOL_H - 6
const CHART_BOTTOM = PAD_T + CHART_H

// ─── Hover state ──────────────────────────────────────────────────────────
const container = ref<HTMLDivElement | null>(null)
const hoverIndex = ref<number | null>(null)

// ─── Scales calculées ─────────────────────────────────────────────────────
interface Scales {
  xAt: (i: number) => number
  yAt: (price: number) => number
  volYAt: (v: number) => number
  yMin: number
  yMax: number
  yRange: number
  xStep: number
  maxVol: number
}

const scales = computed<Scales | null>(() => {
  const ks = props.klines
  if (!ks.length) return null

  const n = ks.length
  const xStep = (W - PAD_L - PAD_R) / Math.max(1, n - 1)

  let lo = Infinity
  let hi = -Infinity
  let maxVol = 0
  for (const k of ks) {
    if (k.low < lo) lo = k.low
    if (k.high > hi) hi = k.high
    if (k.quoteVolume > maxVol) maxVol = k.quoteVolume
  }
  const pad = (hi - lo) * 0.06 || 1
  const yMin = lo - pad
  const yMax = hi + pad
  const yRange = Math.max(1e-9, yMax - yMin)

  return {
    xAt: (i: number) => PAD_L + i * xStep,
    yAt: (p: number) => CHART_BOTTOM - ((p - yMin) / yRange) * CHART_H,
    volYAt: (v: number) => maxVol > 0 ? (v / maxVol) * VOL_H : 0,
    yMin, yMax, yRange, xStep, maxVol,
  }
})

// ─── Direction globale ────────────────────────────────────────────────────
type Dir = 'up' | 'down' | 'flat'
const direction = computed<Dir>(() => {
  const ks = props.klines
  if (ks.length < 2) return 'flat'
  const first = ks[0]!.open
  const last = ks[ks.length - 1]!.close
  if (last > first * 1.0005) return 'up'
  if (last < first * 0.9995) return 'down'
  return 'flat'
})

const lineColor = computed(() =>
  direction.value === 'up' ? '#16c784' : direction.value === 'down' ? '#ea3943' : '#9aa0a6',
)

// ─── Paths ────────────────────────────────────────────────────────────────
const linePath = computed(() => {
  const s = scales.value
  if (!s) return ''
  const parts: string[] = []
  props.klines.forEach((k, i) => {
    parts.push(`${i === 0 ? 'M' : 'L'}${s.xAt(i).toFixed(2)},${s.yAt(k.close).toFixed(2)}`)
  })
  return parts.join(' ')
})

const areaPath = computed(() => {
  const s = scales.value
  const ks = props.klines
  if (!s || !ks.length) return ''
  const first = `M${s.xAt(0).toFixed(2)},${CHART_BOTTOM}`
  const mid = ks.map((k, i) => `L${s.xAt(i).toFixed(2)},${s.yAt(k.close).toFixed(2)}`).join(' ')
  const last = `L${s.xAt(ks.length - 1).toFixed(2)},${CHART_BOTTOM} Z`
  return `${first} ${mid} ${last}`
})

// ─── Axes ─────────────────────────────────────────────────────────────────
const yTicks = computed(() => {
  const s = scales.value
  if (!s) return []
  const N = 5
  return Array.from({ length: N + 1 }, (_, i) => {
    const price = s.yMin + (s.yRange * i) / N
    return { price, y: s.yAt(price) }
  })
})

const xTicks = computed(() => {
  const s = scales.value
  if (!s) return []
  const ks = props.klines
  if (!ks.length) return []
  const desired = 6
  const skip = Math.max(1, Math.floor(ks.length / desired))
  const out: { x: number, label: string }[] = []
  for (let i = 0; i < ks.length; i += skip) {
    out.push({ x: s.xAt(i), label: fmtTimeTick(ks[i]!.openTime, props.interval) })
  }
  return out
})

function fmtTimeTick(ms: number, interval: KlineInterval): string {
  const d = new Date(ms)
  if (interval === '1m' || interval === '5m' || interval === '15m') {
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }
  if (interval === '1h' || interval === '4h') {
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
  }
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

function fmtHoverTime(ms: number): string {
  return new Date(ms).toLocaleString('fr-FR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

// ─── Interaction ──────────────────────────────────────────────────────────
function onPointerMove(e: PointerEvent) {
  const s = scales.value
  if (!s || !container.value) return
  const rect = container.value.getBoundingClientRect()
  const xPx = e.clientX - rect.left
  const xSvg = (xPx / rect.width) * W
  const rel = xSvg - PAD_L
  const idx = Math.round(rel / s.xStep)
  hoverIndex.value = Math.max(0, Math.min(props.klines.length - 1, idx))
}

function onPointerLeave() {
  hoverIndex.value = null
}

// ─── Données du point survolé pour le tooltip ─────────────────────────────
const hovered = computed(() => {
  const i = hoverIndex.value
  if (i === null) return null
  const k = props.klines[i]
  const s = scales.value
  if (!k || !s) return null
  return { k, i, x: s.xAt(i), y: s.yAt(k.close) }
})

// Position horizontale du tooltip en %, pour qu'il suive dans le conteneur.
const tooltipLeftPct = computed(() => {
  if (!hovered.value) return 0
  return (hovered.value.x / W) * 100
})

const tooltipStyle = computed(() => {
  const pct = tooltipLeftPct.value
  if (pct < 12) return { left: '0%', transform: 'translateX(0)' }
  if (pct > 88) return { left: '100%', transform: 'translateX(-100%)' }
  return { left: `${pct}%`, transform: 'translateX(-50%)' }
})
</script>

<template>
  <div
    ref="container"
    class="chart"
    @pointermove="onPointerMove"
    @pointerleave="onPointerLeave"
  >
    <svg :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" role="img" :aria-label="`Graphique ${interval}`">
      <defs>
        <linearGradient id="chart-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   :stop-color="lineColor" stop-opacity="0.35" />
          <stop offset="100%" :stop-color="lineColor" stop-opacity="0" />
        </linearGradient>
      </defs>

      <!-- Grille horizontale -->
      <g class="grid">
        <line
          v-for="(t, i) in yTicks"
          :key="`gy-${i}`"
          :x1="PAD_L" :x2="W - PAD_R"
          :y1="t.y" :y2="t.y"
        />
      </g>

      <!-- Labels Y (prix) -->
      <g class="y-axis">
        <text
          v-for="(t, i) in yTicks"
          :key="`yl-${i}`"
          :x="PAD_L - 8" :y="t.y + 3"
          text-anchor="end"
        >{{ fmtPrice(t.price) }}</text>
      </g>

      <!-- Labels X (temps) -->
      <g class="x-axis">
        <text
          v-for="(t, i) in xTicks"
          :key="`xl-${i}`"
          :x="t.x" :y="H - 14"
          text-anchor="middle"
        >{{ t.label }}</text>
      </g>

      <!-- Area + line -->
      <path :d="areaPath" fill="url(#chart-area)" />
      <path :d="linePath" fill="none" :stroke="lineColor" stroke-width="1.6" />

      <!-- Volume bars -->
      <g v-if="scales" class="volume">
        <rect
          v-for="(k, i) in klines"
          :key="`v-${i}`"
          :x="scales.xAt(i) - scales.xStep * 0.35"
          :y="H - PAD_B - scales.volYAt(k.quoteVolume)"
          :width="Math.max(1, scales.xStep * 0.7)"
          :height="scales.volYAt(k.quoteVolume)"
          :fill="k.close >= k.open ? '#16c784' : '#ea3943'"
          fill-opacity="0.28"
        />
      </g>

      <!-- Crosshair -->
      <g v-if="hovered" class="crosshair">
        <line :x1="hovered.x" :x2="hovered.x" :y1="PAD_T" :y2="H - PAD_B" />
        <line :x1="PAD_L" :x2="W - PAD_R" :y1="hovered.y" :y2="hovered.y" />
        <circle :cx="hovered.x" :cy="hovered.y" r="3.5" :fill="lineColor" />
      </g>
    </svg>

    <!-- Tooltip HTML (positionné en % du container) -->
    <div v-if="hovered" class="tooltip" :style="tooltipStyle">
      <span class="t-time">{{ fmtHoverTime(hovered.k.openTime) }}</span>
      <div class="t-grid">
        <span class="label">O</span><span class="val">{{ fmtPrice(hovered.k.open) }}</span>
        <span class="label">H</span><span class="val">{{ fmtPrice(hovered.k.high) }}</span>
        <span class="label">L</span><span class="val">{{ fmtPrice(hovered.k.low) }}</span>
        <span class="label">C</span>
        <span class="val" :data-trend="hovered.k.close >= hovered.k.open ? 'up' : 'down'">
          {{ fmtPrice(hovered.k.close) }}
        </span>
        <span class="label">Vol</span><span class="val">{{ fmtVolume(hovered.k.quoteVolume) }}</span>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.chart {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 8;
  background: $color-surface;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  overflow: hidden;
  touch-action: none;
  cursor: crosshair;
}

svg {
  width: 100%;
  height: 100%;
  display: block;
  user-select: none;
}

.grid line {
  stroke: $color-border;
  stroke-width: 0.5;
  opacity: 0.5;
}

.y-axis text,
.x-axis text {
  font-family: $font-mono;
  font-size: 10px;
  fill: $color-text-dim;
}

.crosshair line {
  stroke: $color-text-muted;
  stroke-width: 0.5;
  stroke-dasharray: 3 3;
  opacity: 0.7;
}

.tooltip {
  position: absolute;
  top: $space-md;
  padding: $space-sm $space-md;
  background: var(--tooltip-bg);
  border: 1px solid $color-border-hover;
  border-radius: $radius-sm;
  font-size: $fs-xs;
  color: $color-text;
  backdrop-filter: blur(8px);
  pointer-events: none;
  white-space: nowrap;
  z-index: 2;

  // Évite que le tooltip sorte sur les bords.
  min-width: 160px;

  .t-time {
    display: block;
    font-weight: $fw-semibold;
    color: $color-text-muted;
    margin-bottom: $space-xs;
    font-family: $font-mono;
  }

  .t-grid {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 2px $space-md;

    .label {
      color: $color-text-dim;
      font-family: $font-mono;
    }
    .val {
      font-family: $font-mono;
      text-align: right;
      @include mono-nums;
      &[data-trend='up']   { color: $color-accent; }
      &[data-trend='down'] { color: $color-danger; }
    }
  }
}
</style>
