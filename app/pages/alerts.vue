<script setup lang="ts">
import type { CreatePriceAlertRequest, PriceAlert } from '~~/shared/types/portfolio'

useHead({ title: 'Alertes · Paper-Trade' })

const { data: list, status, refresh } = useAsyncData('price-alerts', () =>
  $fetch<PriceAlert[]>('/api/alerts'), { server: true },
)

const form = ref<CreatePriceAlertRequest>({
  pair:        'BTCUSDT',
  op:         'above',
  targetPrice: 100000,
  oneShot:     true,
  label:      '',
  webhookUrl:  '',
  cooldownMs: 60000,
})
const creating = ref(false)
const toasts = useToasts()

async function create() {
  creating.value = true
  try {
    const body: CreatePriceAlertRequest = {
      ...form.value,
      label:     form.value.label || undefined,
      webhookUrl: form.value.webhookUrl || undefined,
    }
    await $fetch<PriceAlert>('/api/alerts', { method: 'POST', body })
    toasts.success('Alerte créée')
    form.value = { ...form.value, targetPrice: form.value.targetPrice, label: '' }
    await refresh()
  } catch (e: unknown) {
    toasts.danger((e as { data?: { statusMessage?: string } }).data?.statusMessage
      ?? (e as Error).message, { title: 'Erreur' })
  } finally {
    creating.value = false
  }
}

async function toggle(a: PriceAlert) {
  try {
    await $fetch(`/api/alerts/${a.id}`, {
      method: 'PATCH',
      body:   { active: !a.active },
    })
    await refresh()
  } catch (e: unknown) {
    toasts.danger((e as Error).message, { title: 'Erreur' })
  }
}

async function remove(id: number) {
  if (!confirm('Supprimer cette alerte ?')) return
  try {
    await $fetch(`/api/alerts/${id}`, { method: 'DELETE' })
    await refresh()
  } catch (e: unknown) {
    toasts.danger((e as Error).message, { title: 'Erreur' })
  }
}
</script>

<template>
  <section class="alerts-page">
    <PageHeader
      kicker="Prix"
      title="Alertes"
      subtitle="Déclenchement en temps quasi réel (poll serveur) · webhook optionnel (Discord, n8n…)"
    />

    <UiCard class="form-card">
      <h2>Nouvelle alerte</h2>
      <form class="form" @submit.prevent="create">
        <div class="row">
          <label>Pair
            <input v-model="form.pair" class="input" type="text" required placeholder="BTCUSDT" />
          </label>
          <label>Opérateur
            <select v-model="form.op" class="input">
              <option value="above">Au-dessus (≥)</option>
              <option value="below">En dessous (≤)</option>
            </select>
          </label>
        </div>
        <div class="row">
          <label>Objectif (prix)
            <input v-model.number="form.targetPrice" class="input" type="number" min="0" step="0.0001" required />
          </label>
          <label class="chk">
            <input v-model="form.oneShot" type="checkbox" /> One-shot
          </label>
        </div>
        <label>Webhook (optionnel, POST JSON)
          <input v-model="form.webhookUrl" class="input" type="url" placeholder="https://…" />
        </label>
        <label>Libellé
          <input v-model="form.label" class="input" type="text" />
        </label>
        <UiButton type="submit" variant="primary" :disabled="creating">
          {{ creating ? 'Création…' : 'Créer' }}
        </UiButton>
      </form>
    </UiCard>

    <div v-if="status === 'pending'" class="dim">Chargement…</div>
    <ul v-else class="alerts">
      <li v-for="a in (list ?? [])" :key="a.id" :class="['al-row', { off: !a.active }]">
        <div>
          <strong>{{ a.pair }}</strong>
          <span class="op">{{ a.op === 'above' ? '≥' : '≤' }} ${{ a.targetPrice.toLocaleString('fr-FR', { maximumFractionDigits: 8 }) }}</span>
          <UiChip v-if="a.label" size="sm" variant="neutral">{{ a.label }}</UiChip>
          <span v-if="!a.webhookUrl" class="tag">Sans webhook</span>
        </div>
        <div class="actions">
          <UiButton size="sm" variant="ghost" @click="toggle(a)">{{ a.active ? 'Désactiver' : 'Activer' }}</UiButton>
          <UiButton size="sm" variant="ghost" @click="remove(a.id)">Supprimer</UiButton>
        </div>
      </li>
    </ul>
  </section>
</template>

<style lang="scss" scoped>
.alerts-page { @include stack($space-xl); max-width: 640px; }
h2 { font-size: $fs-sm; font-weight: $fw-semibold; margin: 0 0 $space-sm; }
.form { @include stack($space-sm); }
.row { display: flex; flex-wrap: wrap; gap: $space-md; align-items: end; }
label { @include stack($space-2xs); font-size: $fs-2xs; text-transform: uppercase; letter-spacing: 0.04em; color: $color-text-dim; }
.input { padding: $space-sm; background: $color-bg; border: 1px solid $color-border; border-radius: $radius-sm; color: $color-text; }
.chk { @include row($space-xs); text-transform: none; font-size: $fs-xs; }
.dim { color: $color-text-dim; }
.alerts { @include stack($space-xs); list-style: none; padding: 0; }
.al-row {
  @include flex-between;
  gap: $space-md;
  @include panel-padded;
  &.off { opacity: 0.55; }
  .op { @include mono-nums; font-size: $fs-xs; margin: 0 $space-sm; }
  .tag { font-size: $fs-3xs; color: $color-text-dim; }
  .actions { flex-shrink: 0; }
}
</style>
