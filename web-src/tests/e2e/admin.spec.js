import {expect, test} from '@playwright/test'

// Admin app boot: second Vue application (own router + store). Covers the
// admin mount path verified manually after the Vue 3 migration.

test.describe('Admin app', () => {

    test('loads with Logs/Scripts tabs and defaults to logs', async ({page}) => {
        await page.goto('/admin.html')

        await expect(page.locator('.admin-page')).toBeVisible()
        await expect(page).toHaveURL(/#\/logs$/)
        await expect(page.locator('.v-tab', {hasText: 'Logs'})).toBeVisible()
        await expect(page.locator('.v-tab', {hasText: 'Scripts'})).toBeVisible()
    })

    test('scripts tab lists configured scripts with an Add button', async ({page}) => {
        await page.goto('/admin.html#/scripts')

        await expect(page.locator('.add-script-btn')).toBeVisible()
        await expect(page.locator('.v-list-item', {hasText: 'E2E Echo'})).toBeVisible()
    })

    test('clicking a script opens its config (not the execution log)', async ({page}) => {
        // Regression: the script list-link path was relative ("E2E%20Echo"),
        // so Vue Router resolved it as "/E2E%20Echo", matched the wildcard
        // route and redirected to /logs instead of the script config.
        await page.goto('/admin.html#/scripts')

        await page.locator('.v-list-item', {hasText: 'E2E Echo'}).click()

        await expect(page).toHaveURL(/#\/scripts\/E2E%20Echo$/)
        await expect(page.locator('.script-config')).toBeVisible()
    })

    test('script editor loads code for a script with a working_directory', async ({page}) => {
        // Regression: the code endpoint must resolve a bare script filename
        // ("python3 e2e_echo.py") against the configured working_directory.
        // Previously this raised "Failed to find script path in command".
        await page.goto('/admin.html#/scripts/' + encodeURIComponent('E2E Echo'))

        const codeResponse = page.waitForResponse(resp =>
            resp.url().includes('/admin/scripts/' + encodeURIComponent('E2E Echo') + '/code'))

        await page.locator('.open-dialog-button').click()

        const response = await codeResponse
        expect(response.status()).toBe(200)

        const body = await response.json()
        expect(body.code).toContain('e2e: started')
        expect(body.code_edit_error ?? null).toBeNull()
    })
})
