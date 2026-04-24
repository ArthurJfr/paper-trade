<script setup lang="ts">
withDefaults(defineProps<{
  padded?: boolean
  raised?: boolean
  interactive?: boolean
}>(), {
  padded: true,
  raised: false,
  interactive: false,
})
</script>

<template>
  <section class="ui-card" :class="{ padded, raised, interactive }">
    <slot />
  </section>
</template>

<style lang="scss" scoped>
.ui-card {
  background: var(--surface-panel);
  border: 1px solid $color-border;
  border-radius: $radius-lg;
  transition:
    border-color $duration-fast $ease-standard,
    transform $duration-fast $ease-standard,
    box-shadow $duration-fast $ease-standard;

  &.padded { padding: $space-lg; }
  &.raised { background: var(--surface-raised); box-shadow: $shadow-md; }
  &.interactive {
    cursor: pointer;
    &:hover {
      border-color: $color-border-hover;
      transform: translate3d(0, -2px, 0);
      box-shadow: $shadow-md;
    }
    &:active { transform: translate3d(0, -1px, 0); }
  }
}
</style>
