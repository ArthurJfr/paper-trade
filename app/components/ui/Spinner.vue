<script setup lang="ts">
withDefaults(defineProps<{
  size?: number
  label?: string
}>(), {
  size: 18,
})
</script>

<template>
  <span class="ui-spinner" role="status" :aria-label="label || 'Chargement'">
    <Icon name="ph:circle-notch-bold" :size="size" />
  </span>
</template>

<style lang="scss" scoped>
.ui-spinner {
  display: inline-flex;
  animation: pt-spin 0.9s linear infinite;
  color: $color-text-muted;
}
</style>
