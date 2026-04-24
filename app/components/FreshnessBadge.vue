<script setup lang="ts">
const props = withDefaults(defineProps<{
  ageSec: number | null
  freshness?: 'fresh' | 'delayed' | 'stale'
  prefix?: string
}>(), {
  freshness: 'stale',
  prefix: 'MAJ',
})

const label = computed(() => {
  if (props.ageSec === null) return 'Données absentes'
  return `${props.prefix} il y a ${props.ageSec}s`
})
</script>

<template>
  <span class="freshness" :data-freshness="freshness" :title="label">
    <Icon
      name="ph:pulse-bold"
      size="11"
      class="ico"
      aria-hidden="true"
    />
    <span>{{ label }}</span>
  </span>
</template>

<style lang="scss" scoped>
.freshness {
  @include row(4px);
  font-size: $fs-xs;
  font-family: $font-mono;
  color: $color-text-muted;
  letter-spacing: 0.01em;

  .ico { opacity: 0.75; }

  &[data-freshness='fresh']   { color: $color-accent; }
  &[data-freshness='delayed'] { color: $color-warning; }
  &[data-freshness='stale']   { color: $color-danger; }
}
</style>
