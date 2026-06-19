import {defineStore} from 'pinia'
import clone from 'lodash/clone'
import {isNull} from '@/common/utils/common'

const STORAGE_KEY = 'script_server_open_tabs'

function loadOpenTabs() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) {
            const parsed = JSON.parse(raw)
            if (Array.isArray(parsed)) {
                return parsed.filter(name => typeof name === 'string')
            }
        }
    } catch (e) {
        // localStorage unavailable (private mode, jsdom) — start empty
    }
    return []
}

/**
 * In-app tabs: keeps the list of scripts the user has opened, plus a per-tab
 * snapshot of the parameter form values so switching tabs preserves work in
 * progress. The open-tab list is persisted to localStorage; the snapshotted
 * values are session-only (executions reconnect on reload via executions.init).
 */
export const useScriptTabsStore = defineStore('scriptTabs', {
    state: () => ({
        openTabs: loadOpenTabs(),
        tabValues: {}
    }),

    actions: {
        openTab(scriptName) {
            if (isNull(scriptName)) {
                return
            }
            if (!this.openTabs.includes(scriptName)) {
                this.openTabs.push(scriptName)
                this._persist()
            }
        },

        // Removes a tab. Returns the script name that should become active when
        // the closed tab was the active one (the neighbour), or null if no tabs
        // remain.
        closeTab(scriptName) {
            const index = this.openTabs.indexOf(scriptName)
            if (index === -1) {
                return null
            }

            this.openTabs.splice(index, 1)
            delete this.tabValues[scriptName]
            this._persist()

            if (this.openTabs.length === 0) {
                return null
            }
            return this.openTabs[Math.min(index, this.openTabs.length - 1)]
        },

        saveValues(scriptName, values) {
            if (isNull(scriptName)) {
                return
            }
            this.tabValues[scriptName] = clone(values)
        },

        // Returns the saved values for a tab and removes them, so the caller can
        // restore them exactly once (avoids re-triggering on parameter echoes).
        consumeValues(scriptName) {
            const values = this.tabValues[scriptName]
            if (isNull(values)) {
                return null
            }
            delete this.tabValues[scriptName]
            return values
        },

        _persist() {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(this.openTabs))
            } catch (e) {
                // ignore persistence failures, tabs still work in-session
            }
        }
    }
})
