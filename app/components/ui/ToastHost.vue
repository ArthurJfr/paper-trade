<script setup lang="ts">
const { toasts, dismiss } = useToasts()

const iconFor = (kind: string) => {
  switch (kind) {
    case 'success': return 'ph:check-circle-bold'
    case 'warning': return 'ph:warning-bold'
    case 'danger':  return 'ph:x-circle-bold'
    default:        return 'ph:info-bold'
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="ui-toasts" role="region" aria-label="Notifications" aria-live="polite">
      <TransitionGroup name="ui-toast" tag="div">
        <div
          v-for="t in toasts"
          :key="t.id"
          class="toast"
          :class="`k-${t.kind}`"
          role="status"
        >
          <Icon :name="iconFor(t.kind)" size="16" class="ico" />
          <div class="body">
            <strong v-if="t.title" class="title">{{ t.title }}</strong>
            <p class="msg">{{ t.message }}</p>
          </div>
          <button
            v-if="t.actionLabel && t.action"
            type="button"
            class="action"
            @click="t.action && t.action()"
          >{{ t.actionLabel }}</button>
          <button
            type="button"
            class="close"
            aria-label="Fermer la notification"
            @click="dismiss(t.id)"
          >
            <Icon name="ph:x-bold" size="12" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style lang="scss" scoped>
.ui-toasts {
  position: fixed;
  bottom: $space-xl;
  right: $space-xl;
  z-index: $z-toast;
  @include stack($space-sm);
  max-width: min(420px, calc(100vw - #{$space-xl * 2}));
  pointer-events: none;
}

.toast {
  pointer-events: auto;
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  align-items: center;
  gap: $space-sm;
  padding: $space-sm $space-md;
  background: var(--surface-raised);
  border: 1px solid $color-border;
  border-left: 3px solid $color-text-muted;
  border-radius: $radius-md;
  box-shadow: $shadow-md;
  font-size: $fs-sm;
  color: $color-text;

  .ico   { color: $color-text-muted; flex-shrink: 0; }
  .body  { min-width: 0; }
  .title { display: block; font-weight: $fw-semibold; font-size: $fs-sm; margin-bottom: 2px; }
  .msg   { color: $color-text-muted; font-size: $fs-xs; line-height: $lh-normal; margin: 0; }

  .action {
    font-size: $fs-xs;
    padding: $space-xs $space-sm;
    border-radius: $radius-sm;
    border: 1px solid $color-border;
    background: $color-surface;
    color: $color-text;
    cursor: pointer;
    &:hover { border-color: $color-border-hover; }
  }

  .close {
    @include flex-center;
    width: 24px;
    height: 24px;
    border-radius: $radius-sm;
    color: $color-text-dim;
    background: transparent;
    &:hover { background: $color-surface-3; color: $color-text; }
  }

  &.k-success { border-left-color: $color-accent; .ico { color: $color-accent; } }
  &.k-warning { border-left-color: $color-warning; .ico { color: $color-warning; } }
  &.k-danger  { border-left-color: $color-danger;  .ico { color: $color-danger; } }
  &.k-info    { border-left-color: $color-info;    .ico { color: $color-info; } }
}

.ui-toast-enter-from {
  opacity: 0;
  transform: translate3d(0, 16px, 0) scale(0.96);
}
.ui-toast-leave-to {
  opacity: 0;
  transform: translate3d(16px, 0, 0) scale(0.98);
}
.ui-toast-enter-active {
  transition:
    opacity $duration-base $ease-spring,
    transform $duration-base $ease-spring;
}
.ui-toast-leave-active {
  transition:
    opacity $duration-fast $ease-accelerate,
    transform $duration-fast $ease-accelerate;
}
.ui-toast-move {
  transition: transform $duration-base $ease-emphasized;
}
.ui-toast-leave-active {
  position: absolute;
  right: 0;
}
</style>
