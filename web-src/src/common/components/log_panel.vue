<template>
  <div class="log-panel">
    <div class="log-panel-header">
      <v-icon :size="16">terminal</v-icon>
      <span>Output</span>

      <div class="log-search">
        <template v-if="searchActive">
          <input
            ref="searchInput"
            v-model="searchQuery"
            class="log-search-input"
            type="text"
            placeholder="Find in output"
            spellcheck="false"
            autocomplete="off"
            @keydown.enter.prevent="$event.shiftKey ? prevMatch() : nextMatch()"
            @keydown.esc.prevent="closeSearch"
          />
          <span class="log-search-count">{{ matchCountLabel }}</span>
          <v-icon class="log-search-btn" size="16" title="Previous match (Shift+Enter)"
                  :class="{disabled: matchCount === 0}" @click="prevMatch">keyboard_arrow_up</v-icon>
          <v-icon class="log-search-btn" size="16" title="Next match (Enter)"
                  :class="{disabled: matchCount === 0}" @click="nextMatch">keyboard_arrow_down</v-icon>
          <v-icon class="log-search-btn" size="16" title="Close (Esc)" @click="closeSearch">close</v-icon>
        </template>
        <v-icon v-else class="log-search-btn" size="16" title="Search output" @click="openSearch">search</v-icon>
      </div>
    </div>
    <div ref="shadow" class="log-panel-shadow"
         v-bind:class="{
             'shadow-top': !atTop && atBottom,
             'shadow-bottom': atTop && !atBottom,
             'shadow-top-bottom': !atTop && !atBottom}">
    </div>
    <a class="copy-text-button btn-icon-flat waves-effect waves-circle" @click="copyLogToClipboard">
      <v-icon>content_copy</v-icon>
    </a>
    <a class="download-text-button btn-icon-flat waves-effect waves-circle" @click="downloadLog">
      <v-icon>file_download</v-icon>
    </a>
  </div>
</template>

<script>
import {copyToClipboard, isNull} from '@/common/utils/common';
import {TerminalOutput} from '@/common/components/terminal/ansi/TerminalOutput'
import {TextOutput} from '@/common/components/terminal/text/TextOutput'
import {HtmlIFrameOutput} from '@/common/components/terminal/html/HtmlIFrameOutput'
import {HtmlOutput} from '@/common/components/terminal/html/HtmlOutput'
import {applyHighlights, clearHighlights, findTextMatches} from '@/common/components/terminal/logSearch'

