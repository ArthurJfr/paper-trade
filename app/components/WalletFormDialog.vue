<script setup lang="ts">
// Dialog unifié création / édition de wallet.
// - Mode `create`  : name + initialBalance + description + couleur + icône
// - Mode `edit`    : idem, mais initialBalance verrouillé si trades existent
// - Teleport vers body + overlay + focus trap minimal + gestion Escape
//
// Émet `submit` avec le payload validé et `cancel` sur fermeture/escape.

import type {
  CreateWalletRequest,
  UpdateWalletRequest,
  WalletWithStats,
} from '~~/shared/types/wallet'

const props = withDefaults(defineProps<{
  mode: 'create' | 'edit'
  open: boolean
  wallet?: WalletWithStats | null
  /** True si le wallet a déjà des trades (désactive l'édition du capital initial). */
  capitalLocked?: boolean
}>(), {
  wallet: null,
  capitalLocked: false,
})

const emit = defineEmits<{
  (e: 'submit', payload: CreateWalletRequest | UpdateWalletRequest): void
  (e: 'cancel'): void
}>()

const COLORS = [
  '#3b82f6', // blue
  '#22c55e', // green
  '#f97316', // orange
  '#a855f7', // purple
  '#eab308', // yellow
  '#ef4444', // red
  '#14b8a6', // teal
  '#f472b6', // pink
]

const ICONS = [
  'ph:wallet-bold',
  'ph:rocket-bold',
  'ph:diamond-bold',
  'ph:target-bold',
  'ph:trophy-bold',
  'ph:chart-line-up-bold',
  'ph:lightning-bold',
  'ph:compass-bold',
  'ph:tree-bold',
  'ph:mountains-bold',
  'ph:anchor-bold',
  'ph:crown-bold',
]

const form = reactive({
  name: '',
  initialBalance: 10000,
  description: '',
  color: COLORS[0]!,
  icon: ICONS[0]!,
})

const errors = reactive({
  name: '' as string,
  initialBalance: '' as string,
  description: '' as string,
})

const submitting = ref(false)
const dialogRef = ref<HTMLDivElement | null>(null)
const nameInputRef = ref<HTMLInputElement | null>(null)

watch(() => props.open, (isOpen) => {
  if (!isOpen) return
  // Reset du formulaire selon le mode à chaque ouverture.
  const w = props.wallet
  if (props.mode === 'edit' && w) {
    form.name = w.name
    form.initialBalance = w.initialBalance
    form.description = w.description ?? ''
    form.color = w.color ?? COLORS[0]!
    form.icon = w.icon ?? ICONS[0]!
  } else {
    form.name = ''
    form.initialBalance = 10000
    form.description = ''
    form.color = COLORS[0]!
    form.icon = ICONS[0]!
  }
  errors.name = ''
  errors.initialBalance = ''
  errors.description = ''
  submitting.value = false
  nextTick(() => nameInputRef.value?.focus())
})

function validate(): boolean {
  errors.name = ''
  errors.initialBalance = ''
  errors.description = ''

  if (!form.name || form.name.trim().length === 0) {
    errors.name = 'Nom requis'
  } else if (form.name.length > 60) {
    errors.name = 'Maximum 60 caractères'
  }

  const ib = Number(form.initialBalance)
  if (!Number.isFinite(ib) || ib < 100 || ib > 10_000_000) {
    errors.initialBalance = 'Entre 100 et 10 000 000 USDC'
  }

  if (form.description && form.description.length > 280) {
    errors.description = 'Maximum 280 caractères'
  }

  return !errors.name && !errors.initialBalance && !errors.description
}

async function onSubmit() {
  if (!validate()) return
  submitting.value = true
  try {
    if (props.mode === 'create') {
      const payload: CreateWalletRequest = {
        name: form.name.trim(),
        initialBalance: Number(form.initialBalance),
        description: form.description.trim() || undefined,
        color: form.color,
        icon: form.icon,
      }
      emit('submit', payload)
    } else {
      const patch: UpdateWalletRequest = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        color: form.color,
        icon: form.icon,
      }
      if (!props.capitalLocked && Number(form.initialBalance) !== (props.wallet?.initialBalance ?? 0)) {
        patch.initialBalance = Number(form.initialBalance)
      }
      emit('submit', patch)
    }
  } finally {
    submitting.value = false
  }
}

