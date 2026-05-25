import { Page, Locator } from '@playwright/test'

export class LinksPage {
  readonly createButton: Locator

  constructor(private page: Page) {
    this.createButton = page.getByRole('button', { name: /create|new link|share/i })
  }

  async goto() { await this.page.goto('/dashboard/links') }
}
