<script setup lang="ts">
// Page de gestion des wallets : vue grille + CTA nouveau wallet + toggle
// archivés + actions par carte (activer, éditer, archiver, supprimer).

import type {
  CreateWalletRequest,
  UpdateWalletRequest,
  WalletWithStats,
} from '~~/shared/types/wallet'

definePageMeta({
  title: 'Wallets',
})

useHead({
  title: 'Wallets · Paper-Trade',
})

const wallets = useWalletsStore()
const portfolio = usePortfolioStore()
const { success, danger, info } = useToasts()

const showArchived = ref(false)
const loading = ref(false)

// Dialogs
const formDialog = reactive({
  open: false,
  mode: 'create' as 'create' | 'edit',
  wallet: null as WalletWithStats | null,
  capitalLocked: false,
})
const confirmDialog = reactive({
  open: false,
  title: '',
  message: '',
  confirmLabel: 'Confirmer',
  confirmVariant: 'primary' as 'primary' | 'danger',
  loading: false,
  onConfirm: (() => {}) as () => Promise<void> | void,
})

// On charge les archivés à la demande (toggle)
async function refresh(includeArchived: boolean) {
  loading.value = true
  try {
    await wallets.fetchAll({ includeArchived })
  } finally {
    loading.value = false
  }
}

// Au mount, s'assure d'avoir aussi les archivés si le toggle est activé.
watch(showArchived, (v) => { refresh(v) }, { immediate: true })

const displayedList = computed<WalletWithStats[]>(() => {
  if (showArchived.value) return [...wallets.list, ...wallets.archived]
  return wallets.list
})

// ─── Formatters ─────────────────────────────────────────────────────────
const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n)

// ─── Actions : activer ───────────────────────────────────────────────────
async function onActivate(w: WalletWithStats) {
  if (w.archivedAt) {
    info('Restaurez d\'abord le wallet archivé pour l\'activer.')
    return
  }
  try {
    await wallets.setActive(w.id)
    success(`Wallet "${w.name}" activé`, { ttl: 2400 })
  } catch (err: unknown) {
    danger(`Impossible d'activer : ${(err as Error).message ?? 'erreur'}`)
  }
}

// ─── Actions : créer ─────────────────────────────────────────────────────
function openCreate() {
  formDialog.mode = 'create'
  formDialog.wallet = null
  formDialog.capitalLocked = false
  formDialog.open = true
}

// ─── Actions : éditer ────────────────────────────────────────────────────
function openEdit(w: WalletWithStats) {
  formDialog.mode = 'edit'
  formDialog.wallet = w
  // Verrouillage si au moins un trade existe (protège perfPct cohérente).
  formDialog.capitalLocked = w.tradeCount > 0
  formDialog.open = true
}

async function onSubmitForm(payload: CreateWalletRequest | UpdateWalletRequest) {
  if (formDialog.mode === 'create') {
    try {
      const created = await wallets.create(payload as CreateWalletRequest)
      success(`Wallet "${created.name}" créé`)
      formDialog.open = false
      // Nouveau wallet → on l'active automatiquement (UX).
      await wallets.setActive(created.id)
    } catch (err: unknown) {
      danger(`Création impossible : ${extractError(err)}`)
    }
  } else if (formDialog.wallet) {
    try {
      const updated = await wallets.update(formDialog.wallet.id, payload as UpdateWalletRequest)
      success(`Wallet "${updated.name}" mis à jour`)
      formDialog.open = false
    } catch (err: unknown) {
      danger(`Mise à jour impossible : ${extractError(err)}`)
    }
  }
}

// ─── Actions : archiver ──────────────────────────────────────────────────
function openArchive(w: WalletWithStats) {
  confirmDialog.title = `Archiver "${w.name}" ?`
  confirmDialog.message = `Le wallet sera masqué par défaut mais ses trades et positions sont conservés. Vous pourrez le restaurer à tout moment.`
  confirmDialog.confirmLabel = 'Archiver'
  confirmDialog.confirmVariant = 'primary'
  confirmDialog.onConfirm = async () => {
    try {
      confirmDialog.loading = true
      await wallets.archive(w.id)
      success(`Wallet "${w.name}" archivé`)
      confirmDialog.open = false
    } catch (err: unknown) {
      danger(`Archivage impossible : ${extractError(err)}`)
    } finally {
      confirmDialog.loading = false
    }
  }
  confirmDialog.open = true
}

