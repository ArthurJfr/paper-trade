<script setup lang="ts">
import type { StreamStatus } from '~~/shared/types/market'

const props = withDefaults(defineProps<{
  status: StreamStatus
  transportMode?: 'ws' | 'rest'
  source?: 'binance' | 'mock'
  label?: string
}>(), {})

const computedLabel = computed(() => {
  if (props.label) return props.label
  switch (props.status) {
    case 'live':         return 'Live · Binance WS'
    case 'connecting':   return 'Connexion…'
    case 'reconnecting': return 'Reconnexion…'
    case 'offline':      return 'Déconnecté'
    default:
      return props.source === 'binance'
        ? 'Snapshot · Binance REST'
        : 'En attente'
  }
})

const variant = computed<'success' | 'warning' | 'danger' | 'neutral'>(() => {
  switch (props.status) {
    case 'live': return 'success'
    case 'connecting':
    case 'reconnecting': return 'warning'
    case 'offline': return 'danger'
    default: return 'neutral'
  }
})
</script>

<template>
  <UiChip :variant="variant" dot :pulse="status === 'live'">
    {{ computedLabel }}
  </UiChip>
</template>
