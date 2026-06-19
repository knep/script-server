<template>
  <v-text-field
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    prepend-inner-icon="search"
    placeholder="Search scripts"
    density="compact"
    variant="solo-filled"
    flat
    rounded="lg"
    hide-details
    autocomplete="off"
    class="search-field"
  />
</template>

<script>
export default {
  name: 'SearchPanel',
  emits: ['update:modelValue'],
  props: {
    modelValue: {
      type: String,
      default: ''
    }
  }
}
</script>

<style scoped>
.search-field {
  width: 100%;
}

.search-field :deep(.v-field) {
  background: var(--background-color-high-emphasis);
  font-size: 0.9rem;
}

.search-field :deep(.v-field__prepend-inner > .v-icon) {
  color: var(--font-color-medium);
  opacity: 1;
}
</style>
