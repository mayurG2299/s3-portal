import { Page, Locator } from '@playwright/test'

export class CredentialsPage {
  readonly addButton: Locator
  readonly editButton: Locator
  readonly deleteButton: Locator

  constructor(private page: Page) {
    this.addButton = page.getByRole('button', { name: /add|new|create credential/i })
    this.editButton = page.getByRole('button', { name: /edit/i })
    this.deleteButton = page.getByRole('button', { name: /delete/i })
  }

  async goto() { await this.page.goto('/dashboard/credentials') }
}
