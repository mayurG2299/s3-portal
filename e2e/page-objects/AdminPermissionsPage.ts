import { Page, Locator } from '@playwright/test'

export class AdminPermissionsPage {
  readonly saveButton: Locator
  readonly accessDenied: Locator

  constructor(private page: Page) {
    this.saveButton = page.getByRole('button', { name: /save/i })
    this.accessDenied = page.getByText(/access denied|forbidden|not authorized/i)
  }

  async goto() { await this.page.goto('http://localhost:3000/dashboard/admin/permissions') }
}
