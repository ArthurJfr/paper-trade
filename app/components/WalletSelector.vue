<script setup lang="ts">
// Sélecteur de wallet placé dans la topbar (entre la recherche et les
// actions). Ouvre un popover listant les wallets non archivés, permet de
// switcher (avec rehydration du store portefeuille via setActive).
// Pattern inspiré du menu `market.vue` (Escape + focus-restore).

import type { WalletWithStats } from '~~/shared/types/wallet'

const wallets = useWalletsStore()
const portfolio = usePortfolioStore()
const { success, danger } = useToasts()

const open = ref(false)
const triggerRef = ref<HTMLButtonElement | null>(null)
const popoverRef = ref<HTMLDivElement | null>(null)

const active = computed(() => wallets.active)

// Equity live du wallet actif (calculé par usePortfolioStore avec les
// prix du market store). Pour les wallets non actifs, on utilise les
// stats serveur (approx. invested+cash).
const liveEquity = computed(() => portfolio.equity || active.value?.equity || 0)
const livePerfPct = computed(() => portfolio.performancePct || active.value?.perfPct || 0)
const liveTrend = computed(() => trendOf(livePerfPct.value))

const equityFlash = useFlashOnChange(liveEquity, { threshold: 0.01 })

function openPopover() {
  open.value = true
  nextTick(() => {
    // Focus le premier élément focusable dans le popover pour le clavier.
    const firstFocusable = popoverRef.value?.querySelector<HTMLElement>(
      'button:not(:disabled), [href]',
    )
    firstFocusable?.focus()
  })
}

function closePopover(restoreFocus = true) {
  if (!open.value) return
  open.value = false
  if (restoreFocus) nextTick(() => triggerRef.value?.focus())
}

function toggle() {
  if (open.value) closePopover()
  else openPopover()
}

async function selectWallet(w: WalletWithStats) {
  if (w.id === wallets.activeId) {
    closePopover()
    return
  }
  try {
    await wallets.setActive(w.id)
    success(`Wallet "${w.name}" activé`, { ttl: 2400 })
    closePopover()
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue'
    danger(`Impossible d'activer ce wallet : ${msg}`)
  }
}

// Live stats par wallet (pour l'affichage dans la liste)
function walletEquity(w: WalletWithStats): number {
  // Pour le wallet actif, on utilise le portfolio store (mark-to-market).
  if (w.id === wallets.activeId) return liveEquity.value
  return w.equity
}
function walletPerf(w: WalletWithStats): number {
  if (w.id === wallets.activeId) return livePerfPct.value
  return w.perfPct
}

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n)

function onClickOutside(e: MouseEvent) {
  if (!open.value) return
  const target = e.target as Node
  if (popoverRef.value?.contains(target) || triggerRef.value?.contains(target)) return
  closePopover(false)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape' || !open.value) return
  e.preventDefault()
  closePopover()
}

onMounted(() => {
  document.addEventListener('mousedown', onClickOutside)
  document.addEventListener('keydown', onKeydown)
  onBeforeUnmount(() => {
    document.removeEventListener('mousedown', onClickOutside)
    document.removeEventListener('keydown', onKeydown)
  })
})

// Quand l'id actif change, on referme proprement.
watch(() => wallets.activeId, () => closePopover(false))

// On affiche 8 wallets max dans le popover (scroll au-delà).
const listed = computed(() => wallets.list.slice(0, 8))
</script>

<template>
  <div class="wallet-selector">
    <button
      ref="triggerRef"
      type="button"
      class="trigger"
      :aria-haspopup="'menu'"
      :aria-expanded="open ? 'true' : 'false'"
      :aria-label="`Wallet actif : ${active?.name ?? 'aucun'}. Cliquer pour changer.`"
      @click="toggle"
    >
      <span
        class="dot"
        :style="{ background: active?.color ?? 'var(--color-accent)' }"
        aria-hidden="true"
      />
      <span class="meta">
        <strong class="name">{{ active?.name ?? 'Aucun wallet' }}</strong>
        <span class="sub">
          <span class="equity" :class="equityFlash">{{ fmtCurrency(liveEquity) }}</span>
          <span class="perf" :data-trend="liveTrend">{{ fmtPerf(livePerfPct) }}</span>
        </span>
      </span>
      <Icon name="ph:caret-down-bold" size="12" class="chev" aria-hidden="true" />
    </button>

    <Transition name="pt-popover">
    <div
      v-if="open"
      ref="popoverRef"
      class="popover"
      role="menu"
      aria-label="Sélectionner un wallet"
    >
      <header class="head">
        <p class="title">Wallets</p>
        <NuxtLink to="/wallets" class="manage" role="menuitem" @click="closePopover(false)">
          <Icon name="ph:gear-bold" size="12" aria-hidden="true" />
          <span>Gérer</span>
        </NuxtLink>
      </header>

      <ul class="list">
        <li v-for="w in listed" :key="w.id">
          <button
            type="button"
            class="wallet-option"
            role="menuitem"
            :class="{ active: w.id === wallets.activeId }"
            :aria-current="w.id === wallets.activeId ? 'true' : undefined"
            @click="selectWallet(w)"
          >
            <span
              class="dot"
              :style="{ background: w.color ?? 'var(--color-accent)' }"
              aria-hidden="true"
            />
            <span class="info">
              <span class="name">{{ w.name }}</span>
              <span class="sub">
                <span>{{ fmtCurrency(walletEquity(w)) }}</span>
                <span class="perf" :data-trend="trendOf(walletPerf(w))">{{ fmtPerf(walletPerf(w)) }}</span>
              </span>
            </span>
            <Icon
              v-if="w.id === wallets.activeId"
              name="ph:check-bold"
              size="14"
              class="check"
              aria-hidden="true"
            />
          </button>
        </li>

        <li v-if="listed.length === 0" class="empty">
          <p>Aucun wallet actif.</p>
          <NuxtLink to="/wallets" class="create-link" @click="closePopover(false)">
            Créer mon premier wallet
          </NuxtLink>
        </li>
      </ul>

      <footer class="foot">
        <NuxtLink to="/wallets" class="manage-full" role="menuitem" @click="closePopover(false)">
          <Icon name="ph:squares-four-bold" size="13" aria-hidden="true" />
          <span>Gérer les wallets</span>
        </NuxtLink>
      </footer>
    </div>
    </Transition>
  </div>