function onCancel() {
  if (submitting.value) return
  emit('cancel')
}

function onKeydown(e: KeyboardEvent) {
  if (!props.open) return
  if (e.key === 'Escape') {
    e.preventDefault()
    onCancel()
    return
  }
  // Focus trap simple : Tab cyclique à l'intérieur du dialog.
  if (e.key === 'Tab' && dialogRef.value) {
    const focusables = dialogRef.value.querySelectorAll<HTMLElement>(
      'input, select, textarea, button, [tabindex]:not([tabindex="-1"])',
    )
    if (focusables.length === 0) return
    const first = focusables[0]!
    const last = focusables[focusables.length - 1]!
    const activeEl = document.activeElement as HTMLElement | null
    if (e.shiftKey && activeEl === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && activeEl === last) {
      e.preventDefault()
      first.focus()
    }
  }
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
})

const title = computed(() =>
  props.mode === 'create' ? 'Nouveau wallet' : `Modifier « ${props.wallet?.name ?? ''} »`,
)
</script>

<template>
  <Teleport to="body">
    <Transition name="pt-dialog">
      <div
        v-if="open"
        class="dialog-backdrop"
        role="presentation"
        @click.self="onCancel"
      >
      <div
        ref="dialogRef"
        class="dialog"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="`wallet-dialog-title`"
      >
        <header class="dialog-head">
          <h2 :id="`wallet-dialog-title`">{{ title }}</h2>
          <UiIconButton
            icon="ph:x-bold"
            variant="ghost"
            ariaLabel="Fermer"
            @click="onCancel"
          />
        </header>

        <form class="dialog-body" @submit.prevent="onSubmit">
          <div class="field">
            <label for="wallet-name">Nom du wallet *</label>
            <input
              id="wallet-name"
              ref="nameInputRef"
              v-model="form.name"
              type="text"
              maxlength="60"
              placeholder="Par ex. Momentum BTC"
              required
              autocomplete="off"
              :aria-invalid="!!errors.name"
              :aria-describedby="errors.name ? 'wallet-name-error' : undefined"
            >
            <p v-if="errors.name" id="wallet-name-error" class="error">{{ errors.name }}</p>
            <p v-else class="hint">{{ form.name.length }} / 60</p>
          </div>

          <div class="field">
            <label for="wallet-initial">Capital initial (USDC) *</label>
            <input
              id="wallet-initial"
              v-model.number="form.initialBalance"
              type="number"
              min="100"
              max="10000000"
              step="100"
              required
              inputmode="decimal"
              :disabled="mode === 'edit' && capitalLocked"
              :aria-invalid="!!errors.initialBalance"
              :aria-describedby="errors.initialBalance ? 'wallet-initial-error' : 'wallet-initial-hint'"
            >
            <p v-if="errors.initialBalance" id="wallet-initial-error" class="error">{{ errors.initialBalance }}</p>
            <p v-else-if="mode === 'edit' && capitalLocked" id="wallet-initial-hint" class="hint warn">
              Verrouillé après le premier trade — utilisez « Reset » pour repartir à zéro.
            </p>
            <p v-else id="wallet-initial-hint" class="hint">Entre 100 et 10 000 000 USDC.</p>
          </div>

          <div class="field">
            <label for="wallet-description">Description (optionnel)</label>
            <textarea
              id="wallet-description"
              v-model="form.description"
              rows="2"
              maxlength="280"
              placeholder="Stratégie, objectif, règles…"
              :aria-invalid="!!errors.description"
              :aria-describedby="errors.description ? 'wallet-description-error' : undefined"
            />
            <p v-if="errors.description" id="wallet-description-error" class="error">{{ errors.description }}</p>
            <p v-else class="hint">{{ form.description.length }} / 280</p>
          </div>

          <div class="field">
            <p class="label">Couleur</p>
            <div class="swatches" role="radiogroup" aria-label="Choisir une couleur">
              <button
                v-for="c in COLORS"
                :key="c"
                type="button"
                class="swatch"
                :class="{ selected: form.color === c }"
                :style="{ background: c }"
                :aria-label="`Couleur ${c}`"
                :aria-checked="form.color === c ? 'true' : 'false'"
                role="radio"
                @click="form.color = c"
              />
            </div>
          </div>

          <div class="field">
            <p class="label">Icône</p>
            <div class="icons" role="radiogroup" aria-label="Choisir une icône">
              <button
                v-for="i in ICONS"
                :key="i"
                type="button"
                class="icon-btn"
                :class="{ selected: form.icon === i }"
                :aria-label="`Icône ${i}`"
                :aria-checked="form.icon === i ? 'true' : 'false'"
                role="radio"
                @click="form.icon = i"
              >
                <Icon :name="i" size="18" :style="{ color: form.icon === i ? form.color : undefined }" />
              </button>
            </div>
          </div>

          <footer class="dialog-foot">
            <UiButton variant="ghost" :disabled="submitting" @click="onCancel">Annuler</UiButton>
            <UiButton
              type="submit"
              variant="primary"
              :loading="submitting"
            >
              {{ mode === 'create' ? 'Créer le wallet' : 'Enregistrer' }}
            </UiButton>
          </footer>
        </form>
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
  width: min(560px, 100%);
  max-height: calc(100vh - #{$space-md * 2});
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.dialog-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
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
  display: flex;
  flex-direction: column;
  gap: $space-md;

  .field {
    display: flex;
    flex-direction: column;
    gap: $space-xs;
    min-width: 0;

    label, .label {
      font-size: $fs-xs;
      color: $color-text-muted;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-weight: $fw-medium;
      margin: 0;
    }

    input,
    textarea {
      width: 100%;
      min-width: 0;
      max-width: 100%;
      box-sizing: border-box;
      background: $color-surface;
      border: 1px solid $color-border;
      border-radius: $radius-sm;
      padding: $space-sm $space-md;
      color: $color-text;
      font: inherit;
      font-size: $fs-sm;
      transition: border-color $transition-fast;

      &:focus {
        outline: none;
        border-color: $color-accent;
      }

      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    }

    textarea {
      resize: vertical;
      min-height: 60px;
      font-family: inherit;
    }

    .hint {
      font-size: $fs-3xs;
      color: $color-text-dim;
      margin: 0;

      &.warn { color: $color-warning; }
    }

    .error {
      font-size: $fs-3xs;
      color: $color-danger;
      margin: 0;
    }
  }

  .swatches {
    display: flex;
    flex-wrap: wrap;
    gap: $space-xs;

    .swatch {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: 2px solid transparent;
      cursor: pointer;
      transition: transform $transition-fast, border-color $transition-fast;

      &:hover { transform: scale(1.08); }
      &.selected {
        border-color: $color-text;
        box-shadow: 0 0 0 2px var(--surface-raised);
      }
      &:focus-visible {
        @include ring-outset;
        outline: none;
      }
    }
  }

  .icons {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: $space-xs;

    .icon-btn {
      aspect-ratio: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      background: $color-surface;
      border: 1px solid $color-border;
      border-radius: $radius-sm;
      color: $color-text-muted;
      cursor: pointer;
      transition: all $transition-fast;

      &:hover { border-color: $color-border-hover; color: $color-text; }
      &.selected {
        border-color: $color-accent;
        background: $color-accent-soft;
      }
      &:focus-visible {
        @include ring-outset;
        outline: none;
      }
    }
  }
}

.dialog-foot {
  display: flex;
  justify-content: flex-end;
  gap: $space-sm;
  padding-top: $space-md;
  border-top: 1px solid $color-border;
  margin: $space-md -#{$space-lg} -#{$space-lg};
  padding: $space-md $space-lg;
  background: var(--surface-panel);
  border-radius: 0 0 $radius-lg $radius-lg;
}
</style>
