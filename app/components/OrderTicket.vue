<script setup lang="ts">
import type { OrderSide } from '~~/shared/types/portfolio'

// ─────────────────────────────────────────────────────────────────────────────
// OrderTicket — ordre market paper-trading.
// Saisie en USDC (notional) ; quantité base asset calculée côté UI.
// ─────────────────────────────────────────────────────────────────────────────

const props = defineProps<{
  pair:  string
  /** Prix de référence pour le preview (live ticker). */
  price: number
  /** Symbole base (BTC, ETH…) pour l'affichage. */
  symbol?: string
}>()

const emit = defineEmits<{
  (e: 'filled', payload: { side: OrderSide; notional: number; quantity: number; price: number }): void
}>()

const runtime = useRuntimeConfig()
const feeBps = runtime.public.tradingFeeBps

const { store, placing, placeOrder } = await usePortfolio()
const wallets = useWalletsStore()
const toasts = useToasts()
const ui = useUiPreferencesStore()

const hasActiveWallet = computed(() => wallets.activeId !== null)

const side = ref<OrderSide>('buy')
const amount = ref<string>('') // saisie USDC (string pour autoriser ",")
const feedback = ref<{ type: 'ok' | 'err'; text: string } | null>(null)
const feedbackTimer = ref<ReturnType<typeof setTimeout> | null>(null)

// ─── Plan SL/TP (simulation frontend uniquement, persistée via uiPreferences) ─
const planOpen = ref(false)
const stopLossPct = ref<number | null>(null)
const takeProfitPct = ref<number | null>(null)

function loadPlanFor(pair: string) {
  const p = ui.getTradePlan(pair)
  stopLossPct.value = p?.stopLossPct ?? null
  takeProfitPct.value = p?.takeProfitPct ?? null
}
loadPlanFor(props.pair)
watch(() => props.pair, loadPlanFor)

// ─── Dérivés ──────────────────────────────────────────────────────────────

const position = computed(() => store.positionByPair.get(props.pair) ?? null)
const cashAvailable = computed(() => store.account?.cashBalance ?? 0)
const qtyAvailable = computed(() => position.value?.quantity ?? 0)

