import { Page, Locator } from '@playwright/test'

export class ProfilePage {
  readonly currentPasswordInput: Locator
  readonly newPasswordInput: Locator
  readonly savePasswordButton: Locator
  readonly deleteAccountButton: Locator
  readonly successMessage: Locator
  readonly errorMessage: Locator

  constructor(private page: Page) {
    this.currentPasswordInput = page.getByLabel(/current password/i)
    this.newPasswordInput = page.getByLabel(/new password/i)
    this.savePasswordButton = page.getByRole('button', { name: /save|update password|change password/i })
    this.deleteAccountButton = page.getByRole('button', { name: /delete account/i })
    this.successMessage = page.getByText(/updated|changed|success/i)
    this.errorMessage = page.getByRole('alert').or(page.getByText(/error|invalid|weak/i))
  }

  async goto() { await this.page.goto('/dashboard/profile') }
}
