<template>
  <v-list-group :value="group.name">
    <template #activator="{ props }">
      <v-list-item v-bind="props" :title="group.name" prepend-icon="folder" class="script-group" />
    </template>
    <ScriptListItem
      v-for="innerScript in group.scripts"
      :key="innerScript.name"
      :script="innerScript"
    />
  </v-list-group>
</template>

<script>
import ScriptListItem from './ScriptListItem';

export default {
  name: 'ScriptListGroup',
  components: {ScriptListItem},
  props: {
    group: {
      type: Object
    }
  }
}
</script>

<style scoped>
.script-group :deep(.v-list-item-title) {
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: var(--font-color-medium);
}

.script-group :deep(.v-list-item__prepend > .v-icon) {
  color: var(--font-color-medium);
  opacity: 1;
  font-size: 20px;
}
</style>
