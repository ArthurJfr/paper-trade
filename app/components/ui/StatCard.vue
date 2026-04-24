<script setup lang="ts">
import type { Trend } from '~/utils/format'

const props = withDefaults(defineProps<{
  label: string
  value: string
  hint?: string
  trend?: Trend | null
  loading?: boolean
}>(), {
  hint: undefined,
  trend: null,
  loading: false,
})

// Flash bref sur changement de valeur (prix / equity / etc).
const ui = useUiPreferencesStore()
const flash = ref<'up' | 'down' | null>(null)
let t: ReturnType<typeof setTimeout> | null = null

watch(() => props.value, (next, prev) => {
  if (!import.meta.client || ui.state.reducedMotion) return
  if (!prev || next === prev) return
  flash.value = props.trend === 'down' ? 'down' : 'up'
  if (t) clearTimeout(t)
  t = setTimeout(() => { flash.value = null }, 600)
})
onBeforeUnmount(() => { if (t) clearTimeout(t) })
</script>

<template>
  <article class="ui-stat" :class="{ loading }">
    <span class="label">{{ label }}</span>
    <strong
      class="value"
      :data-trend="trend || undefined"
      :data-flash="flash || undefined"
    >
      <template v-if="loading">
        <span class="skeleton" aria-hidden="true" />
        <span class="sr">Chargement</span>
      </template>
      <template v-else>{{ value }}</template>
    </strong>
    <span v-if="hint || $slots.hint" class="hint" :data-trend="trend || undefined">
      <slot name="hint">{{ hint }}</slot>
    </span>
  </article>
</template>

<style lang="scss" scoped>
.ui-stat {
  @include stack($space-xs);
  @include panel-padded;
  transition:
    border-color $duration-fast $ease-standard,
    transform $duration-fast $ease-standard,
    box-shadow $duration-fast $ease-standard;

  &:hover {
    border-color: $color-border-hover;
    transform: translate3d(0, -1px, 0);
    box-shadow: $shadow-sm;
  }

  .label {
    font-size: $fs-xs;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .value {
    font-size: $fs-2xl;
    @include mono-nums;
    color: var(--text-primary);
    line-height: 1.2;
    min-height: 1.5em;
    border-radius: $radius-xs;
    padding: 0 2px;
    margin-left: -2px;
    transition: color $duration-fast $ease-standard;

    &[data-trend='up']   { color: $color-accent; }
    &[data-trend='down'] { color: $color-danger; }

    &[data-flash='up']   { @include anim-flash-up; }
    &[data-flash='down'] { @include anim-flash-down; }
  }

  .hint {
    font-size: $fs-xs;
    color: var(--text-tertiary);

    &[data-trend='up']   { color: $color-accent; }
    &[data-trend='down'] { color: $color-danger; }
  }

  .skeleton {
    display: inline-block;
    width: 80%;
    height: 1em;
    border-radius: $radius-sm;
    background: linear-gradient(90deg,
      $color-surface-2 0%,
      $color-surface-3 50%,
      $color-surface-2 100%);
    background-size: 200% 100%;
    @include anim-shimmer;
  }

  .sr { @include visually-hidden; }
}
</style>
