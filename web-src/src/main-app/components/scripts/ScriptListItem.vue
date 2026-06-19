<template>
  <v-list-item
    :to="'/' + descriptor.hash"
    :title="descriptor.name"
    :class="{ 'parsing-failed': descriptor.parsingFailed }"
    class="script-list-item"
  >
    <v-tooltip v-if="descriptor.parsingFailed" activator="parent" location="right">
      Failed to parse config file
    </v-tooltip>
    <template #append>
      <v-icon
        class="favorite-toggle"
        :class="{ 'is-favorite': isFavorite }"
        :size="18"
        :title="isFavorite ? 'Remove from favorites' : 'Add to favorites'"
        @click.stop.prevent="toggleFavorite"
      >{{ isFavorite ? 'star' : 'star_border' }}</v-icon>
      <v-progress-circular
        v-if="descriptor.state === 'executing'"
        :size="20"
        :width="2"
        color="primary"
        indeterminate
      />
      <v-icon v-else-if="descriptor.state === 'finished'" color="primary" :size="20">check</v-icon>
      <v-icon v-else-if="descriptor.state === 'cannot-parse'" color="error" :size="20">priority_high</v-icon>
    </template>
  </v-list-item>
</template>

<script>
import {forEachKeyValue} from '@/common/utils/common';
import {useScriptsStore} from '@/main-app/stores/scripts'
import {useExecutionsStore} from '@/main-app/stores/executions'
import {useScriptFavoritesStore} from '@/main-app/stores/scriptFavorites'
import {scriptNameToHash} from '../../utils/model_helper';

export default {
  name: 'ScriptListItem',
  props: {
    script: {
      type: Object,
      default: null
    }
  },
  computed: {
    descriptor() {
      return {
        name: this.script.name,
        state: this.getState(this.script.name),
        hash: this.toHash(this.script.name),
        parsingFailed: this.script.parsing_failed
      }
    },
    selectedScript() {
      return useScriptsStore().selectedScript
    },
    isFavorite() {
      return useScriptFavoritesStore().isFavorite(this.script.name)
    }
  },
  methods: {
    toggleFavorite() {
      useScriptFavoritesStore().toggle(this.script.name)
    },
    getState(scriptName) {
      if (this.script.parsing_failed) {
        return 'cannot-parse'
      }

      let state = 'idle';
      forEachKeyValue(useExecutionsStore().executors, function (id, executor) {
        if (executor.state.scriptName !== scriptName) {
          return;
        }
        state = executor.state.status;
      });
      return state;
    },
    toHash: scriptNameToHash
  }
}
</script>

<style scoped>
.script-list-item :deep(.v-list-item-title) {
  font-family: var(--font-sans);
  font-size: 0.82rem;
  font-weight: 400;
  letter-spacing: 0;
}

.script-list-item.parsing-failed :deep(.v-list-item-title) {
  color: var(--font-color-disabled);
}

.script-list-item.v-list-item--active :deep(.v-list-item-title) {
  color: var(--primary-color);
  font-weight: 500;
}

/* Star is hidden until row hover, but stays visible once a script is favorited. */
.favorite-toggle {
  color: var(--font-color-disabled);
  opacity: 0;
  margin-right: 4px;
  transition: opacity 0.15s ease, color 0.15s ease;
}

.script-list-item:hover .favorite-toggle {
  opacity: 1;
}

.favorite-toggle:hover {
  color: var(--font-color-medium);
}

.favorite-toggle.is-favorite {
  opacity: 1;
  color: #f5b301;
}
</style>
