import { Page, Locator } from '@playwright/test'

export class FilesPage {
  readonly uploadButton: Locator
  readonly emptyState: Locator
  readonly breadcrumb: Locator

  constructor(private page: Page) {
    this.uploadButton = page.getByRole('button', { name: /upload/i })
    this.emptyState = page.getByText(/no files|empty|upload your first/i)
    this.breadcrumb = page.locator('[aria-label="breadcrumb"], [data-testid="breadcrumb"]')
  }

  async goto() { await this.page.goto('/dashboard/files') }

  async openFileMenu(name: string) {
    const row = this.page.locator(`[data-testid="file-row"]:has-text("${name}")`)
    await row.hover()
    await row.getByRole('button', { name: /more|options|menu/i }).click()
  }
}
