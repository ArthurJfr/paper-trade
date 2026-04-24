<script setup lang="ts">
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
type Size = 'xs' | 'sm' | 'md' | 'lg'

const props = withDefaults(defineProps<{
  variant?: Variant
  size?: Size
  type?: 'button' | 'submit' | 'reset'
  loading?: boolean
  disabled?: boolean
  block?: boolean
  ariaLabel?: string
}>(), {
  variant: 'secondary',
  size: 'md',
  type: 'button',
  loading: false,
  disabled: false,
  block: false,
})

const isDisabled = computed(() => props.disabled || props.loading)
</script>

<template>
  <button
    :type="type"
    class="ui-btn"
    :class="[`v-${variant}`, `s-${size}`, { block, loading }]"
    :disabled="isDisabled"
    :aria-label="ariaLabel"
    :aria-busy="loading ? 'true' : undefined"
  >
    <Icon v-if="loading" name="ph:circle-notch-bold" class="spinner" />
    <slot />
  </button>
</template>

<style lang="scss" scoped>
.ui-btn {
  @include btn-base;
  border: 1px solid transparent;
  background: transparent;
  color: inherit;
  transition:
    background $duration-fast $ease-standard,
    color $duration-fast $ease-standard,
    border-color $duration-fast $ease-standard,
    opacity $duration-fast $ease-standard,
    box-shadow $duration-fast $ease-standard,
    transform $duration-instant $ease-standard;

  &:active:not(:disabled) { transform: scale(0.97); }

  &.block { width: 100%; }

  // Tailles
  &.s-xs { height: var(--control-h-xs); padding: 0 $space-sm; font-size: $fs-xs; }
  &.s-sm { height: var(--control-h-sm); padding: 0 $space-md; font-size: $fs-xs; }
  &.s-md { height: var(--control-h-md); padding: 0 $space-md; font-size: $fs-sm; }
  &.s-lg { height: var(--control-h-lg); padding: 0 $space-lg; font-size: $fs-sm; font-weight: $fw-semibold; }

  // Variants
  &.v-primary {
    background: $color-accent;
    color: $color-bg;
    border-color: $color-accent;
    font-weight: $fw-semibold;
    &:hover:not(:disabled) {
      background: $color-accent-hover;
      border-color: $color-accent-hover;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.22);
    }
  }
  &.v-secondary {
    background: $color-surface;
    color: $color-text;
    border-color: $color-border;
    &:hover:not(:disabled) { border-color: $color-border-hover; background: $color-surface-2; }
  }
  &.v-ghost {
    color: $color-text-muted;
    &:hover:not(:disabled) { background: $color-surface-2; color: $color-text; }
  }
  &.v-danger {
    background: $color-danger;
    color: white;
    border-color: $color-danger;
    font-weight: $fw-semibold;
    &:hover:not(:disabled) {
      background: color-mix(in srgb, $color-danger 90%, white 10%);
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.28);
    }
  }
  &.v-success {
    background: $color-accent;
    color: white;
    border-color: $color-accent;
    font-weight: $fw-semibold;
    &:hover:not(:disabled) {
      background: $color-accent-hover;
      box-shadow: 0 4px 12px rgba(34, 197, 94, 0.25);
    }
  }

  .spinner { animation: pt-spin 0.9s linear infinite; }
}
</style>
