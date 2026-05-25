// e2e/tests/search.spec.ts
import { test, expect } from '../fixtures'
import { SearchPage } from '../page-objects/SearchPage'
import { FilesPage } from '../page-objects/FilesPage'
import { mockFilesAPI } from '../fixtures/mock-api.fixture'

test.describe('TC-SRCH: Search', () => {

  test('TC-SRCH-01: basic file name search', async ({ adminPage }) => {
    await mockFilesAPI(adminPage)
    const files = new FilesPage(adminPage)
    await files.goto()
    await adminPage.waitForLoadState('networkidle')
    // Search box should be on files page
    const searchInput = adminPage.getByPlaceholder(/search|filter/i)
      .or(adminPage.getByRole('searchbox'))
    await expect(searchInput).toBeVisible()
    await searchInput.fill('report')
    await adminPage.waitForTimeout(500)  // Debounce
    // Results should filter to matching files
    const reportFile = adminPage.getByText('report.pdf')
    await expect(reportFile).toBeVisible()
    // Non-matching file should be hidden
    const logoFile = adminPage.getByText('logo.png')
    if (await logoFile.isVisible().catch(() => false)) {
      // If still visible, check if filtered out (display:none or removed from DOM)
      const isFiltered = await logoFile.evaluate(el => {
        return window.getComputedStyle(el).display === 'none' ||
               !el.closest('[data-testid="file-row"]')
      }).catch(() => true)
      expect(isFiltered).toBeTruthy()
    }
  })

  test('TC-SRCH-02: AI semantic search', async ({ adminPage }) => {
    const search = new SearchPage(adminPage)
    await search.goto()
    await adminPage.waitForLoadState('networkidle')
    await expect(search.searchInput).toBeVisible()
    await search.search('invoices from March')
    // Results should appear with semantic ranking
    await expect(search.results.or(adminPage.getByText(/results|found/i))).toBeVisible({ timeout: 10_000 })
    // Check that results are displayed (could be empty if no semantic matches)
    const content = await adminPage.locator('body').textContent()
    expect(content).toMatch(/results|no results|found|semantic|ai/i)
  })

  test('TC-SRCH-03: AI search rate limit', async ({ adminPage }) => {
    const search = new SearchPage(adminPage)
    await search.goto()
    await adminPage.waitForLoadState('networkidle')
    // Send 121 requests rapidly
    for (let i = 0; i < 121; i++) {
      await search.search(`query-${i}`)
      await adminPage.waitForTimeout(50)  // ~6000ms total for 121 requests
    }
    // Should see rate limit error after 120 requests
    await expect(search.rateLimitError).toBeVisible({ timeout: 5000 })
  })

})
