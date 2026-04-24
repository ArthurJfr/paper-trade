<script setup lang="ts" generic="T extends string | number">
interface TabItem {
  key: T
  label: string
  icon?: string
  disabled?: boolean
}

const props = withDefaults(defineProps<{
  modelValue: T
  items: readonly TabItem[]
  ariaLabel?: string
  size?: 'sm' | 'md'
}>(), {
  size: 'sm',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: T): void
}>()

function select(item: TabItem) {
  if (item.disabled) return
  emit('update:modelValue', item.key)
}

function onKey(e: KeyboardEvent, idx: number) {
  const items = props.items
  if (!items.length) return
  let next = idx
  if (e.key === 'ArrowRight') next = (idx + 1) % items.length
  else if (e.key === 'ArrowLeft') next = (idx - 1 + items.length) % items.length
  else if (e.key === 'Home') next = 0
  else if (e.key === 'End') next = items.length - 1
  else return
  e.preventDefault()
  const item = items[next]
  if (item && !item.disabled) emit('update:modelValue', item.key)
}
</script>

<template>
  <div class="ui-tabs" :class="`s-${size}`" role="tablist" :aria-label="ariaLabel">
    <button
      v-for="(it, idx) in items"
      :key="it.key"
      type="button"
      class="tab"
      role="tab"
      :aria-selected="modelValue === it.key"
      :disabled="it.disabled || undefined"
      :tabindex="modelValue === it.key ? 0 : -1"
      @click="select(it)"
      @keydown="onKey($event, idx)"
    >
      <Icon v-if="it.icon" :name="it.icon" size="12" />
      <span>{{ it.label }}</span>
    </button>
  </div>
</template>

<style lang="scss" scoped>
.ui-tabs {
  @include row(2px);
  padding: 3px;
  background: $color-surface-2;
  border-radius: $radius-md;
  width: fit-content;

  &.s-md { padding: 4px; }

  .tab {
    @include row($space-xs);
    background: transparent;
    border: 0;
    border-radius: $radius-sm;
    color: $color-text-muted;
    font-family: $font-mono;
    font-size: $fs-xs;
    font-weight: $fw-medium;
    padding: $space-xs $space-md;
    cursor: pointer;
    transition:
      background $duration-base $ease-emphasized,
      color $duration-fast $ease-standard,
      box-shadow $duration-base $ease-emphasized,
      transform $duration-instant $ease-standard;

    &:hover:not([disabled]):not([aria-selected='true']) {
      color: $color-text;
      background: color-mix(in srgb, $color-surface 60%, transparent);
    }
    &:active:not([disabled]) { transform: scale(0.97); }
    &[aria-selected='true'] {
      background: $color-surface;
      color: $color-text;
      box-shadow: $shadow-sm;
    }
    &:disabled { opacity: 0.45; cursor: not-allowed; }
  }

  &.s-md .tab {
    font-size: $fs-sm;
    padding: $space-sm $space-md;
  }
}
</style>
