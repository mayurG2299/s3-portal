import { Page, Locator } from '@playwright/test'

export class RegisterPage {
  readonly emailInput: Locator
  readonly passwordInput: Locator
  readonly submitButton: Locator
  readonly errorMessage: Locator

  constructor(private page: Page) {
    this.emailInput = page.getByLabel(/email/i)
    this.passwordInput = page.getByLabel(/password/i)
    this.submitButton = page.getByRole('button', { name: /register|sign up|create account/i })
    this.errorMessage = page.getByRole('alert').or(page.locator('[data-error]'))
  }

  async goto() { await this.page.goto('/register') }

  async register(email: string, password: string) {
    await this.emailInput.fill(email)
    await this.passwordInput.fill(password)
    await this.submitButton.click()
  }
}
