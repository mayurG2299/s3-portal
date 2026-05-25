import { Page, Locator } from '@playwright/test'

export class AdminIndexingPage {
  readonly pauseButton: Locator
  readonly resumeButton: Locator
  readonly retryButton: Locator

  constructor(private page: Page) {
    this.pauseButton = page.getByRole('button', { name: /pause/i })
    this.resumeButton = page.getByRole('button', { name: /resume/i })
    this.retryButton = page.getByRole('button', { name: /retry/i })
  }

  async goto() { await this.page.goto('/dashboard/admin/indexing') }
}
