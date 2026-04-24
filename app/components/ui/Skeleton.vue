<script setup lang="ts">
withDefaults(defineProps<{
  width?: string
  height?: string
  radius?: string
  block?: boolean
}>(), {
  width: '100%',
  height: '1em',
  radius: '4px',
  block: false,
})
</script>

<template>
  <span
    class="ui-skeleton"
    :class="{ block }"
    :style="{ width, height, borderRadius: radius }"
    aria-hidden="true"
  />
</template>

<style lang="scss" scoped>
.ui-skeleton {
  display: inline-block;
  background: linear-gradient(90deg,
    $color-surface-2 0%,
    $color-surface-3 50%,
    $color-surface-2 100%);
  background-size: 200% 100%;
  animation:
    pt-fade-in $duration-fast $ease-decelerate forwards,
    pt-shimmer 1.6s ease-in-out infinite;

  &.block { display: block; }
}
</style>