const parsedAmount = computed(() => {
  const n = Number.parseFloat(amount.value.replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : 0
})

const stopLossPrice = computed(() => {
  if (stopLossPct.value === null || !props.price) return null
  return props.price * (1 - stopLossPct.value / 100)
})
const takeProfitPrice = computed(() => {
  if (takeProfitPct.value === null || !props.price) return null
  return props.price * (1 + takeProfitPct.value / 100)
})
const riskReward = computed(() => {
  if (stopLossPct.value === null || takeProfitPct.value === null) return null
  if (stopLossPct.value <= 0) return null
  return takeProfitPct.value / stopLossPct.value
})
const riskAmount = computed(() => {
  if (stopLossPct.value === null) return null
  return parsedAmount.value * (stopLossPct.value / 100)
})
const rewardAmount = computed(() => {
  if (takeProfitPct.value === null) return null
  return parsedAmount.value * (takeProfitPct.value / 100)
})

function savePlan() {
  if (stopLossPct.value === null && takeProfitPct.value === null) {
    ui.removeTradePlan(props.pair)
    toasts.info('Plan SL/TP supprimé', { title: props.pair })
    return
  }
  ui.setTradePlan(props.pair, {
    stopLossPct: stopLossPct.value,
    takeProfitPct: takeProfitPct.value,
    entryPrice: props.price,
  })
  toasts.success('Plan enregistré', { title: props.symbol ?? props.pair })
}

function clearPlan() {
  stopLossPct.value = null
  takeProfitPct.value = null
  ui.removeTradePlan(props.pair)
}

/** Plafond USDC utilisable pour l'ordre courant (inclut les frais pour un buy). */
const maxNotional = computed(() => {
  if (side.value === 'buy') {
    return cashAvailable.value / (1 + feeBps / 10_000)
  }
  return qtyAvailable.value * props.price
})

const fee = computed(() => (parsedAmount.value * feeBps) / 10_000)

const quantity = computed(() =>
  props.price > 0 ? parsedAmount.value / props.price : 0,
)

const totalCost = computed(() =>
  side.value === 'buy' ? parsedAmount.value + fee.value : parsedAmount.value - fee.value,
)

const canSubmit = computed(() => {
  if (placing.value) return false
  if (!hasActiveWallet.value) return false
  if (!props.price || props.price <= 0) return false
  if (parsedAmount.value <= 0) return false
  if (side.value === 'buy' && totalCost.value > cashAvailable.value + 1e-9) return false
  if (side.value === 'sell' && quantity.value > qtyAvailable.value + 1e-9) return false
  return true
})

const submitLabel = computed(() => {
  if (!hasActiveWallet.value) return 'Aucun wallet actif'
  if (!props.price || props.price <= 0) return 'Prix indisponible'
  if (parsedAmount.value <= 0) return 'Entrer un montant'
  if (side.value === 'buy' && totalCost.value > cashAvailable.value + 1e-9) {
    return 'Cash insuffisant'
  }
  if (side.value === 'sell' && quantity.value > qtyAvailable.value + 1e-9) {
    return 'Position insuffisante'
  }
  return side.value === 'buy'
    ? `Acheter ${props.symbol ?? props.pair}`
    : `Vendre ${props.symbol ?? props.pair}`
})

// ─── Actions ──────────────────────────────────────────────────────────────

function setPercent(pct: number) {
  const max = maxNotional.value
  if (max <= 0) return
  amount.value = (max * pct).toFixed(2)
}

function resetAmount() {
  amount.value = ''
}

function flashFeedback(type: 'ok' | 'err', text: string, ttl = 4000) {
  feedback.value = { type, text }
  if (feedbackTimer.value) clearTimeout(feedbackTimer.value)
  feedbackTimer.value = setTimeout(() => { feedback.value = null }, ttl)
}

async function submit() {
  if (!canSubmit.value) return
  const notional = parsedAmount.value
  try {
    const res = await placeOrder({ pair: props.pair, side: side.value, notional })
    const label = side.value === 'buy' ? 'Achat' : 'Vente'
    const summary = `${fmtQty(res.trade.quantity)} ${props.symbol ?? props.pair} à $${fmtPrice(res.trade.price)}`
    flashFeedback('ok', `${label} exécuté : ${summary}`)
    toasts.success(summary, {
      title: `${label} ${props.symbol ?? props.pair}`,
      actionLabel: 'Voir wallets',
      action: () => navigateTo('/wallets'),
    })
    emit('filled', {
      side: side.value,
      notional,
      quantity: res.trade.quantity,
      price: res.trade.price,
    })
    resetAmount()
  } catch (err) {
    const msg = (err as Error).message
    flashFeedback('err', msg)
    toasts.danger(msg, { title: 'Ordre refusé' })
  }
}

function fmtQty(q: number): string {
  if (!Number.isFinite(q) || q <= 0) return '0'
  if (q >= 1)     return q.toFixed(4)
  if (q >= 0.001) return q.toFixed(6)
  return q.toPrecision(4)
}

onBeforeUnmount(() => {
  if (feedbackTimer.value) clearTimeout(feedbackTimer.value)
})
</script>

<template>
  <section class="ticket">
    <header class="ticket-head">
      <h3>Ordre market</h3>
      <div class="side-tabs" role="radiogroup" aria-label="Sens de l'ordre">
        <button
          type="button"
          role="radio"
          class="tab buy"
          :class="{ active: side === 'buy' }"
          :aria-checked="side === 'buy'"
          @click="side = 'buy'"
        >
          Acheter
        </button>
        <button
          type="button"
          role="radio"
          class="tab sell"
          :class="{ active: side === 'sell' }"
          :aria-checked="side === 'sell'"
          @click="side = 'sell'"
        >
          Vendre
        </button>
      </div>
    </header>

    <dl class="avail">
      <div>
        <dt>Cash</dt>
        <dd>${{ fmtPrice(cashAvailable) }}</dd>
      </div>
      <div>
        <dt>Position</dt>
        <dd>
          {{ fmtQty(qtyAvailable) }} {{ symbol ?? pair }}
        </dd>
      </div>
    </dl>

    <form class="form" @submit.prevent="submit">
      <label class="amount">
        <span class="amount-label">Montant (USDC)</span>
        <div class="amount-input">
          <span class="amount-prefix">$</span>
          <input
            v-model="amount"
            type="text"
            inputmode="decimal"
            placeholder="0.00"
            autocomplete="off"
            :disabled="placing"
          >
        </div>
      </label>

      <div class="pct" role="group" aria-label="Utiliser un pourcentage du solde">
        <button
          v-for="p in [0.25, 0.5, 0.75, 1]"
          :key="p"
          type="button"
          :aria-label="`Utiliser ${Math.round(p * 100)} % ${side === 'buy' ? 'du cash' : 'de la position'}`"
          @click="setPercent(p)"
        >
          {{ Math.round(p * 100) }}%
        </button>
      </div>

      <dl class="preview">
        <div>
          <dt>Prix</dt>
          <dd>${{ fmtPrice(price) }}</dd>
        </div>
        <div>
          <dt>Quantité</dt>
          <dd>{{ fmtQty(quantity) }} {{ symbol ?? '' }}</dd>
        </div>
        <div>
          <dt>Frais ({{ (feeBps / 100).toFixed(2) }}%)</dt>
          <dd>${{ fee.toFixed(2) }}</dd>
        </div>
        <div class="total">
          <dt>{{ side === 'buy' ? 'Total débité' : 'Total crédité' }}</dt>
          <dd>${{ totalCost > 0 ? totalCost.toFixed(2) : '0.00' }}</dd>
        </div>
      </dl>

      <button
        type="button"
        class="plan-toggle"
        :aria-expanded="planOpen"
        @click="planOpen = !planOpen"
      >
        <Icon name="ph:target-bold" size="12" aria-hidden="true" />
        <span>Plan SL / TP</span>
        <UiBadge v-if="stopLossPct !== null || takeProfitPct !== null" variant="accent">
          {{ stopLossPct !== null ? `-${stopLossPct}%` : '—' }}
          <span class="sep" aria-hidden="true">/</span>
          {{ takeProfitPct !== null ? `+${takeProfitPct}%` : '—' }}
        </UiBadge>
        <Icon :name="planOpen ? 'ph:caret-up-bold' : 'ph:caret-down-bold'" size="11" class="caret" />
      </button>

      <section v-if="planOpen" class="plan">
        <div class="plan-fields">
          <label class="plan-field">
            <span>Stop-loss (%)</span>
            <input v-model.number="stopLossPct" type="number" min="0.1" step="0.1" placeholder="ex. 3" />
            <small v-if="stopLossPrice !== null">${{ fmtPrice(stopLossPrice) }}</small>
          </label>
          <label class="plan-field">
            <span>Take-profit (%)</span>
            <input v-model.number="takeProfitPct" type="number" min="0.1" step="0.1" placeholder="ex. 6" />
            <small v-if="takeProfitPrice !== null">${{ fmtPrice(takeProfitPrice) }}</small>
          </label>
        </div>

        <dl class="plan-preview" v-if="parsedAmount > 0 || riskReward !== null">
          <div v-if="riskAmount !== null">
            <dt>Risque max</dt>
            <dd class="risk">-${{ riskAmount.toFixed(2) }}</dd>
          </div>
          <div v-if="rewardAmount !== null">
            <dt>Reward cible</dt>
            <dd class="reward">+${{ rewardAmount.toFixed(2) }}</dd>
          </div>
          <div v-if="riskReward !== null">
            <dt>R:R</dt>
            <dd :data-good="riskReward >= 1.5">
              1 : {{ riskReward.toFixed(2) }}
            </dd>
          </div>
        </dl>

        <div class="plan-actions">
          <UiButton variant="secondary" size="sm" @click="clearPlan">
            Effacer
          </UiButton>
          <UiButton variant="primary" size="sm" @click="savePlan">
            <Icon name="ph:check-bold" size="12" />
            Sauvegarder le plan
          </UiButton>
        </div>
        <p class="plan-hint">
          Simulation uniquement. Les ordres SL/TP automatiques ne sont pas encore exécutés côté serveur.
        </p>
      </section>

      <button
        type="submit"
        class="submit"
        :class="{ buy: side === 'buy', sell: side === 'sell' }"
        :disabled="!canSubmit"
      >
        <Icon v-if="placing" name="ph:circle-notch-bold" class="spin" />
        <span>{{ placing ? 'Envoi…' : submitLabel }}</span>
      </button>

      <p v-if="feedback" class="feedback" :data-type="feedback.type" role="status">
        {{ feedback.text }}
      </p>
    </form>
  </section>
</template>

<style lang="scss" scoped>
.ticket {
  background: $color-surface;
  border: 1px solid $color-border;
  border-radius: $radius-lg;
  padding: $space-md;
  display: flex;
  flex-direction: column;
  gap: $space-md;
  min-width: 0;
}

.ticket-head {
  display: flex;
  flex-direction: column;
  gap: $space-sm;

  h3 {
    font-size: $fs-md;
    font-weight: $fw-semibold;
    margin: 0;
  }
}

.side-tabs {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: $space-2xs;
  background: $color-bg;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  padding: $space-2xs;

  .tab {
    appearance: none;
    border: none;
    cursor: pointer;
    background: transparent;
    color: $color-text-muted;
    font-size: $fs-sm;
    font-weight: $fw-semibold;
    padding: $space-sm $space-md;
    border-radius: $radius-sm;
    transition:
      background $duration-base $ease-emphasized,
      color $duration-fast $ease-standard,
      transform $duration-instant $ease-standard;
    min-width: 0;

    &:hover { color: $color-text; }
    &:active { transform: scale(0.97); }
    &:focus-visible { @include ring-inset; }

    &.active.buy {
      background: $color-accent-soft;
      color: $color-accent;
    }
    &.active.sell {
      background: $color-danger-soft;
      color: $color-danger;
    }
  }
}

.avail {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: $space-sm;
  margin: 0;

  > div {
    background: $color-bg;
    border: 1px solid $color-border;
    border-radius: $radius-sm;
    padding: $space-sm $space-md;
    min-width: 0;
  }

  dt {
    font-size: $fs-xs;
    color: $color-text-dim;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  dd {
    margin: $space-2xs 0 0;
    font-family: $font-mono;
    font-size: $fs-sm;
    color: $color-text;
    @include truncate;
  }
}

.form {
  display: flex;
  flex-direction: column;
  gap: $space-md;
}

.amount {
  display: flex;
  flex-direction: column;
  gap: $space-xs;

  .amount-label {
    font-size: $fs-xs;
    color: $color-text-muted;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .amount-input {
    display: flex;
    align-items: center;
    background: $color-bg;
    border: 1px solid $color-border;
    border-radius: $radius-md;
    padding: 0 $space-md;
    transition: border-color $transition-fast;

    &:focus-within {
      border-color: $color-accent;
    }

    .amount-prefix {
      font-family: $font-mono;
      color: $color-text-muted;
      font-size: $fs-md;
    }

    input {
      flex: 1;
      background: transparent;
      border: none;
      outline: none;
      color: $color-text;
      font-family: $font-mono;
      font-size: $fs-lg;
      padding: $space-sm $space-sm;
      min-width: 0;

      &::placeholder { color: $color-text-dim; }
      &:disabled { opacity: 0.5; cursor: not-allowed; }
    }
  }
}

.pct {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: $space-sm;

  button {
    appearance: none;
    border: 1px solid $color-border;
    background: $color-bg;
    color: $color-text-muted;
    border-radius: $radius-sm;
    padding: 6px 0;
    font-size: $fs-xs;
    font-weight: $fw-medium;
    cursor: pointer;
    transition: all $transition-fast;

    &:hover {
      color: $color-text;
      border-color: $color-border-hover;
      background: $color-surface-2;
    }
  }
}

.preview {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: $space-sm $space-md;
  background: $color-bg;
  border: 1px solid $color-border;
  border-radius: $radius-md;

  > div {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: $fs-sm;
  }

  dt { color: $color-text-muted; }
  dd {
    margin: 0;
    font-family: $font-mono;
    color: $color-text;
  }

  .total {
    border-top: 1px solid $color-border;
    padding-top: 6px;
    margin-top: 2px;

    dt { font-weight: $fw-medium; color: $color-text; }
    dd { font-weight: $fw-semibold; }
  }
}

.plan-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px $space-md;
  background: $color-bg;
  border: 1px dashed $color-border;
  border-radius: $radius-md;
  color: $color-text-muted;
  font-size: $fs-xs;
  font-weight: $fw-medium;
  cursor: pointer;
  transition: color $transition-fast, border-color $transition-fast;

  .sep { margin: 0 2px; opacity: 0.6; }
  .caret { margin-left: auto; }

  &:hover { color: $color-text; border-color: $color-border-hover; }
  &:focus-visible { @include ring-inset; }
}

.plan {
  @include stack($space-sm);
  padding: $space-sm $space-md;
  background: $color-bg;
  border: 1px solid $color-border;
  border-radius: $radius-md;
}

.plan-fields {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: $space-sm;
}

.plan-field {
  display: flex;
  flex-direction: column;
  gap: $space-2xs;
  min-width: 0;

  > span {
    font-size: $fs-3xs;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: $color-text-dim;
  }

  input {
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    padding: $space-xs $space-sm;
    background: $color-surface;
    border: 1px solid $color-border;
    border-radius: $radius-sm;
    color: $color-text;
    font-size: $fs-sm;
    font-family: $font-mono;

    &:focus-visible { border-color: $color-accent; @include ring-inset; }
  }

  small {
    font-family: $font-mono;
    font-size: $fs-3xs;
    color: $color-text-dim;
    @include truncate;
  }
}

.plan-preview {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
  gap: $space-xs;
  margin: 0;
  padding: $space-xs 0;

  > div {
    display: flex;
    flex-direction: column;
    gap: $space-2xs;
    min-width: 0;
  }

  dt { font-size: $fs-3xs; color: $color-text-dim; letter-spacing: 0.04em; text-transform: uppercase; }
  dd {
    margin: 0;
    font-family: $font-mono;
    font-size: $fs-sm;
    color: $color-text;
    @include truncate;
  }

  .risk   { color: $color-danger; }
  .reward { color: $color-accent; }
  dd[data-good='true']  { color: $color-accent; }
  dd[data-good='false'] { color: $color-warning; }
}

.plan-actions {
  display: flex;
  gap: $space-sm;
  justify-content: flex-end;
  flex-wrap: wrap;
}

.plan-hint {
  font-size: $fs-3xs;
  color: $color-text-dim;
  font-style: italic;
  margin: 0;
  text-align: center;
}

.submit {
  appearance: none;
  border: none;
  cursor: pointer;
  border-radius: $radius-md;
  padding: $space-md;
  font-size: $fs-sm;
  font-weight: $fw-semibold;
  color: white;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: $space-sm;
  transition: background $transition-fast, opacity $transition-fast;

  &.buy  { background: $color-accent; }
  &.buy:hover:not(:disabled)  { background: $color-accent-hover; }

  &.sell { background: $color-danger; }
  &.sell:hover:not(:disabled) { background: color-mix(in srgb, $color-danger 90%, white 10%); }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .spin {
    animation: spin 0.9s linear infinite;
  }
}

.feedback {
  margin: 0;
  padding: $space-sm $space-md;
  border-radius: $radius-sm;
  font-size: $fs-xs;
  font-family: $font-mono;
  line-height: $lh-normal;

  &[data-type="ok"] {
    background: $color-accent-soft;
    color: $color-accent;
  }
  &[data-type="err"] {
    background: $color-danger-soft;
    color: $color-danger;
  }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
