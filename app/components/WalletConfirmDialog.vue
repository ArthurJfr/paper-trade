<script setup lang="ts">
// Dialog générique de confirmation (archive / suppression dure / reset).
// Pattern identique à `WalletFormDialog.vue` : Teleport + overlay + focus
// trap minimal + Escape. Émet `confirm` et `cancel`.

withDefaults(defineProps<{
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  confirmVariant?: 'primary' | 'danger'
  loading?: boolean
}>(), {
  confirmLabel: 'Confirmer',
  cancelLabel: 'Annuler',
  confirmVariant: 'primary',
  loading: false,
})

const emit = defineEmits<{
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()

const dialogRef = ref<HTMLDivElement | null>(null)
const confirmBtnRef = ref<HTMLElement | null>(null)

function onCancel() {
  emit('cancel')
}
function onConfirm() {
  emit('confirm')
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    onCancel()
  }
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
})

// Focus la confirmation à l'ouverture.
watch(() => dialogRef.value, (el) => {
  if (el) nextTick(() => confirmBtnRef.value?.focus?.())
})
</script>

<template>
  <Teleport to="body">
    <Transition name="pt-dialog">
      <div v-if="open" class="dialog-backdrop" role="presentation" @click.self="onCancel">
        <div
          ref="dialogRef"
          class="dialog"
          role="alertdialog"
          aria-modal="true"
          :aria-labelledby="`confirm-title`"
          :aria-describedby="`confirm-body`"
        >
          <header class="dialog-head">
            <h2 :id="`confirm-title`">{{ title }}</h2>
          </header>
          <div :id="`confirm-body`" class="dialog-body">
            <p>{{ message }}</p>
            <slot />
          </div>
          <footer class="dialog-foot">
            <UiButton variant="ghost" :disabled="loading" @click="onCancel">{{ cancelLabel }}</UiButton>
            <UiButton
              ref="confirmBtnRef"
              :variant="confirmVariant"
              :loading="loading"
              @click="onConfirm"
            >{{ confirmLabel }}</UiButton>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style lang="scss" scoped>
.dialog-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
  z-index: $z-modal;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: $space-md;
}

.dialog {
  background: var(--surface-raised);
  border: 1px solid $color-border;
  border-radius: $radius-lg;
  box-shadow: $shadow-lg;
  width: min(440px, 100%);
}

.dialog-head {
  padding: $space-md $space-lg;
  border-bottom: 1px solid $color-border;

  h2 {
    margin: 0;
    font-size: $fs-lg;
    font-weight: $fw-semibold;
  }
}

.dialog-body {
  padding: $space-lg;
  color: $color-text-muted;
  font-size: $fs-sm;
  line-height: $lh-normal;

  p { margin: 0 0 $space-sm; }
}

.dialog-foot {
  display: flex;
  justify-content: flex-end;
  gap: $space-sm;
  padding: $space-md $space-lg;
  border-top: 1px solid $color-border;
  background: var(--surface-panel);
  border-radius: 0 0 $radius-lg $radius-lg;
}
</style>
