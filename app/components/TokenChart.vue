<script setup lang="ts">
import type { Kline, KlineInterval } from '~~/shared/types/market'

type Mode = 'line' | 'candles' | 'area'

const props = withDefaults(defineProps<{
  klines: Kline[]
  interval: KlineInterval
  mode?: Mode
  overlays?: {
    ma20?: boolean
    ma50?: boolean
    ema21?: boolean
    vwap?: boolean
  }
  showVolume?: boolean
  benchmark?: number[] | null
}>(), {
  mode: 'candles',
  showVolume: true,
  benchmark: null,
})

// ─── Canevas interne SVG ──────────────────────────────────────────────────
const W = 800
const H = 400
const PAD_L = 56
const PAD_R = 12
const PAD_T = 16
const PAD_B = 36
const VOL_H = 72

const chartH = computed(() => props.showVolume ? H - PAD_T - PAD_B - VOL_H - 6 : H - PAD_T - PAD_B)
const chartBottom = computed(() => PAD_T + chartH.value)

// ─── Zoom/pan state ───────────────────────────────────────────────────────
const container = ref<HTMLDivElement | null>(null)
const hoverIndex = ref<number | null>(null)
const zoom = ref(1) // 1 = tout, >1 = zoom in
const panOffset = ref(0) // en nombre de bougies (centre du viewport)

const visibleRange = computed(() => {
  const n = props.klines.length
  if (n === 0) return { start: 0, end: 0 }
  const visible = Math.max(10, Math.round(n / zoom.value))
  let start = Math.max(0, Math.round(n - visible + panOffset.value))
  let end = Math.min(n, start + visible)
  start = Math.max(0, end - visible)
  return { start, end }
})

const visibleKlines = computed(() => {
  const { start, end } = visibleRange.value
  return props.klines.slice(start, end)
})

// ─── Overlays : calculs (SMA, EMA, VWAP) ──────────────────────────────────
function sma(series: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(series.length).fill(null)
  if (period < 2) return out
  let sum = 0
  for (let i = 0; i < series.length; i++) {
    sum += series[i]!
    if (i >= period) sum -= series[i - period]!
    if (i >= period - 1) out[i] = sum / period
  }
  return out
}

function ema(series: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(series.length).fill(null)
  if (period < 2 || series.length === 0) return out
  const k = 2 / (period + 1)
  let prev: number | null = null
  let seedSum = 0
  for (let i = 0; i < series.length; i++) {
    const v = series[i]!
    if (i < period - 1) {
      seedSum += v
      continue
    }
    if (prev === null) {
      seedSum += v
      prev = seedSum / period
      out[i] = prev
      continue
    }
    prev = v * k + prev * (1 - k)
    out[i] = prev
  }
  return out
}

function vwap(ks: Kline[]): (number | null)[] {
  const out: (number | null)[] = new Array(ks.length).fill(null)
  let cumPV = 0
  let cumV = 0
  for (let i = 0; i < ks.length; i++) {
    const k = ks[i]!
    const typical = (k.high + k.low + k.close) / 3
    cumPV += typical * k.volume
    cumV += k.volume
    out[i] = cumV > 0 ? cumPV / cumV : null
  }
  return out
}

const closes = computed(() => props.klines.map(k => k.close))

const overlaySeries = computed(() => ({
  ma20: props.overlays?.ma20 ? sma(closes.value, 20) : null,
  ma50: props.overlays?.ma50 ? sma(closes.value, 50) : null,
  ema21: props.overlays?.ema21 ? ema(closes.value, 21) : null,
  vwap: props.overlays?.vwap ? vwap(props.klines) : null,
}))

