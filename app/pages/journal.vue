<script setup lang="ts">
useHead({ title: 'Journal · Paper-Trade' })

const ui = useUiPreferencesStore()
const wallets = useWalletsStore()
const { store: marketStore } = await useMarket()
const route = useRoute()
const router = useRouter()

const editingId = ref<string | null>(null)
const draft = ref<{
  title: string
  note: string
  pair: string
  tags: string
}>({ title: '', note: '', pair: '', tags: '' })

const filterTag = ref<string | null>(null)
const filterPair = ref<string | null>(null)
const searchQuery = ref('')
// Scope des notes par wallet : 'active' (défaut) = wallet actif + notes
// historiques sans walletId ; 'all' = toutes les notes tous wallets confondus.
const walletScope = ref<'active' | 'all'>('active')

const entries = computed(() => {
  if (walletScope.value === 'all') return ui.state.journalEntries
  const active = wallets.activeId
  return ui.state.journalEntries.filter((e) => {
    if (e.walletId === undefined) return true
    return e.walletId === active
  })
})

const allTags = computed(() => {
  const s = new Set<string>()
  for (const e of entries.value) for (const t of e.tags) s.add(t)
  return Array.from(s).sort()
})
const allPairs = computed(() => {
  const s = new Set<string>()
  for (const e of entries.value) if (e.pair) s.add(e.pair)
  return Array.from(s).sort()
})

const filteredEntries = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return entries.value.filter((e) => {
    if (filterTag.value && !e.tags.includes(filterTag.value)) return false
    if (filterPair.value && e.pair !== filterPair.value) return false
    if (!q) return true
    return (
      e.title.toLowerCase().includes(q)
      || e.note.toLowerCase().includes(q)
      || (e.pair ?? '').toLowerCase().includes(q)
    )
  })
})

function startNew(prefillPair = '') {
  editingId.value = 'new'
  draft.value = {
    title: prefillPair
      ? `${prefillPair} · ${new Date().toLocaleDateString('fr-FR')}`
      : `Note du ${new Date().toLocaleDateString('fr-FR')}`,
    note: '',
    pair: prefillPair,
    tags: '',
  }
}

onMounted(() => {
  const qp = route.query.pair
  const newFlag = route.query.new
  if (newFlag && typeof qp === 'string' && qp) {
    startNew(qp.toUpperCase())
    router.replace({ query: { ...route.query, new: undefined, pair: undefined } })
  } else if (typeof qp === 'string' && qp) {
    filterPair.value = qp.toUpperCase()
  }
})

function startEdit(id: string) {
  const e = entries.value.find(x => x.id === id)
  if (!e) return
  editingId.value = id
  draft.value = {
    title: e.title,
    note: e.note,
    pair: e.pair ?? '',
    tags: e.tags.join(', '),
  }
}

function parseTags(raw: string): string[] {
  return raw
    .split(',')
    .map(t => t.trim())
    .filter(Boolean)
}

function save() {
  const payload = {
    title: draft.value.title.trim() || 'Sans titre',
    note: draft.value.note,
    pair: draft.value.pair.trim().toUpperCase() || undefined,
    tags: parseTags(draft.value.tags),
  }
  if (editingId.value === 'new') {
    ui.addJournal({
      ...payload,
      // Scope la note au wallet actif au moment de la création. Si aucun
      // wallet actif, la note reste non scopée (legacy-friendly).
      walletId: wallets.activeId ?? undefined,
    })
  }
  else if (editingId.value) ui.updateJournal(editingId.value, payload)
  cancel()
}

function cancel() {
  editingId.value = null
  draft.value = { title: '', note: '', pair: '', tags: '' }
}

function remove(id: string) {
  if (!confirm('Supprimer cette note ?')) return
  ui.removeJournal(id)
  if (editingId.value === id) cancel()
}

