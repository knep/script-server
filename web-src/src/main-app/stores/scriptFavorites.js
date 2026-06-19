import {defineStore} from 'pinia'
import {isNull} from '@/common/utils/common'

const STORAGE_KEY = 'script_server_favorites'

function loadFavorites() {
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
 * Pinned/favorite scripts, shown in a dedicated section at the top of the
 * sidebar for quick access. Persisted to localStorage.
 */
export const useScriptFavoritesStore = defineStore('scriptFavorites', {
    state: () => ({
        favorites: loadFavorites()
    }),

    actions: {
        isFavorite(scriptName) {
            return this.favorites.includes(scriptName)
        },

        toggle(scriptName) {
            if (isNull(scriptName)) {
                return
            }
            const index = this.favorites.indexOf(scriptName)
            if (index === -1) {
                this.favorites.push(scriptName)
            } else {
                this.favorites.splice(index, 1)
            }
            this._persist()
        },

        _persist() {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(this.favorites))
            } catch (e) {
                // ignore persistence failures, favorites still work in-session
            }
        }
    }
})
