<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  subtitle?: string
  kicker?: string
}>(), {})
</script>

<template>
  <header class="page-header">
    <div class="identity">
      <p v-if="kicker" class="kicker">{{ kicker }}</p>
      <h1>{{ title }}</h1>
      <p v-if="subtitle || $slots.subtitle" class="subtitle">
        <slot name="subtitle">{{ subtitle }}</slot>
      </p>
    </div>
    <div v-if="$slots.meta" class="meta">
      <slot name="meta" />
    </div>
    <div v-if="$slots.actions" class="actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<style lang="scss" scoped>
.page-header {
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-areas:
    'identity actions'
    'meta     meta';
  align-items: flex-end;
  gap: $space-md;
  @include anim-slide-up($duration-base, $ease-decelerate);

  @include media-down($bp-md) {
    grid-template-columns: 1fr;
    grid-template-areas:
      'identity'
      'meta'
      'actions';
    align-items: flex-start;
  }

  .identity   { grid-area: identity; }
  .meta       { grid-area: meta; @include row($space-sm); flex-wrap: wrap; }
  .actions    { grid-area: actions; @include row($space-sm); flex-wrap: wrap; }

  .kicker {
    font-size: $fs-xs;
    font-family: $font-mono;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--text-tertiary);
    margin-bottom: $space-xs;
  }

  h1 {
    font-size: $fs-3xl;
    letter-spacing: -0.02em;
    line-height: 1.1;
  }

  .subtitle {
    color: var(--text-secondary);
    font-size: $fs-sm;
    margin-top: $space-xs;
  }
}
</style>