// ─── Scales calculées sur la fenêtre visible ──────────────────────────────
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
  const { start, end } = visibleRange.value
  const ks = props.klines.slice(start, end)
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

  // Inclure les overlays dans le range si présents
  const overlays = overlaySeries.value
  for (const key of ['ma20', 'ma50', 'ema21', 'vwap'] as const) {
    const series = overlays[key]
    if (!series) continue
    for (let i = start; i < end; i++) {
      const v = series[i]
      if (v === null || v === undefined) continue
      if (v < lo) lo = v
      if (v > hi) hi = v
    }
  }

  const pad = (hi - lo) * 0.06 || 1
  const yMin = lo - pad
  const yMax = hi + pad
  const yRange = Math.max(1e-9, yMax - yMin)
  const cbot = chartBottom.value
  const ch = chartH.value

  return {
    xAt: (i: number) => PAD_L + i * xStep,
    yAt: (p: number) => cbot - ((p - yMin) / yRange) * ch,
    volYAt: (v: number) => maxVol > 0 ? (v / maxVol) * VOL_H : 0,
    yMin, yMax, yRange, xStep, maxVol,
  }
})

// ─── Direction globale ────────────────────────────────────────────────────
type Dir = 'up' | 'down' | 'flat'
const direction = computed<Dir>(() => {
  const ks = visibleKlines.value
  if (ks.length < 2) return 'flat'
  const first = ks[0]!.open
  const last = ks[ks.length - 1]!.close
  if (last > first * 1.0005) return 'up'
  if (last < first * 0.9995) return 'down'
  return 'flat'
})

const lineColor = computed(() =>
  direction.value === 'up'
    ? 'var(--chart-line-up)'
    : direction.value === 'down'
      ? 'var(--chart-line-down)'
      : 'var(--chart-line-flat)',
)

const chartMode = computed<Mode>(() => props.mode ?? 'candles')

// ─── Paths ────────────────────────────────────────────────────────────────
const linePath = computed(() => {
  const s = scales.value
  const ks = visibleKlines.value
  if (!s) return ''
  const parts: string[] = []
  ks.forEach((k, i) => {
    parts.push(`${i === 0 ? 'M' : 'L'}${s.xAt(i).toFixed(2)},${s.yAt(k.close).toFixed(2)}`)
  })
  return parts.join(' ')
})

const areaPath = computed(() => {
  const s = scales.value
  const ks = visibleKlines.value
  if (!s || !ks.length) return ''
  const first = `M${s.xAt(0).toFixed(2)},${chartBottom.value}`
  const mid = ks.map((k, i) => `L${s.xAt(i).toFixed(2)},${s.yAt(k.close).toFixed(2)}`).join(' ')
  const last = `L${s.xAt(ks.length - 1).toFixed(2)},${chartBottom.value} Z`
  return `${first} ${mid} ${last}`
})

const candles = computed(() => {
  const s = scales.value
  const ks = visibleKlines.value
  if (!s) return []
  const bodyW = Math.max(2, Math.min(14, s.xStep * 0.62))
  return ks.map((k, i) => {
    const x = s.xAt(i)
    const yOpen = s.yAt(k.open)
    const yClose = s.yAt(k.close)
    const yHigh = s.yAt(k.high)
    const yLow = s.yAt(k.low)
    const top = Math.min(yOpen, yClose)
    const bodyH = Math.max(1, Math.abs(yClose - yOpen))
    const trend: 'up' | 'down' = k.close >= k.open ? 'up' : 'down'
    return { x, yOpen, yClose, yHigh, yLow, top, bodyH, bodyW, trend }
  })
})

function overlayPath(key: 'ma20' | 'ma50' | 'ema21' | 'vwap'): string {
  const series = overlaySeries.value[key]
  const s = scales.value
  const { start, end } = visibleRange.value
  if (!series || !s) return ''
  const parts: string[] = []
  let started = false
  for (let i = start; i < end; i++) {
    const v = series[i]
    if (v === null || v === undefined) continue
    const x = s.xAt(i - start)
    const y = s.yAt(v)
    parts.push(`${started ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`)
    started = true
  }
  return parts.join(' ')
}

const ma20Path = computed(() => overlayPath('ma20'))
const ma50Path = computed(() => overlayPath('ma50'))
const ema21Path = computed(() => overlayPath('ema21'))
const vwapPath = computed(() => overlayPath('vwap'))

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
  const ks = visibleKlines.value
  if (!s || !ks.length) return []
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

