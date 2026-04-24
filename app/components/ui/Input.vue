<script setup lang="ts">
const props = withDefaults(defineProps<{
  modelValue: string | number | null
  type?: string
  placeholder?: string
  inputmode?: 'text' | 'numeric' | 'decimal' | 'search' | 'tel' | 'email' | 'url'
  disabled?: boolean
  leadingIcon?: string
  prefix?: string
  suffix?: string
  ariaLabel?: string
  size?: 'sm' | 'md'
}>(), {
  type: 'text',
  disabled: false,
  size: 'md',
})

const emit = defineEmits<{
  (e: 'update:modelValue', v: string): void
  (e: 'submit'): void
}>()

function onInput(e: Event) {
  const t = e.target as HTMLInputElement
  emit('update:modelValue', t.value)
}
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') emit('submit')
}
</script>

<template>
  <label class="ui-input" :class="[`s-${size}`, { disabled }]">
    <Icon v-if="leadingIcon" :name="leadingIcon" size="14" class="lead" />
    <span v-else-if="prefix" class="prefix">{{ prefix }}</span>
    <input
      :type="type"
      :value="modelValue ?? ''"
      :placeholder="placeholder"
      :inputmode="inputmode"
      :disabled="disabled"
      :aria-label="ariaLabel"
      autocomplete="off"
      @input="onInput"
      @keydown="onKeydown"
    >
    <span v-if="suffix" class="suffix">{{ suffix }}</span>
  </label>
</template>

<style lang="scss" scoped>
.ui-input {
  @include row($space-sm);
  background: $color-surface-2;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  padding: 0 $space-md;
  color: $color-text-muted;
  transition:
    border-color $duration-fast $ease-standard,
    background $duration-fast $ease-standard,
    box-shadow $duration-fast $ease-standard;
  min-width: 0;

  &:hover { border-color: $color-border-hover; }
  &:focus-within {
    border-color: $color-accent;
    color: $color-text;
    box-shadow: 0 0 0 3px $color-accent-soft;
  }
  &.disabled { opacity: 0.6; pointer-events: none; }

  &.s-sm { height: var(--control-h-sm); }
  &.s-md { height: var(--control-h-md); }

  .lead { color: $color-text-dim; flex-shrink: 0; }
  .prefix,
  .suffix {
    font-family: $font-mono;
    font-size: $fs-sm;
    color: $color-text-dim;
    flex-shrink: 0;
  }

  input {
    flex: 1;
    min-width: 0;
    background: transparent;
    border: 0;
    outline: 0;
    color: $color-text;
    font-size: $fs-sm;
    padding: 0;

    &::placeholder { color: $color-text-dim; }
    &::-webkit-search-cancel-button { filter: invert(0.6); }
  }
}
</style>
