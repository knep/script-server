<template>
  <div class="app-layout">
    <div ref="appSidebar" :class="{collapsed: !showSidebar}" class="app-sidebar shadow-8dp"
         :style="sidebarStyle">
      <slot name="sidebar"/>
    </div>
    <div v-show="!narrowView"
         class="sidebar-resizer"
         title="Drag to resize · double-click to reset"
         @mousedown="startResize"
         @dblclick="resetSidebarWidth"></div>
    <div class="app-content">
      <div ref="contentHeader"
           :class="{borderless: !hasHeader, 'shadow-8dp': hasHeader}" class="content-header">
        <v-btn
          icon="menu"
          variant="text"
          density="compact"
          class="app-menu-button"
          @click="setSidebarVisibility(true)"
        />
        <slot name="header"/>
        <v-progress-linear
          v-if="loading"
          indeterminate
          color="primary"
          :height="3"
          class="content-progress"
        />
      </div>
      <div ref="contentPanel" class="content-panel">
        <slot name="content"/>
      </div>
    </div>
    <div v-show="showSidebar" class="sidenav-overlay" @click="setSidebarVisibility(false)"></div>
  </div>
</template>

<script>

import {hasClass, isNull} from '@/common/utils/common';

const SIDEBAR_WIDTH_KEY = 'script_server_sidebar_width';
const DEFAULT_SIDEBAR_WIDTH = 300;
const MIN_SIDEBAR_WIDTH = 220;
const MAX_SIDEBAR_WIDTH = 600;

function clampSidebarWidth(value) {
  return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, value));
}

function loadSidebarWidth() {
  try {
    const stored = parseInt(localStorage.getItem(SIDEBAR_WIDTH_KEY), 10);
    if (!isNaN(stored)) {
      return clampSidebarWidth(stored);
    }
  } catch (e) {
    // localStorage unavailable (private mode, jsdom) — use the default
  }
  return DEFAULT_SIDEBAR_WIDTH;
}

export default {
  name: 'AppLayout',
  props: {
    loading: Boolean
  },
  data() {
    return {
      narrowView: false,
      showSidebar: false,
      hasHeader: false,
      sidebarWidth: DEFAULT_SIDEBAR_WIDTH
    }
  },

  computed: {
    sidebarStyle() {
      // The custom (resizable) width only applies to the desktop layout. In the
      // narrow/overlay layout the width is set by CSS (capped to the viewport),
      // so a wide desktop width doesn't overflow a phone screen.
      return this.narrowView ? {} : {width: this.sidebarWidth + 'px'};
    }
  },
  mounted() {
    this.sidebarWidth = loadSidebarWidth();

    const contentHeader = this.$refs.contentHeader;
    const contentPanel = this.$refs.contentPanel;

    updatedStylesBasedOnContent(contentHeader, contentPanel, this);

    const sidebarStyle = getComputedStyle(this.$refs.appSidebar);

    const resizeListener = () => {
      const position = sidebarStyle.position;
      if (!this.narrowView) {
        this.setSidebarVisibility(false);
      }
      this.narrowView = position === 'absolute';
    };
    window.addEventListener('resize', resizeListener);
    resizeListener();
  },

  beforeUnmount() {
    this._stopResizeListening();
  },

  methods: {
    setSidebarVisibility(visible) {
      this.showSidebar = visible;
    },

    startResize(event) {
      if (this.narrowView) {
        return;
      }
      event.preventDefault();
      this._onResizeMove = (e) => this._doResize(e);
      this._onResizeUp = () => this._stopResize();
      document.addEventListener('mousemove', this._onResizeMove);
      document.addEventListener('mouseup', this._onResizeUp);
      // Avoid selecting page text and flip the cursor while dragging.
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
    },

    _doResize(event) {
      // The sidebar starts at the viewport's left edge, so the pointer's X is
      // the desired width.
      this.sidebarWidth = clampSidebarWidth(event.clientX);
    },

    _stopResize() {
      this._stopResizeListening();
      this._persistSidebarWidth();
    },

    _stopResizeListening() {
      if (this._onResizeMove) {
        document.removeEventListener('mousemove', this._onResizeMove);
        this._onResizeMove = null;
      }
      if (this._onResizeUp) {
        document.removeEventListener('mouseup', this._onResizeUp);
        this._onResizeUp = null;
      }
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    },

    resetSidebarWidth() {
      this.sidebarWidth = DEFAULT_SIDEBAR_WIDTH;
      this._persistSidebarWidth();
    },

    _persistSidebarWidth() {
      try {
        localStorage.setItem(SIDEBAR_WIDTH_KEY, String(this.sidebarWidth));
      } catch (e) {
        // ignore persistence failures, the in-session width still applies
      }
    }
  }
}