// ─── Interaction : hover + pan + zoom ────────────────────────────────────
const isDragging = ref(false)
const dragStartX = ref(0)
const dragStartPan = ref(0)
let rafId: number | null = null
let pendingEvent: PointerEvent | null = null

function processPointerMove(e: PointerEvent) {
  const s = scales.value
  if (!s || !container.value) return
  const rect = container.value.getBoundingClientRect()

  if (isDragging.value) {
    const dx = e.clientX - dragStartX.value
    const deltaCandles = -(dx / rect.width) * visibleKlines.value.length
    panOffset.value = dragStartPan.value + deltaCandles
    clampPan()
    return
  }

  const xPx = e.clientX - rect.left
  const xSvg = (xPx / rect.width) * W
  const rel = xSvg - PAD_L
  const idx = Math.round(rel / s.xStep)
  hoverIndex.value = Math.max(0, Math.min(visibleKlines.value.length - 1, idx))
}

function onPointerMove(e: PointerEvent) {
  pendingEvent = e
  if (rafId !== null) return
  rafId = requestAnimationFrame(() => {
    rafId = null
    if (pendingEvent) processPointerMove(pendingEvent)
  })
}

function onPointerDown(e: PointerEvent) {
  if (e.button !== 0) return
  isDragging.value = true
  dragStartX.value = e.clientX
  dragStartPan.value = panOffset.value
  container.value?.setPointerCapture(e.pointerId)
}

function onPointerUp(e: PointerEvent) {
  isDragging.value = false
  container.value?.releasePointerCapture?.(e.pointerId)
}

function onPointerLeave() {
  hoverIndex.value = null
}

function onWheel(e: WheelEvent) {
  if (!container.value) return
  const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
  zoom.value = Math.min(20, Math.max(1, zoom.value * factor))
  clampPan()
}

function clampPan() {
  const n = props.klines.length
  const visible = Math.max(10, Math.round(n / zoom.value))
  const maxOffset = 0
  const minOffset = -(n - visible)
  panOffset.value = Math.min(maxOffset, Math.max(minOffset, panOffset.value))
}

function resetZoom() {
  zoom.value = 1
  panOffset.value = 0
}

defineExpose({ resetZoom })

// ─── Raccourcis clavier ──────────────────────────────────────────────────
function onKeydown(e: KeyboardEvent) {
  const target = e.target as HTMLElement | null
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
  if (e.key === '+' || e.key === '=') {
    zoom.value = Math.min(20, zoom.value * 1.2)
  } else if (e.key === '-' || e.key === '_') {
    zoom.value = Math.max(1, zoom.value / 1.2)
    clampPan()
  } else if (e.key === '0') {
    resetZoom()
  } else if (e.key === 'ArrowLeft') {
    panOffset.value -= Math.max(1, visibleKlines.value.length * 0.1)
    clampPan()
  } else if (e.key === 'ArrowRight') {
    panOffset.value += Math.max(1, visibleKlines.value.length * 0.1)
    clampPan()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  if (rafId !== null) cancelAnimationFrame(rafId)
})

// Reset zoom si le dataset change (ex. changement d'intervalle)
watch(() => props.klines.length, () => {
  resetZoom()
})

// ─── Données du point survolé pour le tooltip ─────────────────────────────
const hovered = computed(() => {
  const i = hoverIndex.value
  if (i === null) return null
  const { start } = visibleRange.value
  const k = props.klines[start + i]
  const s = scales.value
  if (!k || !s) return null
  const absoluteI = start + i
  const mk = (v: (number | null)[] | null) => v?.[absoluteI] ?? null
  return {
    k,
    i,
    x: s.xAt(i),
    y: s.yAt(k.close),
    ma20: mk(overlaySeries.value.ma20),
    ma50: mk(overlaySeries.value.ma50),
    ema21: mk(overlaySeries.value.ema21),
    vwap: mk(overlaySeries.value.vwap),
  }
})

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