function fmtDate(ms: number) {
  return new Date(ms).toLocaleString('fr-FR', {
    day: '2-digit', month: 'short', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

function tickerFor(pair: string) {
  return marketStore.tickers[pair] ?? null
}
</script>

<template>
  <section class="journal">
    <PageHeader
      kicker="Revue"
      title="Journal de trade"
      subtitle="Capture rapidement tes idées, setups et retours de session."
    >
      <template #actions>
        <UiButton variant="primary" size="sm" @click="startNew">
          <Icon name="ph:plus-bold" size="14" aria-hidden="true" />
          Nouvelle note
        </UiButton>
      </template>
    </PageHeader>

    <section v-if="editingId" class="editor">
      <div class="editor-head">
        <h3>{{ editingId === 'new' ? 'Nouvelle note' : 'Édition' }}</h3>
        <button type="button" class="close" aria-label="Fermer l'éditeur" @click="cancel">
          <Icon name="ph:x-bold" size="14" />
        </button>
      </div>
      <form class="editor-form" @submit.prevent="save">
        <div class="form-row">
          <label>
            <span>Titre</span>
            <input v-model="draft.title" type="text" required />
          </label>
          <label>
            <span>Pair (optionnel)</span>
            <input v-model="draft.pair" type="text" placeholder="ex. BTCUSDT" list="journal-pairs" />
            <datalist id="journal-pairs">
              <option v-for="a in marketStore.taxonomy.assets" :key="a.pair" :value="a.pair">
                {{ a.symbol }} — {{ a.name }}
              </option>
            </datalist>
          </label>
        </div>
        <label>
          <span>Tags (virgules)</span>
          <input v-model="draft.tags" type="text" placeholder="ex. breakout, momentum, range" />
        </label>
        <label>
          <span>Note</span>
          <textarea v-model="draft.note" rows="5" placeholder="Contexte, raisonnement, screenshot mental..." />
        </label>
        <div class="editor-actions">
          <UiButton variant="secondary" size="sm" type="button" @click="cancel">Annuler</UiButton>
          <UiButton variant="primary" size="sm" type="submit">
            <Icon name="ph:check-bold" size="12" />
            {{ editingId === 'new' ? 'Ajouter' : 'Mettre à jour' }}
          </UiButton>
        </div>
      </form>
    </section>

    <div v-if="entries.length || walletScope === 'all'" class="filters">
      <UiInput
        v-model="searchQuery"
        placeholder="Rechercher..."
        leading-icon="ph:magnifying-glass-bold"
        size="sm"
        ariaLabel="Rechercher dans le journal"
      />
      <div class="scope-toggle" role="group" aria-label="Portée des notes">
        <UiChip
          :variant="walletScope === 'active' ? 'accent' : 'neutral'"
          :class="{ active: walletScope === 'active' }"
          @click="walletScope = 'active'"
        >
          <Icon name="ph:wallet-bold" size="12" aria-hidden="true" />
          {{ wallets.active?.name ?? 'Wallet actif' }}
        </UiChip>
        <UiChip
          :variant="walletScope === 'all' ? 'accent' : 'neutral'"
          :class="{ active: walletScope === 'all' }"
          @click="walletScope = 'all'"
        >
          <Icon name="ph:squares-four-bold" size="12" aria-hidden="true" />
          Tous les wallets
        </UiChip>
      </div>
      <div class="chips" v-if="allTags.length">
        <UiChip
          variant="neutral"
          :class="{ active: filterTag === null }"
          @click="filterTag = null"
        >Tous</UiChip>
        <UiChip
          v-for="t in allTags"
          :key="t"
          :variant="filterTag === t ? 'accent' : 'neutral'"
          @click="filterTag = filterTag === t ? null : t"
        >#{{ t }}</UiChip>
      </div>
      <select v-if="allPairs.length" v-model="filterPair" class="pair-filter" aria-label="Filtrer par pair">
        <option :value="null">Toutes les pairs</option>
        <option v-for="p in allPairs" :key="p" :value="p">{{ p }}</option>
      </select>
    </div>

    <UiEmptyState
      v-if="entries.length === 0"
      icon="ph:notebook-bold"
      title="Aucune entrée pour le moment"
      description="Commence avec « Nouvelle note » pour conserver tes observations."
    />

    <UiEmptyState
      v-else-if="filteredEntries.length === 0"
      icon="ph:magnifying-glass-bold"
      title="Aucun résultat"
      description="Ajuste la recherche ou les filtres pour retrouver tes notes."
    />

    <ul v-else class="list">
      <li v-for="entry in filteredEntries" :key="entry.id" class="entry">
        <div class="entry-head">
          <div class="entry-identity">
            <strong>{{ entry.title }}</strong>
            <span class="date">{{ fmtDate(entry.updatedAt) }}</span>
          </div>
          <div class="entry-meta">
            <NuxtLink
              v-if="entry.pair"
              :to="`/token/${entry.pair}`"
              class="pair-link"
            >
              <span class="pair-sym">{{ entry.pair }}</span>
              <span
                v-if="tickerFor(entry.pair)"
                class="pair-perf"
                :data-trend="trendOf(tickerFor(entry.pair)!.changePct)"
              >
                {{ fmtPerf(tickerFor(entry.pair)!.changePct) }}
              </span>
            </NuxtLink>
            <UiChip v-for="t in entry.tags" :key="t" variant="neutral" size="sm">#{{ t }}</UiChip>
          </div>
          <div class="entry-actions">
            <UiIconButton
              icon="ph:pencil-simple-bold"
              variant="ghost"
              size="sm"
              aria-label="Éditer la note"
              @click="startEdit(entry.id)"
            />
            <UiIconButton
              icon="ph:trash-bold"
              variant="ghost"
              size="sm"
              aria-label="Supprimer la note"
              @click="remove(entry.id)"
            />
          </div>
        </div>
        <p v-if="entry.note" class="entry-note">{{ entry.note }}</p>
      </li>
    </ul>
  </section>
</template>

<style lang="scss" scoped>
.journal { @include stack($space-xl); }

.editor {
  @include panel-padded;
  @include stack($space-md);
  border-color: $color-accent;
  border-left-width: 3px;
}

.editor-head {
  @include flex-between;
  h3 { font-size: $fs-md; font-weight: $fw-semibold; }

  .close {
    background: transparent;
    border: 0;
    color: $color-text-dim;
    padding: 4px;
    border-radius: $radius-sm;
    cursor: pointer;
    &:hover { color: $color-text; background: $color-surface-2; }
  }
}

.editor-form {
  @include stack($space-sm);

  label {
    @include stack($space-xs);
    font-size: $fs-xs;
    color: $color-text-muted;
    min-width: 0;

    > span {
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-size: $fs-3xs;
      color: $color-text-dim;
    }
  }

  input, textarea {
    width: 100%;
    min-width: 0;
    max-width: 100%;
    box-sizing: border-box;
    padding: $space-sm;
    background: $color-surface-2;
    border: 1px solid $color-border;
    border-radius: $radius-sm;
    color: $color-text;
    font-size: $fs-sm;
    font-family: inherit;
    resize: vertical;

    &:focus-visible { border-color: $color-accent; @include ring-inset; }
  }
}

.form-row {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: $space-sm;

  > label { min-width: 0; }

  @include media-down($bp-sm) {
    grid-template-columns: minmax(0, 1fr);
  }
}

.editor-actions {
  display: flex;
  gap: $space-sm;
  justify-content: flex-end;
  flex-wrap: wrap;
}

.filters {
  @include row($space-sm);
  flex-wrap: wrap;
  padding: $space-sm;
  background: $color-surface;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  min-width: 0;

  > :first-child { flex: 1 1 200px; min-width: 0; }
}

.chips {
  @include row($space-xs);
  flex-wrap: wrap;

  :deep(.ui-chip) {
    cursor: pointer;
    transition: background $transition-fast, color $transition-fast;

    &:focus-visible {
      @include ring-outset;
    }
  }
}

.scope-toggle {
  @include row($space-xs);
  flex-wrap: wrap;

  :deep(.ui-chip) {
    cursor: pointer;
    gap: 4px;
    transition: background $transition-fast, color $transition-fast;

    &:focus-visible {
      @include ring-outset;
    }
  }
}

.pair-filter {
  padding: $space-xs $space-sm;
  background: $color-surface-2;
  border: 1px solid $color-border;
  border-radius: $radius-sm;
  color: $color-text;
  font-size: $fs-xs;
  cursor: pointer;
  max-width: 180px;

  &:focus-visible { border-color: $color-accent; @include ring-inset; }
}

.list {
  @include stack($space-sm);
  @include stagger-children(16, 45ms);
}

.entry {
  @include panel-padded;
  @include stack($space-sm);
  @include anim-slide-up($duration-base, $ease-decelerate);
  transition:
    border-color $duration-fast $ease-standard,
    box-shadow $duration-fast $ease-standard;

  &:hover {
    border-color: $color-border-hover;
    box-shadow: $shadow-sm;
  }
}

.entry-head {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: $space-md;
  align-items: start;

  @include media-down($bp-sm) {
    grid-template-columns: 1fr;
  }
}

.entry-identity {
  @include stack(2px);
  min-width: 0;

  strong { font-size: $fs-md; font-weight: $fw-semibold; }
  .date {
    color: var(--text-tertiary);
    font-size: $fs-xs;
    font-family: $font-mono;
  }
}

.entry-meta {
  @include row($space-xs);
  flex-wrap: wrap;
}

.entry-actions {
  display: flex;
  gap: 4px;
}

.pair-link {
  @include row(4px);
  padding: 2px $space-sm;
  background: $color-surface-2;
  border: 1px solid $color-border;
  border-radius: $radius-sm;
  font-size: $fs-xs;
  color: $color-text;
  font-family: $font-mono;
  text-decoration: none;

  .pair-perf {
    @include mono-nums;
    font-size: $fs-3xs;
    &[data-trend='up']   { color: $color-accent; }
    &[data-trend='down'] { color: $color-danger; }
  }

  &:hover { border-color: $color-border-hover; color: $color-accent; }
}

.entry-note {
  color: $color-text-muted;
  white-space: pre-wrap;
  font-size: $fs-sm;
  line-height: $lh-loose;
}
</style>
