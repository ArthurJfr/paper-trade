<script setup lang="ts">
type Variant = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info'

withDefaults(defineProps<{
  variant?: Variant
}>(), {
  variant: 'neutral',
})
</script>

<template>
  <span class="ui-badge" :class="`v-${variant}`">
    <slot />
  </span>
</template>

<style lang="scss" scoped>
.ui-badge {
  display: inline-flex;
  align-items: center;
  font-family: $font-mono;
  font-size: $fs-3xs;
  font-weight: $fw-medium;
  letter-spacing: 0.06em;
  padding: $space-2xs $space-xs;
  border-radius: $radius-sm;
  border: 1px solid $color-border;
  background: $color-surface-3;
  color: $color-text-dim;
  line-height: 1.2;
  text-transform: uppercase;
  white-space: nowrap;
  transition:
    color $duration-fast $ease-standard,
    background $duration-fast $ease-standard,
    border-color $duration-fast $ease-standard;

  &.v-accent   { color: $color-accent; background: $color-accent-soft; border-color: transparent; }
  &.v-success  { color: $color-accent; background: $color-accent-soft; border-color: transparent; }
  &.v-warning  { color: $color-warning; background: $color-warning-soft; border-color: transparent; }
  &.v-danger   { color: $color-danger; background: $color-danger-soft; border-color: transparent; }
  &.v-info     { color: $color-info; background: $color-info-soft; border-color: transparent; }
}
</style>