// ─── Actions : supprimer définitivement ──────────────────────────────────
function openHardDelete(w: WalletWithStats) {
  confirmDialog.title = `Supprimer définitivement "${w.name}" ?`
  confirmDialog.message = `Tous les trades, positions et notes liés à ce wallet seront effacés. Cette action est irréversible.`
  confirmDialog.confirmLabel = 'Supprimer définitivement'
  confirmDialog.confirmVariant = 'danger'
  confirmDialog.onConfirm = async () => {
    try {
      confirmDialog.loading = true
      await wallets.hardDelete(w.id)
      success(`Wallet "${w.name}" supprimé`)
      confirmDialog.open = false
    } catch (err: unknown) {
      danger(`Suppression impossible : ${extractError(err)}`)
    } finally {
      confirmDialog.loading = false
    }
  }
  confirmDialog.open = true
}

// ─── Actions : restaurer ─────────────────────────────────────────────────
async function onRestore(w: WalletWithStats) {
  try {
    await wallets.restore(w.id)
    success(`Wallet "${w.name}" restauré`)
  } catch (err: unknown) {
    danger(`Restauration impossible : ${extractError(err)}`)
  }
}

// ─── Actions : reset ─────────────────────────────────────────────────────
function openReset(w: WalletWithStats) {
  confirmDialog.title = `Reset "${w.name}" ?`
  confirmDialog.message = `Toutes les positions (${w.positionCount}) et ${w.tradeCount} trade${w.tradeCount > 1 ? 's' : ''} seront effacés. Le cash sera remis à ${fmtCurrency(w.initialBalance)} (capital initial). Irréversible.`
  confirmDialog.confirmLabel = 'Reset le wallet'
  confirmDialog.confirmVariant = 'danger'
  confirmDialog.onConfirm = async () => {
    try {
      confirmDialog.loading = true
      await wallets.resetWallet(w.id)
      success(`Wallet "${w.name}" remis à zéro`)
      confirmDialog.open = false
    } catch (err: unknown) {
      danger(`Reset impossible : ${extractError(err)}`)
    } finally {
      confirmDialog.loading = false
    }
  }
  confirmDialog.open = true
}

// ─── Actions : dupliquer ────────────────────────────────────────────────
async function openDuplicate(w: WalletWithStats) {
  try {
    const copy = await wallets.duplicate(w.id)
    success(`Wallet "${copy.name}" créé`)
  } catch (err: unknown) {
    danger(`Duplication impossible : ${extractError(err)}`)
  }
}

function extractError(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as { statusMessage?: string; data?: { statusMessage?: string }; message?: string }
    return e.data?.statusMessage ?? e.statusMessage ?? e.message ?? 'Erreur inconnue'
  }
  return String(err)
}

// ─── Live stats pour les cartes ──────────────────────────────────────────
function cardEquity(w: WalletWithStats): number {
  if (w.id === wallets.activeId) return portfolio.equity || w.equity
  return w.equity
}
function cardPerf(w: WalletWithStats): number {
  if (w.id === wallets.activeId) return portfolio.performancePct || w.perfPct
  return w.perfPct
}

const activeCount = computed(() => wallets.list.length)
const archivedCount = computed(() => wallets.archived.length)
const maxReached = computed(() => activeCount.value >= 20)
</script>

