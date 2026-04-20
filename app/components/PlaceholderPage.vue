<script setup lang="ts">
defineProps<{
  icon: string
  title: string
  description: string
  version?: string
}>()
</script>

<template>
  <section class="placeholder">
    <div class="card">
      <div class="icon-wrap">
        <Icon :name="icon" size="32" />
      </div>
      <h1>{{ title }}</h1>
      <p>{{ description }}</p>
      <span v-if="version" class="tag">Prévu pour {{ version }}</span>
    </div>
  </section>
</template>

<style lang="scss" scoped>
.placeholder {
  @include flex-center;
  min-height: 60vh;
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
}

h1 {
  font-size: $fs-2xl;
}

p {
  color: $color-text-muted;
  font-size: $fs-sm;
  line-height: $lh-loose;
}

.tag {
  padding: $space-xs $space-sm;
  background: $color-surface-2;
  border: 1px solid $color-border;
  border-radius: $radius-full;
  font-size: $fs-xs;
  color: $color-text-muted;
  font-family: $font-mono;
}
</style>
