import { defineStore } from 'pinia'
import type {
  CreateWalletRequest,
  UpdateWalletRequest,
  WalletWithStats,
} from '~~/shared/types/wallet'

/**
 * Store des wallets (portefeuilles simulés).
 * Source de vérité côté client pour la liste, l'id actif, et les
 * opérations CRUD. Les stats par wallet (equity, perf, …) viennent du
 * backend et sont rafraîchies à la demande.
 */
export const useWalletsStore = defineStore('wallets', () => {
  // ─── State ────────────────────────────────────────────────────────────
  const list       = ref<WalletWithStats[]>([])
  const archived   = ref<WalletWithStats[]>([])
  const activeId   = ref<number | null>(null)
  const loading    = ref<boolean>(false)
  const lastError  = ref<string | null>(null)

  // ─── Getters ──────────────────────────────────────────────────────────
  const active = computed<WalletWithStats | null>(
    () => list.value.find(w => w.id === activeId.value) ?? null,
  )

  const firstAvailableId = computed<number | null>(() => {
    if (list.value.length === 0) return null
    // Priorité à l'id 1 (legacy) s'il est encore actif, sinon le plus ancien.
    const legacy = list.value.find(w => w.id === 1 && !w.archivedAt)
    if (legacy) return legacy.id
    const oldest = [...list.value]
      .filter(w => !w.archivedAt)
      .sort((a, b) => a.id - b.id)[0]
    return oldest?.id ?? null
  })

  const activeCount = computed(() => list.value.length)

  // ─── Actions ──────────────────────────────────────────────────────────
  async function fetchAll(opts: { includeArchived?: boolean } = {}) {
    loading.value = true
    lastError.value = null
    try {
      list.value = await $fetch<WalletWithStats[]>('/api/wallets', {
        query: { archived: 'false' },
      })
      if (opts.includeArchived) {
        const all = await $fetch<WalletWithStats[]>('/api/wallets', {
          query: { archived: 'true' },
        })
        archived.value = all.filter(w => w.archivedAt !== null)
      }
    } catch (err: unknown) {
      lastError.value = extractErrorMessage(err)
    } finally {
      loading.value = false
    }
  }

  async function create(req: CreateWalletRequest): Promise<WalletWithStats> {
    const created = await $fetch<WalletWithStats>('/api/wallets', {
      method: 'POST',
      body: req,
    })
    list.value = [...list.value, created]
    return created
  }

  async function update(id: number, patch: UpdateWalletRequest): Promise<WalletWithStats> {
    const updated = await $fetch<WalletWithStats>(`/api/wallets/${id}`, {
      method: 'PATCH',
      body: patch,
    })
    const idx = list.value.findIndex(w => w.id === id)
    if (idx >= 0) list.value.splice(idx, 1, updated)
    const aIdx = archived.value.findIndex(w => w.id === id)
    if (aIdx >= 0) archived.value.splice(aIdx, 1, updated)
    return updated
  }

  async function archive(id: number): Promise<void> {
    await $fetch(`/api/wallets/${id}`, {
      method: 'DELETE',
      query: { hard: 'false' },
    })
    const idx = list.value.findIndex(w => w.id === id)
    if (idx >= 0) {
      const archivedWallet = { ...list.value[idx]!, archivedAt: Date.now() }
      list.value.splice(idx, 1)
      archived.value.unshift(archivedWallet)
    }
    if (activeId.value === id) {
      const fallback = firstAvailableId.value
      if (fallback) await setActive(fallback)
      else activeId.value = null
    }
  }

  async function hardDelete(id: number): Promise<void> {
    await $fetch(`/api/wallets/${id}`, {
      method: 'DELETE',
      query: { hard: 'true' },
    })
    list.value = list.value.filter(w => w.id !== id)
    archived.value = archived.value.filter(w => w.id !== id)
    if (activeId.value === id) {
      const fallback = firstAvailableId.value
      if (fallback) await setActive(fallback)
      else activeId.value = null
    }
  }

  async function restore(id: number): Promise<WalletWithStats> {
    const restored = await $fetch<WalletWithStats>(`/api/wallets/${id}/restore`, {
      method: 'POST',
    })
    archived.value = archived.value.filter(w => w.id !== id)
    list.value = [...list.value, restored]
    return restored
  }

  async function resetWallet(id: number): Promise<WalletWithStats> {
    const wallet = await $fetch<WalletWithStats>(`/api/wallets/${id}/reset`, {
      method: 'POST',
    })
    const idx = list.value.findIndex(w => w.id === id)
    if (idx >= 0) list.value.splice(idx, 1, wallet)
    if (activeId.value === id) {
      const portfolio = usePortfolioStore()
      await portfolio.rehydrate(id)
    }
    return wallet
  }

  async function duplicate(
    id: number,
    opts: { name?: string; initialBalance?: number } = {},
  ): Promise<WalletWithStats> {
    const wallet = await $fetch<WalletWithStats>(`/api/wallets/${id}/duplicate`, {
      method: 'POST',
      body: opts,
    })
    list.value = [...list.value, wallet]
    return wallet
  }

  /** Définit le wallet actif, persiste la préférence et ré-hydrate le store portefeuille. */
  async function setActive(id: number): Promise<void> {
    activeId.value = id
    const ui = useUiPreferencesStore()
    ui.setActiveWalletId(id)
    const portfolio = usePortfolioStore()
    await portfolio.rehydrate(id)
  }

  /** Met à jour localement les stats d'un wallet (à chaque ordre par ex.). */
  function updateLocalStats(id: number, patch: Partial<WalletWithStats>) {
    const idx = list.value.findIndex(w => w.id === id)
    if (idx >= 0) list.value.splice(idx, 1, { ...list.value[idx]!, ...patch })
  }

  function reset() {
    list.value = []
    archived.value = []
    activeId.value = null
    loading.value = false
    lastError.value = null
  }

  return {
    // state
    list,
    archived,
    activeId,
    loading,
    lastError,
    // getters
    active,
    firstAvailableId,
    activeCount,
    // actions
    fetchAll,
    create,
    update,
    archive,
    hardDelete,
    restore,
    resetWallet,
    duplicate,
    setActive,
    updateLocalStats,
    reset,
  }
})

function extractErrorMessage(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as { statusMessage?: string; data?: { statusMessage?: string; message?: string }; message?: string }
    return (
      e.data?.statusMessage
      ?? e.data?.message
      ?? e.statusMessage
      ?? e.message
      ?? 'Erreur inconnue'
    )
  }
  return String(err)
}
