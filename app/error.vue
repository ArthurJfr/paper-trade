<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{
  error: NuxtError
}>()

const isNotFound = computed(() => props.error?.statusCode === 404)

const handleError = () => clearError({ redirect: '/' })
</script>

<template>
  <div class="error-page">
    <div class="card">
      <div class="icon-wrap" :class="{ 'icon-wrap--danger': !isNotFound }">
        <Icon
          :name="isNotFound ? 'ph:compass-tool-bold' : 'ph:warning-octagon-bold'"
          size="32"
        />
      </div>

      <span class="code">{{ error.statusCode }}</span>
      <h1>
        {{ isNotFound ? 'Perdu en mer ?' : 'Oups, un truc a cassé' }}
      </h1>
      <p>
        {{ isNotFound
          ? "Cette page n'existe pas — ou pas encore. On la construit peut-être en ce moment."
          : error.message || 'Une erreur inattendue est survenue.' }}
      </p>

      <button class="btn" @click="handleError">
        <Icon name="ph:arrow-left-bold" size="14" />
        Retour au dashboard
      </button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.error-page {
  @include flex-center;
  min-height: 100vh;
  background: $color-bg;
  padding: $space-lg;
}

.card {
  @include stack($space-md);
  @include card;
  align-items: center;
  text-align: center;
  max-width: 480px;
  padding: $space-2xl;
}

.icon-wrap {
  @include flex-center;
  width: 64px;
  height: 64px;
  border-radius: $radius-full;
  background: $color-accent-soft;
  color: $color-accent;

  &--danger {
    background: $color-danger-soft;
    color: $color-danger;
  }
}

.code {
  @include mono-nums;
  font-size: $fs-xs;
  color: $color-text-dim;
  letter-spacing: 0.1em;
}

h1 {
  font-size: $fs-2xl;
}

p {
  color: $color-text-muted;
  font-size: $fs-sm;
  line-height: $lh-loose;
}

.btn {
  @include row($space-xs);
  padding: $space-sm $space-md;
  background: $color-accent;
  color: $color-bg;
  border-radius: $radius-md;
  font-size: $fs-sm;
  font-weight: $fw-semibold;
  margin-top: $space-sm;

  &:hover {
    background: $color-accent-hover;
  }
}
</style>
