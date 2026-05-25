import { Page, Locator } from '@playwright/test'

export class SharePage {
  readonly passwordInput: Locator
  readonly submitPassword: Locator
  readonly downloadButton: Locator
  readonly expiredMessage: Locator
  readonly deniedMessage: Locator
  readonly limitMessage: Locator

  constructor(private page: Page) {
    this.passwordInput = page.getByLabel(/password/i)
    this.submitPassword = page.getByRole('button', { name: /submit|unlock|access/i })
    this.downloadButton = page.getByRole('button', { name: /download/i })
    this.expiredMessage = page.getByText(/expired|no longer valid|not available/i)
    this.deniedMessage = page.getByText(/denied|incorrect password|wrong password/i)
    this.limitMessage = page.getByText(/limit|maximum downloads/i)
  }

  async goto(hash: string) { await this.page.goto(`/share/${hash}`) }
}
