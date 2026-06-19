<template>
  <v-list
    v-model:opened="openedGroups"
    open-strategy="single"
    class="scripts-list"
  >
    <template v-if="favoriteScripts.length">
      <v-list-subheader class="section-header">Favorites</v-list-subheader>
      <ScriptListItem
        v-for="script in favoriteScripts"
        :key="'fav-' + script.name"
        :script="script"
      />
      <v-divider class="favorites-divider" />
    </template>

    <template v-for="item in items" :key="item.name">
      <ScriptListGroup v-if="item.isGroup" :group="item" />
      <ScriptListItem v-else :script="item" />
    </template>
  </v-list>
</template>

<script>
import {isBlankString, isEmptyArray, isEmptyString, isNull, removeElement} from '@/common/utils/common';
import {useScriptsStore} from '@/main-app/stores/scripts'
import {useScriptFavoritesStore} from '@/main-app/stores/scriptFavorites'
import ScriptListGroup from './ScriptListGroup';
import ScriptListItem from './ScriptListItem';

export default {
  name: 'ScriptsList',
  components: {ScriptListGroup, ScriptListItem},
  props: {
    searchText: {
      type: String,
      default: null
    }
  },

  data() {
    return {
      openedGroups: []
    }
  },

  computed: {
    scripts() {
      return useScriptsStore().scripts
    },
    selectedScript() {
      return useScriptsStore().selectedScript
    },

    favoriteScripts() {
      const favorites = useScriptFavoritesStore().favorites
      const search = this.searchText
      const byName = {}
      for (const script of this.scripts) {
        byName[script.name] = script
      }
      return favorites
          .map(name => byName[name])
          .filter(script => !isNull(script) && script !== undefined)
          .filter(script =>
              isEmptyString(search) || script.name.toLowerCase().includes(search.toLowerCase()))
    },

    items() {
      let groups = this.scripts.filter(script => !isBlankString(script.group))
          .map(script => script.group)
          .filter((v, i, a) => a.indexOf(v) === i)
          .map(group => ({name: group, isGroup: true, scripts: []}));

      let foundScripts = this.scripts
          .filter(script =>
              isEmptyString(this.searchText) || (script.name.toLowerCase().includes(this.searchText.toLowerCase())));

      for (const script of foundScripts.slice()) {
        if (isBlankString(script.group)) {
          continue;
        }
        let foundGroup = groups.find(g => g.name === script.group);
        foundGroup.scripts.push(script);
        removeElement(foundScripts, script);
      }

      const foundGroups = groups.filter(group => !isEmptyArray(group.scripts))

      const result = foundScripts.concat(foundGroups);
      result.sort((o1, o2) => o1.name.toLowerCase().localeCompare(o2.name.toLowerCase()));

      return result;
    }
  },

  watch: {
    selectedScript: {
      immediate: true,
      handler(selectedScript) {
        if (isNull(selectedScript)) {
          return;
        }

        let foundScript = this.scripts.find(script => script.name === selectedScript);
        if (isNull(foundScript) || isBlankString(foundScript.group)) {
          return;
        }

        if (!this.openedGroups.includes(foundScript.group)) {
          this.openedGroups = [foundScript.group];
        }
      }
    }
  }
}
</script>

<style scoped>
.scripts-list {
  overflow: auto;
  overflow-wrap: normal;
  flex-grow: 1;
}

.section-header {
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: var(--font-color-medium);
  min-height: 2rem;
}

.favorites-divider {
  margin: 4px 0;
}
</style>
