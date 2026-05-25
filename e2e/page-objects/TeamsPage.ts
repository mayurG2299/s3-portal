import { Page, Locator } from '@playwright/test'

export class TeamsPage {
  readonly inviteButton: Locator
  readonly teamNameInput: Locator

  constructor(private page: Page) {
    this.inviteButton = page.getByRole('button', { name: /invite/i })
    this.teamNameInput = page.getByLabel(/team name/i)
  }

  async goto() { await this.page.goto('/dashboard/teams') }
}
