import { defineStore } from 'pinia'
import type { KlineInterval } from '~~/shared/types/market'

export type ThemeMode = 'dark' | 'light' | 'system'
export type Density = 'comfortable' | 'compact'
export type ChartEngine = 'svg' | 'advanced'
export type ChartType = 'candles' | 'line' | 'area'

export type MarketColumnKey =
  | 'symbol'
  | 'category'
  | 'price'
  | 'perf'
  | 'volume'
  | 'highLow'
  | 'sparkline'

export interface MarketView {
  id: string
  label: string
  category: string // 'all' ou CategoryKey
  query: string
  sort: 'symbol' | 'category' | 'price' | 'perf' | 'volume'
  dir: 'asc' | 'desc'
  columns: MarketColumnKey[]
  createdAt: number
}

interface ChartPrefs {
  engine: ChartEngine
  type: ChartType
  interval: KlineInterval
  overlays: {
    ma20: boolean
    ma50: boolean
    ema21: boolean
    vwap: boolean
  }
  showVolume: boolean
  compareBench: boolean
}

interface UiPreferencesState {
  theme: ThemeMode
  density: Density
  sidebarCollapsed: boolean
  watchlist: string[]
  marketColumns: MarketColumnKey[]
  marketViews: MarketView[]
  chart: ChartPrefs
  journalEntries: JournalEntry[]
  tradePlans: Record<string, TradePlan>
  showVitalsOverlay: boolean
  reducedMotion: boolean
  // Multi-wallet : id du wallet actif (persisté pour survivre aux reloads).
  // Peut être null juste avant l'hydratation côté client ; dans ce cas le
  // layout choisit un fallback via `useWalletsStore().ensureActive()`.
  activeWalletId: number | null
}

export interface JournalEntry {
  id: string
  title: string
  note: string
  pair?: string
  tags: string[]
  createdAt: number
  updatedAt: number
  // Scope optionnel : si fourni, la note n'apparaît que dans ce wallet.
  // Les notes historiques (walletId absent) restent visibles partout.
  walletId?: number
}

export interface TradePlan {
  pair: string
  stopLossPct: number | null
  takeProfitPct: number | null
  entryPrice: number
  updatedAt: number
}

const STORAGE_KEY = 'paper-trade:ui-preferences'
// Bump à 2 lors de l'ajout de `activeWalletId` (les anciens blobs restent
// chargeables via le merge `...DEFAULT_STATE` → le reset à v1 provoquait
// la perte du journal existant sur les anciens users).
const STORAGE_VERSION = 2

const DEFAULT_MARKET_COLS: MarketColumnKey[] = ['symbol', 'category', 'price', 'perf', 'volume']

const DEFAULT_STATE: UiPreferencesState = {
  theme: 'dark',
  density: 'comfortable',
  sidebarCollapsed: false,
  watchlist: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'],
  marketColumns: DEFAULT_MARKET_COLS,
  marketViews: [],
  chart: {
    engine: 'svg',
    type: 'candles',
    interval: '1h',
    overlays: { ma20: false, ma50: false, ema21: false, vwap: false },
    showVolume: true,
    compareBench: false,
  },
  journalEntries: [],
  tradePlans: {},
  showVitalsOverlay: false,
  reducedMotion: false,
  activeWalletId: null,
}

function loadFromStorage(): UiPreferencesState {
  if (!import.meta.client) return { ...DEFAULT_STATE }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_STATE }
    const parsed = JSON.parse(raw) as { v: number; state: Partial<UiPreferencesState> }
    // Pour les anciennes versions (<STORAGE_VERSION), on tente un merge
    // best-effort plutôt qu'un reset complet pour ne pas perdre le journal,
    // la watchlist ou les plans de trade sauvegardés par l'utilisateur.
    const incoming = parsed?.state ?? {}
    return {
      ...DEFAULT_STATE,
      ...incoming,
      chart: { ...DEFAULT_STATE.chart, ...(incoming.chart ?? {}) },
      marketColumns: incoming.marketColumns?.length ? incoming.marketColumns : DEFAULT_MARKET_COLS,
      tradePlans: incoming.tradePlans ?? {},
      journalEntries: Array.isArray(incoming.journalEntries) ? incoming.journalEntries : [],
      activeWalletId: typeof incoming.activeWalletId === 'number' ? incoming.activeWalletId : null,
    }
  } catch {
    return { ...DEFAULT_STATE }
  }
}