function recalculateHeight(contentHeader, appLayout, contentPanel) {
  if (!contentHeader.childNodes) {
    return;
  }

  let childrenHeight = 0;
  for (const child of Array.from(contentHeader.childNodes)) {
    if (hasClass(child, 'app-menu-button')) {
      continue;
    }

    if ((child.nodeType === 1) && (window.getComputedStyle(child).position === 'absolute')) {
      continue;
    }

    if (!isNull(child.offsetHeight)) {
      childrenHeight = Math.max(childrenHeight, child.offsetHeight);
    }
  }
  appLayout.hasHeader = childrenHeight >= 1;

  appLayout.$nextTick(() => {
    contentPanel.style.maxHeight = 'calc(100% - ' + contentHeader.offsetHeight + 'px)';
  });
}

function updatedStylesBasedOnContent(contentHeader, contentPanel, appLayout) {
  const mutationObserver = new MutationObserver(mutations => {
    mutations.forEach(() => {
      recalculateHeight(contentHeader, appLayout, contentPanel);
    });
  });

  mutationObserver.observe(contentHeader, {
    childList: true,
    subtree: true,
    characterData: true
  });

  appLayout.$nextTick(() => {
    recalculateHeight(contentHeader, appLayout, contentPanel);
  });
}

</script>

<style scoped>
.app-layout {
  display: flex;
  height: 100vh;
  max-height: 100vh;
}

.app-sidebar {
  /* width is set inline (resizable, persisted); don't let flex shrink it */
  flex-shrink: 0;

  border-right: 1px solid var(--separator-color);
}

.sidebar-resizer {
  flex: 0 0 5px;
  cursor: col-resize;
  background: transparent;
  z-index: 2;
  transition: background-color 0.15s;
}

.sidebar-resizer:hover {
  background-color: var(--primary-color);
}

.app-content {
  flex: 1 1 0;

  display: flex;
  flex-direction: column;

  width: 100vw;
}

.app-menu-button {
  display: none !important;

  float: left;
  position: relative;
  z-index: 1;
  margin-top: 6px;
  margin-right: 4px;
}

.content-header {
  flex: 0 0 auto;
  width: 100%;

  padding-left: 24px;

  border-bottom: 1px solid var(--separator-color);
  position: relative;

  background: var(--script-header-background);
}

.content-header.borderless {
  border-bottom: none;
}

.content-header .content-progress {
  margin: 0;
  bottom: -1px;
  position: absolute;
  left: 0;
  right: 0;
}

.content-panel {
  flex: 1 1 0;
}

@media (max-width: 992px) {
  .content-header {
    padding-left: 0;
  }

  .app-sidebar {
    position: absolute;
    height: 100vh;
    z-index: 999;
    transition: transform 0.3s;

    /* Overlay width is viewport-driven here (the inline desktop width is not
       applied in narrow view), so it never overflows a phone screen. */
    width: 300px;
    max-width: 85vw;
  }

  .app-sidebar.collapsed {
    -webkit-transform: translateX(-105%);
    transform: translateX(-105%);
  }

  .sidenav-overlay {
    opacity: 1;
    display: block;
    background-color: rgba(0, 0, 0, 0.4);
    position: absolute;
    z-index: 500;
    width: 100%;
    height: 100%;
  }

  .app-menu-button {
    display: inline-flex !important;
    margin-right: 4px;
  }
}
</style>
