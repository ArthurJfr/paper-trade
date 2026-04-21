<script setup lang="ts">
import { fetchTrades, usePortfolio } from '~/composables/usePortfolio'

useHead({ title: 'Portefeuille · Paper-Trade' })

const { store, refresh } = await usePortfolio()
const now = useNow(1000)

const { data: trades, pending: tradesPending, refresh: refreshTrades } = await useAsyncData(
  'portfolio-recent-trades',
  () => fetchTrades({ limit: 12 }),
  { server: true, default: () => [] },
)

const account = computed(() => store.account)
const hydratedAgeSec = computed(() =>
  store.hydratedAt ? Math.max(0, Math.round((now.value - store.hydratedAt) / 1000)) : null,
)

const stats = computed(() => ([
  {
    label: 'Cash',
    value: account.value ? `$${fmtPrice(account.value.cashBalance)}` : 'Données en attente',
  },
  {
    label: 'Equity totale',
    value: account.value ? `$${fmtPrice(store.equity)}` : 'Données en attente',
  },
  {
    label: 'PnL non réalisé',
    value: account.value ? `${fmtPerf(store.performancePct)} · $${fmtPrice(store.unrealizedPnl)}` : 'Données en attente',
  },
  {
    label: 'Positions ouvertes',
    value: `${store.positionCount}`,
  },
]))

const positionRows = computed(() => store.positionRows)

async function refreshAll() {
  await Promise.all([refresh(), refreshTrades()])
}
</script>

<template>
  <section class="portfolio">
    <header class="head">
      <div>
        <h1>Portefeuille</h1>
        <p class="sub">
          {{ hydratedAgeSec === null ? 'Snapshot en attente' : `Snapshot il y a ${hydratedAgeSec}s` }}
        </p>
      </div>
      <button class="refresh" @click="refreshAll">
        <Icon name="ph:arrows-clockwise-bold" size="14" />
        Rafraichir
      </button>
    </header>

    <div class="stats">
      <article v-for="s in stats" :key="s.label" class="stat">
        <span class="label">{{ s.label }}</span>
        <strong class="value">{{ s.value }}</strong>
      </article>
    </div>

    <section class="block">
      <div class="block-head">
        <h2>Positions</h2>
        <p class="sub">{{ positionRows.length }} position{{ positionRows.length > 1 ? 's' : '' }}</p>
      </div>
      <div v-if="positionRows.length" class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Actif</th>
              <th class="num">Quantité</th>
              <th class="num">Prix moyen</th>
              <th class="num">Dernier prix</th>
              <th class="num">Valeur</th>
              <th class="num">PnL</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in positionRows" :key="row.position.pair">
              <td>
                <NuxtLink :to="`/token/${row.position.pair}`" class="sym-link">
                  {{ row.asset?.symbol ?? row.position.pair }}
                </NuxtLink>
              </td>
              <td class="num">{{ row.position.quantity.toFixed(6) }}</td>
              <td class="num">${{ fmtPrice(row.position.avgCost) }}</td>
              <td class="num">${{ fmtPrice(row.lastPrice) }}</td>
              <td class="num">${{ fmtPrice(row.value) }}</td>
              <td class="num" :data-trend="trendOf(row.unrealizedPct)">{{ fmtPerf(row.unrealizedPct) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="empty">
        <Icon name="ph:wallet-bold" size="18" />
        <p>Aucune position ouverte.</p>
        <NuxtLink to="/market">Aller au marché</NuxtLink>
      </div>
    </section>

    <section class="block">
      <div class="block-head">
        <h2>Dernières opérations</h2>
        <p class="sub">12 dernières exécutions</p>
      </div>
      <div v-if="tradesPending" class="empty">
        <Icon name="ph:spinner-bold" size="18" class="spin" />
        <p>Chargement...</p>
      </div>
      <div v-else-if="trades && trades.length" class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Pair</th>
              <th>Side</th>
              <th class="num">Quantité</th>
              <th class="num">Prix</th>
              <th class="num">Fee</th>
              <th class="num">Realized</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in trades" :key="t.id">
              <td>{{ new Date(t.createdAt).toLocaleString('fr-FR') }}</td>
              <td>{{ t.pair }}</td>
              <td :data-trend="t.side === 'buy' ? 'up' : 'down'">{{ t.side }}</td>
              <td class="num">{{ t.quantity.toFixed(6) }}</td>
              <td class="num">${{ fmtPrice(t.price) }}</td>
              <td class="num">${{ fmtPrice(t.fee) }}</td>
              <td class="num">{{ t.realizedPnl === null ? '—' : `$${fmtPrice(t.realizedPnl)}` }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="empty">
        <Icon name="ph:clock-counter-clockwise-bold" size="18" />
        <p>Aucune opération pour le moment.</p>
        <NuxtLink to="/market">Passer un ordre</NuxtLink>
      </div>
    </section>
  </section>
</template>

<style lang="scss" scoped>
.portfolio { @include stack($space-lg); }
.head { @include flex-between; gap: $space-md; flex-wrap: wrap; }
.sub { color: $color-text-muted; font-size: $fs-sm; }
.refresh {
  @include row($space-xs);
  border: 1px solid $color-border;
  border-radius: $radius-sm;
  padding: $space-xs $space-md;
  background: $color-surface;
  color: $color-text;
}
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: $space-md; }
.stat { @include card; @include stack($space-xs); }
.label { font-size: $fs-xs; color: $color-text-muted; text-transform: uppercase; letter-spacing: 0.06em; }
.value { font-size: $fs-xl; @include mono-nums; }
.block { @include stack($space-md); }
.block-head { @include flex-between; gap: $space-md; flex-wrap: wrap; }
.table-wrap { @include card; padding: 0; overflow-x: auto; }
.table { width: 100%; border-collapse: collapse; font-size: $fs-sm; }
.table th, .table td { padding: $space-sm $space-md; border-bottom: 1px solid $color-border; }
.table th { color: $color-text-muted; text-align: left; font-size: $fs-xs; text-transform: uppercase; letter-spacing: 0.06em; }
.table tr:last-child td { border-bottom: 0; }
.num { text-align: right; @include mono-nums; }
.empty { @include card; @include stack($space-sm); align-items: center; color: $color-text-muted; }
.sym-link { color: $color-text; font-weight: $fw-semibold; }
[data-trend='up'] { color: $color-accent; }
[data-trend='down'] { color: $color-danger; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
