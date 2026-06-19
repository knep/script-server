<template xmlns:v-slot="http://www.w3.org/1999/XSL/Transform">
  <div id="main-app">
    <AppLayout ref="appLayout" :loading="pageLoading">
      <template v-slot:sidebar>
        <MainAppSidebar/>
      </template>
      <template v-slot:header>
        <router-view name="header"/>
      </template>
      <template v-slot:content>
        <div class="content-with-tabs">
          <ScriptTabs/>
          <div class="tabbed-content">
            <router-view/>
          </div>
        </div>
      </template>
    </AppLayout>
    <DocumentTitleManager/>
    <FaviconManager/>
    <ExecutionNotifier/>
  </div>
</template>

<script>
import '@/assets/css/index.css';
import AppLayout from '@/common/components/AppLayout';
import {isEmptyString} from '@/common/utils/common';
import AppWelcomePanel from './components/AppWelcomePanel';
import DocumentTitleManager from './components/DocumentTitleManager';
import FaviconManager from './components/FaviconManager';
import MainAppSidebar from './components/MainAppSidebar';
import MainAppContent from './components/scripts/MainAppContent';
import ScriptTabs from './components/scripts/ScriptTabs';
import ExecutionNotifier from './components/ExecutionNotifier';
import {scriptNameToHash} from './utils/model_helper';
import {useScriptTabsStore} from '@/main-app/stores/scriptTabs';
import {usePageStore} from '@/main-app/stores/page'
import {useAuthStore} from '@/common/stores/auth'
import {useServerConfigStore} from '@/main-app/stores/serverConfig'
import {useScriptsStore} from '@/main-app/stores/scripts'
import {useExecutionsStore} from '@/main-app/stores/executions'

export default {
  name: 'App',
  components: {
    AppLayout,
    MainAppSidebar,
    MainAppContent,
    ScriptTabs,
    ExecutionNotifier,
    AppWelcomePanel,
    DocumentTitleManager,
    FaviconManager
  },
  computed: {
    pageLoading() {
      return usePageStore().pageLoading
    }
  },

  created() {
    useAuthStore().init()
    useServerConfigStore().init()
    useScriptsStore().init()
    useExecutionsStore().init()
  },

  mounted() {
    const currentPath = this.$router.currentRoute.value.path;
    this.$refs.appLayout.setSidebarVisibility(isEmptyString(currentPath) || (currentPath === '/'));

    this.$router.afterEach((to) => {
      this.$refs.appLayout.setSidebarVisibility(false);
    });

    window.addEventListener('keydown', this.handleTabShortcuts);
  },

  beforeUnmount() {
    window.removeEventListener('keydown', this.handleTabShortcuts);
  },

  methods: {
    // Tab navigation shortcuts. Uses Alt-based combos: Ctrl+W / Ctrl+Tab are
    // reserved by the browser and can't be reliably intercepted.
    handleTabShortcuts(event) {
      if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }

      const tabsStore = useScriptTabsStore();
      const openTabs = tabsStore.openTabs;
      const activeScript = useScriptsStore().selectedScript;

      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        if (openTabs.length === 0) {
          return;
        }
        event.preventDefault();
        const step = event.key === 'ArrowRight' ? 1 : -1;
        let index = openTabs.indexOf(activeScript);
        index = index === -1 ? 0 : (index + step + openTabs.length) % openTabs.length;
        this.$router.push('/' + scriptNameToHash(openTabs[index]));
      } else if (event.key === 'w' || event.key === 'W') {
        if (isEmptyString(activeScript)) {
          return;
        }
        event.preventDefault();
        const nextScript = tabsStore.closeTab(activeScript);
        this.$router.push(nextScript ? '/' + scriptNameToHash(nextScript) : '/');
      }
    }
  }
}
</script>

<style>
h1, h2, h3, h4, h5, h6 {
  margin: 0;
}

.content-with-tabs {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.content-with-tabs > .tabbed-content {
  flex: 1 1 0;
  min-height: 0;
}
</style>