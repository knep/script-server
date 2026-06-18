/**
 * Light/dark theme management.
 *
 * Keeps two things in sync:
 *  - the `theme-dark` class on <html>, which switches the custom CSS variables
 *    defined in assets/css/shared.css
 *  - the active Vuetify theme (scriptServer / scriptServerDark)
 *
 * The preference is persisted in localStorage; when none is stored the OS
 * `prefers-color-scheme` is used.
 */
import vuetify from '@/common/vuetifyPlugin'

const STORAGE_KEY = 'script_server_theme'

function prefersDark() {
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
}

export function getStoredTheme() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored === 'dark' || stored === 'light') {
            return stored
        }
    } catch (e) {
        // localStorage may be unavailable (private mode, blocked) — fall through
    }
    return null
}

export function isDarkActive() {
    return document.documentElement.classList.contains('theme-dark')
}

export function applyTheme(name) {
    const dark = name === 'dark'
    document.documentElement.classList.toggle('theme-dark', dark)
    vuetify.theme.global.name.value = dark ? 'scriptServerDark' : 'scriptServer'
}

export function initTheme() {
    applyTheme(getStoredTheme() || (prefersDark() ? 'dark' : 'light'))
}

export function toggleTheme() {
    const next = isDarkActive() ? 'light' : 'dark'
    try {
        localStorage.setItem(STORAGE_KEY, next)
    } catch (e) {
        // ignore persistence failures, the in-page toggle still applies
    }
    applyTheme(next)
    return next
}
