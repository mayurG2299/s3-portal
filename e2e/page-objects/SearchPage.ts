import { Page, Locator } from '@playwright/test'

export class SearchPage {
  readonly searchInput: Locator
  readonly searchButton: Locator
  readonly results: Locator
  readonly rateLimitError: Locator

  constructor(private page: Page) {
    this.searchInput = page.getByPlaceholder(/search|query/i)
      .or(page.getByRole('searchbox'))
      .or(page.getByLabel(/search/i))
    this.searchButton = page.getByRole('button', { name: /search|find/i })
    this.results = page.locator('[data-testid="search-results"]')
      .or(page.getByRole('list'))
    this.rateLimitError = page.getByText(/rate limit|too many requests|slow down/i)
  }

  async goto() { await this.page.goto('http://localhost:3000/dashboard/search') }

  async search(query: string) {
    await this.searchInput.fill(query)
    // Try to submit via button, fallback to Enter key
    if (await this.searchButton.isVisible().catch(() => false)) {
      await this.searchButton.click()
    } else {
      await this.searchInput.press('Enter')
    }
  }
}
