<script setup lang="ts">
type Variant = 'ghost' | 'secondary' | 'primary'
type Size = 'sm' | 'md' | 'lg'

const props = withDefaults(defineProps<{
  icon: string
  variant?: Variant
  size?: Size
  type?: 'button' | 'submit' | 'reset'
  ariaLabel: string
  disabled?: boolean
  active?: boolean
}>(), {
  variant: 'ghost',
  size: 'md',
  type: 'button',
  disabled: false,
  active: false,
})

const iconSize = computed(() => {
  switch (props.size) {
    case 'sm': return 14
    case 'lg': return 20
    default:   return 16
  }
})
</script>

<template>
  <button
    :type="type"
    class="ui-iconbtn"
    :class="[`v-${variant}`, `s-${size}`, { active }]"
    :aria-label="ariaLabel"
    :aria-pressed="active || undefined"
    :disabled="disabled"
  >
    <Icon :name="icon" :size="iconSize" />
  </button>
</template>

<style lang="scss" scoped>
.ui-iconbtn {
  @include flex-center;
  border: 1px solid transparent;
  background: transparent;
  color: $color-text-muted;
  cursor: pointer;
  transition:
    color $duration-fast $ease-standard,
    background $duration-fast $ease-standard,
    border-color $duration-fast $ease-standard,
    transform $duration-instant $ease-standard;

  &:active:not(:disabled) { transform: scale(0.92); }

  &:disabled { opacity: 0.5; cursor: not-allowed; }

  &.s-sm { width: var(--control-h-sm); height: var(--control-h-sm); border-radius: $radius-sm; }
  &.s-md { width: var(--control-h-md); height: var(--control-h-md); border-radius: $radius-md; }
  &.s-lg { width: var(--control-h-lg); height: var(--control-h-lg); border-radius: $radius-md; }

  &.v-ghost {
    &:hover:not(:disabled) { background: $color-surface-2; color: $color-text; }
    &.active { color: $color-accent; background: $color-accent-soft; }
  }
  &.v-secondary {
    background: $color-surface;
    border-color: $color-border;
    color: $color-text;
    &:hover:not(:disabled) { border-color: $color-border-hover; background: $color-surface-2; }
  }
  &.v-primary {
    background: $color-accent;
    color: $color-bg;
    &:hover:not(:disabled) { background: $color-accent-hover; }
  }
}
</style>
