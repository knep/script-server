<template>
  <div class="main-app-sidebar">
    <div class="list-header">
      <div class="header-top">
        <router-link :title="versionString" class="header server-header" to="/">
          <span class="server-badge">{{ badgeLetter }}</span>
          <span :class="{
                      'header-gt-15-chars' : serverName && serverName.length >= 15,
                     'header-gt-18-chars' : serverName && serverName.length >= 18,
                     'header-gt-21-chars' : serverName && serverName.length >= 21
            }" class="server-name">{{ serverName || 'Script server' }}</span>
        </router-link>

        <div class="header-actions">
          <div class="header-link">
            <v-btn v-if="adminUser" icon="settings" variant="text" color="primary" density="compact" href="admin.html" />
            <a v-else href="https://github.com/knep/script-server" target="_blank">
              <svg aria-hidden="true" class="svg-icon github-icon" height="20px" viewBox="0 0 16 16" width="20px">
                <path
                    d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
              </svg>
            </a>
          </div>

          <ThemeToggle class="theme-toggle"/>
        </div>
      </div>

      <SearchPanel v-model="searchText" class="header-search"/>
    </div>

    <ScriptsList :search-text="searchText"/>

    <router-link class="bottom-panel history-button" to="/history">History</router-link>

    <div v-if="authEnabled" class="logout-panel bottom-panel">
      <span>{{ username }}</span>
      <v-btn
        icon="power_settings_new"
        variant="text"
        color="primary"
        density="compact"
        class="logout-button"
        @click="logout"
      />
    </div>
  </div>
</template>

<script>
import ScriptsList from './scripts/ScriptsList'
import SearchPanel from './SearchPanel';
import ThemeToggle from '@/common/components/ThemeToggle';
import {useServerConfigStore} from '@/main-app/stores/serverConfig'
import {useAuthStore} from '@/common/stores/auth'
import {useExecutionsStore} from '@/main-app/stores/executions'
import {logError} from '@/common/utils/common'

export default {
  name: 'MainAppSidebar',
  components: {
    SearchPanel,
    ScriptsList,
    ThemeToggle
  },

  data() {
    return {
      searchText: '',
    }
  },

  computed: {
    versionString() {
      const v = useServerConfigStore().version
      return v ? 'v' + v : null
    },
    serverName() {
      return useServerConfigStore().serverName
    },
    badgeLetter() {
      return (this.serverName || 'Script server').trim().charAt(0).toUpperCase()
    },
    adminUser() {
      return useAuthStore().admin
    },
    username() {
      return useAuthStore().username
    },
    authEnabled() {
      return useAuthStore().enabled
    }
  },

  methods: {
    logout() {
      useExecutionsStore().stopAll()
          .then(() => useAuthStore().logout())
          .then(() => location.reload())
          .catch(e => e && logError(e))
    }
  }
}
</script>

<style scoped>
.list-header {
  display: flex;
  flex-direction: column;

  border-bottom: 5px solid transparent; /* This is to make the header on the same level as the script header */

  flex-shrink: 0;

  position: relative;
}

.header-top {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 0.5rem 0.5rem 0.25rem;
}

.header-search {
  padding: 0 0.6rem 0.5rem;
}

.server-header {
  flex-grow: 1;
  display: flex;
  align-items: center;
  gap: 0.55rem;
  min-width: 0;

  font-weight: 400;
  line-height: 110%;
  color: var(--font-color-main);
  text-decoration: none;
}

.server-badge {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: var(--primary-color);
  color: var(--font-on-primary-color-main);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.95rem;
  font-weight: 600;
}

.server-name {
  font-size: 1.3rem;
  font-weight: 400;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.server-name.header-gt-15-chars {
  font-size: 1.15rem;
}

.server-name.header-gt-18-chars {
  font-size: 1.05rem;
}

.server-name.header-gt-21-chars {
  font-size: 1rem;
}

.header-actions {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.main-app-sidebar {
  height: 100%;

  background: var(--background-color);

  display: flex;
  flex-direction: column;
}

.header-link {
  margin: 0 0.5rem;
  display: flex;
  line-height: 0;
}

.theme-toggle {
  margin-right: 0;
}

.header-link .svg-icon {
  width: 24px;
  height: 24px;
}

.header-link .svg-icon path {
  fill: var(--primary-color)
}

.history-button {
  line-height: 3em;
  text-align: center;
  color: var(--primary-color);
  text-decoration: none;
  display: block;
}

.history-button:hover {
  background-color: var(--hover-color);
}

.bottom-panel {
  height: 3em;
  width: 100%;
  border-top: 1px solid var(--separator-color);

  flex-shrink: 0;
}

.logout-panel {
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
}

.logout-button {
  margin-left: 4px;
}

</style>