// Zoom label (affichage)
const zoomLabel = computed(() => `${(zoom.value).toFixed(1)}×`)
</script>

<template>
  <div
    ref="container"
    class="chart"
    :class="{ dragging: isDragging }"
    tabindex="0"
    @pointermove="onPointerMove"
    @pointerdown="onPointerDown"
    @pointerup="onPointerUp"
    @pointerleave="onPointerLeave"
    @wheel.prevent="onWheel"
  >
    <svg :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" role="img" :aria-label="`Graphique ${interval}`">
      <defs>
        <linearGradient id="chart-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   :stop-color="lineColor" stop-opacity="0.35" />
          <stop offset="100%" :stop-color="lineColor" stop-opacity="0" />
        </linearGradient>
      </defs>

      <g class="grid">
        <line
          v-for="(t, i) in yTicks"
          :key="`gy-${i}`"
          :x1="PAD_L" :x2="W - PAD_R"
          :y1="t.y" :y2="t.y"
        />
      </g>

      <g class="y-axis">
        <text
          v-for="(t, i) in yTicks"
          :key="`yl-${i}`"
          :x="PAD_L - 8" :y="t.y + 3"
          text-anchor="end"
        >{{ fmtPrice(t.price) }}</text>
      </g>

      <g class="x-axis">
        <text
          v-for="(t, i) in xTicks"
          :key="`xl-${i}`"
          :x="t.x" :y="H - 14"
          text-anchor="middle"
        >{{ t.label }}</text>
      </g>

      <g v-if="chartMode === 'line' || chartMode === 'area'">
        <path v-if="chartMode === 'area'" :d="areaPath" fill="url(#chart-area)" />
        <path :d="linePath" fill="none" :stroke="lineColor" stroke-width="1.6" />
      </g>

      <g v-else class="candles">
        <line
          v-for="(c, i) in candles"
          :key="`wick-${i}`"
          :x1="c.x"
          :x2="c.x"
          :y1="c.yHigh"
          :y2="c.yLow"
          :data-trend="c.trend"
          class="wick"
        />
        <rect
          v-for="(c, i) in candles"
          :key="`body-${i}`"
          :x="c.x - c.bodyW / 2"
          :y="c.top"
          :width="c.bodyW"
          :height="c.bodyH"
          :data-trend="c.trend"
          class="body"
        />
      </g>

      <g class="overlays">
        <path v-if="overlays?.ma20" class="ov ov-ma20" :d="ma20Path" />
        <path v-if="overlays?.ma50" class="ov ov-ma50" :d="ma50Path" />
        <path v-if="overlays?.ema21" class="ov ov-ema21" :d="ema21Path" />
        <path v-if="overlays?.vwap" class="ov ov-vwap" :d="vwapPath" />
      </g>

      <g v-if="scales && showVolume" class="volume">
        <rect
          v-for="(k, i) in visibleKlines"
          :key="`v-${i}`"
          :x="scales.xAt(i) - scales.xStep * 0.35"
          :y="H - PAD_B - scales.volYAt(k.quoteVolume)"
          :width="Math.max(1, scales.xStep * 0.7)"
          :height="scales.volYAt(k.quoteVolume)"
          :fill="k.close >= k.open ? 'var(--chart-line-up)' : 'var(--chart-line-down)'"
          fill-opacity="0.28"
        />
      </g>

      <g v-if="hovered" class="crosshair">
        <line :x1="hovered.x" :x2="hovered.x" :y1="PAD_T" :y2="H - PAD_B" />
        <line :x1="PAD_L" :x2="W - PAD_R" :y1="hovered.y" :y2="hovered.y" />
        <circle :cx="hovered.x" :cy="hovered.y" r="3.5" :fill="lineColor" />
      </g>
    </svg>

    <div class="hud">
      <span class="zoom" :title="`${(zoom).toFixed(2)}x`">zoom {{ zoomLabel }}</span>
      <button
        v-if="zoom > 1 || panOffset !== 0"
        type="button"
        class="reset"
        @click="resetZoom"
        aria-label="Réinitialiser le zoom"
      >reset</button>
    </div>

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
        <template v-if="hovered.ma20 !== null">
          <span class="label ov-label ov-ma20-label">MA20</span>
          <span class="val">{{ fmtPrice(hovered.ma20) }}</span>
        </template>
        <template v-if="hovered.ma50 !== null">
          <span class="label ov-label ov-ma50-label">MA50</span>
          <span class="val">{{ fmtPrice(hovered.ma50) }}</span>
        </template>
        <template v-if="hovered.ema21 !== null">
          <span class="label ov-label ov-ema21-label">EMA21</span>
          <span class="val">{{ fmtPrice(hovered.ema21) }}</span>
        </template>
        <template v-if="hovered.vwap !== null">
          <span class="label ov-label ov-vwap-label">VWAP</span>
          <span class="val">{{ fmtPrice(hovered.vwap) }}</span>
        </template>
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

  &.dragging { cursor: grabbing; }

  &:focus-visible {
    outline: 2px solid $color-accent;
    outline-offset: 2px;
  }
}