export default {
  props: {
    'autoscrollEnabled': {
      type: Boolean,
      default: true
    },
    'outputFormat': {
      type: String,
      default: 'terminal'
    }
  },
  data: function () {
    return {
      atBottom: false,
      atTop: false,
      mouseDown: false,
      scrollUpdater: null,
      needScrollUpdate: false,
      text: '',
      searchActive: false,
      searchQuery: '',
      searchRanges: [],
      matchCount: 0,
      currentMatch: 0
    }
  },

  computed: {
    matchCountLabel: function () {
      if (this.matchCount === 0) {
        return this.searchQuery ? '0/0' : '';
      }
      return (this.currentMatch + 1) + '/' + this.matchCount;
    }
  },

  mounted: function () {
    window.addEventListener('resize', this.revalidateScroll);

    this.scrollUpdater = window.setInterval(() => {
      if (!this.needScrollUpdate) {
        return;
      }
      this.needScrollUpdate = false;

      let autoscrolled = false;
      if (this.autoscrollEnabled) {
        autoscrolled = this.autoscroll();
      }

      if (!autoscrolled) {
        this.recalculateScrollPosition();
      }
    }, 40);

    this.renderOutputElement()
  },

  methods: {
    recalculateScrollPosition: function () {
      var logContent = this.output.element;

      var scrollTop = logContent.scrollTop;
      var newAtBottom = (scrollTop + logContent.clientHeight + 5) > (logContent.scrollHeight);
      var newAtTop = scrollTop === 0;

      // sometimes we can get scroll update (from incoming text) between autoscroll and this method
      if (!this.needScrollUpdate) {
        this.atBottom = newAtBottom;
        this.atTop = newAtTop;
      }
    },

    autoscroll: function () {
      var logContent = this.output.element;

      if ((this.atBottom) && (!this.mouseDown)) {
        logContent.scrollTop = logContent.scrollHeight;
        return true;
      }
      return false;
    },

    revalidateScroll: function () {
      this.needScrollUpdate = true;
    },

    setLog: function (text) {
      this.text = ''
      this.output.clear()

      this.recalculateScrollPosition()

      this.appendLog(text)
    },

    appendLog: function (text) {
      if (isNull(text) || (text === '')) {
        return;
      }

      this.text += text
      this.output.write(text);

      this.revalidateScroll();

      if (this.searchActive && this.searchQuery) {
        // New output may contain (or shift) matches — refresh, preserving the
        // current position by index.
        this.scheduleSearchRefresh();
      }
    },

    scheduleSearchRefresh: function () {
      if (this._searchRefreshScheduled) {
        return;
      }
      this._searchRefreshScheduled = true;
      this.$nextTick(() => {
        this._searchRefreshScheduled = false;
        const previous = this.currentMatch;
        this.searchRanges = findTextMatches(this.output.element, this.searchQuery);
        this.matchCount = this.searchRanges.length;
        this.currentMatch = Math.min(previous, Math.max(0, this.matchCount - 1));
        applyHighlights(this.searchRanges, this.matchCount ? this.currentMatch : -1);
      });
    },

    removeInlineImage: function (output_path) {
      this.output.removeInlineImage(output_path);
    },

    setInlineImage: function (output_path, download_url) {
      this.output.setInlineImage(output_path, download_url);
    },

    copyLogToClipboard: function () {
      copyToClipboard(this.output.element);
    },

    downloadLog: function () {
      const content = this.output.element.innerText || this.output.element.textContent || '';
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'log-output.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },

    openSearch: function () {
      this.searchActive = true;
      this.$nextTick(() => {
        if (this.$refs.searchInput) {
          this.$refs.searchInput.focus();
        }
      });
    },

    closeSearch: function () {
      this.searchActive = false;
      this.searchQuery = '';
      this.searchRanges = [];
      this.matchCount = 0;
      this.currentMatch = 0;
      clearHighlights();
    },

    runSearch: function () {
      if (!this.output || !this.output.element || !this.searchQuery) {
        this.searchRanges = [];
        this.matchCount = 0;
        this.currentMatch = 0;
        clearHighlights();
        return;
      }

      this.searchRanges = findTextMatches(this.output.element, this.searchQuery);
      this.matchCount = this.searchRanges.length;
      if (this.matchCount === 0) {
        this.currentMatch = 0;
      } else if (this.currentMatch >= this.matchCount) {
        this.currentMatch = this.matchCount - 1;
      }

      applyHighlights(this.searchRanges, this.matchCount ? this.currentMatch : -1);
      this.scrollToCurrentMatch();
    },

    nextMatch: function () {
      if (this.matchCount === 0) {
        return;
      }
      this.currentMatch = (this.currentMatch + 1) % this.matchCount;
      applyHighlights(this.searchRanges, this.currentMatch);
      this.scrollToCurrentMatch();
    },

    prevMatch: function () {
      if (this.matchCount === 0) {
        return;
      }
      this.currentMatch = (this.currentMatch - 1 + this.matchCount) % this.matchCount;
      applyHighlights(this.searchRanges, this.currentMatch);
      this.scrollToCurrentMatch();
    },

    scrollToCurrentMatch: function () {
      const range = this.searchRanges[this.currentMatch];
      if (!range) {
        return;
      }
      // Pause autoscroll-following while the user navigates matches.
      this.atBottom = false;
      const target = range.startContainer.parentElement;
      if (target && target.scrollIntoView) {
        target.scrollIntoView({block: 'center', inline: 'nearest'});
      }
    },

    renderOutputElement: function () {
      if (!this.output || !this.$el) {
        return
      }

      const oldOutputs = this.$el.getElementsByClassName('log-content')
      Array.from(oldOutputs).forEach(old => this.$el.removeChild(old))

      const terminal = this.output.element;
      terminal.classList.add('log-content');
      terminal.addEventListener('scroll', () => this.recalculateScrollPosition());
      terminal.addEventListener('mousedown', () => this.mouseDown = true);
      terminal.addEventListener('mouseup', () => this.mouseDown = false);

      this.$el.insertBefore(terminal, this.$refs.shadow);

      this.revalidateScroll()
    }
  },

  beforeUnmount: function () {
    window.removeEventListener('resize', this.revalidateScroll);
    window.clearInterval(this.scrollUpdater);
    clearHighlights();
  },

  watch: {
    searchQuery: function () {
      this.currentMatch = 0;
      this.runSearch();
    },

    outputFormat: {
      immediate: true,
      handler: function () {
        switch (this.outputFormat) {
          case 'terminal':
            this.output = new TerminalOutput()
            break
          case 'html_iframe':
            this.output = new HtmlIFrameOutput()
            break
          case 'html':
            this.output = new HtmlOutput()
            break
          case 'text':
            this.output = new TextOutput()
            break
          default:
            console.log('WARNING! Unknown outputFormat: "' + this.outputFormat + '". Falling back to terminal')
            this.output = new TerminalOutput()
        }

        this.output.write(this.text)

        this.renderOutputElement()
      }
    }
  }
}

</script>

<style scoped>
.log-panel {
  flex: 1;

  position: relative;
  min-height: 0;

  display: flex;
  flex-direction: column;

  background: #0d1117;

  width: 100%;

  border: solid 1px #30363d;
  border-radius: 8px;
  overflow: hidden;
}

.log-panel-header {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 6px;

  padding: 6px 12px;
  background: #161b22;
  border-bottom: 1px solid #30363d;

  color: #768390;
  font-size: 12px;
  font-family: var(--font-sans);
  user-select: none;
}

.log-panel-header :deep(.v-icon) {
  color: #768390;
}

.log-search {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 4px;
}

.log-search-input {
  width: 150px;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 4px;
  color: #adbac7;
  font-family: var(--font-mono);
  font-size: 12px;
  padding: 2px 6px;
  outline: none;
}

.log-search-input:focus {
  border-color: var(--primary-color);
}

.log-search-count {
  color: #768390;
  font-size: 11px;
  min-width: 34px;
  text-align: right;
}

.log-search-btn {
  cursor: pointer;
  color: #768390;
  border-radius: 4px;
}

.log-search-btn:hover {
  color: #adbac7;
  background: #30363d;
}

.log-search-btn.disabled {
  opacity: 0.4;
  pointer-events: none;
}

.log-panel-shadow {
  position: absolute;

  width: 100%;
  min-height: 100%;
  top: 0;
  z-index: 5;

  pointer-events: none;
}

.shadow-top-bottom {
  box-shadow: 0 7px 8px -4px rgba(0, 0, 0, 0.4) inset, 0 -7px 8px -4px rgba(0, 0, 0, 0.4) inset;
}

.shadow-top {
  box-shadow: 0 7px 8px -4px rgba(0, 0, 0, 0.4) inset;
}

.shadow-bottom {
  box-shadow: 0 -7px 8px -4px rgba(0, 0, 0, 0.4) inset;
}

.log-panel :deep(.log-content.terminal-output img) {
  max-width: 100%
}

.log-panel .copy-text-button {
  position: absolute;
  right: 8px;
  bottom: 4px;
}

.log-panel .copy-text-button i {
  color: #768390;
}

.log-panel .download-text-button {
  position: absolute;
  right: 50px;
  bottom: 4px;
}

.log-panel .download-text-button i {
  color: #768390;
}

/*noinspection CssInvalidPropertyValue,CssOverwrittenProperties*/
.log-panel :deep(.log-content) {
  display: block;
  overflow-y: auto;
  flex: 1 1 0;
  min-height: 0;
  width: 100%;

  color: #adbac7;
  font-family: var(--font-mono);
  font-size: .875em;

  padding: 1.25em 1.5em;

  white-space: pre-wrap; /* CSS 3 */
  white-space: -moz-pre-wrap; /* Mozilla, since 1999 */
  white-space: -o-pre-wrap; /* Opera 7 */
  overflow-wrap: break-word;

  -ms-word-break: break-all;
  /* This is the dangerous one in WebKit, as it breaks things wherever */
  word-break: break-all;
  /* Instead use this non-standard one: */
  word-break: break-word;

  /* Adds a hyphen where the word breaks, if supported (No Blink) */
  -ms-hyphens: auto;
  -moz-hyphens: auto;
  -webkit-hyphens: auto;
  hyphens: auto;
}


</style>

<!-- Global: ::highlight() applies to Ranges in the externally-inserted output
     element, which doesn't carry the scoped-style attribute. -->
<style>
::highlight(log-search) {
  background-color: rgba(255, 214, 0, 0.35);
}

::highlight(log-search-current) {
  background-color: #f5b301;
  color: #0d1117;
}
</style>
