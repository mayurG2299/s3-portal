import { Page, Locator } from '@playwright/test'

export class AdminAuditPage {
  readonly logRows: Locator
  readonly accessDenied: Locator

  constructor(private page: Page) {
    this.logRows = page.locator('[data-testid="audit-row"]').or(page.locator('table tbody tr'))
    this.accessDenied = page.getByText(/access denied|permission|forbidden|not authorized/i)
  }

  async goto() { await this.page.goto('http://localhost:3000/dashboard/admin/audit') }
}
