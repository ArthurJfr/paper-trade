import type {
  CreateWalletRequest,
  UpdateWalletRequest,
  Wallet,
  WalletWithStats,
} from '~~/shared/types/wallet'
import type { PositionSummary } from '~~/shared/types/portfolio'

/** Snapshot complet renvoyé par GET /api/wallets/:id. */
export interface WalletSnapshot extends WalletWithStats {
  positions: PositionSummary[]
}

export type {
  Wallet,
  WalletWithStats,
  CreateWalletRequest,
  UpdateWalletRequest,
}

/**
 * Composable d'entrée pour l'hydration SSR du store wallets.
 * Peut être invoqué au boot du layout : il liste les wallets et définit
 * automatiquement un walletId actif cohérent avec `uiPreferences`.
 */
export async function useWallets() {
  const store = useWalletsStore()
  const ui = useUiPreferencesStore()

  // Pas de refetch côté client si on a déjà hydraté pendant le SSR.
  if (store.list.length === 0) {
    await store.fetchAll()
  }

  // Choisit le wallet actif : priorité à celui persisté, sinon fallback sur
  // le plus ancien non archivé, sinon null (cas vraiment dégradé).
  const persisted = ui.state.activeWalletId
  const candidate = persisted && store.list.find(w => w.id === persisted && !w.archivedAt)
    ? persisted
    : store.firstAvailableId

  if (candidate && store.activeId !== candidate) {
    await store.setActive(candidate)
  }

  return {
    store,
    activeWalletId: computed(() => store.activeId),
  }
}
