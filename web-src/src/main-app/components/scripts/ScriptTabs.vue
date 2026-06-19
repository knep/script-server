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
      <v-progress-circular
        v-if="statusFor(scriptName) === 'running'"
        class="tab-status"
        :size="13"
        :width="2"
        color="primary"
        indeterminate
      />
      <v-icon
        v-else-if="statusFor(scriptName) === 'finished'"
        class="tab-status status-finished"
        size="15"
      >check_circle</v-icon>
      <v-icon
        v-else-if="statusFor(scriptName) === 'error'"
        class="tab-status status-error"
        size="15"
      >error</v-icon>

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
import {useExecutionsStore} from '@/main-app/stores/executions'
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
    statusFor(scriptName) {
      return useExecutionsStore().getScriptStatus(scriptName)
    },
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

.tab-status {
  margin-right: 6px;
  flex-shrink: 0;
}

.tab-status.status-finished {
  color: var(--primary-color);
}

.tab-status.status-error {
  color: var(--error-color);
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
