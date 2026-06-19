<template>
  <v-tabs
    v-if="openTabs.length"
    :model-value="activeScript"
    color="primary"
    density="compact"
    show-arrows
    class="script-tabs"
  >
    <v-tab
      v-for="scriptName in openTabs"
      :key="scriptName"
      :value="scriptName"
      class="script-tab"
      @click="activate(scriptName)"
    >
      <span class="tab-label">{{ scriptName }}</span>
      <v-icon
        class="tab-close"
        size="16"
        title="Close tab"
        @click.stop="close(scriptName)"
      >close</v-icon>
    </v-tab>
  </v-tabs>
</template>

<script>
import {useScriptTabsStore} from '@/main-app/stores/scriptTabs'
import {useScriptsStore} from '@/main-app/stores/scripts'
import {scriptNameToHash} from '@/main-app/utils/model_helper'

export default {
  name: 'ScriptTabs',
  computed: {
    openTabs() {
      return useScriptTabsStore().openTabs
    },
    activeScript() {
      return useScriptsStore().selectedScript
    }
  },
  methods: {
    activate(scriptName) {
      if (scriptName === this.activeScript) {
        return
      }
      this.$router.push('/' + scriptNameToHash(scriptName))
    },
    close(scriptName) {
      const nextScript = useScriptTabsStore().closeTab(scriptName)
      if (scriptName !== this.activeScript) {
        return
      }
      this.$router.push(nextScript ? '/' + scriptNameToHash(nextScript) : '/')
    }
  }
}
</script>

<style scoped>
.script-tabs {
  flex: 0 0 auto;
  border-bottom: 1px solid var(--separator-color);
  background: var(--background-color);
}

.script-tab {
  text-transform: none;
  font-size: 0.85rem;
  font-weight: 400;
  letter-spacing: 0;
  color: var(--font-color-medium);
  padding: 0 12px;
}

.script-tab.v-tab--selected {
  color: var(--primary-color);
}

.tab-label {
  max-width: 18ch;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tab-close {
  margin-left: 8px;
  color: var(--font-color-disabled);
  border-radius: 50%;
}

.tab-close:hover {
  color: var(--font-color-main);
  background: var(--hover-color);
}
</style>
