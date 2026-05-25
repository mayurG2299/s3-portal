import { Page, Locator } from '@playwright/test'

export class SettingsPage {
  readonly aiCredentialsSection: Locator
  readonly testConnectionButton: Locator
  readonly saveButton: Locator
  readonly successMessage: Locator

  constructor(private page: Page) {
    this.aiCredentialsSection = page.getByText(/ai|openai|credentials/i)
    this.testConnectionButton = page.getByRole('button', { name: /test|verify/i })
    this.saveButton = page.getByRole('button', { name: /save/i })
    this.successMessage = page.getByText(/success|saved|connected/i)
  }

  async goto() { await this.page.goto('http://localhost:3000/dashboard/settings') }
}