svg {
  width: 100%;
  height: 100%;
  display: block;
  user-select: none;
}

.grid line {
  stroke: var(--chart-grid, #{$color-border});
  stroke-width: 0.5;
  opacity: 0.7;
}

.y-axis text,
.x-axis text {
  font-family: $font-mono;
  font-size: $fs-3xs;
  fill: $color-text-dim;
}

.crosshair line {
  stroke: $color-text-muted;
  stroke-width: 0.5;
  stroke-dasharray: 3 3;
  opacity: 0.7;
}

.candles {
  .wick {
    stroke-width: 1;
    &[data-trend='up'] { stroke: $color-accent; }
    &[data-trend='down'] { stroke: $color-danger; }
  }

  .body {
    stroke-width: 0.6;
    &[data-trend='up'] {
      fill: color-mix(in oklab, $color-accent 22%, transparent);
      stroke: $color-accent;
    }
    &[data-trend='down'] {
      fill: color-mix(in oklab, $color-danger 22%, transparent);
      stroke: $color-danger;
    }
  }
}

.overlays .ov {
  fill: none;
  stroke-width: 1.4;
  stroke-linejoin: round;
  stroke-linecap: round;
  pointer-events: none;
}
.ov-ma20 { stroke: var(--chart-overlay-ma20, #60a5fa); }
.ov-ma50 { stroke: var(--chart-overlay-ma50, #a78bfa); }
.ov-ema21 { stroke: var(--chart-overlay-ema21, #fb923c); stroke-dasharray: 3 3; }
.ov-vwap { stroke: var(--chart-overlay-vwap, #f472b6); stroke-dasharray: 5 3; }

.hud {
  position: absolute;
  top: $space-sm;
  right: $space-sm;
  display: flex;
  align-items: center;
  gap: $space-xs;
  z-index: 2;
  pointer-events: auto;

  .zoom {
    font-family: $font-mono;
    font-size: $fs-3xs;
    color: $color-text-dim;
    padding: $space-2xs $space-xs;
    background: var(--tooltip-bg);
    border: 1px solid $color-border;
    border-radius: $radius-sm;
  }
  .reset {
    font-size: $fs-3xs;
    padding: $space-2xs $space-xs;
    background: transparent;
    color: $color-text-muted;
    border: 1px solid $color-border;
    border-radius: $radius-sm;
    cursor: pointer;

    &:hover { color: $color-text; border-color: $color-border-hover; }
    &:focus-visible { @include ring-inset; }
  }
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
    .ov-label { font-weight: $fw-semibold; }
    .ov-ma20-label  { color: var(--chart-overlay-ma20); }
    .ov-ma50-label  { color: var(--chart-overlay-ma50); }
    .ov-ema21-label { color: var(--chart-overlay-ema21); }
    .ov-vwap-label  { color: var(--chart-overlay-vwap); }
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