<template>
  <div class="wallets-page">
    <PageHeader
      kicker="Multi-wallet"
      title="Mes wallets"
      subtitle="Créez, gérez et basculez entre plusieurs portefeuilles simulés."
    >
      <template #meta>
        <UiChip size="sm" variant="neutral">{{ activeCount }} actifs</UiChip>
        <UiChip v-if="archivedCount > 0" size="sm" variant="neutral">{{ archivedCount }} archivés</UiChip>
        <UiChip v-if="maxReached" size="sm" variant="warning">Limite atteinte (20)</UiChip>
      </template>
      <template #actions>
        <UiButton
          variant="ghost"
          size="sm"
          :aria-pressed="showArchived ? 'true' : 'false'"
          @click="showArchived = !showArchived"
        >
          <Icon :name="showArchived ? 'ph:eye-slash-bold' : 'ph:archive-bold'" size="14" aria-hidden="true" />
          <span>{{ showArchived ? 'Masquer archivés' : 'Afficher archivés' }}</span>
        </UiButton>
        <UiButton
          variant="primary"
          :disabled="maxReached"
          @click="openCreate"
        >
          <Icon name="ph:plus-bold" size="14" aria-hidden="true" />
          <span>Nouveau wallet</span>
        </UiButton>
      </template>
    </PageHeader>

    <ClientOnly>
      <template #fallback>
        <div class="grid">
          <UiSkeleton v-for="n in 3" :key="n" class="card-skel" />
        </div>
      </template>

      <div v-if="loading && displayedList.length === 0" class="grid">
        <UiSkeleton v-for="n in 3" :key="n" class="card-skel" />
      </div>

      <UiEmptyState
        v-else-if="displayedList.length === 0"
        icon="ph:wallet-bold"
        title="Aucun wallet pour l'instant"
        description="Créez votre premier wallet pour commencer à simuler des trades."
      >
        <template #actions>
          <UiButton variant="primary" @click="openCreate">
            <Icon name="ph:plus-bold" size="14" aria-hidden="true" />
            <span>Créer mon premier wallet</span>
          </UiButton>
        </template>
      </UiEmptyState>

      <TransitionGroup v-else appear tag="div" name="pt-cards" class="grid stagger">
        <UiCard
          v-for="w in displayedList"
          :key="w.id"
          class="wallet-card"
          :class="{
            archived: w.archivedAt,
            active: w.id === wallets.activeId,
          }"
        >
          <header class="card-head">
            <span class="icon-wrap" :style="{ background: (w.color ?? 'var(--color-accent)') + '1f' }">
              <Icon :name="w.icon ?? 'ph:wallet-bold'" size="18" :style="{ color: w.color ?? undefined }" />
            </span>
            <div class="identity">
              <h3 class="name">{{ w.name }}</h3>
              <p v-if="w.description" class="description">{{ w.description }}</p>
            </div>
            <UiChip v-if="w.id === wallets.activeId" size="xs" variant="success">Actif</UiChip>
            <UiChip v-else-if="w.archivedAt" size="xs" variant="neutral">Archivé</UiChip>
          </header>

          <dl class="metrics">
            <div>
              <dt>Equity</dt>
              <dd>{{ fmtCurrency(cardEquity(w)) }}</dd>
            </div>
            <div>
              <dt>Perf</dt>
              <dd class="perf" :data-trend="trendOf(cardPerf(w))">{{ fmtPerf(cardPerf(w)) }}</dd>
            </div>
            <div>
              <dt>Capital initial</dt>
              <dd>{{ fmtCurrency(w.initialBalance) }}</dd>
            </div>
            <div>
              <dt>Trades</dt>
              <dd>{{ w.tradeCount }} · {{ w.positionCount }} pos.</dd>
            </div>
          </dl>

          <footer class="actions">
            <template v-if="w.archivedAt">
              <UiButton size="sm" variant="primary" @click="onRestore(w)">
                <Icon name="ph:arrow-counter-clockwise-bold" size="12" aria-hidden="true" />
                <span>Restaurer</span>
              </UiButton>
              <UiButton size="sm" variant="danger" @click="openHardDelete(w)">
                <Icon name="ph:trash-bold" size="12" aria-hidden="true" />
                <span>Supprimer</span>
              </UiButton>
            </template>
            <template v-else>
              <UiButton
                size="sm"
                :variant="w.id === wallets.activeId ? 'ghost' : 'secondary'"
                :disabled="w.id === wallets.activeId"
                @click="onActivate(w)"
              >
                <Icon name="ph:check-bold" size="12" aria-hidden="true" />
                <span>{{ w.id === wallets.activeId ? 'Actif' : 'Activer' }}</span>
              </UiButton>
              <UiButton size="sm" variant="ghost" @click="openEdit(w)">
                <Icon name="ph:pencil-simple-bold" size="12" aria-hidden="true" />
                <span>Éditer</span>
              </UiButton>
              <UiButton size="sm" variant="ghost" :disabled="maxReached" @click="openDuplicate(w)">
                <Icon name="ph:copy-bold" size="12" aria-hidden="true" />
                <span>Dupliquer</span>
              </UiButton>
              <UiButton
                size="sm"
                variant="ghost"
                :disabled="w.tradeCount === 0 && w.positionCount === 0"
                @click="openReset(w)"
              >
                <Icon name="ph:arrow-counter-clockwise-bold" size="12" aria-hidden="true" />
                <span>Reset</span>
              </UiButton>
              <UiButton size="sm" variant="ghost" @click="openArchive(w)">
                <Icon name="ph:archive-bold" size="12" aria-hidden="true" />
                <span>Archiver</span>
              </UiButton>
            </template>
          </footer>
        </UiCard>
      </TransitionGroup>
    </ClientOnly>

    <WalletFormDialog
      :mode="formDialog.mode"
      :open="formDialog.open"
      :wallet="formDialog.wallet"
      :capital-locked="formDialog.capitalLocked"
      @submit="onSubmitForm"
      @cancel="formDialog.open = false"
    />

    <WalletConfirmDialog
      :open="confirmDialog.open"
      :title="confirmDialog.title"
      :message="confirmDialog.message"
      :confirm-label="confirmDialog.confirmLabel"
      :confirm-variant="confirmDialog.confirmVariant"
      :loading="confirmDialog.loading"
      @confirm="confirmDialog.onConfirm()"
      @cancel="confirmDialog.open = false"
    />
  </div>
