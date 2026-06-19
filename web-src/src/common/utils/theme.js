/**
 * Light/dark theme management.
 *
 * Keeps two things in sync:
 *  - the `theme-dark` class on <html>, which switches the custom CSS variables
 *    defined in assets/css/shared.css
 *  - the active Vuetify theme (scriptServer / scriptServerDark), when an app
 *    has registered one via registerVuetifyTheme()
 *
 * Vuetify is injected rather than imported so the (Vuetify-less) login page can
 * reuse this module — and respect the same preference — without bundling it.
 *
 * The preference is persisted in localStorage; when none is stored the OS
 * `prefers-color-scheme` is used.
 */

const STORAGE_KEY = 'script_server_theme'

// vuetify.theme.global, set by apps that use Vuetify (main, admin). Left null
// on the login page, where only the <html> class needs toggling.
let vuetifyTheme = null

export function registerVuetifyTheme(themeGlobal) {
    vuetifyTheme = themeGlobal
}

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
    if (vuetifyTheme) {
        vuetifyTheme.name.value = dark ? 'scriptServerDark' : 'scriptServer'
    }
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
