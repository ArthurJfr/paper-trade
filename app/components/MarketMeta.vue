<script setup lang="ts">
withDefaults(defineProps<{
  transportMode: 'ws' | 'rest'
  latencyMs: number | null
  switchCount: number
  lastSwitchSec?: number | null
}>(), {
  lastSwitchSec: null,
})
</script>

<template>
  <span class="meta" :title="`Transport ${transportMode.toUpperCase()}`">
    {{ transportMode.toUpperCase() }}
    <span class="sep" aria-hidden="true">·</span>
    <span class="latency">
      {{ latencyMs === null ? 'latence —' : `${latencyMs}ms` }}
    </span>
    <span class="sep" aria-hidden="true">·</span>
    <span class="switch">
      switch {{ switchCount }}<template v-if="lastSwitchSec !== null"> (il y a {{ lastSwitchSec }}s)</template>
    </span>
  </span>
</template>

<style lang="scss" scoped>
.meta {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  font-size: $fs-xs;
  color: $color-text-dim;
  font-family: $font-mono;

  .sep { color: $color-text-dim; }
}
</style>