</template>

<style lang="scss" scoped>
.wallets-page {
  display: flex;
  flex-direction: column;
  gap: $space-lg;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: $space-md;

  &.stagger {
    @include stagger-children(20, 55ms);
  }
}

.card-skel {
  height: 220px;
  border-radius: $radius-lg;
}

.wallet-card {
  display: flex;
  flex-direction: column;
  gap: $space-md;
  transition:
    border-color $duration-fast $ease-standard,
    transform $duration-fast $ease-standard,
    box-shadow $duration-fast $ease-standard;

  &:hover {
    transform: translate3d(0, -2px, 0);
    box-shadow: $shadow-md;
    border-color: $color-border-hover;
  }

  &.active {
    border-color: $color-accent;
    box-shadow: 0 0 0 1px $color-accent-soft, $shadow-sm;
  }

  &.archived {
    opacity: 0.6;
  }
}

.card-head {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: $space-sm;
  align-items: flex-start;

  .icon-wrap {
    width: 36px;
    height: 36px;
    border-radius: $radius-md;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .identity {
    min-width: 0;

    .name {
      @include truncate;
      margin: 0 0 $space-2xs;
      font-size: $fs-md;
      font-weight: $fw-semibold;
    }
    .description {
      margin: 0;
      font-size: $fs-xs;
      color: $color-text-muted;
      line-height: $lh-normal;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  }
}

.metrics {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: $space-sm;
  margin: 0;

  > div {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: $space-2xs;
  }

  dt {
    font-size: $fs-3xs;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: $color-text-dim;
    margin: 0;
  }
  dd {
    @include truncate;
    margin: 0;
    font-size: $fs-sm;
    font-weight: $fw-semibold;
    font-family: $font-mono;

    &.perf {
      &[data-trend='up']   { color: $color-accent; }
      &[data-trend='down'] { color: $color-danger; }
      &[data-trend='flat'] { color: $color-text-dim; }
    }
  }
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: $space-xs;
  padding-top: $space-sm;
  border-top: 1px solid $color-border;

  :deep(.ui-btn) {
    flex: 1 1 auto;
    justify-content: center;
    gap: $space-2xs;
  }
}
</style>
