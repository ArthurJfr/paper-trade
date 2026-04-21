<script setup lang="ts">
useHead({ title: 'Réglages · Paper-Trade' })

const cfg = useRuntimeConfig()
const marketStore = useMarketStore()

const simulationSettings = computed(() => [
  { label: 'Balance initiale', value: `${Number(cfg.public.initialBalanceUsdc).toLocaleString('fr-FR')} USDC` },
  { label: 'Frais simulés', value: `${Number(cfg.public.tradingFeeBps).toFixed(0)} bps` },
  { label: 'Version app', value: `v${cfg.public.appVersion}` },
])
</script>

<template>
  <section class="settings">
    <header class="head">
      <h1>Réglages</h1>
      <p>Vue simple des paramètres actifs et de la taxonomie chargée.</p>
    </header>

    <section class="block">
      <h2>Paramètres de simulation</h2>
      <ul class="rows">
        <li v-for="item in simulationSettings" :key="item.label">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
        </li>
      </ul>
    </section>

    <section class="block">
      <h2>Taxonomie active</h2>
      <ul class="cats">
        <li
          v-for="cat in marketStore.taxonomy.categories"
          :key="cat.key"
          class="cat"
        >
          <span class="dot" :style="{ background: cat.color }" />
          <span>{{ cat.label }}</span>
          <small>{{ cat.key }}</small>
        </li>
      </ul>
    </section>
  </section>
</template>

<style lang="scss" scoped>
.settings { @include stack($space-lg); }

.head {
  h1 { font-size: $fs-3xl; letter-spacing: -0.02em; }
  p { margin-top: $space-xs; color: $color-text-muted; font-size: $fs-sm; }
}

.block {
  @include card;
  @include stack($space-md);
  h2 { font-size: $fs-lg; }
}

.rows {
  @include stack($space-xs);
  li {
    @include flex-between;
    gap: $space-md;
    padding: $space-sm 0;
    border-bottom: 1px solid $color-border;
    &:last-child { border-bottom: 0; }
    span { color: $color-text-muted; }
    strong { @include mono-nums; }
  }
}

.cats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: $space-sm;
}

.cat {
  @include row($space-xs);
  background: $color-surface-2;
  border: 1px solid $color-border;
  border-radius: $radius-sm;
  padding: $space-sm;
  small {
    margin-left: auto;
    color: $color-text-dim;
    font-family: $font-mono;
    font-size: 11px;
  }
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: $radius-full;
}
</style>
