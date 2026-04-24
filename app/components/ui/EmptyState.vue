<script setup lang="ts">
withDefaults(defineProps<{
  icon?: string
  title?: string
  description?: string
  variant?: 'neutral' | 'danger'
  compact?: boolean
}>(), {
  icon: 'ph:cloud-slash-bold',
  variant: 'neutral',
  compact: false,
})
</script>

<template>
  <div class="ui-empty" :class="[`v-${variant}`, { compact }]" role="status">
    <div v-if="icon" class="icon-wrap">
      <Icon :name="icon" size="22" />
    </div>
    <strong v-if="title || $slots.title" class="title">
      <slot name="title">{{ title }}</slot>
    </strong>
    <p v-if="description || $slots.default" class="desc">
      <slot>{{ description }}</slot>
    </p>
    <div v-if="$slots.actions" class="actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.ui-empty {
  @include panel-padded($space-2xl);
  @include stack($space-sm);
  align-items: center;
  text-align: center;
  color: var(--text-secondary);
  font-size: $fs-sm;
  @include anim-slide-up($duration-slow, $ease-decelerate);

  &.compact {
    padding: $space-lg;
    min-height: 140px;
  }

  .icon-wrap {
    @include flex-center;
    width: 44px;
    height: 44px;
    border-radius: $radius-full;
    background: $color-surface-2;
    color: var(--text-secondary);
    @include anim-scale-in($duration-base, $ease-spring, 80ms);
  }

  .title {
    font-size: $fs-md;
    color: var(--text-primary);
    font-weight: $fw-semibold;
  }

  .desc {
    color: var(--text-secondary);
    max-width: 420px;
  }

  .actions {
    @include row($space-sm);
    flex-wrap: wrap;
    justify-content: center;
    margin-top: $space-xs;
  }

  &.v-danger {
    .icon-wrap {
      background: $color-danger-soft;
      color: $color-danger;
    }
  }
}
</style>