export const useUiPreferencesStore = defineStore('ui-preferences', () => {
  const state = ref<UiPreferencesState>({ ...DEFAULT_STATE })

  function hydrate() {
    state.value = loadFromStorage()
  }

  function persist() {
    if (!import.meta.client) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: STORAGE_VERSION, state: state.value }))
    } catch {
      // storage can be full / disabled in private mode
    }
  }

  // ─── Theme ─────────────────────────────────────────────────────────────
  function setTheme(theme: ThemeMode) {
    state.value.theme = theme
    persist()
    applyTheme(theme)
  }
  function toggleTheme() {
    const resolved = resolvedTheme.value === 'dark' ? 'light' : 'dark'
    setTheme(resolved)
  }
  const resolvedTheme = computed<'dark' | 'light'>(() => {
    if (state.value.theme !== 'system') return state.value.theme
    if (!import.meta.client) return 'dark'
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  })

  function applyTheme(theme: ThemeMode) {
    if (!import.meta.client) return
    const effective = theme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
      : theme
    document.documentElement.setAttribute('data-theme', effective)
  }

  function applyDensity(density: Density) {
    if (!import.meta.client) return
    document.documentElement.setAttribute('data-density', density)
  }

  function applyReducedMotion(forced: boolean) {
    if (!import.meta.client) return
    if (forced) document.documentElement.setAttribute('data-motion', 'reduced')
    else document.documentElement.removeAttribute('data-motion')
  }

  function setReducedMotion(v: boolean) {
    state.value.reducedMotion = v
    persist()
    applyReducedMotion(v)
  }

  function toggleVitalsOverlay() {
    state.value.showVitalsOverlay = !state.value.showVitalsOverlay
    persist()
  }

  // ─── Density ───────────────────────────────────────────────────────────
  function setDensity(d: Density) {
    state.value.density = d
    persist()
    applyDensity(d)
  }
  function toggleDensity() {
    setDensity(state.value.density === 'compact' ? 'comfortable' : 'compact')
  }

  // ─── Sidebar ───────────────────────────────────────────────────────────
  function toggleSidebar() {
    state.value.sidebarCollapsed = !state.value.sidebarCollapsed
    persist()
  }

  // ─── Watchlist ─────────────────────────────────────────────────────────
  function isWatched(pair: string) {
    return state.value.watchlist.includes(pair)
  }
  function toggleWatch(pair: string) {
    const idx = state.value.watchlist.indexOf(pair)
    if (idx >= 0) state.value.watchlist.splice(idx, 1)
    else state.value.watchlist.unshift(pair)
    // Dédoublonnage + cap 50
    state.value.watchlist = Array.from(new Set(state.value.watchlist)).slice(0, 50)
    persist()
  }

  // ─── Market columns ────────────────────────────────────────────────────
  function setMarketColumns(cols: MarketColumnKey[]) {
    state.value.marketColumns = cols.length ? cols : DEFAULT_MARKET_COLS
    persist()
  }

  // ─── Market views ──────────────────────────────────────────────────────
  function saveMarketView(v: Omit<MarketView, 'id' | 'createdAt'> & Partial<Pick<MarketView, 'id' | 'createdAt'>>): MarketView {
    const id = v.id
      ?? (typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `view-${Date.now()}`)
    const full: MarketView = {
      id,
      label: v.label,
      category: v.category,
      query: v.query,
      sort: v.sort,
      dir: v.dir,
      columns: v.columns,
      createdAt: v.createdAt ?? Date.now(),
    }
    const existing = state.value.marketViews.findIndex(x => x.id === id)
    if (existing >= 0) state.value.marketViews.splice(existing, 1, full)
    else state.value.marketViews.push(full)
    persist()
    return full
  }
  function deleteMarketView(id: string) {
    state.value.marketViews = state.value.marketViews.filter(x => x.id !== id)
    persist()
  }

  // ─── Chart prefs ──────────────────────────────────────────────────────
  function setChart(patch: Partial<ChartPrefs>) {
    state.value.chart = {
      ...state.value.chart,
      ...patch,
      overlays: { ...state.value.chart.overlays, ...(patch.overlays ?? {}) },
    }
    persist()
  }
  function toggleOverlay(key: keyof ChartPrefs['overlays']) {
    state.value.chart.overlays[key] = !state.value.chart.overlays[key]
    persist()
  }

  // ─── Trade plans (SL/TP) ───────────────────────────────────────────────
  function setTradePlan(pair: string, plan: Omit<TradePlan, 'pair' | 'updatedAt'>) {
    state.value.tradePlans[pair] = {
      pair,
      stopLossPct: plan.stopLossPct,
      takeProfitPct: plan.takeProfitPct,
      entryPrice: plan.entryPrice,
      updatedAt: Date.now(),
    }
    persist()
  }
  function removeTradePlan(pair: string) {
    delete state.value.tradePlans[pair]
    persist()
  }
  function getTradePlan(pair: string): TradePlan | null {
    return state.value.tradePlans[pair] ?? null
  }

  // ─── Journal ──────────────────────────────────────────────────────────
  function addJournal(entry: Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt'>): JournalEntry {
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `j-${Date.now()}`
    const now = Date.now()
    const full: JournalEntry = { id, createdAt: now, updatedAt: now, ...entry }
    state.value.journalEntries.unshift(full)
    persist()
    return full
  }
  function updateJournal(id: string, patch: Partial<Omit<JournalEntry, 'id' | 'createdAt'>>) {
    const idx = state.value.journalEntries.findIndex(e => e.id === id)
    if (idx < 0) return
    const prev = state.value.journalEntries[idx]!
    state.value.journalEntries.splice(idx, 1, {
      ...prev,
      ...patch,
      tags: patch.tags ?? prev.tags,
      updatedAt: Date.now(),
    })
    persist()
  }
  function removeJournal(id: string) {
    state.value.journalEntries = state.value.journalEntries.filter(e => e.id !== id)
    persist()
  }

  // ─── Active wallet (persisté) ─────────────────────────────────────────
  function setActiveWalletId(id: number | null) {
    state.value.activeWalletId = id
    persist()
  }

  return {
    // state
    state,
    resolvedTheme,
    // actions
    hydrate,
    applyTheme,
    applyDensity,
    applyReducedMotion,
    setTheme,
    toggleTheme,
    setDensity,
    toggleDensity,
    setReducedMotion,
    toggleVitalsOverlay,
    toggleSidebar,
    isWatched,
    toggleWatch,
    setMarketColumns,
    saveMarketView,
    deleteMarketView,
    setChart,
    toggleOverlay,
    setTradePlan,
    removeTradePlan,
    getTradePlan,
    addJournal,
    updateJournal,
    removeJournal,
    setActiveWalletId,
  }
})