</template>

<style lang="scss" scoped>
.wallet-selector {
  position: relative;
  min-width: 0;
}

.trigger {
  display: inline-flex;
  align-items: center;
  gap: $space-sm;
  padding: 0 $space-sm;
  height: var(--control-h-md);
  background: $color-surface-2;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  color: $color-text;
  cursor: pointer;
  transition: border-color $transition-fast, background $transition-fast;
  min-width: 0;
  max-width: 260px;

  &:hover { border-color: $color-border-hover; }
  &:focus-visible {
    @include ring-outset;
    border-color: $color-accent;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--surface-panel) 60%, transparent 40%);
  }

  .meta {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: $space-2xs;
    min-width: 0;
  }

  .name {
    @include truncate;
    font-size: $fs-sm;
    font-weight: $fw-semibold;
    max-width: 140px;
  }

  .sub {
    display: inline-flex;
    gap: $space-xs;
    font-size: $fs-3xs;
    font-family: $font-mono;
    color: $color-text-muted;
  }

  .equity {
    padding: 0 2px;
    border-radius: $radius-xs;
    transition: color $duration-fast $ease-standard;

    &.flash-up   { @include anim-flash-up; color: $color-accent; }
    &.flash-down { @include anim-flash-down; color: $color-danger; }
  }

  .perf {
    &[data-trend='up']   { color: $color-accent; }
    &[data-trend='down'] { color: $color-danger; }
    &[data-trend='flat'] { color: $color-text-dim; }
  }

  .chev {
    color: $color-text-dim;
    flex-shrink: 0;
    transition: transform $duration-fast $ease-standard;
  }

  &[aria-expanded='true'] .chev { transform: rotate(180deg); }
}

.popover {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: $z-dropdown;
  min-width: 280px;
  max-width: calc(100vw - #{$space-md * 2});
  background: var(--surface-raised);
  border: 1px solid $color-border;
  border-radius: $radius-md;
  box-shadow: $shadow-lg;
  overflow: hidden;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $space-sm $space-md;
  border-bottom: 1px solid $color-border;

  .title {
    font-size: $fs-2xs;
    font-weight: $fw-semibold;
    color: $color-text-dim;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: 0;
  }
  .manage {
    display: inline-flex;
    align-items: center;
    gap: $space-xs;
    font-size: $fs-xs;
    color: $color-text-muted;
    padding: $space-2xs $space-xs;
    border-radius: $radius-sm;

    &:hover { background: $color-surface-2; color: $color-text; }
    &:focus-visible {
      @include ring-inset;
      outline: none;
    }
  }
}

.list {
  list-style: none;
  margin: 0;
  padding: $space-xs 0;
  max-height: 320px;
  overflow-y: auto;
}

.wallet-option {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: $space-sm;
  width: 100%;
  padding: $space-xs $space-md;
  background: transparent;
  border: 0;
  color: $color-text;
  cursor: pointer;
  text-align: left;

  &:hover { background: $color-surface-2; }
  &:focus-visible {
    @include ring-inset;
    outline: none;
  }
  &.active {
    background: color-mix(in srgb, $color-accent-soft 60%, transparent 40%);
    .check { color: $color-accent; }
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .info {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .name {
    @include truncate;
    font-size: $fs-sm;
    font-weight: $fw-medium;
  }
  .sub {
    display: inline-flex;
    gap: $space-xs;
    font-size: $fs-3xs;
    font-family: $font-mono;
    color: $color-text-muted;
  }
  .perf {
    &[data-trend='up']   { color: $color-accent; }
    &[data-trend='down'] { color: $color-danger; }
    &[data-trend='flat'] { color: $color-text-dim; }
  }

  .check { color: $color-accent; }
}

.empty {
  padding: $space-md;
  text-align: center;
  color: $color-text-muted;
  font-size: $fs-xs;

  p { margin: 0 0 $space-xs; }
  .create-link {
    display: inline-block;
    font-size: $fs-xs;
    color: $color-accent;
    font-weight: $fw-semibold;

    &:hover { text-decoration: underline; }
  }
}

.foot {
  border-top: 1px solid $color-border;
  padding: $space-xs $space-md;

  .manage-full {
    display: inline-flex;
    align-items: center;
    gap: $space-xs;
    font-size: $fs-xs;
    color: $color-text-muted;
    padding: $space-2xs $space-xs;
    border-radius: $radius-sm;

    &:hover { color: $color-text; }
    &:focus-visible {
      @include ring-inset;
      outline: none;
    }
  }
}
</style>
