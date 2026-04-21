<script setup lang="ts">
useHead({ title: 'Journal · Paper-Trade' })

interface JournalEntry {
  id: string
  title: string
  note: string
  createdAt: string
}

const entries = ref<JournalEntry[]>([])

function addEntry() {
  const now = new Date()
  entries.value.unshift({
    id: crypto.randomUUID(),
    title: `Note du ${now.toLocaleDateString('fr-FR')}`,
    note: 'Setup, contexte et retour d’expérience...',
    createdAt: now.toISOString(),
  })
}
</script>

<template>
  <section class="journal">
    <header class="head">
      <div>
        <h1>Journal de trade</h1>
        <p class="sub">Capture rapidement tes idées et retours de session.</p>
      </div>
      <button class="new-btn" @click="addEntry">
        <Icon name="ph:plus-bold" size="14" />
        Nouvelle note
      </button>
    </header>

    <section v-if="entries.length === 0" class="empty">
      <Icon name="ph:notebook-bold" size="20" />
      <p>Aucune entrée pour le moment.</p>
      <span>Commence avec “Nouvelle note” pour conserver tes observations.</span>
    </section>

    <ul v-else class="list">
      <li v-for="entry in entries" :key="entry.id" class="entry">
        <div class="entry-head">
          <strong>{{ entry.title }}</strong>
          <span>{{ new Date(entry.createdAt).toLocaleString('fr-FR') }}</span>
        </div>
        <p>{{ entry.note }}</p>
      </li>
    </ul>
  </section>
</template>

<style lang="scss" scoped>
.journal { @include stack($space-lg); }

.head {
  @include flex-between;
  gap: $space-md;
  flex-wrap: wrap;
  h1 { font-size: $fs-3xl; letter-spacing: -0.02em; }
  .sub { color: $color-text-muted; font-size: $fs-sm; margin-top: $space-xs; }
}

.new-btn {
  @include row($space-xs);
  padding: $space-xs $space-md;
  border-radius: $radius-sm;
  border: 1px solid $color-border;
  background: $color-surface;
  color: $color-text;
  cursor: pointer;
  &:hover { border-color: $color-border-hover; }
}

.empty {
  @include card;
  @include flex-center;
  @include stack($space-sm);
  min-height: 220px;
  text-align: center;
  color: $color-text-muted;
  span { font-size: $fs-xs; color: $color-text-dim; }
}

.list {
  @include stack($space-sm);
}

.entry {
  @include card;
  @include stack($space-sm);
}

.entry-head {
  @include flex-between;
  gap: $space-md;
  flex-wrap: wrap;
  span { color: $color-text-dim; font-size: $fs-xs; font-family: $font-mono; }
}
</style>
