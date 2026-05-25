import { Page, Locator } from '@playwright/test'

export class InvitationsPage {
  readonly invitationCards: Locator
  readonly acceptButton: Locator
  readonly declineButton: Locator

  constructor(private page: Page) {
    this.invitationCards = page.locator('[data-testid="invitation-card"]').or(page.getByText(/pending invitation/i))
    this.acceptButton = page.getByRole('button', { name: /accept/i })
    this.declineButton = page.getByRole('button', { name: /decline|reject/i })
  }

  async goto() { await this.page.goto('/dashboard/invitations') }
}
