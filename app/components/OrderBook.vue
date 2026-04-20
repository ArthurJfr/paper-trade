<script setup lang="ts">
import type { OrderBookSnapshot, StreamStatus } from '~~/shared/types/market'

const props = defineProps<{
  book: OrderBookSnapshot | null
  status: StreamStatus
  depth?: number // nombre de niveaux à afficher par côté
}>()

const rows = computed(() => props.depth ?? 14)

interface Row { price: number; quantity: number; cum: number; cumPct: number }

// Calcule les niveaux avec cumul + %.
// `asks` inversé pour avoir le meilleur (le plus bas) en bas, proche du spread.
function compute(levels: { price: number, quantity: number }[], reverse = false): Row[] {
  if (!levels.length) return []
  const take = levels.slice(0, rows.value)
  const total = take.reduce((s, l) => s + l.quantity, 0) || 1
  let cum = 0
  const withCum: Row[] = take.map((l) => {
    cum += l.quantity
    return { price: l.price, quantity: l.quantity, cum, cumPct: (cum / total) * 100 }
  })
  return reverse ? withCum.reverse() : withCum
}

const bids = computed<Row[]>(() => compute(props.book?.bids ?? []))
const asks = computed<Row[]>(() => compute(props.book?.asks ?? [], true))

// Spread
const spread = computed(() => {
  const b = props.book
  if (!b || !b.bids.length || !b.asks.length) return null
  const bid = b.bids[0]!.price
  const ask = b.asks[0]!.price
  const mid = (bid + ask) / 2
  return { bid, ask, mid, abs: ask - bid, pct: ((ask - bid) / mid) * 100 }
})

const fmtQty = (q: number) => {
  if (q === 0) return '—'
  if (q >= 1000) return q.toLocaleString('en-US', { maximumFractionDigits: 0 })
  if (q >= 1) return q.toFixed(3)
  if (q >= 0.001) return q.toFixed(5)
  return q.toPrecision(3)
}
</script>

<template>
  <section class="ob">
    <header class="ob-head">
      <h3>Order book</h3>
      <span class="chip" :data-status="status">
        <span class="dot" />
        {{ status === 'live' ? 'Live · 100 ms' : status }}
      </span>
    </header>

    <div class="ob-cols">
      <span>Prix</span>
      <span>Quantité</span>
      <span>Cumul</span>
    </div>

    <!-- Asks (rouge) : plus élevés en haut, meilleur ask juste au-dessus du spread -->
    <div class="ob-side asks" role="list">
      <template v-if="asks.length">
        <div
          v-for="l in asks"
          :key="`a-${l.price}`"
          class="ob-row"
          :style="{ '--fill': `${l.cumPct}%` }"
          role="listitem"
        >
          <span class="p">{{ fmtPrice(l.price) }}</span>
          <span class="q">{{ fmtQty(l.quantity) }}</span>
          <span class="c">{{ fmtQty(l.cum) }}</span>
        </div>
      </template>
      <div v-else class="ob-empty">—</div>
    </div>

    <!-- Spread -->
    <div v-if="spread" class="ob-spread">
      <span class="lbl">Spread</span>
      <span class="val">${{ fmtPrice(spread.abs) }}</span>
      <span class="pct">{{ spread.pct.toFixed(3) }}%</span>
    </div>
    <div v-else class="ob-spread placeholder">
      <span class="lbl">Spread</span>
      <span class="val">—</span>
      <span class="pct">—</span>
    </div>

    <!-- Bids (vert) : meilleur bid en haut, décroissant -->
    <div class="ob-side bids" role="list">
      <template v-if="bids.length">
        <div
          v-for="l in bids"
          :key="`b-${l.price}`"
          class="ob-row"
          :style="{ '--fill': `${l.cumPct}%` }"
          role="listitem"
        >
          <span class="p">{{ fmtPrice(l.price) }}</span>
          <span class="q">{{ fmtQty(l.quantity) }}</span>
          <span class="c">{{ fmtQty(l.cum) }}</span>
        </div>
      </template>
      <div v-else class="ob-empty">—</div>
    </div>
  </section>
</template>

<style lang="scss" scoped>
.ob {
  @include stack($space-sm);
  padding: $space-md;
  background: $color-surface;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  font-size: $fs-xs;
}

.ob-head {
  @include flex-between;

  h3 { font-size: $fs-sm; font-weight: $fw-semibold; }
}

.chip {
  @include row($space-xs);
  padding: 2px $space-sm;
  font-size: 10px;
  color: $color-text-muted;

  .dot {
    width: 6px;
    height: 6px;
    border-radius: $radius-full;
    background: $color-text-dim;
  }

  &[data-status='live'] .dot {
    background: $color-accent;
    box-shadow: 0 0 0 3px $color-accent-soft;
  }
  &[data-status='reconnecting'] .dot,
  &[data-status='offline'] .dot { background: $color-danger; }
}

.ob-cols {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: $space-sm;
  padding: 0 $space-xs;
  color: $color-text-dim;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;

  span:nth-child(2),
  span:nth-child(3) { text-align: right; }
}

.ob-side {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.ob-row {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: $space-sm;
  padding: 2px $space-xs;
  font-family: $font-mono;
  @include mono-nums;
  font-size: 11px;
  border-radius: 2px;

  // Barre de profondeur en background (ancrée à droite).
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    width: var(--fill, 0%);
    border-radius: inherit;
    pointer-events: none;
  }

  .p { font-weight: $fw-semibold; }
  .q { text-align: right; color: $color-text-muted; }
  .c { text-align: right; color: $color-text-dim; }

  &:hover { background: $color-surface-2; }
}

.asks .ob-row {
  .p { color: $color-danger; }
  &::before {
    background: rgba(234, 57, 67, 0.13);
    right: 0; left: auto;
  }
}
.bids .ob-row {
  .p { color: $color-accent; }
  &::before {
    background: rgba(22, 199, 132, 0.13);
    right: 0; left: auto;
  }
}

.ob-empty {
  padding: $space-md 0;
  text-align: center;
  color: $color-text-dim;
  font-family: $font-mono;
}

.ob-spread {
  @include flex-between;
  padding: $space-sm $space-xs;
  background: $color-surface-2;
  border-radius: $radius-sm;
  font-family: $font-mono;
  @include mono-nums;

  .lbl { color: $color-text-muted; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; }
  .val { color: $color-text; font-weight: $fw-semibold; }
  .pct { color: $color-text-dim; font-size: 10px; }

  &.placeholder .val,
  &.placeholder .pct { color: $color-text-dim; }
}
</style>
