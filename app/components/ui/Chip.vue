<script setup lang="ts">
type Variant = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info'

withDefaults(defineProps<{
  variant?: Variant
  dot?: boolean
  pulse?: boolean
  size?: 'xs' | 'sm'
}>(), {
  variant: 'neutral',
  dot: false,
  pulse: false,
  size: 'sm',
})
</script>

<template>
  <span class="ui-chip" :class="[`v-${variant}`, `s-${size}`, { pulse }]">
    <span v-if="dot" class="dot" aria-hidden="true" />
    <slot />
  </span>
</template>

<style lang="scss" scoped>
.ui-chip {
  @include chip-base;
  transition:
    color $duration-fast $ease-standard,
    background $duration-fast $ease-standard,
    border-color $duration-fast $ease-standard,
    transform $duration-instant $ease-standard;

  &.s-xs { font-size: $fs-3xs; padding: $space-2xs $space-sm; }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: $radius-full;
    background: $color-text-dim;
    flex-shrink: 0;
  }

  &.v-neutral { color: $color-text-muted; }
  &.v-accent  {
    color: $color-accent;
    background: $color-accent-soft;
    border-color: transparent;
    .dot { background: $color-accent; }
  }
  &.v-success {
    color: $color-accent;
    background: $color-accent-soft;
    border-color: transparent;
    .dot { background: $color-accent; }
  }
  &.v-warning {
    color: $color-warning;
    background: $color-warning-soft;
    border-color: transparent;
    .dot { background: $color-warning; }
  }
  &.v-danger {
    color: $color-danger;
    background: $color-danger-soft;
    border-color: transparent;
    .dot { background: $color-danger; }
  }
  &.v-info {
    color: $color-info;
    background: $color-info-soft;
    border-color: transparent;
    .dot { background: $color-info; }
  }

  &.pulse .dot {
    box-shadow: 0 0 0 3px $color-accent-soft;
    @include anim-pulse(2s);
  }
}
</style>
